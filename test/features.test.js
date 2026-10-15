import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { parseCommit, releaseType, formatCommit, fromCommitlint, findCommitlintConfig, loadPreset, normalizePreset, DEFAULT_PRESET, prompt, check } from '../src/index.js';
import * as parser from '../src/parser.js';
import { repo, run, g, tmp, write } from './helpers.js';

test('parser: header, scopes, body, footers, breaking, refs, revert', () => {
  const c = parseCommit('feat(api,cli)!: add tokens\n\nLonger body\nline two\n\nBREAKING CHANGE: tokens replace keys\n  continued\nRefs: #12\nReviewed-by: Z\n# comment');
  assert.equal(c.type, 'feat'); assert.deepEqual(c.scopes, ['api', 'cli']); assert.equal(c.subject, 'add tokens');
  assert.equal(c.body, 'Longer body\nline two');
  assert.equal(c.breaking, true); assert.deepEqual(c.breakingNotes, ['tokens replace keys\n  continued'.trim()]);
  assert.deepEqual(c.footers.map((f) => f.token), ['BREAKING CHANGE', 'Refs', 'Reviewed-by']);
  assert.deepEqual(c.references, ['#12']);
  assert.equal(c.conventional, true);
  assert.equal(parseCommit('fix: x\n\nBREAKING-CHANGE: y').breaking, true);
  assert.equal(parseCommit('Bad message').conventional, false);
  assert.equal(parseCommit('Merge branch \'x\'').merge, true);
  assert.deepEqual(parseCommit('Revert "feat: a"\n\nThis reverts commit abcdef1.').revert, { header: 'feat: a', hash: 'abcdef1' });
  assert.equal(parseCommit('docs: a\n\nsee: this\n\nplain closing paragraph').footers.length, 0);
});

test('releaseType and formatCommit', () => {
  assert.equal(releaseType(parseCommit('feat!: x')), 'major');
  assert.equal(releaseType(parseCommit('feat: x')), 'minor');
  assert.equal(releaseType(parseCommit('perf: x')), 'patch');
  assert.equal(releaseType(parseCommit('docs: x')), null);
  assert.equal(formatCommit({ type: 'fix', scope: 'ui', subject: 'stop crash', body: 'b', breaking: 'old api gone', issues: ['#1'] }), 'fix(ui)!: stop crash\n\nb\n\nBREAKING CHANGE: old api gone\nRefs: #1\n');
});

test('parser subpath has no lint/CLI code and matches index exports', () => {
  assert.equal(parser.parseCommit, parseCommit);
  assert.ok(!('lintMessage' in parser));
});

test('commitlint config: extends config-conventional + rule overrides (json, yaml, js, package.json)', async () => {
  const r = fromCommitlint({ extends: ['@commitlint/config-conventional'], rules: { 'scope-enum': [2, 'always', ['api', 'ui']], 'header-max-length': [2, 'always', 72], 'subject-case': [0], 'references-empty': [2, 'never'], 'foo-bar': [2, 'always'] } });
  assert.deepEqual(r.options.scopes, ['api', 'ui']); assert.equal(r.options.headerMaxLength, 72);
  assert.ok(r.options.types.includes('feat')); assert.equal(r.options.subjectCase, 'any'); assert.ok(r.options.issuePattern);
  assert.deepEqual(r.unsupported, ['foo-bar']);
  const d = tmp();
  write(d, '.commitlintrc.yml', "extends:\n  - '@commitlint/config-conventional'\nrules:\n  type-enum: [2, always, [feat, fix]]\n");
  assert.deepEqual(fromCommitlint((await findCommitlintConfig(d)).config).options.types, ['feat', 'fix']);
  const d2 = tmp(); write(d2, 'commitlint.config.mjs', "export default { rules: { 'scope-empty': [2, 'never'] } };");
  assert.equal(fromCommitlint((await findCommitlintConfig(d2)).config).options.requireScope, true);
  const d3 = tmp(); write(d3, 'package.json', JSON.stringify({ commitlint: { rules: { 'type-enum': [2, 'always', ['x']] } } }));
  assert.equal((await findCommitlintConfig(d3)).file, 'package.json');
});

