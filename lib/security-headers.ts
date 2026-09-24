// Baseline browser security headers for every Worker response (pages and API).
// Static files served straight from Workers Assets get the same policy from
// public/_headers; keep the two in sync (tests/security.test.mjs checks this).
import {isSoloHost} from "./solo.ts";

const BASE_DIRECTIVES = [
  "default-src 'self'",
  // React Server Components stream small inline bootstrap scripts, so inline
  // scripts stay allowed; every external script origin is still refused.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];

export const PERMISSIONS_POLICY = [
  "accelerometer=()", "camera=()", "geolocation=()", "gyroscope=()", "magnetometer=()",
  "microphone=()", "payment=()", "usb=()", "browsing-topics=()",
].join(", ");

export function contentSecurityPolicy(options: { dev?: boolean; secure?: boolean } = {}): string {
  const directives = [...BASE_DIRECTIVES];
  if (options.dev) {
    // Vite HMR and React's development stack traces need eval and a websocket.
    directives[1] = "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
    directives[5] = "connect-src 'self' ws: wss:";
  }
  if (options.secure) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export function securityHeaders(options: { dev?: boolean; secure?: boolean } = {}): Record<string, string> {
  return {
    "Content-Security-Policy": contentSecurityPolicy(options),
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "Permissions-Policy": PERMISSIONS_POLICY,
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    ...(options.secure ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" } : {}),
  };
}

/** Returns a response carrying the security headers without discarding existing ones. */
export function applySecurityHeaders(request: Request, response: Response, dev = false): Response {
  // Protocol-switch responses cannot be re-wrapped.
  if (response.status === 101) return response;
  const secure = new URL(request.url).protocol === "https:";
  const headers = securityHeaders({ dev, secure });
  const localDesk = isSoloHost(new URL(request.url).hostname);
  if (localDesk) {
    headers["Content-Security-Policy"] = headers["Content-Security-Policy"].replace("frame-ancestors 'none'", "frame-ancestors 'self'");
    headers["X-Frame-Options"] = "SAMEORIGIN";
  }
  const wrapped = new Response(response.body, response);
  for (const [name, value] of Object.entries(headers)) {
    if (!wrapped.headers.has(name) || (localDesk && (name === "Content-Security-Policy" || name === "X-Frame-Options"))) wrapped.headers.set(name, value);
  }
  return wrapped;
}
