import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { lintMessage, closestType, inferType, fixSubject, parseHeader, DEFAULT_TYPES } from './lint.js';
import { buildReport, UsageError } from './core.js';

export { lintMessage, closestType, inferType, fixSubject, parseHeader, DEFAULT_TYPES };
export * from './core.js';

export const RULES = {
  'header-format': { severity: 'high', title: 'Header is not "type(scope): subject"' },
  'type-unknown': { severity: 'high', title: 'Type is not in the allowed list' },
  'subject-empty': { severity: 'high', title: 'Subject (or whole message) is empty' },
  'fixup-commit': { severity: 'high', title: 'fixup!/squash!/amend! commit left in the history' },
  'type-case': { severity: 'medium', title: 'Type is not lowercase' },
  'scope-empty': { severity: 'medium', title: 'Empty scope "()"' },
  'scope-not-allowed': { severity: 'medium', title: 'Scope is not in the allowed list (or is required)' },
  'header-max-length': { severity: 'medium', title: 'Header is too long' },
  'breaking-change-format': { severity: 'medium', title: 'Malformed BREAKING CHANGE footer' },
  'wip-commit': { severity: 'medium', title: 'Work-in-progress commit' },
  'missing-signoff': { severity: 'medium', title: 'No Signed-off-by trailer (requireSignoff)' },
  'subject-case': { severity: 'low', title: 'Subject starts with an uppercase letter' },
  'scope-case': { severity: 'low', title: 'Scope is not lowercase' },
  'subject-full-stop': { severity: 'low', title: 'Subject ends with a full stop' },
  'body-leading-blank': { severity: 'low', title: 'No blank line between header and body' },
  'footer-leading-blank': { severity: 'low', title: 'No blank line before the footer' },
  'missing-issue-ref': { severity: 'low', title: 'No issue reference (issuePattern)' },
  'subject-imperative': { severity: 'info', title: 'Subject is not in the imperative mood' },
  'body-max-line-length': { severity: 'info', title: 'Body line is too long' },
};

const git = (dir, args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
const ZERO = /^0{40}$/;
const isIgnored = (m, cfg) => (cfg.ignoreMerges !== false && /^Merge (pull request|branch|remote-tracking branch|tag|commit) /.test(m)) || (cfg.ignoreReverts !== false && /^Revert ".*"/.test(m)) || /^Initial commit$/i.test(m.split('\n')[0]) || (cfg.ignore || []).some((r) => new RegExp(r).test(m.split('\n')[0])) || /^(chore\(release\)|release):? v?\d+\.\d+\.\d+/.test(m) || /^v?\d+\.\d+\.\d+(-[\w.]+)?$/.test(m.split('\n')[0]);

/** Commits in from..to (oldest first). */
export function commitsInRange(dir, from, to = 'HEAD') {
  let range;
  if (!from || ZERO.test(from)) range = ['-1', to];
  else range = [`${from}..${to}`];
  let out;
  try { out = git(dir, ['log', '--reverse', '--format=%H%x1f%B%x1e', ...range]); } catch (e) { throw new UsageError(`git log failed: ${String(e.stderr || e.message).trim().split('\n')[0]}`); }
  return out.split('\x1e').map((s) => s.trim()).filter(Boolean).map((s) => { const [sha, ...m] = s.split('\x1f'); return { sha, message: m.join('\x1f').trim() }; });
}

/** Lint a list of { sha?, message, source? } */
export function lintCommits(commits, cfg = {}) {
  const findings = []; const results = [];
  for (const c of commits) {
    if (isIgnored(c.message, cfg)) { results.push({ sha: c.sha || null, header: c.message.split('\n')[0], ignored: true, findings: [] }); continue; }
    const r = lintMessage(c.message, cfg);
    const id = c.sha ? c.sha.slice(0, 7) : (c.source || 'message');
    r.findings.forEach((f, i) => findings.push({ rule: f.rule, severity: RULES[f.rule].severity, file: c.source || undefined, line: c.source ? f.line : undefined, subject: c.sha || c.source || 'message', message: `${c.sha ? id + ' ' : ''}${f.message}`, fix: i === 0 && r.suggestion && !String(f.fix).includes(r.suggestion) ? `${f.fix} Suggested header: "${r.suggestion}"` : f.fix, ...(r.suggestion ? { suggestion: r.suggestion } : {}) }));
    results.push({ sha: c.sha || null, header: r.header, parsed: r.parsed, suggestion: r.suggestion, findings: r.findings.map((f) => f.rule) });
  }
  return { findings, results };
}

export function check(dir, opts = {}, config = {}, configFile) {
  const cfg = { ...config, ...Object.fromEntries(Object.entries(opts.lint || {}).filter(([, v]) => v !== undefined)) };
  let commits;
  if (opts.message != null) commits = [{ message: opts.message, source: opts.source }];
  else commits = commitsInRange(dir, opts.from, opts.to);
  const { findings, results } = lintCommits(commits, cfg);
  const tool = { name: 'commit-gauge', version: opts.toolVersion || '1.0.0', rules: RULES, emoji: '📝', defaultFile: opts.source || '.git/COMMIT_EDITMSG' };
  const linted = results.filter((r) => !r.ignored).length;
  const bad = results.filter((r) => r.findings.length).length;
  const target = opts.message != null ? (opts.source || 'commit message') : `${opts.from && !ZERO.test(opts.from) ? opts.from.slice(0, 12) + '..' : ''}${opts.to || 'HEAD'}`;
  const report = buildReport(tool, target, findings, config, { now: opts.now, configFile, summaryLine: `${linted} commit(s) linted, ${bad} with problems${results.length - linted ? `, ${results.length - linted} skipped (merge/revert/release)` : ''}`, commits: results });
  return report;
}

/** Install a commit-msg hook (husky-aware). Returns the path written. */
export function installHook(dir, { force = false, command = 'npx --no -- commit-gauge --edit "$1"' } = {}) {
  let hooksDir;
  if (existsSync(join(dir, '.husky'))) hooksDir = join(dir, '.husky');
  else {
    let gitDir; try { gitDir = git(dir, ['rev-parse', '--git-path', 'hooks']).trim(); } catch { throw new UsageError('not a git repository'); }
    hooksDir = join(dir, gitDir);
  }
  mkdirSync(hooksDir, { recursive: true });
  const file = join(hooksDir, 'commit-msg');
  if (existsSync(file) && !force) { const cur = readFileSync(file, 'utf8'); if (cur.includes('commit-gauge')) return { file, changed: false }; throw new UsageError(`${file} already exists (use --force to overwrite)`); }
  writeFileSync(file, `#!/bin/sh\n# installed by commit-gauge\n${command}\n`);
  chmodSync(file, 0o755);
  return { file, changed: true };
}