test('CLI picks up commitlint config automatically (and --no-commitlint opts out)', () => {
  const d = repo('feat: add a');
  write(d, 'commitlint.config.cjs', "module.exports = { extends: ['@commitlint/config-conventional'], rules: { 'type-enum': [2, 'always', ['fix']] } };");
  const r = run(['--format', 'json'], { cwd: d });
  assert.equal(r.code, 1, r.err);
  const j = JSON.parse(r.out); assert.equal(j.commitlintConfig, 'commitlint.config.cjs'); assert.equal(j.findings[0].rule, 'type-unknown');
  assert.equal(run(['--no-commitlint'], { cwd: d }).code, 0);
});

test('PR title linting and --github-pr (title + every commit)', () => {
  assert.equal(run(['--pr-title', 'feat: add login']).code, 0);
  const bad = run(['--pr-title', 'Added login page', '-f', 'json']);
  assert.equal(bad.code, 1); const j = JSON.parse(bad.out); assert.equal(j.target, 'PR title'); assert.match(j.findings[0].fix, /feat: add login page/);
  const d = repo('chore: init', 'feat: good', 'oops bad');
  const base = g(d, 'rev-list', '--max-parents=0', 'HEAD').trim(); const head = g(d, 'rev-parse', 'HEAD').trim();
  const ev = join(d, 'event.json'); writeFileSync(ev, JSON.stringify({ pull_request: { number: 3, title: 'feat: add things', base: { sha: base }, head: { sha: head } } }));
  const r = check(d, { prTitle: 'feat: add things', from: base, to: head });
  assert.equal(r.commits.length, 3); assert.deepEqual(r.findings.map((f) => f.rule), ['header-format']);
  const p = run(['--github-pr', '-f', 'json'], { cwd: d, env: { GITHUB_EVENT_PATH: ev } });
  assert.equal(p.code, 1, p.err); assert.equal(JSON.parse(p.out).commits.length, 3);
  assert.equal(run(['--github-pr'], { cwd: d, env: { GITHUB_EVENT_PATH: '' } }).code, 2);
});

test('shareable presets: file preset via extends, normalisation', () => {
  const p = normalizePreset({ types: [{ type: 'feat', description: 'F' }, 'fix'], scopes: ['core'], headerMaxLength: 50 });
  assert.deepEqual(p.options, { headerMaxLength: 50, types: ['feat', 'fix'], scopes: ['core'] });
  assert.equal(loadPreset('conventional').types.length, DEFAULT_PRESET.types.length);
  const d = repo('docs: write');
  write(d, 'preset.json', JSON.stringify({ types: ['feat', 'fix'] }));
  write(d, '.commit-gauge.json', JSON.stringify({ extends: './preset.json' }));
  const r = run(['-f', 'json'], { cwd: d });
  assert.equal(r.code, 1, r.err); assert.equal(JSON.parse(r.out).findings[0].rule, 'type-unknown');
  assert.equal(run(['--preset', './nope.json'], { cwd: d }).code, 2);
});

test('interactive prompt builds a valid message', async () => {
  const input = new PassThrough(); const output = new PassThrough(); let shown = '';
  output.on('data', (b) => { shown += b; });
  input.end('nope\n1\nui\nadd dark mode\n\n\n#7\n');
  const r = await prompt(normalizePreset(DEFAULT_PRESET), { input, output });
  assert.equal(r.message, 'feat(ui): add dark mode\n\nRefs: #7\n');
  assert.deepEqual(r.findings, []);
  assert.match(shown, /1\) feat/);
});

test('CLI prompt prints the message', () => {
  const r = run(['prompt'], { input: 'fix\n\nhandle empty input\n\nremoved --old flag\n\n' });
  assert.equal(r.code, 0, r.err);
  assert.equal(r.out, 'fix!: handle empty input\n\nBREAKING CHANGE: removed --old flag\n');
});
