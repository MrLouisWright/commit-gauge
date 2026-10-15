// Conventional Commits 1.0.0 parser. Pure, zero-dependency; shared by commit-gauge and semver-gauge
// (import from 'commit-gauge/parser').

/** Default Conventional Commits types (config-conventional). */
export const DEFAULT_TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'];

const HEADER = /^(?<type>[^\s():!]+)(?:\((?<scope>[^()]*)\))?(?<bang>!)?(?<colon>:)(?<space>\s*)(?<subject>.*)$/;
const FOOTER = /^(?<token>BREAKING[ -]CHANGE|[A-Za-z][\w-]*)(?:(?<sep>: )|(?<hash> #))(?<value>.*)$/;

/**
 * Parse a header line into its raw groups ({type, scope, bang, colon, space, subject}), or null.
 * @param {string} header
 * @returns {{type: string, scope?: string, bang?: string, colon: string, space: string, subject: string} | null}
 */
export const parseHeader = (header) => HEADER.exec(header)?.groups || null;

/**
 * Strip git comment lines and the scissors section from a raw commit message.
 * @param {string} raw
 * @returns {string}
 */
export function cleanMessage(raw) {
  return String(raw).replace(/\r\n/g, '\n').replace(/^# -+ >8 -+[\s\S]*$/m, '').split('\n').filter((l) => !l.startsWith('#')).join('\n').replace(/\s+$/, '');
}

/**
 * @typedef {{ token: string, value: string }} Footer
 * @typedef {{
 *   header: string, type: string | null, scope: string | null, scopes: string[], subject: string | null,
 *   breaking: boolean, breakingNotes: string[], body: string | null, footers: Footer[],
 *   references: string[], merge: boolean, revert: { header: string, hash: string | null } | null, conventional: boolean
 * }} ParsedCommit
 */

/**
 * Parse a full commit message per Conventional Commits 1.0.0.
 * Breaking changes come from "!" in the header or BREAKING CHANGE / BREAKING-CHANGE footers.
 * @param {string} message
 * @returns {ParsedCommit}
 */
export function parseCommit(message) {
  const msg = cleanMessage(message);
  const lines = msg.split('\n');
  const header = lines[0] || '';
  const g = parseHeader(header);
  const conventional = !!(g && g.space && g.subject.trim() && !/\s/.test(g.type));
  // footers: the last paragraph (after a blank line) whose first line is "Token: value" or "Token #value"
  let footerStart = lines.length;
  for (let i = lines.length - 1; i >= 2; i--) {
    if (lines[i - 1].trim() === '' && lines[i].trim() !== '') { if (FOOTER.test(lines[i])) footerStart = i; break; }
  }
  const footers = [];
  for (const l of lines.slice(footerStart)) {
    const m = FOOTER.exec(l);
    if (m) footers.push({ token: m.groups.token, value: m.groups.value });
    else if (footers.length) footers[footers.length - 1].value += '\n' + l;
  }
  for (const f of footers) f.value = f.value.trim();
  const body = lines.slice(1, footerStart).join('\n').trim() || null;
  const breakingNotes = footers.filter((f) => /^BREAKING[ -]CHANGE$/.test(f.token)).map((f) => f.value);
  const refs = new Set();
  for (const m of msg.matchAll(/(?:^|[\s(])((?:[\w.-]+\/[\w.-]+)?#\d+|[A-Z][A-Z0-9]+-\d+)\b/g)) refs.add(m[1]);
  const scope = g?.scope?.trim() ? g.scope.trim() : null;
  const rev = /^Revert "(.*)"\s*$/.exec(header);
  const revHash = /This reverts commit ([0-9a-f]{7,40})/.exec(msg);
  return {
    header,
    type: g && !/\s/.test(g.type) ? g.type : null,
    scope,
    scopes: scope ? scope.split(/[,/]\s*/).map((s) => s.trim()).filter(Boolean) : [],
    subject: g ? g.subject.trim() : null,
    breaking: !!(g && g.bang) || breakingNotes.length > 0,
    breakingNotes,
    body,
    footers,
    references: [...refs],
    merge: /^Merge (pull request|branch|remote-tracking branch|tag|commit) /.test(header),
    revert: rev || (g && g.type === 'revert') ? { header: rev ? rev[1] : g.subject, hash: revHash ? revHash[1] : null } : null,
    conventional,
  };
}

/**
 * Release impact of a parsed commit: 'major' | 'minor' | 'patch' | null.
 * @param {ParsedCommit} c
 * @param {{ minor?: string[], patch?: string[] }} [opts] types mapped to minor (default feat) / patch (default fix, perf, revert)
 */
export function releaseType(c, { minor = ['feat'], patch = ['fix', 'perf', 'revert'] } = {}) {
  if (!c || !c.type) return null;
  if (c.breaking) return 'major';
  if (minor.includes(c.type)) return 'minor';
  if (patch.includes(c.type)) return 'patch';
  return null;
}

/**
 * Format a commit message from parts (used by the interactive prompt).
 * @param {{ type: string, scope?: string, subject: string, body?: string, breaking?: string | boolean, footers?: Footer[], issues?: string[] }} p
 */
export function formatCommit(p) {
  const bang = p.breaking ? '!' : '';
  const out = [`${p.type}${p.scope ? `(${p.scope})` : ''}${bang}: ${p.subject.trim()}`];
  if (p.body && p.body.trim()) out.push('', p.body.trim());
  const foot = [];
  if (typeof p.breaking === 'string' && p.breaking.trim()) foot.push(`BREAKING CHANGE: ${p.breaking.trim()}`);
  for (const i of p.issues || []) foot.push(`Refs: ${i}`);
  for (const f of p.footers || []) foot.push(`${f.token}: ${f.value}`);
  if (foot.length) out.push('', ...foot);
  return out.join('\n') + '\n';
}
