# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## What Sigil is

Sigil is a web app for signing Contributor License Agreements against open
source repos. A maintainer drops a `CLA.md` in their repo root; contributors
visit `withsigil.eu/cla/<forge>/<owner>/<repo>` and sign by opening a PR that
commits a signature file to `.signatures/cla/<handle>.md`. Re-signing overwrites
the file, revoking deletes it.

**The repo itself is the source of truth.** No database, no central signature
store - every signature, revocation, and re-sign is auditable via Git history on
the target repo. The hosted app is a thin frontend over the forge API: OAuth,
open PR, poll for merge.

## Architecture

**Deno-first, Fresh 2.x.** Stack as pinned in `deno.json`:

- **Fresh** (`@fresh/core`) - file-system routing, server-rendered HTML, islands
  for interactivity
- **Vite** + `@fresh/plugin-vite` - build tool (Fresh 2.x runs on Vite, executed
  under Deno via npm: specifiers)
- **Preact** + `@preact/signals` - the component/state model for islands
- **Tailwind 4** via `@tailwindcss/vite`
- **Zod** - validate every query param and request body with `safeParse` (add as
  dep when we write the first route that needs it)
- **`@deno/gfm`** - runtime markdown → HTML for rendering fetched `CLA.md`
  bodies (add when we build the signing page)

Forge calls are plain `fetch`. Auth is a KV-backed session cookie (see Auth flow
below) - access tokens live in Deno KV, the browser only ever sees an opaque
session id in an HttpOnly cookie.

Client data layer: **`@tanstack/preact-query`** (SSR-safe, works in islands via
`npm:` specifier). Install it the first time we actually issue a proxy call -
not scaffolded yet.

### Project structure

```
src/
  routes/
    index.tsx                         # landing
    cla/[forge]/[owner]/[repo].tsx    # signing page (the product)
    auth/[forge]/login.ts             # OAuth start - sets state cookie, redirects to forge
    auth/[forge]/callback.ts          # OAuth finish - exchanges code, creates KV session
    auth/[forge]/logout.ts             # POST - clears session
    api/[forge]/[...path].ts          # forge API proxy (session-optional)
    _app.tsx                          # outer <html> wrapper
  islands/SignBox.tsx                 # sign-card state machine + dialogs + dev bar
  lib/
    forge.ts                          # forge registry (OAuth endpoints, API base, scopes)
    sessions.ts                       # Deno KV session store
    cookies.ts                        # parse / build / clear cookies
  assets/styles.css                   # Tailwind 4 @theme + custom brutalism CSS
  main.ts                             # Fresh App entry
  client.ts                           # client entry (loads styles)
  utils.ts                            # `define` + `State` type
static/                               # served as-is (favicon, logo)
vite.config.ts                        # Fresh + Tailwind Vite plugins (points plugin at ./src)
```

Import alias `@/` resolves to `./src/` (set in `deno.json`). Root stays reserved
for config/build artifacts.

### Multi-forge shape

Design everything as if GitHub and Codeberg are both supported, but only
implement GitHub to start. The `<forge>` segment drives dispatch. Forge-specific
code (OAuth endpoints, API base URL, PR creation call) goes behind an interface
so adding Codeberg later is a new module, not a rewrite. Cookie name is
forge-scoped: `session_github`, `session_codeberg`.

### Auth flow

GitHub OAuth App (web flow), scopes `public_repo read:user`. After callback:

1. Exchange code → access token (server-side; `client_secret` never touches the
   browser)
2. Generate a random opaque `sessionId` (32 bytes, base64url)
3. Write `{ token, login, forge }` to **Deno KV** at `["sessions", sessionId]`
   with `expireIn: 30 * 60 * 1000` - KV evicts it automatically at 30 min
4. Set `session_<forge>` cookie carrying `sessionId`: `HttpOnly`, `Secure`,
   `SameSite=Lax`

The token never reaches the browser. XSS can't exfiltrate what isn't there. Log
out = delete the KV row. Rotate = write a new row, overwrite cookie.

**Deno KV works identically in dev and prod.** `Deno.openKv()` opens a local
SQLite file in dev, hosted globally-replicated KV on Deno Deploy. Enabled via
`"unstable": ["kv"]` in `deno.json` (Deno 2 still gates KV behind the flag).

### Proxy

`routes/api/[forge]/[...path].ts` forwards any request to the forge's REST API.
Session-optional: if a valid session cookie is present, the proxy attaches
`Authorization: token <access_token>` from KV; otherwise the request goes
through unauthenticated, which is fine for public-repo reads. GitHub's rate
limits and token scopes are the real gates - we don't pre-validate paths. The
proxy strips hop-by-hop headers + the client's `Cookie`/`Authorization` before
forwarding.

