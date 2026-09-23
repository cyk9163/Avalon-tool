// Operator keys for the /admin dashboard. Separate from host keys.
//   node scripts/admin-keys.mjs generate work/admin-key.txt [--count N]
//   node scripts/admin-keys.mjs publish work/admin-key.txt [--env staging]
// generate writes only inside the git-ignored work/ directory and never
// overwrites; publish replaces the whole ADMIN_KEY_HASHES allowlist.
import { randomInt, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const [action, target, ...options] = process.argv.slice(2);
const option = name => { const index = options.indexOf(name); return index >= 0 ? options[index + 1] ?? '' : null; };
const wranglerEnv = option('--env');
const countOption = option('--count');
const count = countOption === null ? 1 : Number(countOption);
if (!['generate', 'publish'].includes(action) || !target || (wranglerEnv !== null && wranglerEnv !== 'staging')
  || !Number.isInteger(count) || count < 1 || count > 16 || (action === 'publish' && countOption !== null)) {
  console.error('Usage: node scripts/admin-keys.mjs generate work/admin-key.txt [--count N]');
  console.error('       node scripts/admin-keys.mjs publish work/admin-key.txt [--env staging]');
  process.exit(1);
}
const workspace = resolve('work');
const file = resolve(target);
const within = relative(workspace, file);
if (!within || within.startsWith('..') || isAbsolute(within)) throw new Error('Keep private keys inside the git-ignored work directory.');
const pattern = /ADM-(?:[2-9A-HJ-NP-Z]{4}-){4}[2-9A-HJ-NP-Z]{4}/g;
if (action === 'generate') {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const keys = new Set();
  while (keys.size < count) {
    keys.add('ADM-' + Array.from({ length: 5 }, () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join('')).join('-'));
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, '# 圆桌阿瓦隆 · 管理后台 Key（/admin）\n# 只用于查看运营统计，不能建房。请勿公开或提交到 GitHub。\n\n' + [...keys].map((key, i) => `${i + 1}. ${key}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  console.log(`Generated ${count} admin key${count === 1 ? '' : 's'}: ${file}`);
} else {
  const keys = [...new Set(readFileSync(file, 'utf8').match(pattern) ?? [])];
  if (!keys.length) throw new Error('No valid admin keys found.');
  const hashes = keys.map(key => createHash('sha256').update(key).digest('hex')).join(',');
  console.log(`Publishing ${keys.length} admin key digest${keys.length === 1 ? '' : 's'} to the ${wranglerEnv ?? 'production'} Cloudflare Worker.`);
  const child = spawn(process.execPath, ['scripts/wrangler.mjs', 'secret', 'put', 'ADMIN_KEY_HASHES', '--config', 'wrangler.jsonc', ...(wranglerEnv ? ['--env', wranglerEnv] : [])], { stdio: ['pipe', 'inherit', 'inherit'] });
  child.stdin.end(hashes + '\n');
  child.once('error', error => { console.error(error.message); process.exitCode = 1; });
  child.once('exit', code => { process.exitCode = code ?? 1; });
}
