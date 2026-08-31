# CI — one manual step needed

`docs/ci-workflow.yml` is a ready GitHub Actions workflow: `bun install` →
`type-check` → `lint` → `test` → `build`. It is **not** at
`.github/workflows/ci.yml` because pushing a file into `.github/workflows/`
requires the `workflow` OAuth scope, which the token on this machine does not
have — the same reason commit `ad43e75` removed a workflow file earlier.

Nothing is lost: the file is complete and correct, it just is not active yet.

## To activate it

```bash
gh auth refresh -s workflow           # one-time, opens a browser
mkdir -p .github/workflows
git mv docs/ci-workflow.yml .github/workflows/ci.yml
git commit -m "ci: enable type-check, lint, test and build on push"
git push
```

Or paste the contents into a new file through the GitHub web UI
(Actions → New workflow → set up a workflow yourself), which needs no scope change.

## Why this matters here

Until CI runs, nothing enforces the gates. This repo had no CI, `bun run lint`
was failing, ESLint covered zero `.tsx` files, and both test runners were broken
— which is how a stale-closure bug that silently dropped GPS from every
collection stayed in the codebase for 116 commits. The gates only hold if
something fails the build when they break.
