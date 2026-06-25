#!/usr/bin/env bash
# Build the debug .app bundle, sign it with the stable "Todaymarks Dev" self-signed
# certificate (so macOS Calendar/Camera permission grants PERSIST across rebuilds),
# and launch it. Falls back to ad-hoc signing if the cert isn't set up.
# Set up the cert once with: scripts/setup-signing.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP="$ROOT/src-tauri/target/debug/bundle/macos/Todaymarks.app"
ID="com.todaymarks.app"
SIGN_ID="Todaymarks Dev"
KC="$HOME/Library/Keychains/todaymarks-signing.keychain-db"

echo "▸ Building app bundle…"
./node_modules/.bin/tauri build --debug --bundles app

echo "▸ Stopping any running instance…"
pkill -f "Todaymarks.app" 2>/dev/null || true
sleep 1

if security find-identity -p codesigning "$KC" 2>/dev/null | grep -q "$SIGN_ID"; then
  echo "▸ Signing with stable '$SIGN_ID' certificate (permissions persist)…"
  security unlock-keychain -p todaymarks "$KC" 2>/dev/null || true
  codesign --force --deep --sign "$SIGN_ID" --keychain "$KC" "$APP"
else
  echo "▸ Cert not found — signing ad-hoc (permissions reset each rebuild)…"
  codesign --force --sign - --identifier "$ID" "$APP/Contents/MacOS/todaymarks"
  codesign --force --deep --sign - --identifier "$ID" "$APP"
fi

echo "▸ Launching…"
open "$APP"
echo "✓ Todaymarks launched."
