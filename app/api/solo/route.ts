import { isSoloHost } from "@/lib/solo";

// The local test key is already public in .dev.vars.example. This route
// refuses every hostname that is not the local dev machine.
const LOCAL_HOST_KEY = "AVL-TEST-KEYS-2345-6789";

export function GET(request: Request) {
  const host = new URL(request.url).hostname;
  if (!isSoloHost(host)) return new Response(null, { status: 404 });
  return Response.json({ hostKey: LOCAL_HOST_KEY }, { headers: { "Cache-Control": "no-store" } });
}
