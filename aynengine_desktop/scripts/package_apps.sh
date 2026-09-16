#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "========================================================"
echo "Packaging AynEngine AI Sovereign Desktop Applications"
echo "========================================================"

mkdir -p dist

echo "1. Building Linux Standalone Distribution (x64)..."
npx --yes electron-packager . AynEngineAI \
  --platform=linux \
  --arch=x64 \
  --electron-version=41.7.1 \
  --out=dist \
  --overwrite \
  --prune=true

echo "2. Building Windows Standalone Distribution (x64 .exe)..."
npx --yes electron-packager . AynEngineAI \
  --platform=win32 \
  --arch=x64 \
  --electron-version=41.7.1 \
  --out=dist \
  --overwrite \
  --prune=true

echo "3. Creating compressed distribution archives..."
cd dist
if [ -d "AynEngineAI-linux-x64" ]; then
  tar -czf AynEngineAI-linux-x64.tar.gz AynEngineAI-linux-x64/
  echo "Created: dist/AynEngineAI-linux-x64.tar.gz"
fi

if [ -d "AynEngineAI-win32-x64" ]; then
  zip -rq AynEngineAI-windows-x64.zip AynEngineAI-win32-x64/
  echo "Created: dist/AynEngineAI-windows-x64.zip"
fi

cd "$DIR"
echo "All desktop builds packaged successfully!"
