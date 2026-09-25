// Account sessions live in an HttpOnly cookie so a phone stays signed in.
import { env } from "cloudflare:workers";
import { GameError } from "./game.ts";
import { hash } from "./request-context.ts";

export const ACCOUNT_COOKIE = "avalon_account";
const YEAR = 60 * 60 * 24 * 365;
const PBKDF2_ITERATIONS = 10000;

export type Account = { id: string; name: string; canHost: boolean; title: string | null };

function db() {
  if (!env.DB) throw new GameError("账号服务暂时不可用，请稍后再试。", 503);
  return env.DB;
}

export function readAccountCookie(request: Request): string | null {
  const header = request.headers.get("cookie") ?? "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${ACCOUNT_COOKIE}=([a-f0-9]{64})`));
  return match?.[1] ?? null;
}

export function accountCookie(token: string, secure: boolean, clear = false): string {
  const maxAge = clear ? 0 : YEAR;
  return `${ACCOUNT_COOKIE}=${clear ? "" : token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

async function derivePassword(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" }, key, 256);
  return Array.from(new Uint8Array(bits)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function nameOf(value: unknown): string {
  if (typeof value !== "string") throw new GameError("请填写账号名。", 400);
  const name = value.trim().normalize("NFC");
  if (!/^[\p{L}\p{N}_-]{2,16}$/u.test(name)) throw new GameError("账号名需为 2–16 位字母、数字或下划线。", 400);
  return name;
}

function passwordOf(value: unknown): string {
  if (typeof value !== "string" || value.length < 8 || value.length > 64) {
    throw new GameError("密码需为 8–64 位。", 400);
  }
  return value;
}

export async function readAccount(request: Request): Promise<Account | null> {
  const token = readAccountCookie(request);
  if (!token) return null;
  const tokenHash = await hash(token);
  const row = await db().prepare(
    "SELECT a.id, a.name, a.can_host as canHost, a.title as title FROM account_sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ? AND s.expires_at > ?",
  ).bind(tokenHash, Date.now()).first<{ id: string; name: string; canHost: number; title: string | null }>();
  if (!row) return null;
  return { id: row.id, name: row.name, canHost: row.canHost === 1, title: row.title };
}

export async function registerAccount(nameInput: unknown, passwordInput: unknown): Promise<{ account: Account; token: string }> {
  const name = nameOf(nameInput);
  const password = passwordOf(passwordInput);
  const existing = await db().prepare("SELECT id FROM accounts WHERE name = ?").bind(name).first();
  if (existing) throw new GameError("这个账号名已经有人用了。", 409);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = `${Array.from(salt).map(byte => byte.toString(16).padStart(2, "0")).join("")}:${await derivePassword(password, salt)}`;
  const id = crypto.randomUUID().replace(/-/g, "");
  await db().prepare("INSERT INTO accounts (id, name, password_hash, can_host, created_at) VALUES (?, ?, ?, 0, ?)").bind(id, name, passwordHash, Date.now()).run();
  const token = await startSession(id);
  return { account: { id, name, canHost: false, title: null }, token };
}

export async function loginAccount(nameInput: unknown, passwordInput: unknown): Promise<{ account: Account; token: string }> {
  const name = nameOf(nameInput);
  const password = passwordOf(passwordInput);
  const row = await db().prepare("SELECT id, name, password_hash, can_host as canHost, title FROM accounts WHERE name = ?").bind(name).first<{ id: string; name: string; password_hash: string; canHost: number; title: string | null }>();
  if (!row) throw new GameError("账号或密码不正确。", 403);
  const [saltHex, expected] = row.password_hash.split(":");
  if (!saltHex || !expected || saltHex.length !== 32) throw new GameError("账号或密码不正确。", 403);
  const salt = new Uint8Array(saltHex.match(/../g)!.map(byte => parseInt(byte, 16)));
  const actual = await derivePassword(password, salt);
  if (actual !== expected) throw new GameError("账号或密码不正确。", 403);
  return { account: { id: row.id, name: row.name, canHost: row.canHost === 1, title: row.title }, token: await startSession(row.id) };
}

async function startSession(accountId: string): Promise<string> {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(byte => byte.toString(16).padStart(2, "0")).join("");
  const tokenHash = await hash(token);
  await db().prepare("INSERT INTO account_sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)").bind(tokenHash, accountId, Date.now() + YEAR * 1000).run();
  return token;
}

export async function logoutAccount(request: Request): Promise<void> {
  const token = readAccountCookie(request);
  if (!token) return;
  await db().prepare("DELETE FROM account_sessions WHERE token_hash = ?").bind(await hash(token)).run();
}

export async function setAccountTitle(accountId: string, achievementId: string): Promise<void> {
  const owned = await db().prepare("SELECT 1 as ok FROM account_achievements WHERE account_id = ? AND achievement_id = ?").bind(accountId, achievementId).first();
  if (!owned) throw new GameError("还没有解锁这个成就。", 403);
  await db().prepare("UPDATE accounts SET title = ? WHERE id = ?").bind(achievementId, accountId).run();
}

export async function setHostRight(nameInput: unknown, canHost: boolean): Promise<void> {
  const name = nameOf(nameInput);
  const result = await db().prepare("UPDATE accounts SET can_host = ? WHERE name = ?").bind(canHost ? 1 : 0, name).run();
  if (!result.meta.changes) throw new GameError("没有这个账号。", 404);
}
