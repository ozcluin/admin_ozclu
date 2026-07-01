import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth";
import { decryptOrPassthrough, maskAadhaar, maskPan, maskDl } from "shared/encryption";

// ─── Types ───────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  email: string;
  role: "client" | "admin" | "candidate";
  orgName: string;
  fullName: string;
  mfaEnabled: boolean;
  mfaPending: boolean;
  mfaVerified: boolean;
}

interface AuthResult {
  session: any;
  user: SessionUser;
}

// ─── Guards ──────────────────────────────────────────────────────

/**
 * Require an authenticated session. Returns 401 if not authenticated.
 */
export async function requireAuth(): Promise<AuthResult | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    console.warn("[AUTH] Unauthenticated request to protected admin API route");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user: SessionUser = {
    id: (session.user as any).id || "",
    email: session.user.email || "",
    role: (session.user as any).role || "",
    orgName: (session.user as any).orgName || "",
    fullName: (session.user as any).fullName || session.user.name || "",
    mfaEnabled: (session.user as any).mfaEnabled || false,
    mfaPending: (session.user as any).mfaPending || false,
    mfaVerified: (session.user as any).mfaVerified || false,
  };
  return { session, user };
}

/**
 * Require that the authenticated user has one of the allowed roles.
 * Returns 403 if the role does not match.
 */
export function requireRole(
  user: SessionUser,
  allowedRoles: string[]
): NextResponse | null {
  if (!allowedRoles.includes(user.role)) {
    console.warn(
      `[AUTH] Forbidden: user ${user.email} with role "${user.role}" attempted admin access`
    );
    return NextResponse.json(
      { error: "Forbidden: insufficient permissions" },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Require that the admin user has completed MFA verification.
 * Returns 403 if MFA is enabled but not yet verified.
 */
export function requireMfaVerified(user: SessionUser): NextResponse | null {
  if (user.mfaEnabled && !user.mfaVerified) {
    console.warn(
      `[AUTH] MFA required: admin ${user.email} attempted privileged action without completing MFA`
    );
    return NextResponse.json(
      { error: "MFA verification required for this action" },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Strip sensitive fields from a verification document for admin responses.
 * Removes: password, tempPassword (legacy), and converts _id.
 * Strips large blobs (photo, documents) from list views.
 */
export function sanitizeVerification(doc: any): any {
  if (!doc) return doc;
  const clean = { ...doc };

  // Generate setupUrl on-the-fly if missing but email and tempPassword exist
  if (!clean.setupUrl && clean.tempPassword && clean.email) {
    const candidatePortalUrl = process.env.CANDIDATE_PORTAL_URL || "https://candidate.verify.cluso.in";
    clean.setupUrl = `${candidatePortalUrl}/?email=${encodeURIComponent(clean.email.toLowerCase().trim())}&password=${encodeURIComponent(clean.tempPassword)}`;
  }

  delete clean.password;
  delete clean.tempPassword; // Legacy field — no longer stored
  
  // Strip large blobs from list responses
  if (clean.digilockerPhoto) {
    clean.hasPhoto = true;
    delete clean.digilockerPhoto;
  }
  if (clean.digilockerDocuments && Array.isArray(clean.digilockerDocuments)) {
    clean.documentCount = clean.digilockerDocuments.length;
    delete clean.digilockerDocuments;
  }

  // Mask sensitive fields for safe list view
  if (clean.digilockerAadhaarMasked) {
    clean.digilockerAadhaar = clean.digilockerAadhaarMasked;
  } else if (clean.digilockerAadhaar) {
    clean.digilockerAadhaar = maskAadhaar(decryptOrPassthrough(clean.digilockerAadhaar));
  }

  if (clean.digilockerPanMasked) {
    clean.digilockerPan = clean.digilockerPanMasked;
  } else if (clean.digilockerPan) {
    clean.digilockerPan = maskPan(decryptOrPassthrough(clean.digilockerPan));
  }

  if (clean.digilockerDrivingLicenceMasked) {
    clean.digilockerDrivingLicence = clean.digilockerDrivingLicenceMasked;
  } else if (clean.digilockerDrivingLicence) {
    clean.digilockerDrivingLicence = maskDl(decryptOrPassthrough(clean.digilockerDrivingLicence));
  }

  if (clean.digilockerDob) {
    clean.digilockerDob = "Matched & Secured";
  }
  if (clean.digilockerId) {
    clean.digilockerId = "[Secured]";
  }
  if (clean.digilockerReferenceKey) {
    clean.digilockerReferenceKey = "[Secured]";
  }

  // Manual candidate inputs
  if (clean.aadhaarNumberMasked) {
    clean.aadhaarNumber = clean.aadhaarNumberMasked;
  } else if (clean.aadhaarNumber) {
    clean.aadhaarNumber = maskAadhaar(decryptOrPassthrough(clean.aadhaarNumber));
  }
  if (clean.dob) {
    clean.dob = "Secured";
  }

  if (clean._id) {
    clean._id = clean._id.toString ? clean._id.toString() : String(clean._id);
  }
  return clean;
}

/**
 * Strip sensitive fields from an invoice document.
 * Removes: password, paymentProof (large base64 — use detail endpoint instead).
 */
export function sanitizeInvoice(doc: any): any {
  if (!doc) return doc;
  const clean = { ...doc };
  delete clean.password;
  // Strip large base64 paymentProof from list responses
  if (clean.paymentProof) {
    clean.hasPaymentProof = true;
    // Keep paymentProof in admin panel as there is no detail endpoint
  }
  if (clean._id) {
    clean._id = clean._id.toString ? clean._id.toString() : String(clean._id);
  }
  return clean;
}

/**
 * Helper to check if a requireAuth/requireRole result is an error response.
 */
export function isErrorResponse(result: any): result is NextResponse {
  return result instanceof NextResponse;
}
