# Working on Todaymarks

Todaymarks is a small native macOS calendar (Tauri 2 + React/TS + Rust). It reads
Apple Calendar via EventKit, plus local SQLite events. Ships as a self-updating
`.app`/`.dmg` through GitHub Releases. Repo: `adambwhitten/todaymarks`.

This file is the standing context for how we build and release. Read it at the
start of every session.

## Running it locally

- **`scripts/run-app.sh`** — builds, signs with the stable local "Todaymarks Dev"
  cert, and reinstalls/launches `/Applications/Todaymarks.app`. Use this for the
  "real installed app" view; the dev cert keeps Calendar/Camera permission across
  rebuilds (see `scripts/setup-signing.sh`, run once).
- **`pnpm tauri dev`** — fast hot-reload for iterating on UI.
- Backend: `cd src-tauri && cargo build`. Frontend typecheck: `./node_modules/.bin/tsc --noEmit`.
  (Call binaries directly, not `pnpm <script>` — pnpm 11's esbuild build-script nag
  exits non-zero.)

## Shipping an update — the workflow

This is the core loop. When Adam says **"ship it"** / "push this as an update", do
the whole thing:

1. **Write the changelog.** Add a `## What's new in vX.Y.Z` section to the TOP of
   `RELEASE_NOTES.md`. This text is what users see in the in-app update card, so
   write it for them (plain, useful). I draft this copy.
2. **Cut the release:** `scripts/release.sh patch` (or `minor` / `major`). It bumps
   the version in package.json + Cargo.toml + tauri.conf.json, commits, and tags.
3. **Push:** `git push origin main && git push origin vX.Y.Z`.
   **The tag is what ships it** — pushing to `main` alone does nothing for users.
4. The tag triggers `.github/workflows/release.yml`: builds Apple Silicon + Intel,
   signs the update bundles, writes `latest.json`, publishes the GitHub Release.
5. **Verify** the run succeeds (`gh run watch`) and that `latest.json` looks right.
6. Installed apps check `latest.json` **on launch** and show an "Update available"
   card. It's a pull, not a push — users see it next time they open the app.

Default to committing straight to `main` (solo project). If Adam asks for a PR,
branch → PR → let CI pass → merge → then tag.

**Commit identity (don't get this wrong).** Author every commit as
`Adam Whitten <3663553+adambwhitten@users.noreply.github.com>` so GitHub credits
Adam's `adambwhitten` account. This is GitHub's privacy noreply address — do NOT
use `helptacoclout@gmail.com` (his Claude email; it's unlinked and won't show as a
contributor). The repo's `.git/config` is already set to this; in a fresh clone,
set it first:
`git config user.name "Adam Whitten" && git config user.email "3663553+adambwhitten@users.noreply.github.com"`.

## Signing model (don't break this)

- **Public releases** are signed ad-hoc with hardened runtime + `src-tauri/entitlements.plist`
  (camera + WebView JIT). Config: `bundle.macOS.signingIdentity: "-"`. This is what
  lets distributed builds get macOS permission prompts — a plain linker-signed build
  does NOT prompt, so never remove this.
- **Local dev builds** get re-signed with the "Todaymarks Dev" cert by `run-app.sh`
  for persistent permissions. That cert + the updater private key live OUTSIDE the
  repo (`~/.todaymarks-updater/`, `~/Library/Keychains/todaymarks-signing…`).
- The release workflow needs the GitHub Actions secret **`TAURI_SIGNING_PRIVATE_KEY`**
  (already set). The matching pubkey is in `tauri.conf.json`. Losing the private key
  breaks auto-update for everyone — there's a backup at `~/.todaymarks-updater/`.

## Never commit

- The updater private key or signing cert (they're outside the repo anyway).
- Any temporary demo flag (e.g. a `DEMO_UPDATE` in `UpdateBanner.tsx` used to preview
  the update toast) — revert before any release.

## Layout

`src/components` (month grid, agenda, modals, camera, update card) · `src/lib`
(api, date, layout, updater) · `src-tauri/src/providers` (apple = EventKit, local =
SQLite) · `commands.rs` is the invoke bridge · `models.rs` the shared event shape.
Reusable native-app packaging guide: `docs/NATIVE_APP_FRAMEWORK.md`.
