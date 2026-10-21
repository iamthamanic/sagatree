#!/usr/bin/env python3
"""Optional official Chrome-for-Testing fallback when Playwright CDN is unavailable."""
import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import urllib.request
import zipfile

URL = "https://storage.googleapis.com/chrome-for-testing-public/140.0.7339.186/linux64/chrome-headless-shell-linux64.zip"
SHA256 = "7df82707146aa70f5eebdfb0b699c6396261f8270fd6cd9a4555979c5fee7b52"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", type=Path, default=Path(__file__).parent / "artifacts" / "chromium")
args = parser.parse_args()
with urllib.request.urlopen(URL, timeout=60) as response:
    data = response.read()
if hashlib.sha256(data).hexdigest() != SHA256:
    raise SystemExit("Official Chromium archive did not match the reviewed SHA-256")
args.output.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(io.BytesIO(data)) as archive:
    for member in archive.infolist():
        if member.filename.startswith("/") or ".." in PurePosixPath(member.filename).parts:
            raise SystemExit("Unsafe path in official browser archive")
    archive.extractall(args.output)
binary = args.output / "chrome-headless-shell-linux64" / "chrome-headless-shell"
binary.chmod(0o755)
(args.output / "source.json").write_text(json.dumps({"url": URL, "sha256": SHA256, "version": "140.0.7339.186", "binary": str(binary.resolve())}, indent=2) + "\n")
print(binary.resolve())
