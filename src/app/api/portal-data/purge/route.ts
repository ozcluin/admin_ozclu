import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  requireRole,
  requireMfaVerified,
  isErrorResponse,
} from "src/lib/apiAuth";
import { connectToDatabase } from "src/lib/mongodb";
import { getClientIp, getUserAgent, logAuditEvent } from "shared/audit";
import { checkRateLimit, RATE_LIMITS } from "shared/rateLimit";
import { purgeDeleted } from "shared/softDelete";

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const authResult = await requireAuth();
    if (isErrorResponse(authResult)) return authResult;
    const { user } = authResult;

    const roleError = requireRole(user, ["admin"]);
    if (roleError) return roleError;

    // 2. MFA check
    const mfaError = requireMfaVerified(user);
    if (mfaError) return mfaError;

    const { db } = await connectToDatabase();
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);

    // 3. Rate Limit check
    const rateLimitKey = `purge:${ip}:${user.id}`;
    // Using PASSWORD_CHANGE rate limit preset (5 per 15 min) for purge safety
    const limitCheck = await checkRateLimit(db, rateLimitKey, RATE_LIMITS.PASSWORD_CHANGE.maxAttempts, RATE_LIMITS.PASSWORD_CHANGE.windowMs);
    if (!limitCheck.allowed) {
      await logAuditEvent(db, {
        actorUserId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        portal: "admin",
        action: "rate_limit_hit",
        outcome: "failure",
        reason: "Purge endpoint rate limit exceeded",
        ip,
        userAgent,
      });
      return NextResponse.json(
        { error: "Too many purge attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil((limitCheck.retryAfterMs || 0) / 1000).toString(),
          },
        }
      );
    }

    // 4. Request validation
    const { deletionReason } = await req.json();
    if (!deletionReason) {
      return NextResponse.json({ error: "deletionReason is required to execute a database purge" }, { status: 400 });
    }

    // 5. Execute Purge
    const deletedOrgs = await purgeDeleted(db, "organisations");
    const deletedVerifiers = await purgeDeleted(db, "verifiers");
    const deletedInvoices = await purgeDeleted(db, "invoices");
    const deletedUsers = await purgeDeleted(db, "users");
    const deletedVerifications = await purgeDeleted(db, "verifications");

    const totalPurged = deletedOrgs + deletedVerifiers + deletedInvoices + deletedUsers + deletedVerifications;

    // 6. Audit logging
    await logAuditEvent(db, {
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      portal: "admin",
      action: "purge_executed",
      outcome: "success",
      reason: deletionReason,
      ip,
      userAgent,
      metadata: {
        deletedOrgs,
        deletedVerifiers,
        deletedInvoices,
        deletedUsers,
        deletedVerifications,
        totalPurged,
      },
    });

    return NextResponse.json({
      success: true,
      purged: {
        organisations: deletedOrgs,
        verifiers: deletedVerifiers,
        invoices: deletedInvoices,
        users: deletedUsers,
        verifications: deletedVerifications,
        total: totalPurged,
      },
    });
  } catch (error: any) {
    console.error("[PURGE] Error executing database purge:", error.message);
    return NextResponse.json({ error: "Internal server error during purge" }, { status: 500 });
  }
}
