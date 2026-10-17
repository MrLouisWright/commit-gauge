# Changelog

## 1.1.0 (2026-10-17)

Re-release: these changes were committed after 1.0.0 was published but never reached npm. 1.0.0 on npm is the original first release.

- **`commit-gauge/parser` subpath export:** a pure Conventional Commits 1.0.0 parser (`parseCommit`, `parseHeader`, `releaseType`, `formatCommit`, `cleanMessage`, `DEFAULT_TYPES`) with header, scopes, body, footers, BREAKING CHANGE notes, references, merge and revert detection. semver-gauge reuses it.
- **Reads existing commitlint configs:** `commitlint.config.{js,cjs,mjs}`, `.commitlintrc{,.json,.yaml,.yml,.js,.cjs,.mjs}` and package.json `commitlint`, including `extends: @commitlint/config-conventional` / `config-angular` (built in, no install needed). Maps type-enum, scope-enum, scope-empty, header-max-length, body-max-line-length, subject-case, signed-off-by, references-empty; `--no-commitlint` opts out.
- **PR linting:** `--pr-title` lints a PR title as the squash-merge header; `--github-pr` lints the title plus every commit in the PR from `GITHUB_EVENT_PATH`. The Action lints the PR title by default.
- **Shareable presets + interactive prompt:** presets (JSON/JS/package with typed descriptions, scopes and options) via `--preset` or `extends` in `.commit-gauge.json`; `commit-gauge prompt [--commit | --edit <file>]` builds a valid message commitizen-style.
- Dual ESM + CJS build, generated `.d.ts`, require/import CI checks.

## 1.0.0 (2026-10-15)

First release, by Louis Wright.

- Lints a single message (`--message`, `--edit` for commit-msg hooks, `--file`, stdin) or every commit in a git range (`--from`/`--to`), skipping merge and revert commits by default.
- Rules: header-format, type-unknown, subject-empty, fixup-commit, type-case, scope-empty, scope-not-allowed, scope-case, header-max-length, breaking-change-format, wip-commit, missing-signoff, subject-case, subject-full-stop, body-leading-blank, footer-leading-blank, missing-issue-ref, subject-imperative, body-max-line-length.
- Suggested corrected header for every failing commit (type inferred from the wording, imperative mood, lowercase, no full stop).
- `--install-hook` writes a commit-msg hook (husky-aware).
- Text/JSON/SARIF/Markdown output, `--fail-on`, exit codes 0/1/2, allowlist with expiry, severity overrides.
- Composite GitHub Action with job summary.
