// Conventional Commits linting for one message.
import { DEFAULT_TYPES, parseHeader } from './parser.js';
export { DEFAULT_TYPES, parseHeader };
const PAST = { added: 'add', adds: 'add', adding: 'add', fixed: 'fix', fixes: 'fix', fixing: 'fix', updated: 'update', updates: 'update', updating: 'update', removed: 'remove', removes: 'remove', removing: 'remove', changed: 'change', changes: 'change', changing: 'change', improved: 'improve', improves: 'improve', refactored: 'refactor', refactors: 'refactor', renamed: 'rename', renames: 'rename', moved: 'move', moves: 'move', deleted: 'delete', deletes: 'delete', created: 'create', creates: 'create', implemented: 'implement', implements: 'implement', bumped: 'bump', bumps: 'bump', upgraded: 'upgrade', upgrades: 'upgrade', made: 'make', makes: 'make', cleaned: 'clean', cleans: 'clean', merged: 'merge', replaced: 'replace', replaces: 'replace', converted: 'convert', allowed: 'allow', allows: 'allow', enabled: 'enable', enables: 'enable', disabled: 'disable', disables: 'disable', introduced: 'introduce', introduces: 'introduce', supported: 'support', supports: 'support', documented: 'document', documents: 'document', tested: 'test', reverted: 'revert', reverts: 'revert', prevented: 'prevent', prevents: 'prevent', handled: 'handle', handles: 'handle', ensured: 'ensure', ensures: 'ensure', used: 'use', uses: 'use', extracted: 'extract', simplified: 'simplify', simplifies: 'simplify', optimized: 'optimize', optimised: 'optimise', corrected: 'correct', corrects: 'correct', resolved: 'resolve', resolves: 'resolve' };
const ALIASES = { feature: 'feat', features: 'feat', feats: 'feat', new: 'feat', add: 'feat', added: 'feat', fixed: 'fix', fixes: 'fix', bugfix: 'fix', bug: 'fix', hotfix: 'fix', patch: 'fix', doc: 'docs', documentation: 'docs', readme: 'docs', tests: 'test', testing: 'test', refactoring: 'refactor', refactored: 'refactor', performance: 'perf', chores: 'chore', deps: 'chore', dep: 'chore', dependencies: 'chore', release: 'chore', cleanup: 'chore', formatting: 'style', format: 'style', lint: 'style', builds: 'build', ci_cd: 'ci', reverted: 'revert', update: 'chore', upgrade: 'chore', bump: 'chore' };

function lev(a, b) { const m = a.length; const n = b.length; let prev = Array.from({ length: n + 1 }, (_, i) => i); for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; } return prev[n]; }

/** Best type for a word, or null. */
export function closestType(word, types = DEFAULT_TYPES) {
  const w = String(word || '').toLowerCase();
  if (types.includes(w)) return w;
  if (ALIASES[w] && types.includes(ALIASES[w])) return ALIASES[w];
  let best = null; let d = 3;
  for (const t of types) { const k = lev(w, t); if (k < d || (k === d && best && t.length < best.length)) { d = k; best = t; } }
  return d <= (w.length <= 4 ? 1 : 2) ? best : null;
}

/** Guess a type from free text. */
export function inferType(text, types = DEFAULT_TYPES) {
  const t = String(text).toLowerCase();
  const pick = (x) => (types.includes(x) ? x : null);
  if (/\b(fix|fixe[sd]|bug|crash|error|issue|broken|typo|regression|resolve[sd]?)\b/.test(t)) return pick('fix') || types[0];
  if (/\b(readme|docs?|documentation|comment[s]?|changelog)\b/.test(t)) return pick('docs') || types[0];
  if (/\b(tests?|specs?|coverage)\b/.test(t)) return pick('test') || types[0];
  if (/\b(refactor\w*|rename[sd]?|restructure[sd]?|clean ?up|simplif\w+|extract\w*)\b/.test(t)) return pick('refactor') || types[0];
  if (/\b(bump\w*|upgrade[sd]?|deps?|dependenc\w+|release|version)\b/.test(t)) return pick('chore') || types[0];
  if (/\b(ci|workflow|pipeline|github actions?)\b/.test(t)) return pick('ci') || types[0];
  if (/\b(perf\w*|faster|speed|optimi[sz]\w*)\b/.test(t)) return pick('perf') || types[0];
  if (/\b(format\w*|lint\w*|whitespace|prettier)\b/.test(t)) return pick('style') || types[0];
  if (/\b(add\w*|new|support\w*|implement\w*|introduc\w*|allow\w*|enable\w*|create\w*)\b/.test(t)) return pick('feat') || types[0];
  return pick('chore') || types[0];
}

