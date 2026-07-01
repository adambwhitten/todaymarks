#!/usr/bin/env bash
# Build the debug .app bundle, INSTALL it into /Applications, sign it with the
# stable "Todaymarks Dev" self-signed certificate (so macOS Calendar/Camera
# permission grants PERSIST across rebuilds), and launch that one copy.
# Falls back to ad-hoc signing if the cert isn't set up.
# Set up the cert once with: scripts/setup-signing.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BUNDLE="$ROOT/src-tauri/target/debug/bundle/macos/Todaymarks.app"
DEST="/Applications/Todaymarks.app"
ID="com.todaymarks.app"
SIGN_ID="Todaymarks Dev"
KC="$HOME/Library/Keychains/todaymarks-signing.keychain-db"
UPDATER_KEY="$HOME/.todaymarks-updater/todaymarks.key"

# `createUpdaterArtifacts` is on, so the bundler always signs an update tarball
# and fails if it can't find the private key. Supply it from the local backup
# for dev builds (the tarball itself is throwaway here — we only want the .app).
if [ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" ] && [ -f "$UPDATER_KEY" ]; then
  export TAURI_SIGNING_PRIVATE_KEY="$(cat "$UPDATER_KEY")"
  export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"
fi

echo "▸ Building app bundle…"
./node_modules/.bin/tauri build --debug --bundles app

# Stop every running copy — the freshly built bundle path AND any prior
# /Applications install — so we never end up with two dock icons.
echo "▸ Stopping any running instance…"
pkill -f "Todaymarks.app/Contents/MacOS/todaymarks" 2>/dev/null || true
sleep 1

echo "▸ Installing into /Applications…"
rm -rf "$DEST"
cp -R "$BUNDLE" "$DEST"

if security find-identity -p codesigning "$KC" 2>/dev/null | grep -q "$SIGN_ID"; then
  echo "▸ Signing with stable '$SIGN_ID' certificate (permissions persist)…"
  security unlock-keychain -p todaymarks "$KC" 2>/dev/null || true
  codesign --force --deep --sign "$SIGN_ID" --keychain "$KC" "$DEST"
else
  echo "▸ Cert not found — signing ad-hoc (permissions reset each rebuild)…"
  codesign --force --sign - --identifier "$ID" "$DEST/Contents/MacOS/todaymarks"
  codesign --force --deep --sign - --identifier "$ID" "$DEST"
fi

echo "▸ Launching…"
open "$DEST"
echo "✓ Todaymarks installed to /Applications and launched."