No auth state on the client. The frontend makes same-origin fetches to
`/api/github/...` and treats 401 as "session expired, re-auth."

OAuth is configured via env vars (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`).
See `.env.example`.

## Artifact formats

### CLA.md (maintainer-authored, lives in target repo root)

Frontmatter + markdown body. Body is the CLA text shown to contributors.

```yaml
---
name: Realm        # project/agreement display name; used in the signing page heading
version: 1.0       # X.Y - quoted or unquoted is fine; integers are normalized to X.0
---
```

`name` drives the rendered heading on the signing page (e.g. "Realm Contributor
License Agreement"), and is embedded into each signature's `attestation` line.
Required.

### Signature file (`.signatures/cla/<handle>.md`, committed by Sigil on the contributor's behalf)

Body is the full CLA text the contributor agreed to (copied from `CLA.md` at
signing time - embedded so a later edit to `CLA.md` can't rewrite history).

Frontmatter:

```yaml
agreement_version: "<version from CLA.md at signing time>"
attestation: "I, @<handle>, agree to the following <name> Contributor License Agreement, version <version>."
client: sigil@<version>
```

The filename stem is the canonical identity (lowercased GitHub handle) and must
match the commit author - enforce this on PR creation, not in frontmatter.
Signing time is the commit timestamp. The embedded body is the canonical record
of what was signed; later edits to `CLA.md` don't rewrite history, and Git
history on the signature file is the tamper-evidence.

### Gatekeeper (runs in the target repo, not Sigil)

Validation of signature PRs is a GitHub Action script that lives in the target
repo and runs on PRs touching `.signatures/cla/`. It compares the PR against
the repo's current `CLA.md`:

- signature file body === `CLA.md` body (verbatim)
- `agreement_version` === `CLA.md` frontmatter `version`
- `attestation` === `"I, @<handle>, agree to the following <name> Contributor License Agreement, version <version>."` (with handle/name/version matching the other checks)
- filename stem === commit author handle (lowercased)
- PR touches exactly one file under `.signatures/cla/`

Sigil hosts and maintains this script (shipped as a reusable Action, to be
authored later in a subdir of this repo) but does not run it. The split is
deliberate: Sigil is UI + PR-opener, the repo's CI is the gate. This keeps
"source of truth is the repo" honest - a maintainer who never points anyone at
withsigil.eu can still accept signatures via the same Action.

## Commands

From `deno.json`:

- `deno task dev` - Vite dev server with HMR
- `deno task build` - produces `_fresh/` for production
- `deno task start` - runs the production build
  (`deno serve -A _fresh/server.js`)
- `deno task check` - `deno fmt --check`, `deno lint`, `deno check`
- `deno task update` - runs `jsr:@fresh/update` to upgrade Fresh

No test task yet. Single-file test: `deno test path/to/file_test.ts`; filter:
`deno test --filter "name"`.

## Deploy

GitHub Actions runs `deno task build` and deploys `_fresh/` to Deno Deploy
(scale-to-zero).

## Design

Neobrutalism - hard 2.5px black strokes, `6px 6px 0 #111114` offset shadows, no
border-radius, yellow `#FFD400` / navy `#001E62` / red `#F80035` / green
`#007A3D` pigments for state; Archivo Black (display), Source Serif 4 (CLA
body), JetBrains Mono (labels), Inter (UI). Phosphor duotone icons. Ported from
the Claude Design handoff; design tokens live in `assets/styles.css` (`@theme`
block) plus the custom brutalism CSS below it.

The signing page lives at `routes/cla/[forge]/[owner]/[repo].tsx` with all
interactive surface in `islands/SignBox.tsx`. Demo content (Realm CLA, user
`@benjick`) is hardcoded in the island - real data wiring (OAuth + GitHub API
fetch of `CLA.md` and signature state) is TBD. A dev bar at the top of the
island lets you force any state; keyboard `1`–`7` also switches states. Remove
for production.

### Sign-card state machine (7 states)

`loggedOut` → sign in · `loggedIn` → agree + open sign PR · `resignNeeded` →
banner + compare + re-sign · `submitting` → step-by-step animation of the fork

- commit + PR flow · `signed` → PR receipt + artifact details + revoke link ·
  `revoke` → confirm UI with reason textarea (reason goes to PR body, not
  frontmatter) · `revoking` → step-by-step animation of the delete + commit + PR
  flow.

After revocation merges, the user re-enters `loggedIn` on next page load -
"revoked" is not a distinct terminal state.
