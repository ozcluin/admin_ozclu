import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole, isErrorResponse } from "src/lib/apiAuth";
import { connectToDatabase } from "src/lib/mongodb";
import { decrypt, encrypt, isEncryptedValue } from "shared/encryption";
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

    const { db } = await connectToDatabase();
    const ip = getClientIp(req);
    const ua = getUserAgent(req);

    // Rate limit
    const rlKey = `mfa_enroll:${user.id}`;
    const rl = await checkRateLimit(db, rlKey, RATE_LIMITS.MFA_ENROLL.maxAttempts, RATE_LIMITS.MFA_ENROLL.windowMs);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } }
      );
    }

    const body = await req.json();
    const { code } = body;

    if (!code || typeof code !== "string" || code.length !== 6) {
      return NextResponse.json({ error: "Invalid TOTP code. Must be 6 digits." }, { status: 400 });
    }

    const adminUser = await db.collection("users").findOne({ email: user.email.toLowerCase().trim() });
    if (!adminUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (adminUser.mfaEnabled) {
      return NextResponse.json({ error: "MFA is already enabled." }, { status: 400 });
    }

    if (!adminUser.mfaPendingSecret) {
      return NextResponse.json({ error: "No pending MFA enrollment. Start enrollment first." }, { status: 400 });
    }

    // Decrypt the pending secret
    const secretBase32 = isEncryptedValue(adminUser.mfaPendingSecret)
      ? decrypt(adminUser.mfaPendingSecret)
      : adminUser.mfaPendingSecret;

    // Verify the TOTP code
    const totp = new OTPAuth.TOTP({
      issuer: "Cluso Infolink Admin",
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
        action: "mfa_enroll_complete",
        outcome: "failure",
        reason: "Invalid TOTP code during enrollment confirmation",
        ip,
        userAgent: ua,
      });
      return NextResponse.json({ error: "Invalid TOTP code. Please try again." }, { status: 400 });
    }

    // Generate recovery codes (8 codes, 10 chars each)
    const recoveryCodes: string[] = [];
    const recoveryCodesHashed: string[] = [];
    for (let i = 0; i < 8; i++) {
      const code = crypto.randomBytes(5).toString("hex").toUpperCase();
      recoveryCodes.push(code);
      recoveryCodesHashed.push(
        crypto.createHash("sha256").update(code).digest("hex")
      );
    }

    // Finalize MFA enrollment
    const encryptedSecret = encrypt(secretBase32);
    await db.collection("users").updateOne(
      { email: user.email.toLowerCase().trim() },
      {
        $set: {
          mfaEnabled: true,
          mfaSecretEncrypted: encryptedSecret,
          mfaEnabledAt: new Date(),
          recoveryCodesHashed,
          recoveryCodesCount: recoveryCodes.length,
        },
        $unset: {
          mfaPendingSecret: "",
          mfaPendingSecretAt: "",
        },
      }
    );

    await logAuditEvent(db, {
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      portal: "admin",
      action: "mfa_enroll_complete",
      outcome: "success",
      ip,
      userAgent: ua,
    });

    // Return recovery codes — shown only once
    return NextResponse.json({
      success: true,
      recoveryCodes,
      message: "MFA enabled successfully. Save your recovery codes — they will not be shown again.",
    });
  } catch (error: any) {
    console.error("[MFA] Confirm enrollment error:", error.message);
    return NextResponse.json({ error: "Failed to confirm MFA enrollment" }, { status: 500 });
  }
}
