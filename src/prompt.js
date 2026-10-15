// Interactive commit prompt (commitizen-style) driven by a preset. Uses node:readline only.
import { createInterface } from 'node:readline';
import { formatCommit } from './parser.js';
import { lintMessage } from './lint.js';

/**
 * Ask for type, scope, subject, body, breaking change and issues; returns { message, findings }.
 * @param {{ types: {type: string, description?: string}[], scopes?: string[], options?: object }} preset
 * @param {{ input?: NodeJS.ReadableStream, output?: NodeJS.WritableStream }} [io]
 */
export async function prompt(preset, io = {}) {
  const rl = createInterface({ input: io.input || process.stdin, output: io.output || process.stdout, terminal: false });
  const lines = rl[Symbol.asyncIterator]();
  const out = io.output || process.stdout;
  const ask = async (q) => { out.write(q); const r = await lines.next(); return r.done ? '' : r.value.trim(); };
  try {
    out.write('Select the type of change:\n');
    preset.types.forEach((t, i) => out.write(`  ${String(i + 1).padStart(2)}) ${t.type.padEnd(10)} ${t.description || ''}\n`));
    let type = null;
    for (let tries = 0; !type && tries < 3; tries++) {
      const a = await ask('Type (number or name): ');
      type = preset.types[Number(a) - 1]?.type || preset.types.find((t) => t.type === a)?.type || null;
    }
    if (!type) throw new Error('No valid type chosen');
    const scope = await ask(`Scope${preset.scopes?.length ? ` (${preset.scopes.join(', ')})` : ''} (optional): `);
    let subject = '';
    for (let tries = 0; !subject && tries < 3; tries++) subject = await ask('Short description (imperative, lowercase): ');
    if (!subject) throw new Error('A description is required');
    const body = await ask('Longer description (optional): ');
    const breaking = await ask('Breaking change? Describe it, or leave empty: ');
    const issues = (await ask('Issues (e.g. #123, comma-separated, optional): ')).split(',').map((s) => s.trim()).filter(Boolean);
    const message = formatCommit({ type, scope: scope || undefined, subject, body, breaking: breaking || false, issues });
    const { findings } = lintMessage(message, preset.options || {});
    return { message, findings };
  } finally { rl.close(); }
}
