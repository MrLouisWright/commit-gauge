# commit-gauge

[![npm version](https://img.shields.io/npm/v/commit-gauge.svg)](https://www.npmjs.com/package/commit-gauge) [![CI](https://github.com/MrLouisWright/commit-gauge/actions/workflows/ci.yml/badge.svg)](https://github.com/MrLouisWright/commit-gauge/actions/workflows/ci.yml) [![Node](https://img.shields.io/node/v/commit-gauge.svg)](https://nodejs.org) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> A lightweight Conventional Commits linter for git hooks and CI, with clear fix-up suggestions.

`commit-gauge` checks commit messages against [Conventional Commits](https://www.conventionalcommits.org/). It tells you what's wrong and also what to write instead. `Fixed the Login bug.` gets the suggestion `fix: fix the Login bug`, and `feature(API): Added new endpoint.` gets `feat(api): add new endpoint`. Use it as a `commit-msg` hook, on a single message, or on every commit in a pull request.

CLI, library and GitHub Action. Node.js 18+, **zero runtime dependencies** (commitlint needs dozens). By Louis Wright.

## Features

- **Inputs:** `--message`, `--edit` (the commit-msg hook file), `--file`, `--stdin`, or a git range `--from`/`--to`. Merge, revert and release commits are skipped. An all-zero `--from` (a new branch push) lints just the head commit.
- **Header rules:** format, allowed types (with the closest match: `feature` → `feat`, `bugfix` → `fix`), lowercase type and scope, empty and allowed scopes, empty subject, trailing full stop, sentence case, imperative mood (`added` → `add`), and max length.
- **Body/footer rules:** blank lines before body and footer, `BREAKING CHANGE:` spelling, line length (URLs exempt), optional `Signed-off-by` and issue-reference requirements.
- **History hygiene:** `fixup!`/`squash!`/`amend!` and WIP commits are caught before merge.
- **Hook installer:** `commit-gauge --install-hook` writes `.husky/commit-msg` if Husky is set up, otherwise `.git/hooks/commit-msg`.
- **Output:** text, JSON, SARIF 2.1.0 and Markdown; `--fail-on`; exit codes 0/1/2; allowlist entries with expiry dates.

## Rules

| Rule | Default severity | What it catches |
|---|---|---|
| `header-format` | high | Header is not "type(scope): subject" |
| `type-unknown` | high | Type is not in the allowed list |
| `subject-empty` | high | Subject (or whole message) is empty |
| `fixup-commit` | high | fixup!/squash!/amend! commit left in the history |
| `type-case` | medium | Type is not lowercase |
| `scope-empty` | medium | Empty scope "()" |
| `scope-not-allowed` | medium | Scope is not in the allowed list (or is required) |
| `header-max-length` | medium | Header is too long |
| `breaking-change-format` | medium | Malformed BREAKING CHANGE footer |
| `wip-commit` | medium | Work-in-progress commit |
| `missing-signoff` | medium | No Signed-off-by trailer (requireSignoff) |
| `subject-case` | low | Subject starts with an uppercase letter |
| `scope-case` | low | Scope is not lowercase |
| `subject-full-stop` | low | Subject ends with a full stop |
| `body-leading-blank` | low | No blank line between header and body |
| `footer-leading-blank` | low | No blank line before the footer |
| `missing-issue-ref` | low | No issue reference (issuePattern) |
| `subject-imperative` | info | Subject is not in the imperative mood |
| `body-max-line-length` | info | Body line is too long |
| `allowlist-expired` | medium | Allowlist entry has expired |
| `allowlist-unused` | info | Allowlist entry matched nothing |

## Install and run

```bash
npm install --save-dev commit-gauge
npx commit-gauge --install-hook                 # lint every commit message locally
npx commit-gauge -m "feature(API): Added new endpoint."
npx commit-gauge --from origin/main --to HEAD   # every commit on this branch
git log -1 --format=%B | npx commit-gauge --stdin
```

### Sample output

```text
commit-gauge — commit message
1 commit(s) linted, 1 with problems

HIGH     type "feature" is not one of: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert [type-unknown]
         ↳ fix: Use "feat". Suggested header: "feat(api): add new endpoint"
LOW      scope "API" should be lowercase [scope-case]
         ↳ fix: Use "api".
LOW      subject ends with a full stop [subject-full-stop]
         ↳ fix: Remove the trailing ".".
LOW      subject starts with an uppercase letter ("Added") [subject-case]
         ↳ fix: Use "added".

1 high, 3 low, 1 info
✖ Failing (fail-on: high).
```

## Options

```text
commit-gauge 1.0.0 — lint commit messages against Conventional Commits, with fix-up suggestions

Usage: commit-gauge [dir] [--message <msg> | --edit [file] | --file <file> | --stdin | --from <ref> --to <ref>] [options]
       commit-gauge --install-hook [--force]

Input (default: the last commit)
  -m, --message <msg>       Lint this message
  -e, --edit [file]         Lint the commit-msg hook file (default: .git/COMMIT_EDITMSG)
      --file <file>         Lint a message stored in a file
      --stdin               Read the message from stdin
      --from <ref>          Lint every commit in <from>..<to> (all-zero SHA = only <to>)
      --to <ref>            End of the range (default: HEAD)
Rules
      --types <list>        Allowed types (default: feat,fix,docs,style,refactor,perf,test,build,ci,chore,revert)
      --scopes <list>       Allowed scopes (default: any)
      --require-scope       A scope is mandatory
      --max-length <n>      Header max length (default: 100)
      --require-signoff     Require a Signed-off-by trailer
      --issue-pattern <re>  Require an issue reference matching this regex
      --no-merges-ignored   Also lint merge commits
Hooks
      --install-hook        Write a commit-msg hook (.husky/commit-msg if husky is set up, else .git/hooks)

Common
  -c, --config <file>     JSON config (default: .commit-gauge.json or "commitGauge" in package.json)
  -f, --format <fmt>      text (default) | json | sarif | markdown
      --json <file>       Also write a JSON report
      --sarif <file>      Also write SARIF 2.1.0
      --markdown <file>   Also write Markdown (e.g. for a job summary)
      --fail-on <sev>     critical | high | medium | low | info | none (default: high)
      --list-rules        Print rules and default severities
      --no-fixes          Hide fix suggestions in text output
      --no-color          Disable colours
  -v, --version / -h, --help

Exit codes: 0 = passed, 1 = findings at or above --fail-on, 2 = usage, config or read error.
```

## Configuration and allowlist

Options can live in `.commit-gauge.json` (or a `"commitGauge"` key in `package.json`, or `--config <file>`):

```json
{
  "failOn": "medium",
  "severity": { "subject-case": "low" },
  "allowlist": [
    { "rule": "header-max-length", "subject": "3f2a9c1*", "reason": "Historic commit, cannot be rewritten", "expires": "2027-03-31" }
  ],
  "types": ["feat", "fix", "docs", "chore", "refactor", "perf", "test", "build", "ci", "revert", "deps"],
  "scopes": ["cli", "core", "action"],
  "headerMaxLength": 72,
  "requireSignoff": false,
  "issuePattern": "#\\d+|[A-Z]+-\\d+"
}
```

- **`severity`** changes a rule's severity, or turns it `"off"`.
- **`allowlist`** entries suppress matching findings. Each needs a `reason` and matches on any combination of `rule`, `file`, `subject` (globs with `*`) and `match` (a substring of the message). Add `expires` (`YYYY-MM-DD`) so the exception is time-boxed: once it lapses the finding comes back along with an `allowlist-expired` finding (medium). Entries that no longer match anything are reported as `allowlist-unused` (info).

Other config keys: `requireScope`, `subjectCase` (`"lower"` or `"any"`), `bodyMaxLineLength`, `ignore` (regexes for headers to skip), `ignoreMerges`, `ignoreReverts`.

## Output and exit codes

- `--format text` (default), `json`, `sarif` (SARIF 2.1.0 for GitHub code scanning) or `markdown` (for job summaries and PR comments). `--json`, `--sarif` and `--markdown` write extra report files in the same run.
- `--fail-on <severity>` sets the threshold (`critical`, `high`, `medium`, `low`, `info`, `none`; default `high`).
- Exit codes: **0** passed, **1** findings at or above `--fail-on`, **2** usage, config or read error.

## GitHub Action

```yaml
permissions:
  contents: read
  security-events: write   # only needed for the SARIF upload
jobs:
  commit-gauge:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
        with: { persist-credentials: false, fetch-depth: 0 }
      - uses: MrLouisWright/commit-gauge@v1
        with:
          fail-on: high
          sarif: commit-gauge.sarif
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with: { sarif_file: commit-gauge.sarif }
```

| Input | Description | Default |
|---|---|---|
| `path` | Project directory | `.` |
| `from` | Base ref (default: PR base SHA or the push before SHA) | `${{ github.event.pull_request.base.sha || github.event.before }}` |
| `to` | Head ref (default: HEAD) | `HEAD` |
| `fail-on` | Failure threshold | `high` |
| `config` | Config file path | |
| `sarif` / `json` | Write SARIF / JSON report to this path | |
| `job-summary` | Add the Markdown report to the job summary | `true` |
| `args` | Extra CLI arguments | |

The action runs the bundled CLI with Node 20; it has no dependencies to install. Pin it to a commit SHA if your policy requires it.

In pull requests the action lints `base..head`; on pushes it lints `before..after`. Use `fetch-depth: 0` so the range is available.

## Library

```js
import { lintMessage } from 'commit-gauge';
const r = lintMessage('Fixed the login bug.');
r.findings[0].rule; // 'header-format'
r.suggestion;       // 'fix: fix the login bug'
```

Types are included.

## Requirements

Node.js 18 or newer. Zero runtime dependencies.

## Support

If this project is useful to you, you can support its development with a donation: [Buy me a coffee](https://donate.stripe.com/aFa00lek3cvX4Ds2Fk9EI0b). It helps keep these tools maintained, documented and free for everyone.

## Licence

MIT © Louis Wright ([Louis Wright](https://github.com/MrLouisWright))
