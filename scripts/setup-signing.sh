#!/usr/bin/env bash
# One-time setup: create a self-signed "Todaymarks Dev" code-signing certificate in a
# dedicated keychain so dev builds get a STABLE signing identity. macOS TCC keys
# Calendar/Camera grants to this cert's designated requirement (not the binary
# hash), so permissions persist across rebuilds instead of resetting every time.
#
# The cert is untrusted (self-signed) — that's fine, codesign signs with it and
# TCC honors it. `set-key-partition-list` uses the KEYCHAIN password (not your
# login password) so codesign never shows a GUI prompt.
set -euo pipefail

SIGN_DIR="$HOME/.todaymarks-signing"
KC="$HOME/Library/Keychains/todaymarks-signing.keychain-db"
KCPASS="todaymarks"

mkdir -p "$SIGN_DIR"
cd "$SIGN_DIR"

if [ ! -f todaymarks.p12 ]; then
  echo "▸ Generating self-signed code-signing certificate…"
  openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 3650 -nodes \
    -subj "/CN=Todaymarks Dev/O=Todaymarks" \
    -addext "extendedKeyUsage=codeSigning" \
    -addext "keyUsage=critical,digitalSignature" >/dev/null 2>&1
  openssl pkcs12 -export -out todaymarks.p12 -inkey key.pem -in cert.pem \
    -passout "pass:$KCPASS" -name "Todaymarks Dev" >/dev/null 2>&1
fi

echo "▸ Creating signing keychain…"
security delete-keychain "$KC" 2>/dev/null || true
security create-keychain -p "$KCPASS" "$KC"
security set-keychain-settings "$KC"
security unlock-keychain -p "$KCPASS" "$KC"
security import todaymarks.p12 -k "$KC" -P "$KCPASS" -A -T /usr/bin/codesign -f pkcs12 >/dev/null 2>&1
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KCPASS" "$KC" >/dev/null 2>&1

# Add to the user keychain search list (preserving existing entries).
EXISTING=$(security list-keychains -d user | sed 's/[":]//g' | xargs)
security list-keychains -d user -s $EXISTING "$KC" >/dev/null 2>&1

echo "✓ Done. Identity:"
security find-identity -p codesigning "$KC" | grep -i "Todaymarks Dev" || true
echo "  Now run scripts/run-app.sh — it will sign with this cert."
