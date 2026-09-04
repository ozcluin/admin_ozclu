/**
 * API Key Generation, Hashing & Validation Utilities
 * 
 * Shared between admin-verify and client-verify portals.
 * Key format: sk_live_<32-char-hex>
 * Only the SHA-256 hash is stored; plaintext is shown once at creation.
 */

import { createHash, randomBytes } from "crypto";

const KEY_PREFIX = "sk_live_";
const KEY_HEX_LENGTH = 32; // 32 hex chars = 16 bytes of entropy

export interface GeneratedApiKey {
  /** Full plaintext key — show to user ONCE, never store */
  fullKey: string;
  /** SHA-256 hash of the full key — stored in DB */
  keyHash: string;
  /** Last 4 characters of the hex portion — for display identification */
  keySuffix: string;
  /** The prefix used */
  keyPrefix: string;
}

/**
 * Generate a new API key with its hash and suffix.
 * The plaintext `fullKey` must be shown to the user once and never stored.
 */
export function generateApiKey(): GeneratedApiKey {
  const hexPart = randomBytes(KEY_HEX_LENGTH / 2).toString("hex"); // 16 bytes → 32 hex chars
  const fullKey = `${KEY_PREFIX}${hexPart}`;
  const keyHash = hashApiKey(fullKey);
  const keySuffix = hexPart.slice(-4);

  return { fullKey, keyHash, keySuffix, keyPrefix: KEY_PREFIX };
}

/**
 * Hash an API key using SHA-256.
 * Used both at generation time (to store) and at request time (to look up).
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Validate that a string matches the expected API key format.
 */
export function validateKeyFormat(key: string): boolean {
  if (!key || typeof key !== "string") return false;
  if (!key.startsWith(KEY_PREFIX)) return false;
  const hexPart = key.slice(KEY_PREFIX.length);
  if (hexPart.length !== KEY_HEX_LENGTH) return false;
  return /^[0-9a-f]+$/.test(hexPart);
}

/**
 * Extract the bearer token from an Authorization header value.
 * Supports: "Bearer sk_live_xxx" and "sk_live_xxx"
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const trimmed = authHeader.trim();
  if (trimmed.startsWith("Bearer ")) {
    return trimmed.slice(7).trim();
  }
  // Allow raw key without "Bearer " prefix
  if (trimmed.startsWith(KEY_PREFIX)) {
    return trimmed;
  }
  return null;
}
