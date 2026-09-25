function bareHost(hostname: string): string {
  const host = hostname.trim().toLowerCase();
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end > 0 ? host.slice(1, end) : host;
  }
  return host.replace(/:\d+$/, "");
}

/** Home and office IPv4 ranges. A public address never qualifies. */
export function isPrivateIPv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part))) return false;
  const nums = parts.map(part => Number(part));
  if (nums.some(part => part > 255)) return false;
  const [first, second] = nums;
  if (first === 10) return true;
  if (first === 192 && second === 168) return true;
  return first === 172 && second >= 16 && second <= 31;
}

/** Local-only solo table. Production hostnames never qualify. */
export function isSoloHost(hostname: string): boolean {
  const host = bareHost(hostname);
  return host === "localhost" || host === "127.0.0.1" || host === "::1"
    || host.endsWith(".localhost") || host.endsWith(".local") || isPrivateIPv4(host);
}

const SOLO_DEVICE = /^[a-f0-9]{64}$/;

/** A per-seat device id, accepted only when the request itself is on a local host. */
export function soloDeviceOverride(request: Request): string | null {
  const header = request.headers.get("x-avalon-solo");
  if (!header || !SOLO_DEVICE.test(header)) return null;
  return isSoloHost(new URL(request.url).hostname) ? header : null;
}

export const SOLO_NAMES = ["小明", "阿花", "老王", "Kiki", "大雄", "阿强", "小美", "石头", "圆圆", "阿凯"] as const;
