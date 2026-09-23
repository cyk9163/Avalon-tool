// Structured, single-line JSON logs. Workers Logs (observability.enabled in
// wrangler.jsonc) indexes these fields so an incident can be traced by
// requestId without ever logging cookies, host keys, recovery codes, roles or
// raw room codes.

export type LogLevel = "info" | "warn" | "error";
export type LogFields = Record<string, string | number | boolean | null | undefined>;

export function log(level: LogLevel, event: string, fields: LogFields = {}): void {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

/** A short pseudonymous room reference for correlating log lines. */
export async function roomRef(code: unknown): Promise<string | null> {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return null;
  return (await sha256Hex(`room:${code}`)).slice(0, 12);
}

export function newRequestId(): string {
  return crypto.randomUUID();
}
