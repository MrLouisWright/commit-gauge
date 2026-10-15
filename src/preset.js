// Shareable presets: a JSON (or JS) object with types (+ descriptions), scopes and lint options.
// Referenced from .commit-gauge.json as { "extends": "<file or package>" }.
import { readFileSync } from 'node:fs';
import { join, resolve, isAbsolute } from 'node:path';
import { createRequire } from 'node:module';
import { DEFAULT_TYPES } from './parser.js';

/** Default preset (Conventional Commits with descriptions, used by the prompt). */
export const DEFAULT_PRESET = {
  name: 'conventional',
  types: [
    { type: 'feat', description: 'A new feature' }, { type: 'fix', description: 'A bug fix' }, { type: 'docs', description: 'Documentation only' },
    { type: 'style', description: 'Formatting, no code change' }, { type: 'refactor', description: 'Code change that neither fixes a bug nor adds a feature' },
    { type: 'perf', description: 'Performance improvement' }, { type: 'test', description: 'Adding or fixing tests' }, { type: 'build', description: 'Build system or dependencies' },
    { type: 'ci', description: 'CI configuration' }, { type: 'chore', description: 'Other changes that don\'t touch src or tests' }, { type: 'revert', description: 'Revert a previous commit' },
  ],
};

/**
 * Normalise a preset: types may be strings or { type, description, emoji }.
 * @returns {{ name?: string, types: {type: string, description?: string, emoji?: string}[], scopes?: string[], options: object }}
 */
export function normalizePreset(p) {
  const types = (p.types || DEFAULT_TYPES).map((t) => (typeof t === 'string' ? { type: t } : t));
  const { types: _t, scopes, name, extends: _e, ...options } = p;
  return { name, types, scopes, options: { ...options, types: types.map((t) => t.type), ...(scopes ? { scopes } : {}) } };
}

/** Load a preset from a file path or an installed package name, relative to dir. */
export function loadPreset(ref, dir = '.') {
  if (ref === 'conventional' || ref === 'commit-gauge/conventional') return normalizePreset(DEFAULT_PRESET);
  let obj;
  if (/^[./]/.test(ref) || isAbsolute(ref)) {
    const p = resolve(dir, ref);
    obj = p.endsWith('.json') ? JSON.parse(readFileSync(p, 'utf8')) : createRequire(join(resolve(dir), 'x.js'))(p);
  } else obj = createRequire(join(resolve(dir), 'package.json'))(ref);
  obj = obj?.default ?? obj;
  return normalizePreset(obj);
}
