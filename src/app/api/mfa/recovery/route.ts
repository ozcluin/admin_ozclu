import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole, isErrorResponse } from "src/lib/apiAuth";
import { connectToDatabase } from "src/lib/mongodb";
import { logAuditEvent, getClientIp, getUserAgent } from "shared/audit";
import { checkRateLimit, RATE_LIMITS } from "shared/rateLimit";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isErrorResponse(authResult)) return authResult;
    const { user } = authResult;

    const roleError = requireRole(user, ["admin"]);
    if (roleError) return roleError;

    const { db } = await connectToDatabase();
    const ip = getClientIp(req);
    const ua = getUserAgent(req);

    // Strict rate limit: 3 per 15 min
    const rlKey = `mfa_recovery:${ip}:${user.email}`;
    const rl = await checkRateLimit(db, rlKey, RATE_LIMITS.MFA_RECOVERY.maxAttempts, RATE_LIMITS.MFA_RECOVERY.windowMs);
    if (!rl.allowed) {
      await logAuditEvent(db, {
        actorUserId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        portal: "admin",
        action: "rate_limit_hit",
        targetType: "mfa_recovery",
        outcome: "failure",
        reason: "Rate limit exceeded for recovery code usage",
        ip,
        userAgent: ua,
      });
      return NextResponse.json(
        { error: "Too many recovery attempts. Please wait before trying again." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } }
      );
    }

    const body = await req.json();
    const { recoveryCode } = body;

    if (!recoveryCode || typeof recoveryCode !== "string") {
      return NextResponse.json({ error: "Recovery code is required." }, { status: 400 });
    }

    const adminUser = await db.collection("users").findOne({ email: user.email.toLowerCase().trim() });
    if (!adminUser || !adminUser.mfaEnabled || !adminUser.recoveryCodesHashed) {
      return NextResponse.json({ error: "MFA is not configured or no recovery codes available." }, { status: 400 });
    }

    // Hash the submitted recovery code and check against stored hashes
    const submittedHash = crypto
      .createHash("sha256")
      .update(recoveryCode.toUpperCase().trim())
      .digest("hex");

    const matchIndex = adminUser.recoveryCodesHashed.findIndex(
      (h: string) => h === submittedHash
    );

    if (matchIndex === -1) {
      await logAuditEvent(db, {
        actorUserId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        portal: "admin",
        action: "mfa_recovery_used",
        outcome: "failure",
        reason: "Invalid recovery code",
        ip,
        userAgent: ua,
      });
      return NextResponse.json({ error: "Invalid recovery code." }, { status: 400 });
    }

    // Consume the recovery code (one-time use)
    const updatedCodes = [...adminUser.recoveryCodesHashed];
    updatedCodes.splice(matchIndex, 1);

    await db.collection("users").updateOne(
      { email: user.email.toLowerCase().trim() },
      {
        $set: {
          recoveryCodesHashed: updatedCodes,
          recoveryCodesCount: updatedCodes.length,
        },
      }
    );

    await logAuditEvent(db, {
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      portal: "admin",
      action: "mfa_recovery_used",
      outcome: "success",
      metadata: { remainingCodes: updatedCodes.length },
      ip,
      userAgent: ua,
    });

    return NextResponse.json({
      success: true,
      mfaVerified: true,
      remainingRecoveryCodes: updatedCodes.length,
    });
  } catch (error: any) {
    console.error("[MFA] Recovery error:", error.message);
    return NextResponse.json({ error: "Recovery code verification failed" }, { status: 500 });
  }
}
