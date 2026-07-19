#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
VERSION=$(node -e "const m=require('$ROOT_DIR/manifest.json'); process.stdout.write(m.version)")
RELEASE_DIR="$ROOT_DIR/release"
PACKAGE_DIR="$RELEASE_DIR/block-poster-$VERSION"
ZIP_PATH="$RELEASE_DIR/block-poster-$VERSION.zip"

if rg -n "localhost" "$ROOT_DIR/manifest.json" >/dev/null; then
  echo "Refusing to package a manifest that contains localhost access." >&2
  exit 1
fi

rm -rf "$PACKAGE_DIR" "$ZIP_PATH"
mkdir -p "$PACKAGE_DIR/icons"

for file in \
  manifest.json \
  background.js \
  connect-bridge.js \
  content.js \
  sidepanel.html \
  sidepanel.css \
  sidepanel.js
do
  cp "$ROOT_DIR/$file" "$PACKAGE_DIR/$file"
done

for size in 16 32 48 128; do
  cp "$ROOT_DIR/icons/icon-$size.png" "$PACKAGE_DIR/icons/icon-$size.png"
done

(
  cd "$PACKAGE_DIR"
  zip -qr "$ZIP_PATH" .
)

echo "$ZIP_PATH"
