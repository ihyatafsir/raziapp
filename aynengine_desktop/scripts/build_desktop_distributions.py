#!/usr/bin/env python3
"""
Build & Package AynEngine AI Desktop Distributions:
- Linux x64 Standalone Executable & Archive
- Windows x64 Standalone .exe & Archive
Strictly zero emojis.
"""

import os
import sys
import shutil
import zipfile
import tarfile
import urllib.request
from pathlib import Path

DESKTOP_DIR = Path(__file__).parent.parent.resolve()
DIST_DIR = DESKTOP_DIR / "dist"
DIST_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR = Path.home() / ".cache" / "electron"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

VERSION = "41.7.1"
WIN_ZIP_NAME = f"electron-v{VERSION}-win32-x64.zip"
WIN_ZIP_PATH = CACHE_DIR / WIN_ZIP_NAME
WIN_URL = f"https://github.com/electron/electron/releases/download/v{VERSION}/{WIN_ZIP_NAME}"

print("=" * 70)
print("AYNENGINE AI: BUILDING CROSS-PLATFORM DESKTOP DISTRIBUTIONS")
print("=" * 70)

# 1. Package Linux Standalone Archive
linux_dist_dir = DIST_DIR / "AynEngineAI-linux-x64"
if linux_dist_dir.exists():
    print("Packaging Linux Standalone Archive...")
    tar_path = DIST_DIR / "AynEngineAI-linux-x64.tar.gz"
    with tarfile.open(tar_path, "w:gz") as tar:
        tar.add(linux_dist_dir, arcname="AynEngineAI-linux-x64")
    print(f"Linux Archive created: {tar_path} ({tar_path.stat().st_size / 1024 / 1024:.2f} MB)")
else:
    print("Warning: Linux build directory not found. Please run electron-packager first.")

# 2. Download and Bundle Windows Standalone (.exe)
win_dist_dir = DIST_DIR / "AynEngineAI-win32-x64"
if not WIN_ZIP_PATH.exists() or WIN_ZIP_PATH.stat().st_size < 10000000:
    print(f"Downloading Windows Electron runtime v{VERSION} from GitHub...")
    req = urllib.request.Request(WIN_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp, open(WIN_ZIP_PATH, "wb") as out_f:
        shutil.copyfileobj(resp, out_f)
    print(f"Downloaded: {WIN_ZIP_PATH} ({WIN_ZIP_PATH.stat().st_size / 1024 / 1024:.2f} MB)")
else:
    print(f"Using cached Windows Electron runtime: {WIN_ZIP_PATH}")

print("Extracting Windows Standalone Runtime...")
if win_dist_dir.exists():
    shutil.rmtree(win_dist_dir)
win_dist_dir.mkdir(parents=True, exist_ok=True)

with zipfile.ZipFile(WIN_ZIP_PATH, 'r') as zip_ref:
    zip_ref.extractall(win_dist_dir)

# Rename electron.exe to AynEngineAI.exe
orig_exe = win_dist_dir / "electron.exe"
target_exe = win_dist_dir / "AynEngineAI.exe"
if orig_exe.exists():
    orig_exe.rename(target_exe)

# Copy application resources into resources/app
app_res_dir = win_dist_dir / "resources" / "app"
app_res_dir.mkdir(parents=True, exist_ok=True)

# Copy source, backend, assets, package.json
shutil.copy2(DESKTOP_DIR / "package.json", app_res_dir / "package.json")
for folder in ["src", "backend", "assets"]:
    src_f = DESKTOP_DIR / folder
    dst_f = app_res_dir / folder
    if src_f.exists():
        if dst_f.exists():
            shutil.rmtree(dst_f)
        shutil.copytree(src_f, dst_f)

# Add Windows runner script
bat_content = "@echo off\r\nstart \"\" \"%~dp0AynEngineAI.exe\" %*\r\n"
with open(win_dist_dir / "Run_AynEngineAI.bat", "w") as f:
    f.write(bat_content)

print(f"Windows Executable created at: {target_exe}")

# Create Windows Distribution Zip
win_zip_dist = DIST_DIR / "AynEngineAI-windows-x64.zip"
print("Compressing Windows Distribution Zip...")
with zipfile.ZipFile(win_zip_dist, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(win_dist_dir):
        for file in files:
            abs_p = Path(root) / file
            rel_p = abs_p.relative_to(win_dist_dir.parent)
            zipf.write(abs_p, rel_p)

print(f"Windows Distribution Zip created: {win_zip_dist} ({win_zip_dist.stat().st_size / 1024 / 1024:.2f} MB)")

# Copy to public/ for instant HTTP download
pub_dir = Path("/home/absolut7/Documents/news/raziapp/public")
if pub_dir.exists():
    shutil.copy2(tar_path, pub_dir / "AynEngineAI-linux-x64.tar.gz")
    shutil.copy2(win_zip_dist, pub_dir / "AynEngineAI-windows-x64.zip")
    print(f"Mirrored desktop distribution archives to {pub_dir} for download.")

print("=" * 70)
print("DESKTOP PACKAGING COMPLETED SUCCESSFULLY!")
print("=" * 70)
