// Operator (admin) keys for the read-only dashboard (v0.12). Separate from
// host keys: a host key can never open the dashboard and vice versa. The
// server stores only SHA-256 digests, in the ADMIN_KEY_HASHES secret.
//
// Format: ADM-XXXX-XXXX-XXXX-XXXX-XXXX (20 characters without 0/1/I/O, about
// 100 bits). Like host keys, it may be typed with or without the prefix and
// hyphens; the digest is taken over the canonical form.
const BODY_PATTERN = /^[2-9A-HJ-NP-Z]{20}$/;
const HYPHENATED_PATTERN = /^(?:ADM-)?(?:[2-9A-HJ-NP-Z]{4}-){4}[2-9A-HJ-NP-Z]{4}$/;
const MAX_KEY_LENGTH = 128;
const MAX_CONFIGURATION_LENGTH = 4096;
const MAX_CONFIGURED_HASHES = 16;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function equalDigest(left: string, right: string): boolean {
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export function canonicalAdminKey(value: string): string | null {
  const typed = value.trim().toUpperCase();
  let body: string;
  if (HYPHENATED_PATTERN.test(typed)) body = typed.replace(/^ADM-/, "").replaceAll("-", "");
  else if (!typed.includes("-")) body = typed.length === 23 && typed.startsWith("ADM") ? typed.slice(3) : typed;
  else return null;
  if (!BODY_PATTERN.test(body)) return null;
  return `ADM-${body.match(/.{4}/g)!.join("-")}`;
}

/** Number of usable digests in the configuration, or 0 when it is unusable. */
export function configuredAdminKeys(configuration: unknown): number {
  if (typeof configuration !== "string" || configuration.length > MAX_CONFIGURATION_LENGTH) return 0;
  const hashes = configuration.split(/[\s,]+/).filter(hash => /^[a-f0-9]{64}$/i.test(hash));
  return hashes.length <= MAX_CONFIGURED_HASHES ? hashes.length : 0;
}

/** null: dashboard not configured; false: wrong or malformed key; true: authorized. */
export async function verifyAdminKey(value: unknown, configuration: unknown): Promise<boolean | null> {
  if (!configuredAdminKeys(configuration)) return null;
  const hashes = (configuration as string).split(/[\s,]+/).map(hash => hash.toLowerCase()).filter(hash => /^[a-f0-9]{64}$/.test(hash));
  if (typeof value !== "string" || value.length > MAX_KEY_LENGTH) return false;
  const key = canonicalAdminKey(value);
  if (!key) return false;
  const digest = await sha256(key);
  let matched = false;
  for (const hash of hashes) matched = equalDigest(digest, hash) || matched;
  return matched;
}
