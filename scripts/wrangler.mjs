import "./cloudflare-env.mjs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
// Resolve the project-local CLI consistently on every operating system.
const child = spawn(process.execPath, [
  fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url)),
  ...process.argv.slice(2),
], { stdio: "inherit" });
child.on("error", (error) => { console.error(error); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
