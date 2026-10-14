# Changelog

## 1.0.0 (2026-10-14)

First release, by Louis Wright.

- Lints a single message (`--message`, `--edit` for commit-msg hooks, `--file`, stdin) or every commit in a git range (`--from`/`--to`), skipping merge and revert commits by default.
- Rules: header-format, type-unknown, subject-empty, fixup-commit, type-case, scope-empty, scope-not-allowed, scope-case, header-max-length, breaking-change-format, wip-commit, missing-signoff, subject-case, subject-full-stop, body-leading-blank, footer-leading-blank, missing-issue-ref, subject-imperative, body-max-line-length.
- Suggested corrected header for every failing commit (type inferred from the wording, imperative mood, lowercase, no full stop).
- `--install-hook` writes a commit-msg hook (husky-aware).
- Text/JSON/SARIF/Markdown output, `--fail-on`, exit codes 0/1/2, allowlist with expiry, severity overrides.
- Composite GitHub Action with job summary.
