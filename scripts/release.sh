#!/usr/bin/env bash
# Cut a release: bump the version everywhere, commit, and tag.
# Pushing the tag triggers the GitHub Actions release workflow, which builds,
# signs, and publishes the update.
#
#   scripts/release.sh           # patch: 0.1.0 -> 0.1.1
#   scripts/release.sh minor     # minor: 0.1.0 -> 0.2.0
#   scripts/release.sh major     # major: 0.1.0 -> 1.0.0
#
# Before running, add a "## What's new in vX.Y.Z" section to RELEASE_NOTES.md.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BUMP="${1:-patch}"

CURRENT=$(node -p "require('./package.json').version")
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
case "$BUMP" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
  *) echo "Usage: release.sh [major|minor|patch]"; exit 1 ;;
esac
NEXT="$MAJOR.$MINOR.$PATCH"

echo "▸ $CURRENT → $NEXT"

if ! grep -q "v$NEXT" RELEASE_NOTES.md; then
  echo "⚠️  RELEASE_NOTES.md has no '## What's new in v$NEXT' section."
  read -r -p "   Continue anyway? [y/N] " ok
  [ "$ok" = "y" ] || exit 1
fi

# package.json
node -e "const f='package.json',j=require('./'+f);j.version='$NEXT';require('fs').writeFileSync(f,JSON.stringify(j,null,2)+'\n')"
# tauri.conf.json
node -e "const f='src-tauri/tauri.conf.json',j=require('./'+f);j.version='$NEXT';require('fs').writeFileSync(f,JSON.stringify(j,null,2)+'\n')"
# Cargo.toml (first version = line)
perl -0pi -e 's/^version = "[^"]+"/version = "'"$NEXT"'"/m' src-tauri/Cargo.toml
# Cargo.lock (refresh the package entry)
(cd src-tauri && cargo update -p todaymarks --precise "$NEXT" 2>/dev/null || cargo build --quiet 2>/dev/null || true)

git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock RELEASE_NOTES.md
git commit -m "Release v$NEXT"
git tag "v$NEXT"

echo "✓ Committed and tagged v$NEXT"
echo "  Push it:  git push origin main && git push origin v$NEXT"
