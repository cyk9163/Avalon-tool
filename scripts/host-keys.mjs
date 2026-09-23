import { randomInt, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const [action, target, ...options] = process.argv.slice(2);
// publish accepts --env staging to update the staging Worker's allowlist.
const envIndex = options.indexOf('--env');
const wranglerEnv = envIndex >= 0 ? options[envIndex + 1] : null;
if (!['generate', 'publish'].includes(action) || !target || (envIndex >= 0 && wranglerEnv !== 'staging')) {
  console.error('Usage: node scripts/host-keys.mjs generate|publish work/private-keys.txt [--env staging]');
  process.exit(1);
}
const workspace = resolve('work');
const file = resolve(target);
const within = relative(workspace, file);
if (!within || within.startsWith('..') || isAbsolute(within)) {
  throw new Error('Keep private keys inside the git-ignored work directory.');
}
const pattern = /AVL-(?:[2-9A-HJ-NP-Z]{4}-){3}[2-9A-HJ-NP-Z]{4}/g;
if (action === 'generate') {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const keys = new Set();
  while (keys.size < 10) {
    const groups = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join(''));
    keys.add('AVL-' + groups.join('-'));
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, '# 圆桌阿瓦隆 · 房主 Key\n# 仅用于创建房间；朋友加入房间无需 Key。请勿公开或提交到 GitHub。\n# 可重复使用；更新服务器白名单后，未列入的新旧 Key 将失效。\n\n' + [...keys].map((key, i) => `${i + 1}. ${key}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  console.log(`Generated 10 private keys: ${file}`);
} else {
  const keys = [...new Set(readFileSync(file, 'utf8').match(pattern) ?? [])];
  if (!keys.length) throw new Error('No valid host keys found.');
  const hashes = keys.map(key => createHash('sha256').update(key).digest('hex')).join(',');
  console.log(`Publishing ${keys.length} allowed key digests to the ${wranglerEnv ?? 'production'} Cloudflare Worker.`);
  const child = spawn(process.execPath, ['scripts/wrangler.mjs', 'secret', 'put', 'HOST_KEY_HASHES', '--config', 'wrangler.jsonc', ...(wranglerEnv ? ['--env', wranglerEnv] : [])], { stdio: ['pipe', 'inherit', 'inherit'] });
  child.stdin.end(hashes + '\n');
  child.once('error', error => { console.error(error.message); process.exitCode = 1; });
  child.once('exit', code => { process.exitCode = code ?? 1; });
}
