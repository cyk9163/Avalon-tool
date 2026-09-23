// Imported only by the room API. Raw keys must never enter stored room state.
// 16 characters from an alphabet without 0/1/I/O. Players may type them with
// or without the "AVL" prefix and the hyphens; the digest is always taken over
// the canonical AVL-XXXX-XXXX-XXXX-XXXX form, so published digests never change.
const KEY_BODY_PATTERN = /^[2-9A-HJ-NP-Z]{16}$/;
const HYPHENATED_PATTERN = /^(?:AVL-)?(?:[2-9A-HJ-NP-Z]{4}-){3}[2-9A-HJ-NP-Z]{4}$/;
const MAX_KEY_LENGTH = 128;
const MAX_CONFIGURATION_LENGTH = 8192;
const MAX_CONFIGURED_HASHES = 64;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function equalDigest(left: string, right: string): boolean {
  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

/**
 * Canonical AVL-XXXX-XXXX-XXXX-XXXX form of a typed key, or null. Accepts the
 * full hyphenated key, the four groups without the prefix, or the 16
 * characters run together (optionally prefixed with AVL), in any case.
 */
export function canonicalHostKey(value: string): string | null {
  const typed = value.trim().toUpperCase();
  let body: string;
  if (HYPHENATED_PATTERN.test(typed)) body = typed.replace(/^AVL-/, "").replaceAll("-", "");
  else if (!typed.includes("-")) body = typed.length === 19 && typed.startsWith("AVL") ? typed.slice(3) : typed;
  else return null;
  if (!KEY_BODY_PATTERN.test(body)) return null;
  return `AVL-${body.match(/.{4}/g)!.join("-")}`;
}

/** null means the server has no usable configuration; false means an invalid key. */
export async function verifyHostKey(value: unknown, configuration: unknown): Promise<boolean | null> {
  if (typeof configuration !== "string" || configuration.length > MAX_CONFIGURATION_LENGTH) return null;
  const hashes = configuration.split(/[\s,]+/).map(hash => hash.toLowerCase())
    .filter(hash => /^[a-f0-9]{64}$/.test(hash));
  if (!hashes.length || hashes.length > MAX_CONFIGURED_HASHES) return null;
  if (typeof value !== "string" || value.length > MAX_KEY_LENGTH) return false;
  const key = canonicalHostKey(value);
  if (!key) return false;

  const digest = await sha256(key);
  let matched = false;
  // Compare every configured fixed-length digest, including after a match.
  for (const hash of hashes) matched = equalDigest(digest, hash) || matched;
  return matched;
}
