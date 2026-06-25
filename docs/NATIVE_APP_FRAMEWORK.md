# Shipping a native desktop app (macOS + Windows)

A reusable playbook for building a real, installable desktop app with
**self-updating** — the same structure Todaymarks and Ship Studio use. It's
framework-only: nothing here is calendar-specific. Copy it into any new project.

The shape of it:

- **Tauri 2** wraps a web frontend (React/TS/Vite here, but any works) in a
  native shell with a small **Rust** backend. One codebase → a `.app`/`.dmg` on
  macOS and an `.exe`/installer on Windows.
- **Tauri's updater plugin** gives you the "Update available → click → restart"
  flow, secured by your own signing key.
- **GitHub Actions + GitHub Releases** build, sign, and host everything for
  free. The app reads a `latest.json` manifest to know when to update.
- A **one-line `curl | bash` installer** handles first install on macOS without
  paying Apple for notarization.

---

## 1. The skeleton

```
my-app/
├── package.json              # frontend deps + scripts; "version" is the source of truth
├── index.html
├── vite.config.ts
├── src/                      # web frontend
│   └── lib/updater.ts        # thin wrappers over the updater plugin
│   └── components/UpdateBanner.tsx
├── src-tauri/
│   ├── Cargo.toml            # Rust deps (keep "version" in sync with package.json)
│   ├── tauri.conf.json       # app config: bundle targets, updater endpoint + pubkey
│   ├── capabilities/default.json   # which plugin permissions the window may use
│   ├── Info.plist            # macOS usage strings (camera, calendar, …)
│   └── src/lib.rs            # registers plugins + commands
├── scripts/
│   ├── release.sh            # bump version everywhere, commit, tag
│   └── install.sh            # macOS curl installer (de-quarantines)
├── .github/workflows/
│   ├── ci.yml                # typecheck + cargo check on PRs
│   └── release.yml           # tag v* → build, sign, publish
└── RELEASE_NOTES.md          # changelog; top section feeds the update dialog
```

The golden rule: **the version lives in three files** — `package.json`,
`src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` — and they must always
match. `scripts/release.sh` bumps all three so you never do it by hand.

---

## 2. The updater, end to end

Auto-update has two halves that people conflate: **update signing** (proves the
download is really yours — required, free) and **OS code signing** (Gatekeeper /
SmartScreen trust — optional, costs money). Keep them separate in your head.

### a. Generate an update signing key (once, free)

```bash
npx tauri signer generate -w ~/.my-app-updater/key
```

This prints a **public key** and writes a **private key** file. The private key
signs every release; the public key is baked into the app to verify downloads.
**Store the private key outside the repo** and never commit it.

### b. Configure the app

`src-tauri/tauri.conf.json`:

```jsonc
{
  "bundle": {
    "active": true,
    "targets": ["app", "dmg"],        // macOS; Windows uses ["nsis"] (see §5)
    "createUpdaterArtifacts": true,    // emits the .tar.gz/.zip + .sig the updater needs
    "macOS": { "minimumSystemVersion": "14.0" }
  },
  "plugins": {
    "updater": {
      "endpoints": [
        "https://github.com/OWNER/REPO/releases/latest/download/latest.json"
      ],
      "pubkey": "<the public key from step a>"
    }
  }
}
```

Add the Rust plugins (`src-tauri/Cargo.toml`):

```toml
tauri-plugin-updater = "2"
tauri-plugin-process = "2"   # for relaunch() after install
```

Register them (`src-tauri/src/lib.rs`), desktop-only:

```rust
let mut builder = tauri::Builder::default();
#[cfg(desktop)]
{
    builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());
}
```

Grant the window permission (`src-tauri/capabilities/default.json`):

```json
{ "permissions": ["updater:default", "process:default"] }
```

Frontend deps: `@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process`.

### c. The in-app UX

On launch, check; if there's an update, show a card with the release notes and
an install button. The plugin downloads, verifies the signature against your
pubkey, swaps the bundle, and relaunches.

```ts
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

const update = await check();           // null if up to date
if (update) {
  await update.downloadAndInstall(/* progress callback */);
  await relaunch();
}
```

Because the *app itself* downloads the update, the new bundle is never
quarantined — so updates are seamless even on the free (un-notarized) path.

---

## 3. Code signing & Gatekeeper — the free path

A downloaded app is quarantined by macOS. Gatekeeper then refuses to open
anything that isn't **notarized** (which needs the **Apple Developer Program,
$99/yr**). Two ways around it:

- **Pay for it.** Enroll, add a "Developer ID Application" cert + an App Store
  Connect API key as GitHub secrets, set `APPLE_SIGNING_IDENTITY` in the build,
  and let `tauri-action`/the bundler notarize. Users double-click and it just
  opens. Worth it if you have non-technical users.
- **Skip it (free).** Ship the app ad-hoc-signed (the bundler does this by
  default) and remove the quarantine flag at install time:
  `xattr -dr com.apple.quarantine /Applications/MyApp.app`. That's exactly what
  `scripts/install.sh` automates. Update signatures (§2) still protect users —
  you've just opted out of *Apple's* trust chain, not your own.

The free path is what Todaymarks and Ship Studio ship today. You can switch to
notarized later without changing the updater at all.

