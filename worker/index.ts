// Custom Worker entry: delegates every request to vinext, then adds the
// security baseline, and runs the scheduled cleanup (see wrangler.jsonc).
import handler from "vinext/server/fetch-handler";
import { applySecurityHeaders } from "../lib/security-headers";
import { runScheduledMaintenance } from "../lib/maintenance";

export default {
  async fetch(request, env, ctx) {
    const response = await handler.fetch!(request, env, ctx);
    return applySecurityHeaders(request, response, import.meta.env.DEV);
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runScheduledMaintenance(env.DB, controller.cron));
  },
} satisfies ExportedHandler<Cloudflare.Env>;
