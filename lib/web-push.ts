// Web Push (RFC 8291 aes128gcm + VAPID ES256) using only WebCrypto, so it runs
// inside a Cloudflare Worker. The private key never leaves the secret store.
import { VAPID_PUBLIC_KEY } from "./vapid-public.ts";

const encoder = new TextEncoder();
const VAPID_SUBJECT = "mailto:push@avalon-roundtable.workers.dev";
const RECORD_SIZE = 4096;

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return copyBytes(Uint8Array.from(binary, char => char.charCodeAt(0)));
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(parts.reduce((sum, part) => sum + part.length, 0)));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

function copyBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  out.set(bytes);
  return out;
}

async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: string, length: number): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey("raw", copyBytes(ikm), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: copyBytes(salt), info: encoder.encode(info) }, key, length * 8);
  return copyBytes(new Uint8Array(bits));
}

export type PushKeys = { p256dh: string; auth: string };

/** Encrypts a short UTF-8 notice for one browser subscription. */
export async function encryptPushPayload(text: string, keys: PushKeys): Promise<Uint8Array> {
  const uaPublic = base64UrlToBytes(keys.p256dh);
  const auth = base64UrlToBytes(keys.auth);
  if (uaPublic.length !== 65 || auth.length !== 16) throw new Error("bad push keys");
  const local = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const remote = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = copyBytes(new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: remote }, local.privateKey, 256)));
  const asPublic = copyBytes(new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey)));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyInfo = concat(encoder.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikmKey = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveBits"]);
  const ikm = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: auth, info: keyInfo }, ikmKey, 256));
  const cek = await hkdf(ikm, salt, "Content-Encoding: aes128gcm\0", 16);
  const nonce = await hkdf(ikm, salt, "Content-Encoding: nonce\0", 12);
  const record = concat(encoder.encode(text), new Uint8Array([2]));
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, record));
  const header = new Uint8Array(21 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, ciphertext);
}

export async function decryptPushPayloadFor(body: Uint8Array, subscriber: CryptoKeyPair, auth: Uint8Array): Promise<string> {
  const salt = copyBytes(body.slice(0, 16));
  const idLen = body[20];
  const asPublic = copyBytes(body.slice(21, 21 + idLen));
  const ciphertext = copyBytes(body.slice(21 + idLen));
  const uaPublic = copyBytes(new Uint8Array(await crypto.subtle.exportKey("raw", subscriber.publicKey)));
  const remote = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = copyBytes(new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: remote }, subscriber.privateKey, 256)));
  const keyInfo = concat(encoder.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikmKey = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveBits"]);
  const ikm = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: copyBytes(auth), info: keyInfo }, ikmKey, 256));
  const cek = await hkdf(ikm, salt, "Content-Encoding: aes128gcm\0", 16);
  const nonce = await hkdf(ikm, salt, "Content-Encoding: nonce\0", 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const record = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aes, ciphertext));
  const end = record.lastIndexOf(2);
  return new TextDecoder().decode(end >= 0 ? record.slice(0, end) : record);
}

async function vapidJwt(privateKeyB64: string, audience: string): Promise<string> {
  const header = bytesToBase64Url(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: VAPID_SUBJECT,
  })));
  const key = await crypto.subtle.importKey("pkcs8", base64UrlToBytes(privateKeyB64), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(`${header}.${payload}`)));
  return `${header}.${payload}.${bytesToBase64Url(signature)}`;
}

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushNotice = { body: string; url: string };

/** Posts one encrypted notice. Returns the push service status, or 0 when signing is not configured. */
export async function sendWebPush(target: PushTarget, notice: PushNotice, privateKey = ""): Promise<number> {
  if (!privateKey) return 0;
  if (!/^\/\?room=\d{6}$/.test(notice.url)) throw new Error("bad push url");
  const audience = new URL(target.endpoint).origin;
  const jwt = await vapidJwt(privateKey, audience);
  const body = await encryptPushPayload(JSON.stringify({ body: notice.body, url: notice.url }), target);
  const response = await fetch(target.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "120",
    },
    body: copyBytes(body).buffer,
  });
  return response.status;
}
