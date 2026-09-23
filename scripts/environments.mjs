// Deployed environments. `wranglerEnv` names the block under "env" in
// wrangler.jsonc; production is the top-level configuration.
export const ENVIRONMENTS = {
  production: { url: "https://avalon-roundtable.yunkangchen2017.workers.dev", wranglerEnv: null, worker: "avalon-roundtable" },
  staging: { url: "https://avalon-roundtable-staging.yunkangchen2017.workers.dev", wranglerEnv: "staging", worker: "avalon-roundtable-staging" },
};
