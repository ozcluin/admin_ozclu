import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole, isErrorResponse } from "src/lib/apiAuth";
import { connectToDatabase } from "src/lib/mongodb";
import { decrypt, isEncryptedValue } from "shared/encryption";
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

    // MFA verify is specifically for admins with mfaPending — no requireMfaVerified check here
    const { db } = await connectToDatabase();
    const ip = getClientIp(req);
    const ua = getUserAgent(req);

    // Rate limit: 5 per 5 min
    const rlKey = `mfa_verify:${ip}:${user.email}`;
    const rl = await checkRateLimit(db, rlKey, RATE_LIMITS.MFA_VERIFY.maxAttempts, RATE_LIMITS.MFA_VERIFY.windowMs);
    if (!rl.allowed) {
      await logAuditEvent(db, {
        actorUserId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        portal: "admin",
        action: "rate_limit_hit",
        targetType: "mfa_verify",
        outcome: "failure",
        reason: "Rate limit exceeded for MFA verification",
        ip,
        userAgent: ua,
      });
      return NextResponse.json(
        { error: "Too many attempts. Please wait before trying again." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } }
      );
    }

    const body = await req.json();
    const { code } = body;

    if (!code || typeof code !== "string" || code.length !== 6) {
      return NextResponse.json({ error: "Invalid code format. Must be 6 digits." }, { status: 400 });
    }

    const adminUser = await db.collection("users").findOne({ email: user.email.toLowerCase().trim() });
    if (!adminUser || !adminUser.mfaEnabled || !adminUser.mfaSecretEncrypted) {
      return NextResponse.json({ error: "MFA is not configured for this account." }, { status: 400 });
    }

    // Decrypt the secret
    const secretBase32 = isEncryptedValue(adminUser.mfaSecretEncrypted)
      ? decrypt(adminUser.mfaSecretEncrypted)
      : adminUser.mfaSecretEncrypted;

    // Verify TOTP
    const totp = new OTPAuth.TOTP({
      issuer: "Ozclu Admin",
      label: user.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secretBase32),
    });

    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) {
      await logAuditEvent(db, {
        actorUserId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        portal: "admin",
        action: "mfa_verify_failure",
        outcome: "failure",
        reason: "Invalid TOTP code",
        ip,
        userAgent: ua,
      });
      return NextResponse.json({ error: "Invalid verification code." }, { status: 400 });
    }

    // MFA verified successfully
    await logAuditEvent(db, {
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      portal: "admin",
      action: "mfa_verify_success",
      outcome: "success",
      ip,
      userAgent: ua,
    });

    // Return success — the frontend will call session update to set mfaVerified=true
    return NextResponse.json({
      success: true,
      mfaVerified: true,
    });
  } catch (error: any) {
    console.error("[MFA] Verify error:", error.message);
    return NextResponse.json({ error: "MFA verification failed" }, { status: 500 });
  }
}
