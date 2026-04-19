# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Sigil is

Sigil is a web app for signing Contributor License Agreements against open source repos. A maintainer drops a `CLA.md` in their repo root; contributors visit `sigil.io/cla/<forge>/<owner>/<repo>` and sign by opening a PR that commits a signature file to `.cla-signatures/<handle>.md`. Re-signing overwrites the file, revoking deletes it.

**The repo itself is the source of truth.** No database, no central signature store — every signature, revocation, and re-sign is auditable via Git history on the target repo. The hosted app is a thin frontend over the forge API: OAuth, open PR, poll for merge.

## Architecture

**Deno-first, Fresh 2.x.** Stack as pinned in `deno.json`:

- **Fresh** (`@fresh/core`) — file-system routing, server-rendered HTML, islands for interactivity
- **Vite** + `@fresh/plugin-vite` — build tool (Fresh 2.x runs on Vite, executed under Deno via npm: specifiers)
- **Preact** + `@preact/signals` — the component/state model for islands
- **Tailwind 4** via `@tailwindcss/vite`
- **Zod** — validate every query param and request body with `safeParse` (add as dep when we write the first route that needs it)
- **`@deno/gfm`** — runtime markdown → HTML for rendering fetched `CLA.md` bodies (add when we build the signing page)

No Octokit, no HTMX, no JWT library. Forge calls are plain `fetch`. Cookie auth uses Web Crypto `AES-GCM` to encrypt the access token — a library like `jose` is overkill when the payload is one opaque string only our server reads.

### Project structure (scaffolded by the Fresh installer)

```
routes/          # file-system routes; [param] for dynamic segments
  api/           # server-only handlers (no JSX)
  _app.tsx       # outer <html> wrapper
islands/         # client-hydrated Preact components (use sparingly)
components/      # server-rendered Preact components
assets/          # CSS (processed by Vite/Tailwind)
static/          # static files served as-is (favicon, logo, vendored CLA.md snapshots if any)
main.ts          # Fresh App entry — middleware, fsRoutes()
client.ts        # client entry loaded on every page
utils.ts         # `define` + `State` type for typed middleware/routes
vite.config.ts   # Fresh + Tailwind Vite plugins
```

Import alias `@/` resolves to repo root (set in `deno.json`).

### Routes (planned)

- `routes/index.tsx` — landing
- `routes/cla/[forge]/[owner]/[repo].tsx` — the signing page (the product)
- `routes/auth/[forge]/callback.ts` — OAuth callback (API-style, returns redirect)
- `routes/api/[forge]/...` — authenticated forge API proxy; unwraps the session cookie and calls the forge on behalf of the user so the access token never reaches the browser

### Multi-forge shape

Design everything as if GitHub and Codeberg are both supported, but only implement GitHub to start. The `<forge>` segment drives dispatch. Forge-specific code (OAuth endpoints, API base URL, PR creation call) goes behind an interface so adding Codeberg later is a new module, not a rewrite. Cookie name is forge-scoped: `session_github`, `session_codeberg`.

### Auth flow

GitHub OAuth App (web flow), scopes `public_repo read:user`. After callback:
1. Exchange code → access token
2. Encrypt token with AES-GCM (Web Crypto) using a server secret, 30-min expiry baked into the payload
3. Set as `session_<forge>` cookie: `HttpOnly`, `Secure`, `SameSite=Lax`

Server secret lives in an env var (e.g. `SIGIL_COOKIE_KEY`, base64-encoded 32 bytes).

## Artifact formats

### CLA.md (maintainer-authored, lives in target repo root)

Frontmatter + markdown body. Body is the CLA text shown to contributors.

```yaml
---
version: 1.0   # X.Y only
---
```

### Signature file (`.cla-signatures/<handle>.md`, committed by Sigil on the contributor's behalf)

Body is the full CLA text the contributor agreed to (copied from `CLA.md` at signing time — embedded so a later edit to `CLA.md` can't rewrite history).

Frontmatter:

```yaml
agreement_version: <version from CLA.md at signing time>
client: sigil@<version>
```

The filename stem is the canonical identity (lowercased GitHub handle) and must match the commit author — enforce this on PR creation, not in frontmatter. Signing time is the commit timestamp. The embedded body is the canonical record of what was signed; later edits to `CLA.md` don't rewrite history, and Git history on the signature file is the tamper-evidence.

### Gatekeeper (runs in the target repo, not Sigil)

Validation of signature PRs is a GitHub Action script that lives in the target repo and runs on PRs touching `.cla-signatures/`. It compares the PR against the repo's current `CLA.md`:

- signature file body === `CLA.md` body (verbatim)
- `agreement_version` === `CLA.md` frontmatter `version`
- filename stem === commit author handle (lowercased)
- PR touches exactly one file under `.cla-signatures/`

Sigil hosts and maintains this script (shipped as a reusable Action, to be authored later in a subdir of this repo) but does not run it. The split is deliberate: Sigil is UI + PR-opener, the repo's CI is the gate. This keeps "source of truth is the repo" honest — a maintainer who never points anyone at sigil.io can still accept signatures via the same Action.

## Commands

From `deno.json`:

- `deno task dev` — Vite dev server with HMR
- `deno task build` — produces `_fresh/` for production
- `deno task start` — runs the production build (`deno serve -A _fresh/server.js`)
- `deno task check` — `deno fmt --check`, `deno lint`, `deno check`
- `deno task update` — runs `jsr:@fresh/update` to upgrade Fresh

No test task yet. Single-file test: `deno test path/to/file_test.ts`; filter: `deno test --filter "name"`.

## Deploy

GitHub Actions runs `deno task build` and deploys `_fresh/` to Deno Deploy (scale-to-zero).

## Design

The signing-page UI is designed in Cloud Design separately and will be dropped in as source later — don't invent visual design for the signing flow until that arrives.
