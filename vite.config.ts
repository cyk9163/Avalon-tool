import os from "node:os";
import vinext from "vinext";
import { defineConfig, type Plugin } from "vite";
import { isPrivateIPv4 } from "./lib/solo.ts";
import "./scripts/cloudflare-env.mjs";

function lanHosts(): string[] {
  const hosts = new Set<string>();
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && isPrivateIPv4(entry.address)) hosts.add(entry.address);
    }
  }
  return [...hosts];
}

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig(async () => {
  // Use Miniflare's local Request.cf placeholder unless fetching is requested.
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  const soloLan: Plugin = {
    name: "solo-lan",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split("?")[0];
        if (path !== "/api/dev-lan") return next();
        const address = server.httpServer?.address();
        const port = address && typeof address === "object" ? address.port : 5173;
        const origins = lanHosts().map(host => `http://${host}:${port}`);
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify({ origins }));
      });
    },
  };

  return {
    server: {
      host: "0.0.0.0",
      // Loopback, mDNS, and this machine's current LAN addresses. A phone on
      // the same Wi-Fi can open one seat; a public hostname still cannot.
      allowedHosts: [".localhost", ".local", ...lanHosts()],
      ...(isCodexSeatbeltSandbox ? { watch: { useFsEvents: false, usePolling: true } } : {}),
    },
    plugins: [
      soloLan,
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        configPath: "./wrangler.jsonc",
      }),
    ],
  };
});
