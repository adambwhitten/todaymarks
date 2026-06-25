#!/usr/bin/env bash
# Todaymarks installer.
#
#   curl -fsSL https://raw.githubusercontent.com/adambwhitten/todaymarks/main/scripts/install.sh | bash
#
# Downloads the latest release for your Mac, installs it to /Applications, and
# removes the Gatekeeper quarantine flag so it opens without a warning (the app
# isn't notarized — it's a free, open-source build). Updates after this happen
# automatically inside the app.
set -euo pipefail

REPO="adambwhitten/todaymarks"
APP="Todaymarks.app"

case "$(uname -m)" in
  arm64)  ARCH="aarch64" ;;
  x86_64) ARCH="x86_64" ;;
  *) echo "Unsupported architecture: $(uname -m)"; exit 1 ;;
esac

URL="https://github.com/$REPO/releases/latest/download/Todaymarks_${ARCH}.dmg"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "▸ Downloading Todaymarks ($ARCH)…"
if ! curl -fsSL "$URL" -o "$TMP/Todaymarks.dmg"; then
  echo "✗ Couldn't download $URL"
  echo "  Check that a release exists at https://github.com/$REPO/releases"
  exit 1
fi

echo "▸ Installing to /Applications…"
MOUNT="$(hdiutil attach "$TMP/Todaymarks.dmg" -nobrowse -readonly | grep '/Volumes/' | awk '{ $1=""; $2=""; sub(/^ +/, ""); print }')"
rm -rf "/Applications/$APP"
cp -R "$MOUNT/$APP" /Applications/
hdiutil detach "$MOUNT" -quiet

echo "▸ Clearing quarantine…"
xattr -dr com.apple.quarantine "/Applications/$APP" 2>/dev/null || true

echo "✓ Installed. Launching…"
open "/Applications/$APP"
