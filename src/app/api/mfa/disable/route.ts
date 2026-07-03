import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole, requireMfaVerified, isErrorResponse } from "src/lib/apiAuth";
import { connectToDatabase } from "src/lib/mongodb";
import { decrypt, isEncryptedValue } from "shared/encryption";
import { logAuditEvent, getClientIp, getUserAgent } from "shared/audit";
import { checkRateLimit, RATE_LIMITS } from "shared/rateLimit";
import * as OTPAuth from "otpauth";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isErrorResponse(authResult)) return authResult;
    const { user } = authResult;

    const roleError = requireRole(user, ["admin"]);
    if (roleError) return roleError;

    // Disabling MFA requires a fully verified MFA session first
    const mfaError = requireMfaVerified(user);
    if (mfaError) return mfaError;

    const { db } = await connectToDatabase();
    const ip = getClientIp(req);
    const ua = getUserAgent(req);

    // Rate limit: 5 attempts per 5 minutes
    const rlKey = `mfa_disable:${ip}:${user.email}`;
    const rl = await checkRateLimit(db, rlKey, RATE_LIMITS.MFA_VERIFY.maxAttempts, RATE_LIMITS.MFA_VERIFY.windowMs);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } }
      );
    }

    const body = await req.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Code or recovery code is required to disable MFA." }, { status: 400 });
    }

    const adminUser = await db.collection("users").findOne({ email: user.email.toLowerCase().trim() });
    if (!adminUser || !adminUser.mfaEnabled) {
      return NextResponse.json({ error: "MFA is not enabled on this account." }, { status: 400 });
    }

    let isValid = false;

    // 1. Try TOTP code first
    if (code.length === 6 && /^\d+$/.test(code) && adminUser.mfaSecretEncrypted) {
      const secretBase32 = isEncryptedValue(adminUser.mfaSecretEncrypted)
        ? decrypt(adminUser.mfaSecretEncrypted)
        : adminUser.mfaSecretEncrypted;

      const totp = new OTPAuth.TOTP({
        issuer: "Ozclu Admin",
        label: user.email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secretBase32),
      });

      const delta = totp.validate({ token: code, window: 1 });
      if (delta !== null) {
        isValid = true;
      }
    }

    // 2. Try recovery code if TOTP didn't match/run
    if (!isValid && adminUser.recoveryCodesHashed) {
      const submittedHash = crypto
        .createHash("sha256")
        .update(code.toUpperCase().trim())
        .digest("hex");

      const matchIndex = adminUser.recoveryCodesHashed.findIndex(
        (h: string) => h === submittedHash
      );

      if (matchIndex !== -1) {
        isValid = true;
        // Consume the recovery code
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
      }
    }

    if (!isValid) {
      await logAuditEvent(db, {
        actorUserId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        portal: "admin",
        action: "mfa_disable",
        outcome: "failure",
        reason: "Invalid credentials submitted to disable MFA",
        ip,
        userAgent: ua,
      });
      return NextResponse.json({ error: "Invalid verification code or recovery code." }, { status: 400 });
    }

    // Disable MFA on user document
    await db.collection("users").updateOne(
      { email: user.email.toLowerCase().trim() },
      {
        $set: {
          mfaEnabled: false,
        },
        $unset: {
          mfaSecretEncrypted: "",
          mfaEnabledAt: "",
          recoveryCodesHashed: "",
          recoveryCodesCount: "",
        },
      }
    );

    await logAuditEvent(db, {
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      portal: "admin",
      action: "mfa_disable",
      outcome: "success",
      ip,
      userAgent: ua,
    });

    return NextResponse.json({
      success: true,
      mfaEnabled: false,
      mfaVerified: true, // upgraded since MFA is now off
    });
  } catch (error: any) {
    console.error("[MFA] Disable error:", error.message);
    return NextResponse.json({ error: "Failed to disable MFA" }, { status: 500 });
  }
}
