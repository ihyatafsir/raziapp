#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"
echo "Starting AynEngine AI Sovereign Desktop Studio..."
exec npx --yes electron --no-sandbox . "$@"