/** Rewrite a subject in imperative, lowercase, without trailing full stop. */
export function fixSubject(subject, { subjectCase = 'lower' } = {}) {
  let s = String(subject).trim().replace(/[.。]+$/, '').replace(/\s+/g, ' ');
  const [w, ...rest] = s.split(' ');
  const lw = (w || '').toLowerCase();
  if (PAST[lw]) s = [PAST[lw], ...rest].join(' ');
  if (subjectCase === 'lower' && /^[A-Z][a-z]/.test(s)) s = s[0].toLowerCase() + s.slice(1);
  return s;
}


/** Lint one commit message. Returns { findings: [{rule, message, fix, line}], suggestion, parsed } */
export function lintMessage(raw, cfg = {}) {
  const types = cfg.types || DEFAULT_TYPES;
  const max = cfg.headerMaxLength ?? 100; const bodyMax = cfg.bodyMaxLineLength ?? 100;
  const msg = String(raw).replace(/\r\n/g, '\n').replace(/^# -+ >8 -+[\s\S]*$/m, '').split('\n').filter((l) => !l.startsWith('#') || cfg.keepHashLines).join('\n').replace(/\n# -+ >8 -+[\s\S]*$/, '').replace(/\s+$/, '');
  const lines = msg.split('\n');
  const header = lines[0] || '';
  const out = [];
  const add = (rule, message, fix, line = 1) => out.push({ rule, message, fix, line });
  const res = { findings: out, suggestion: null, parsed: null, header };
  if (!header.trim()) { add('subject-empty', 'commit message is empty', 'Write a header like "feat: add login form".'); return res; }
  if (/^(fixup|squash|amend)! /.test(header)) { add('fixup-commit', `"${header.slice(0, 60)}" is a ${header.split('!')[0]}! commit`, 'Squash it with git rebase -i --autosquash before merging.'); return res; }
  if (/^(wip|WIP|Wip)\b|\bwip\b:?\s*$|^\[wip\]/i.test(header)) add('wip-commit', `"${header.slice(0, 60)}" looks like a work-in-progress commit`, 'Squash or reword it before merging.');
  const p = parseHeader(header);
  const suggest = (type, scope, subject, bang) => `${type}${scope ? `(${scope})` : ''}${bang ? '!' : ''}: ${fixSubject(subject, cfg)}`;
  if (!p || /\s/.test(p.type)) {
    const m = /^\s*(\w+)(\s*[:\-]\s*|\s+)(.*)$/.exec(header);
    const guess = m && closestType(m[1], types);
    // "Fix: x" / "feature - x" -> drop the word; "Add dark mode" -> keep it as the verb
    const explicit = m && m[2].trim();
    const sug = guess && explicit ? suggest(guess, null, m[3]) : suggest(m && types.includes(m[1].toLowerCase()) ? m[1].toLowerCase() : inferType(header, types), null, header);
    add('header-format', `"${header.slice(0, 72)}" is not "type(scope): subject"`, `Try: ${sug}`);
    res.suggestion = sug;
  } else {
    res.parsed = { type: p.type, scope: p.scope ?? null, breaking: !!p.bang, subject: p.subject };
    let type = p.type; let scope = p.scope; let changed = false;
    if (!p.space && p.subject) { add('header-format', 'missing space after the colon', `Try: ${suggest(type, scope, p.subject, p.bang)}`); changed = true; }
    if (type !== type.toLowerCase() && types.includes(type.toLowerCase())) { add('type-case', `type "${type}" should be lowercase`, `Use "${type.toLowerCase()}".`); type = type.toLowerCase(); changed = true; }
    else if (!types.includes(type)) { const g = closestType(type, types) || inferType(p.subject, types); add('type-unknown', `type "${type}" is not one of: ${types.join(', ')}`, `Use "${g}".`); type = g; changed = true; }
    if (scope !== undefined && scope !== null) {
      if (!scope.trim()) { add('scope-empty', 'empty scope "()"', 'Remove the parentheses or name a scope.'); scope = null; changed = true; }
      else {
        const scopes = scope.split(/[,/]\s*/);
        if (cfg.scopes?.length) for (const s of scopes) if (!cfg.scopes.includes(s)) { const near = cfg.scopes.find((x) => lev(x, s.toLowerCase()) <= 2); add('scope-not-allowed', `scope "${s}" is not one of: ${cfg.scopes.join(', ')}`, near ? `Use "${near}".` : 'Use an allowed scope or none.'); if (near) { scope = scope.replace(s, near); changed = true; } }
        if (cfg.scopeCase !== false && scope !== scope.toLowerCase()) { add('scope-case', `scope "${scope}" should be lowercase`, `Use "${scope.toLowerCase()}".`); scope = scope.toLowerCase(); changed = true; }
      }
    } else if (cfg.requireScope) { add('scope-not-allowed', 'a scope is required', `Add one, e.g. "${type}(${cfg.scopes?.[0] || 'core'}): …".`); }
    const subject = p.subject.trim();
    if (!subject) add('subject-empty', 'subject is empty', `Describe the change: "${type}${scope ? `(${scope})` : ''}: add …"`);
    else {
      if (/[.。]$/.test(subject) && !/\.\.\.$/.test(subject)) { add('subject-full-stop', 'subject ends with a full stop', 'Remove the trailing ".".'); changed = true; }
      if ((cfg.subjectCase ?? 'lower') === 'lower' && /^[A-Z][a-z]/.test(subject)) { add('subject-case', `subject starts with an uppercase letter ("${subject.split(' ')[0]}")`, `Use "${subject[0].toLowerCase() + subject.slice(1).split(' ')[0]}".`); changed = true; }
      const w = subject.split(' ')[0].toLowerCase();
      if (PAST[w]) { add('subject-imperative', `subject should use the imperative mood ("${PAST[w]}", not "${subject.split(' ')[0]}")`, `Start with "${PAST[w]}".`); changed = true; }
    }
    if (header.length > max) add('header-max-length', `header is ${header.length} characters (max ${max})`, 'Shorten the subject; put details in the body.');
    if (changed && subject) res.suggestion = suggest(type, scope, subject, p.bang);
  }
  // body / footer
  if (lines.length > 1 && lines[1].trim() !== '') add('body-leading-blank', 'no blank line between header and body', 'Insert an empty line after the header.', 2);
  const footerStart = lines.findIndex((l, i) => i > 0 && /^(BREAKING[ -]CHANGES?|[\w-]+)(: | #)\S/.test(l) && (/^BREAKING/.test(l) || /^[A-Z][\w-]*(: | #)/.test(l)));
  if (footerStart > 1 && lines[footerStart - 1].trim() !== '') add('footer-leading-blank', 'no blank line before the footer', 'Insert an empty line before the trailers.', footerStart + 1);
  lines.forEach((l, i) => {
    if (i === 0) return;
    if (/^breaking[ -]changes?\s*:/i.test(l) && !/^BREAKING[ -]CHANGE: \S/.test(l)) add('breaking-change-format', `"${l.slice(0, 40)}" is not a valid breaking-change footer`, 'Use exactly "BREAKING CHANGE: <description>" (uppercase, singular).', i + 1);
    if (l.length > bodyMax && !/^\S+:\/\/\S+$/.test(l.trim()) && !/^\s*[[(]?https?:\/\//.test(l)) add('body-max-line-length', `line ${i + 1} is ${l.length} characters (max ${bodyMax})`, 'Wrap the body.', i + 1);
  });
  if (cfg.requireSignoff && !/^Signed-off-by: .+ <[^>]+>$/m.test(msg)) add('missing-signoff', 'no "Signed-off-by:" trailer', 'Commit with git commit -s.');
  if (cfg.issuePattern) { let re; try { re = new RegExp(cfg.issuePattern); } catch { re = null; } if (re && !re.test(msg)) add('missing-issue-ref', `no issue reference matching /${cfg.issuePattern}/`, 'Reference the issue, e.g. "Refs: #123".'); }
  return res;
}
