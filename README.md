# Todaymarks

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A small, fast calendar for your Mac that gets out of the way.

<p align="center">
  <a href="https://github.com/adambwhitten/todaymarks/releases/latest/download/Todaymarks_aarch64.dmg"><img alt="Download for Apple Silicon" src="https://img.shields.io/badge/Download-Apple%20Silicon-0A84FF?style=for-the-badge&logo=apple&logoColor=white"></a>
  &nbsp;&nbsp;
  <a href="https://github.com/adambwhitten/todaymarks/releases/latest/download/Todaymarks_x86_64.dmg"><img alt="Download for Intel" src="https://img.shields.io/badge/Download-Intel-444444?style=for-the-badge&logo=apple&logoColor=white"></a>
</p>

<p align="center"><sub>Not sure which? &nbsp;Apple menu →  About This Mac. &nbsp;“Apple M1/M2/M3…” means Apple Silicon.</sub></p>

<img style="width:100%;" src="https://i.imgur.com/BQaiq4c.png">

I wanted a calendar that looked like the one in my head — a clean month grid,
a list of today's stuff underneath, dark, quiet, no clutter — and read straight
from the calendars I already keep in macOS. I couldn't find it, so I built it.

Todaymarks reads your **Apple Calendar** through the native EventKit API. That
means every account you've already connected in the macOS Calendar app —
iCloud, Google, Exchange, whatever — just shows up. No extra logins, no syncing
service, no account to create. Your data stays on your machine; there are no
servers and no telemetry.

> Heads up: this is a personal project I'm sharing, not a polished product.
> macOS-only and month view only (for now).

<!-- Add a screenshot here once you take one: ![Todaymarks](docs/screenshot.png) -->

## Install

**Download** the `.dmg` for your Mac (buttons above), open it, and drag
**Todaymarks** to Applications.

### First launch

Todaymarks is free and open-source, so it isn't notarized by Apple (that's a
$99/yr developer account). Because of that, the *first* time you open it macOS
will say it "can't verify the developer." That's expected — here's the one-time
approval:

1. Double-click **Todaymarks**, read the warning, and click **Done**.
2. Open **System Settings → Privacy & Security**, scroll down, and click
   **Open Anyway** next to Todaymarks.
3. Confirm once. After that it opens normally, forever.

**Prefer zero prompts?** This one line downloads it, drops it in `/Applications`,
and clears the quarantine flag so Gatekeeper never asks — nothing sketchy, just
`xattr -dr com.apple.quarantine`:

```bash
curl -fsSL https://raw.githubusercontent.com/adambwhitten/todaymarks/main/scripts/install.sh | bash
```

Either way you only do this once — Todaymarks **updates itself** after that. When
a new version ships it shows an "Update available" card; one click downloads it,
verifies the signature, and restarts.

## What it does

- Shows your month at a glance, with multi-day events as bars and a tidy
  "+N more" when a day gets busy.
- Lists the selected day's events underneath — drag the divider to make that
  list as tall as you want.
- Lets you **create, edit, and delete** events on any calendar you have write
  access to. Read-only calendars (like a locked-down work Exchange) stay
  read-only, and Todaymarks won't pretend otherwise.
- Picks which calendars to show and recolors them, from the calendar menu.
- Opens meeting links (Google Meet, Zoom, Teams…) straight into your browser.
- Has a **"How do I look?"** button — a quick webcam mirror for checking
  yourself before a call. Because I always forget to.

A few keys to make it feel native:

| Key | Does |
|-----|------|
| `←` / `→` | Previous / next month |
| `T` | Jump to today |
| `N` | New event |
| `⌘F` | Search events |
| `Esc` | Close a dialog |

## Build it yourself

You'll need [Node](https://nodejs.org) (see [`.nvmrc`](.nvmrc)),
[pnpm](https://pnpm.io), [Rust](https://rustup.rs/), and the Xcode Command Line
Tools (`xcode-select --install`).

```bash
git clone <your-fork-url> todaymarks
cd todaymarks
pnpm install
pnpm tauri dev      # run it
pnpm tauri build    # build a .app → src-tauri/target/release/bundle/
```

The first time you launch it, macOS will ask for **Calendar access** — that's
EventKit doing its job. Say yes and your events appear.

### A note on signing (for local dev)

EventKit is picky: macOS keys your permission grant to the app's code
signature. An ad-hoc signature changes on every build, so macOS forgets the
grant and re-asks every time. To avoid that during development, there's a
helper that creates a stable self-signed certificate once:

```bash
scripts/setup-signing.sh   # run once — makes a local "Todaymarks Dev" cert
scripts/run-app.sh         # build, sign with it, and launch
```

Now your Calendar (and Camera) permission sticks across rebuilds. The cert
lives in its own keychain on your machine and never touches the repo.

## How it's built

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript, Vite |
| Backend | Rust, Tauri 2 |
| Calendar | macOS EventKit via `objc2` |
| Local events | SQLite |
| Styling | hand-written CSS, dark theme |

```
todaymarks/
├── src/                    # React frontend
│   ├── components/         # month grid, agenda, modals, camera
│   ├── lib/                # Tauri command wrappers, date/layout helpers
│   └── styles/             # the design system, one CSS file
└── src-tauri/              # Rust backend
    └── src/
        ├── providers/      # apple (EventKit), local (SQLite)
        ├── commands.rs     # the bridge the frontend calls
        └── models.rs       # the shared event shape
```

The backend normalizes everything into one `CalendarEvent` shape, so the
frontend never has to care where an event came from. Providers live behind a
thin seam — Apple Calendar and local events today; Google or Outlook could slot
in the same way later.

## Cutting a release

Releases are automated. Add a section to [`RELEASE_NOTES.md`](RELEASE_NOTES.md),
then:

```bash
scripts/release.sh            # 0.1.0 -> 0.1.1 (or: minor / major)
git push origin main && git push origin v0.1.1
```

Pushing the tag kicks off [`.github/workflows/release.yml`](.github/workflows/release.yml),
which builds Apple Silicon + Intel, signs the update bundles, writes
`latest.json`, and publishes the GitHub Release. The in-app updater reads
`latest.json`; the notes you wrote show up in the update dialog.

This repo is wired up for `adambwhitten/todaymarks`. The one thing that isn't in
the repo (and never should be) is the **updater private key** — add it as a
GitHub Actions secret named **`TAURI_SIGNING_PRIVATE_KEY`**. Its public half is
already in `tauri.conf.json`; the private half signs every update. Lose it and
existing installs can't auto-update, so keep a backup.

Forking? Point the updater endpoint in
[`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json) and the `REPO` in
[`scripts/install.sh`](scripts/install.sh) at your own `owner/repo`, and generate
your own key with `tauri signer generate`.

For local development with persistent Calendar/Camera permission, see the
signing note above (`scripts/setup-signing.sh`).

## Why "Todaymarks"

Marks on today. The little ticks and notes that make up a day. Also it was the
name that didn't make me cringe.

## License

[MIT](LICENSE) — do what you like with it.
