// Custom Worker entry: delegates every request to vinext, then adds the
// security baseline, and runs the scheduled cleanup (see wrangler.jsonc).
// Live WebSocket handshakes are answered here before vinext, so the 101
// response is passed to the browser untouched.
import handler from "vinext/server/fetch-handler";
import { applySecurityHeaders } from "../lib/security-headers";
import { runScheduledMaintenance } from "../lib/maintenance";
import { LIVE_PATH } from "../lib/live";
import { handleLiveRequest } from "../lib/live-gateway";

export { RoomHub } from "../lib/room-hub";

export default {
  async fetch(request, env, ctx) {
    const response = new URL(request.url).pathname === LIVE_PATH
      ? await handleLiveRequest(request, env)
      : await handler.fetch!(request, env, ctx);
    return applySecurityHeaders(request, response, import.meta.env.DEV);
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runScheduledMaintenance(env.DB, controller.cron));
  },
} satisfies ExportedHandler<Cloudflare.Env>;
