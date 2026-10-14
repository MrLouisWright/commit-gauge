import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export const BIN = fileURLToPath(new URL('../bin/commit-gauge.js', import.meta.url));
export const tmp = () => mkdtempSync(join(tmpdir(), 'cg-'));
const env = (d) => ({ ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@e', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@e', GIT_CONFIG_NOSYSTEM: '1', HOME: d });
export const g = (d, ...a) => execFileSync('git', a, { cwd: d, encoding: 'utf8', env: env(d) });
export function repo(...messages) { const d = tmp(); g(d, 'init', '-q', '-b', 'main'); messages.forEach((m, i) => { writeFileSync(join(d, `f${i}`), String(i)); g(d, 'add', '-A'); g(d, 'commit', '-q', '-m', m); }); return d; }
export function run(args, opts = {}) { const r = spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8', cwd: opts.cwd, input: opts.input, env: { ...process.env, NO_COLOR: '1' } }); return { code: r.status, out: r.stdout, err: r.stderr }; }
export function write(d, p, c) { mkdirSync(dirname(join(d, p)), { recursive: true }); writeFileSync(join(d, p), c); return join(d, p); }
