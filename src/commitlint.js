// Read existing commitlint configuration and translate it into commit-gauge options.
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { DEFAULT_TYPES } from './parser.js';

export const COMMITLINT_FILES = ['.commitlintrc', '.commitlintrc.json', '.commitlintrc.yaml', '.commitlintrc.yml', '.commitlintrc.js', '.commitlintrc.cjs', '.commitlintrc.mjs', 'commitlint.config.js', 'commitlint.config.cjs', 'commitlint.config.mjs'];

/** Built-in equivalents of the common shareable configs, so they work without installing them. */
export const KNOWN_PRESETS = {
  '@commitlint/config-conventional': { rules: { 'type-enum': [2, 'always', DEFAULT_TYPES], 'header-max-length': [2, 'always', 100], 'body-max-line-length': [2, 'always', 100], 'subject-full-stop': [2, 'never', '.'], 'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']], 'type-case': [2, 'always', 'lower-case'], 'body-leading-blank': [1, 'always'], 'footer-leading-blank': [1, 'always'] } },
  '@commitlint/config-angular': { rules: { 'type-enum': [2, 'always', ['build', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'style', 'test']], 'header-max-length': [2, 'always', 72], 'subject-full-stop': [2, 'never', '.'] } },
};

function parseSimpleYaml(text) {
  // Minimal YAML for commitlint configs: "extends: [a]" / "- a" lists and "rules:" maps with [level, when, value] arrays.
  const out = {}; let section = null; let key = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, ''); if (!line.trim()) continue;
    const ind = line.match(/^ */)[0].length; const t = line.trim();
    const val = (v) => { v = v.trim(); if (v.startsWith('[')) { try { return JSON.parse(v.replace(/'/g, '"').replace(/"[^"]*"|[^\s,[\]"]+/g, (t) => (t.startsWith('"') || /^-?\d+$/.test(t) ? t : JSON.stringify(t)))); } catch { return v.slice(1, -1).split(',').map((x) => x.trim().replace(/^['"]|['"]$/g, '')); } } if (/^\d+$/.test(v)) return +v; return v.replace(/^['"]|['"]$/g, ''); };
    if (ind === 0) { const [k, ...r] = t.split(':'); const rest = r.join(':').trim(); key = k.trim(); section = key; out[key] = rest ? val(rest) : (key === 'rules' ? {} : []); continue; }
    if (t.startsWith('- ') && Array.isArray(out[section])) out[section].push(val(t.slice(2)));
    else if (section === 'rules') { const [k, ...r] = t.split(':'); out.rules[k.trim()] = val(r.join(':')); }
  }
  return out;
}

async function loadFile(file) {
  if (/\.(c?js|mjs)$/.test(file) || /\.commitlintrc\.(c?js|mjs)$/.test(file)) {
    if (file.endsWith('.cjs')) return createRequire(import.meta.url)(file);
    try { const m = await import(pathToFileURL(file).href); return m.default ?? m; } catch (e) { if (file.endsWith('.js')) return createRequire(import.meta.url)(file); throw e; }
  }
  const text = readFileSync(file, 'utf8');
  if (/\.ya?ml$/.test(file)) return parseSimpleYaml(text);
  try { return JSON.parse(text); } catch { return parseSimpleYaml(text); }
}

/** Find a commitlint config in dir: commitlint files or package.json "commitlint". Returns { file, config } or null. */
export async function findCommitlintConfig(dir) {
  for (const f of COMMITLINT_FILES) { const p = join(dir, f); if (existsSync(p)) return { file: f, config: await loadFile(p) }; }
  try { const pj = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')); if (pj.commitlint) return { file: 'package.json', config: pj.commitlint }; } catch {}
  return null;
}

function resolveExtends(cfg, dir, seen = new Set()) {
  const ext = [].concat(cfg.extends || []);
  let rules = {};
  for (const e of ext) {
    if (seen.has(e)) continue; seen.add(e);
    let base = KNOWN_PRESETS[e] || KNOWN_PRESETS[`@commitlint/config-${e}`];
    if (!base) { try { base = createRequire(join(resolve(dir), 'package.json'))(e); } catch { base = null; } }
    if (base) rules = { ...rules, ...resolveExtends(base, dir, seen) };
  }
  return { ...rules, ...(cfg.rules || {}) };
}

/**
 * Translate commitlint rules to commit-gauge lint options. Unsupported rules are listed in `unsupported`.
 * @param {object} cfg commitlint config ({ extends, rules })
 * @param {string} [dir]
 */
export function fromCommitlint(cfg, dir = '.') {
  const rules = resolveExtends(cfg || {}, dir);
  const out = {}; const unsupported = []; const disabled = [];
  for (const [name, spec] of Object.entries(rules)) {
    const [level, when = 'always', value] = Array.isArray(spec) ? spec : [spec];
    if (!level) { disabled.push(name); continue; }
    switch (name) {
      case 'type-enum': if (when === 'always') out.types = value; break;
      case 'scope-enum': if (when === 'always' && value?.length) out.scopes = value; break;
      case 'scope-empty': if (when === 'never') out.requireScope = true; break;
      case 'header-max-length': out.headerMaxLength = value; break;
      case 'body-max-line-length': out.bodyMaxLineLength = value; break;
      case 'subject-case': out.subjectCase = when === 'never' && [].concat(value).some((v) => /sentence|start|pascal|upper/.test(v)) ? 'lower' : 'any'; break;
      case 'signed-off-by': if (when === 'always') out.requireSignoff = true; break;
      case 'trailer-exists': if (when === 'always' && /^Signed-off-by/i.test(value || '')) out.requireSignoff = true; break;
      case 'references-empty': if (when === 'never') out.issuePattern = '(#\\d+|[A-Z][A-Z0-9]+-\\d+)'; break;
      case 'scope-case': out.scopeCase = when === 'always' && [].concat(value).includes('lower-case') ? true : out.scopeCase; break;
      case 'type-case': case 'subject-full-stop': case 'subject-empty': case 'type-empty': case 'body-leading-blank': case 'footer-leading-blank': break; // built in
      default: unsupported.push(name);
    }
  }
  if (disabled.includes('subject-case')) out.subjectCase = 'any';
  return { options: out, unsupported, disabled };
}
