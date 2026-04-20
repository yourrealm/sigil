# Sigil

Signatures for open source.

Contributor License Agreements that live in your repo.

## How to adopt Sigil

### 01. Drop a `CLA.md` in your repo root

Frontmatter sets the agreement's display name and version. The body is the legal
text contributors agree to. Example:

```markdown
---
name: Realm
version: 1.0
---

By submitting a contribution to this project, you agree that:

1. **Ownership.** The contribution is your original work, or you have the right
   to submit it under this agreement.

2. **License grant.** You grant the maintainers and all downstream recipients a
   perpetual, worldwide, non-exclusive, royalty-free, irrevocable license to
   use, modify, and distribute your contribution.

3. **You keep your copyright.** You retain all rights to your contribution and
   may use it however you wish elsewhere.
```

### 02. Install the gatekeeper Action

Create `.github/workflows/sigil.yml`. With `auto-merge: true`, signature PRs
that pass all three checks (signature validity, CLA integrity, contributor
consent) merge automatically: revocations immediately, re-signs after a 30-day
cooldown to curb sign/revoke spam.

```yaml
name: Sigil
on: [pull_request_target]
permissions:
  pull-requests: write # post status comment, enable auto-merge on signature PRs
  contents: read # read CLA.md and signature files
jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: yourrealm/sigil@main
        with:
          auto-merge: true # default: false. Auto-merge signature PRs that pass all checks.
          auto-merge-method: REBASE # default: REBASE. Other options: MERGE, SQUASH.
          sign-cooldown-days: 30 # default: 30. Re-sign cooldown for the same contributor; revocations ignore this.
```

In your repo's **Settings → Pull Requests**, enable `Allow auto-merge`. For the
default method, also enable `Allow rebase merging`.

### 03. Share your signing URL

Point contributors at `withsigil.eu/cla/github/<owner>/<repo>`. They sign in
with GitHub and Sigil opens a pull request against your repo that adds
`.signatures/cla/<handle>.md`.

## Development

Requires Deno 2.x.

```
deno task dev           # Vite dev server with HMR
deno task build         # production build
deno task start         # run the production build
deno task check         # fmt, lint, typecheck, action tests
deno task test:action   # run just the action unit tests
```

OAuth needs `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. See `.env.example`.

Architecture, conventions, and the signature-file spec:
[`CLAUDE.md`](CLAUDE.md).

## License

[AGPL-3.0-or-later](LICENSE).

Contributions require signing the Sigil [CLA](CLA.md).
