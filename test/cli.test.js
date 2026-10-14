import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, commitsInRange } from '../src/index.js';
import { repo, run, g, tmp, write } from './helpers.js';

test('range linting via git, merges/reverts/releases skipped', () => {
  const d = repo('chore: init', 'feat: good one', 'Bad commit message', 'fixup! feat: good one', 'Revert "feat: good one"', 'v1.2.3');
  const base = g(d, 'rev-list', '--max-parents=0', 'HEAD').trim();
  const r = check(d, { from: base, to: 'HEAD' });
  assert.equal(r.commits.length, 5);
  assert.equal(r.commits.filter((c) => c.ignored).length, 2);
  assert.deepEqual(r.findings.map((f) => f.rule).sort(), ['fixup-commit', 'header-format']);
  assert.match(r.findings.find((f) => f.rule === 'header-format').message, /^[0-9a-f]{7} /);
  assert.equal(commitsInRange(d, '0'.repeat(40)).length, 1, 'zero SHA = only HEAD');
  assert.equal(commitsInRange(d).length, 1);
});
test('CLI range exit codes', () => {
  const d = repo('chore: init', 'feat: good one');
  assert.equal(run([d, '--from', 'HEAD~1']).code, 0);
  const b = repo('chore: init', 'stuff');
  const r = run([b, '--from', 'HEAD~1']); assert.equal(r.code, 1); assert.match(r.out, /Try: chore: stuff/);
  assert.equal(run([b, '--from', 'nope-ref']).code, 2);
});
test('--message, --stdin, --file, --edit', () => {
  assert.equal(run(['-m', 'feat: x']).code, 0);
  assert.equal(run(['-m', 'nope']).code, 1);
  assert.equal(run(['--stdin'], { input: 'fix: y\n' }).code, 0);
  const d = tmp(); const f = write(d, 'msg.txt', 'Feature: Added a thing.\n');
  const r = run(['--file', f, '-f', 'json']); const j = JSON.parse(r.out);
  assert.equal(r.code, 1); assert.equal(j.findings[0].file, f); assert.equal(j.commits[0].suggestion, 'feat: add a thing');
  const rp = repo('chore: init'); write(rp, '.git/COMMIT_EDITMSG', 'docs: fix typo\n# comment\n');
  assert.equal(run(['--edit'], { cwd: rp }).code, 0);
  write(rp, 'custom-msg', 'bad');
  assert.equal(run(['--edit', 'custom-msg'], { cwd: rp }).code, 1);
});
test('rule flags and config file', () => {
  assert.equal(run(['-m', 'feat: x', '--require-signoff', '--fail-on', 'medium']).code, 1);
  assert.equal(run(['-m', 'feat(web): x', '--scopes', 'api,cli', '--fail-on', 'medium']).code, 1);
  assert.equal(run(['-m', 'deps: x', '--types', 'feat,fix,deps']).code, 0);
  assert.equal(run(['-m', 'feat: ' + 'x'.repeat(60), '--max-length', '50', '--fail-on', 'medium']).code, 1);
  assert.equal(run(['-m', 'feat: x', '--issue-pattern', '(']).code, 2);
  const d = repo('chore: init'); writeFileSync(join(d, '.commit-gauge.json'), JSON.stringify({ types: ['feat', 'chore'], allowlist: [{ rule: 'type-unknown', reason: 'legacy', expires: '2099-01-01' }] }));
  assert.equal(run([d, '-m', 'fix: y']).code, 0);
});
test('formats', () => {
  const o = tmp();
  run(['-m', 'bad message', '--sarif', join(o, 's.sarif'), '--markdown', join(o, 'r.md'), '--json', join(o, 'r.json')]);
  assert.equal(JSON.parse(readFileSync(join(o, 's.sarif'), 'utf8')).runs[0].results[0].ruleId, 'header-format');
  assert.match(readFileSync(join(o, 'r.md'), 'utf8'), /header-format/);
  assert.equal(JSON.parse(readFileSync(join(o, 'r.json'), 'utf8')).counts.high, 1);
});
test('--install-hook (git hooks and husky)', () => {
  const d = repo('chore: init');
  let r = run(['--install-hook'], { cwd: d }); assert.equal(r.code, 0);
  const hook = join(d, '.git/hooks/commit-msg'); assert.ok(existsSync(hook)); assert.match(readFileSync(hook, 'utf8'), /commit-gauge --edit/);
  assert.ok(statSync(hook).mode & 0o100);
  assert.match(run(['--install-hook'], { cwd: d }).out, /already/);
  writeFileSync(hook, '#!/bin/sh\nother\n');
  assert.equal(run(['--install-hook'], { cwd: d }).code, 2);
  assert.equal(run(['--install-hook', '--force'], { cwd: d }).code, 0);
  const h = repo('chore: init'); mkdirSync(join(h, '.husky'));
  run(['--install-hook'], { cwd: h }); assert.ok(existsSync(join(h, '.husky/commit-msg')));
  assert.equal(run(['--install-hook'], { cwd: tmp() }).code, 2);
});
test('--help, --version, --list-rules', () => {
  assert.match(run(['--help']).out, /--install-hook/);
  assert.match(run(['--version']).out, /^1\./);
  assert.match(run(['--list-rules']).out, /header-format/);
});
