# Sigil

Git-native Contributor License Agreements for open source.

Maintainers drop a `CLA.md` at their repo root. Contributors sign by opening a
pull request that commits `.cla-signatures/<handle>.md`. The repo itself is the
source of truth — every signature, revocation, and re-sign is a Git commit,
fully auditable. No database. No dashboard. No bot.

The hosted app at `sigil.io` is a thin frontend over the GitHub API: OAuth, open
PR, wait for the maintainer to merge.

## Development

Requires Deno 2.x.

```
deno task dev      # Vite dev server with HMR
deno task build    # production build
deno task start    # run the production build
deno task check    # fmt, lint, typecheck
```

OAuth needs `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` — see `.env.example`.

Architecture, conventions, and the signature-file spec:
[`CLAUDE.md`](CLAUDE.md).

## License

[AGPL-3.0-or-later](LICENSE).

Contributions require signing the Sigil [CLA](CLA.md).
