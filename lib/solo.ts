/** Local-only solo table. Production hostnames never qualify. */
export function isSoloHost(hostname: string): boolean {
  const host = hostname.toLowerCase().split(":")[0];
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
}

const SOLO_DEVICE = /^[a-f0-9]{64}$/;

/** A per-seat device id, accepted only when the request itself is on a local host. */
export function soloDeviceOverride(request: Request): string | null {
  const header = request.headers.get("x-avalon-solo");
  if (!header || !SOLO_DEVICE.test(header)) return null;
  return isSoloHost(new URL(request.url).hostname) ? header : null;
}

export const SOLO_NAMES = ["小明", "阿花", "老王", "Kiki", "大雄", "阿强", "小美", "石头", "圆圆", "阿凯"] as const;
