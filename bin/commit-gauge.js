#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { runCli, check, RULES, splitList, UsageError, installHook } from '../src/index.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const argv = process.argv.slice(2);
if (argv.includes('--install-hook')) {
  try { const r = installHook(process.cwd(), { force: argv.includes('--force') }); process.stdout.write(r.changed ? `commit-gauge: wrote ${r.file}\n` : `commit-gauge: ${r.file} already runs commit-gauge\n`); process.exitCode = 0; } catch (e) { process.stderr.write(`commit-gauge: ${e.message}\n`); process.exitCode = 2; }
} else {
  runCli({
    name: 'commit-gauge', version: pkg.version, configKey: 'commitGauge', rules: RULES,
    tagline: 'lint commit messages against Conventional Commits, with fix-up suggestions',
    usage: `Usage: commit-gauge [dir] [--message <msg> | --edit [file] | --file <file> | --stdin | --from <ref> --to <ref>] [options]
       commit-gauge --install-hook [--force]`,
    help: `Input (default: the last commit)
  -m, --message <msg>       Lint this message
  -e, --edit [file]         Lint the commit-msg hook file (default: .git/COMMIT_EDITMSG)
      --file <file>         Lint a message stored in a file
      --stdin               Read the message from stdin
      --from <ref>          Lint every commit in <from>..<to> (all-zero SHA = only <to>)
      --to <ref>            End of the range (default: HEAD)
Rules
      --types <list>        Allowed types (default: ${'feat,fix,docs,style,refactor,perf,test,build,ci,chore,revert'})
      --scopes <list>       Allowed scopes (default: any)
      --require-scope       A scope is mandatory
      --max-length <n>      Header max length (default: 100)
      --require-signoff     Require a Signed-off-by trailer
      --issue-pattern <re>  Require an issue reference matching this regex
      --no-merges-ignored   Also lint merge commits
Hooks
      --install-hook        Write a commit-msg hook (.husky/commit-msg if husky is set up, else .git/hooks)
`,
    options: { message: { type: 'string', short: 'm' }, edit: { type: 'boolean', short: 'e' }, file: { type: 'string' }, stdin: { type: 'boolean' }, from: { type: 'string' }, to: { type: 'string' }, types: { type: 'string', multiple: true }, scopes: { type: 'string', multiple: true }, 'require-scope': { type: 'boolean' }, 'max-length': { type: 'string' }, 'require-signoff': { type: 'boolean' }, 'issue-pattern': { type: 'string' }, 'no-merges-ignored': { type: 'boolean' } },
    dirFrom: (o, pos) => (o.edit ? '.' : pos[0] || '.'),
    run: async ({ dir, values: o, positionals, config, configFile }) => {
      let message; let source;
      if (o.message != null) message = o.message;
      else if (o.edit) { source = positionals[0] || (() => { try { return execFileSync('git', ['rev-parse', '--git-path', 'COMMIT_EDITMSG'], { cwd: dir, encoding: 'utf8' }).trim(); } catch { return '.git/COMMIT_EDITMSG'; } })(); message = readFileSync(resolve(dir, source), 'utf8'); }
      else if (o.file) { source = o.file; message = readFileSync(resolve(o.file), 'utf8'); }
      else if (o.stdin) message = readFileSync(0, 'utf8');
      if (o['max-length'] && !/^\d+$/.test(o['max-length'])) throw new UsageError('--max-length must be a number');
      if (o['issue-pattern']) { try { new RegExp(o['issue-pattern']); } catch (e) { throw new UsageError(`Invalid --issue-pattern: ${e.message}`); } }
      const lint = { types: o.types ? splitList(o.types) : undefined, scopes: o.scopes ? splitList(o.scopes) : undefined, requireScope: o['require-scope'] || undefined, headerMaxLength: o['max-length'] ? +o['max-length'] : undefined, requireSignoff: o['require-signoff'] || undefined, issuePattern: o['issue-pattern'], ignoreMerges: o['no-merges-ignored'] ? false : undefined };
      return check(dir, { message, source, from: o.from, to: o.to, lint, toolVersion: pkg.version }, config, configFile);
    },
  }, argv).then((code) => { process.exitCode = code; }, (e) => { process.stderr.write(`commit-gauge: ${e.stack || e}\n`); process.exitCode = 2; });
}
