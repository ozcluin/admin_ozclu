import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole, isErrorResponse } from "src/lib/apiAuth";
import { connectToDatabase } from "src/lib/mongodb";
import { encrypt } from "shared/encryption";
import { logAuditEvent, getClientIp, getUserAgent } from "shared/audit";
import { checkRateLimit, RATE_LIMITS } from "shared/rateLimit";
import * as OTPAuth from "otpauth";

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

    // Rate limit enrollment
    const rlKey = `mfa_enroll:${user.id}`;
    const rl = await checkRateLimit(db, rlKey, RATE_LIMITS.MFA_ENROLL.maxAttempts, RATE_LIMITS.MFA_ENROLL.windowMs);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } }
      );
    }

    // Check if already enrolled
    const adminUser = await db.collection("users").findOne({ email: user.email.toLowerCase().trim() });
    if (adminUser?.mfaEnabled) {
      return NextResponse.json({ error: "MFA is already enabled for this account." }, { status: 400 });
    }

    // Generate TOTP secret
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: "Cluso Infolink Admin",
      label: user.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret,
    });

    const otpauthUri = totp.toString();
    const secretBase32 = secret.base32;

    // Encrypt and store the pending secret temporarily
    const encryptedSecret = encrypt(secretBase32);
    await db.collection("users").updateOne(
      { email: user.email.toLowerCase().trim() },
      {
        $set: {
          mfaPendingSecret: encryptedSecret,
          mfaPendingSecretAt: new Date(),
        },
      }
    );

    await logAuditEvent(db, {
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      portal: "admin",
      action: "mfa_enroll_start",
      outcome: "success",
      ip,
      userAgent: ua,
    });

    return NextResponse.json({
      otpauthUri,
      secretBase32, // Shown to user for manual entry — only during enrollment
    });
  } catch (error: any) {
    console.error("[MFA] Enrollment error:", error.message);
    return NextResponse.json({ error: "Failed to start MFA enrollment" }, { status: 500 });
  }
}