> **Local dev tip:** an ad-hoc signature changes every build, so macOS keeps
> re-asking for Calendar/Camera/etc. permissions. Create a stable **self-signed
> cert** once and sign dev builds with it — macOS then keys the permission grant
> to the cert, not the binary hash, and it persists across rebuilds. See
> `scripts/setup-signing.sh` for the recipe (the key trick is
> `security set-key-partition-list … -k <keychain-pw>` so `codesign` never
> prompts).

---

## 4. Versioning & changelog

`RELEASE_NOTES.md` is both the human changelog and the source of the in-app
update notes. Newest section on top:

```markdown
## What's new in v0.2.0

- **Thing** — what changed.
```

`scripts/release.sh [patch|minor|major]` bumps the three version files, refreshes
`Cargo.lock`, commits, and tags. Pushing the tag does the rest.

---

## 5. The release pipeline (GitHub Actions)

`.github/workflows/release.yml` runs on `push: tags: v*`:

1. **Build matrix** — `aarch64-apple-darwin` + `x86_64-apple-darwin` on
   `macos-latest`. (Add a Windows runner for `.exe`; see below.)
2. **Build + sign** — `tauri build --target <arch>` with the update key in
   `TAURI_SIGNING_PRIVATE_KEY` (a GitHub Actions **secret**). This emits the
   `.dmg`, the updater `.app.tar.gz`, and its `.sig`.
3. **Assemble `latest.json`** — combine each platform's signature + download URL
   into the manifest the updater polls:

   ```json
   {
     "version": "0.2.0",
     "notes": "…top of RELEASE_NOTES.md…",
     "pub_date": "2026-…Z",
     "platforms": {
       "darwin-aarch64": { "signature": "…", "url": ".../MyApp_aarch64.app.tar.gz" },
       "darwin-x86_64":  { "signature": "…", "url": ".../MyApp_x86_64.app.tar.gz" },
       "windows-x86_64": { "signature": "…", "url": ".../MyApp_x64-setup.exe" }
     }
   }
   ```
4. **Publish** the GitHub Release with the DMGs/installers, the updater bundles,
   and `latest.json`. The updater endpoint
   `…/releases/latest/download/latest.json` always resolves to the newest one.

The **only secret you must add** for the free path is `TAURI_SIGNING_PRIVATE_KEY`
(the update key). Notarization adds the Apple secrets listed in §3.

> If your *source* repo is private but you still want public download URLs,
> publish the artifacts + `latest.json` to a separate **public "releases" repo**
> (Ship Studio's approach). For a public source repo, the same repo's Releases
> are fine.

---

## 6. The macOS installer

`scripts/install.sh` is the user-facing front door:

```bash
curl -fsSL https://raw.githubusercontent.com/OWNER/REPO/main/scripts/install.sh | bash
```

It detects the arch (`uname -m`), downloads
`releases/latest/download/MyApp_<arch>.dmg`, copies the app to `/Applications`,
runs `xattr -dr com.apple.quarantine`, and launches it. (Upload the DMG under a
**stable, version-less name** in the workflow so this URL never changes.)

---

## 7. Windows parity

Tauri builds Windows from the same project — the moving parts just swap:

| Concern | macOS | Windows |
|---------|-------|---------|
| Installer | `.dmg` | `.nsis` `-setup.exe` (or `.msi`) |
| Bundle target | `["app","dmg"]` | `["nsis"]` |
| Updater bundle | `.app.tar.gz` + `.sig` | `-setup.exe` + `.sig` (zip) |
| Manifest key | `darwin-aarch64` / `darwin-x86_64` | `windows-x86_64` |
| OS trust | Gatekeeper / notarization | SmartScreen / Authenticode cert |
| Quarantine fix | `xattr -dr com.apple.quarantine` | n/a (SmartScreen "More info → Run anyway") |

Notes:

- Build Windows on a `windows-latest` runner. Ship Studio keeps it in a
  **separate workflow** (`release-windows.yml`) triggered by `-win` tags so the
  two platforms can ship independently, and carries the macOS artifacts forward
  so one Release holds everything.
- The **update signing key is the same** across platforms — only the per-OS
  bundle and the `latest.json` platform key differ. Many projects publish a
  `latest.json` (macOS) and a `latest-windows.json` and point each platform's
  updater endpoint at the right one.
- Windows code signing uses an **Authenticode certificate** (from a CA, paid).
  Without it, SmartScreen warns until your download earns reputation. There's no
  free `xattr`-style bypass — users click "More info → Run anyway", or you buy a
  cert.

---

## First-time checklist

- [ ] `npx tauri signer generate` → save the private key outside the repo.
- [ ] Put the **public** key + your `releases/latest/download/latest.json`
      endpoint in `tauri.conf.json`; set `createUpdaterArtifacts: true`.
- [ ] Add `tauri-plugin-updater` + `tauri-plugin-process`, register them, grant
      `updater:default` + `process:default`.
- [ ] Add the `UpdateBanner` (check on launch → download → relaunch).
- [ ] Add `TAURI_SIGNING_PRIVATE_KEY` as a GitHub Actions secret.
- [ ] Replace `OWNER/REPO` in `tauri.conf.json` and `install.sh`.
- [ ] Write `RELEASE_NOTES.md`, run `scripts/release.sh`, push the tag.
- [ ] (Optional) Pay for Apple notarization / a Windows cert to drop the
      Gatekeeper/SmartScreen warnings.
