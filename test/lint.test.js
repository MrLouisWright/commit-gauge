import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintMessage, closestType, inferType, fixSubject } from '../src/index.js';

const rules = (m, c) => lintMessage(m, c).findings.map((f) => f.rule).sort();

test('valid messages', () => {
  for (const m of ['feat: add login', 'fix(api): handle null body', 'feat(ui,core)!: drop IE11', 'docs: update README\n\nMore words here.\n\nRefs: #12', 'refactor!: rename X\n\nBREAKING CHANGE: X is now Y', 'chore(deps): bump vite from 5 to 6', 'perf: speed up parse...']) assert.deepEqual(rules(m), [], m);
});
test('header-format with suggestion', () => {
  const r = lintMessage('Fixed the login bug.');
  assert.deepEqual(r.findings.map((f) => f.rule), ['header-format']);
  assert.equal(r.suggestion, 'fix: fix the login bug');
  assert.equal(lintMessage('Bugfix: login crash').suggestion, 'fix: login crash');
  assert.equal(lintMessage('Add dark mode').suggestion, 'feat: add dark mode');
  assert.equal(lintMessage('Update README with examples').suggestion, 'docs: update README with examples');
  assert.equal(lintMessage('feat:missing space').findings[0].rule, 'header-format');
});
test('type-unknown / type-case with closest type', () => {
  assert.deepEqual(rules('feature: x'), ['type-unknown']);
  assert.match(lintMessage('feature: x').findings[0].fix, /"feat"/);
  assert.match(lintMessage('fx: thing').findings[0].fix, /"fix"/);
  assert.deepEqual(rules('Feat: x'), ['type-case']);
  assert.equal(lintMessage('Feat: Added x.').suggestion, 'feat: add x');
});
test('scope rules', () => {
  assert.deepEqual(rules('feat(): x'), ['scope-empty']);
  assert.deepEqual(rules('feat(API): x'), ['scope-case']);
  assert.deepEqual(rules('feat(clii): x', { scopes: ['cli', 'core'] }), ['scope-not-allowed']);
  assert.equal(lintMessage('feat(clii): x', { scopes: ['cli', 'core'] }).suggestion, 'feat(cli): x');
  assert.deepEqual(rules('feat: x', { requireScope: true, scopes: ['core'] }), ['scope-not-allowed']);
  assert.deepEqual(rules('feat(core,cli): x', { scopes: ['cli', 'core'] }), []);
});
test('subject rules', () => {
  assert.deepEqual(rules('feat: '), ['subject-empty']);
  assert.deepEqual(rules(''), ['subject-empty']);
  assert.deepEqual(rules('feat: Add x'), ['subject-case']);
  assert.deepEqual(rules('feat: Add x', { subjectCase: 'any' }), []);
  assert.deepEqual(rules('feat: add x.'), ['subject-full-stop']);
  assert.deepEqual(rules('feat: added x'), ['subject-imperative']);
  assert.deepEqual(rules('feat: ' + 'x'.repeat(100)), ['header-max-length']);
  assert.deepEqual(rules('feat: ' + 'x'.repeat(70), { headerMaxLength: 72 }), ['header-max-length']);
});
test('fixup / wip', () => {
  assert.deepEqual(rules('fixup! feat: x'), ['fixup-commit']);
  assert.deepEqual(rules('squash! fix: y'), ['fixup-commit']);
  assert.deepEqual(rules('WIP'), ['header-format', 'wip-commit']);
  assert.deepEqual(rules('feat: login wip'), ['wip-commit']);
});
test('body and footer rules', () => {
  assert.deepEqual(rules('feat: x\nbody right away'), ['body-leading-blank']);
  assert.deepEqual(rules('feat: x\n\nbody\nRefs: #1'), ['footer-leading-blank']);
  assert.deepEqual(rules('feat!: x\n\nBreaking change: y'), ['breaking-change-format']);
  assert.deepEqual(rules('feat!: x\n\nBREAKING CHANGES: y'), ['breaking-change-format']);
  assert.deepEqual(rules('feat: x\n\n' + 'y'.repeat(120)), ['body-max-line-length']);
  assert.deepEqual(rules('feat: x\n\nhttps://example.com/' + 'y'.repeat(120)), []);
});
test('git comment lines and scissors are ignored', () => {
  assert.deepEqual(rules('feat: x\n# Please enter the commit message\n# ------------------------ >8 ------------------------\ndiff --git a b'), []);
});
test('sign-off and issue pattern', () => {
  assert.deepEqual(rules('feat: x', { requireSignoff: true }), ['missing-signoff']);
  assert.deepEqual(rules('feat: x\n\nSigned-off-by: A B <a@b.c>', { requireSignoff: true }), []);
  assert.deepEqual(rules('feat: x', { issuePattern: '#\\d+|[A-Z]+-\\d+' }), ['missing-issue-ref']);
  assert.deepEqual(rules('feat: x (JIRA-12)', { issuePattern: '#\\d+|[A-Z]+-\\d+' }), []);
});
test('custom types', () => {
  assert.deepEqual(rules('deps: bump x', { types: ['feat', 'fix', 'deps'] }), []);
  assert.deepEqual(rules('chore: x', { types: ['feat', 'fix'] }), ['type-unknown']);
});
test('helpers', () => {
  assert.equal(closestType('bugfix'), 'fix'); assert.equal(closestType('docs'), 'docs'); assert.equal(closestType('zzzzzz'), null);
  assert.equal(inferType('Bump lodash'), 'chore'); assert.equal(inferType('improve tests'), 'test'); assert.equal(inferType('Something'), 'chore');
  assert.equal(fixSubject('Removed old flags.'), 'remove old flags');
});
