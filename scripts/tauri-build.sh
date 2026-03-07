#!/usr/bin/env bash
# Build the Next.js frontend as a static export for Tauri.
#
# API routes and middleware are NOT needed in the Tauri bundle because the
# desktop app routes all server calls to the deployed backend (via apiBase()).
# This script temporarily excludes them so `next build` with output:"export"
# succeeds, then restores them.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_DIR="src/app/api"
CALLBACK_DIR="src/app/callback"
MIDDLEWARE="src/middleware.ts"
AUTH_ACTIONS="src/lib/auth-actions.ts"

# Store backups outside of the source tree so Next.js doesn't pick them up
BACKUP_DIR="$ROOT/.tauri-backup"

cleanup() {
  # Restore backed-up files/dirs
  for item in "$API_DIR" "$CALLBACK_DIR" "$MIDDLEWARE" "$AUTH_ACTIONS"; do
    basename="$(basename "$item")"
    if [ -e "$BACKUP_DIR/$basename" ]; then
      rm -rf "$item"
      mv "$BACKUP_DIR/$basename" "$item"
    fi
  done
  rm -rf "$BACKUP_DIR"
}

trap cleanup EXIT

mkdir -p "$BACKUP_DIR"

# Back up server-only files outside the source tree
for item in "$API_DIR" "$CALLBACK_DIR" "$MIDDLEWARE" "$AUTH_ACTIONS"; do
  if [ -e "$item" ]; then
    mv "$item" "$BACKUP_DIR/$(basename "$item")"
  fi
done

# Run the Next.js static export build
npx next build

echo "✓ Static export complete → out/"
