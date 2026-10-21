#!/usr/bin/env python3
"""Extract only the two pinned official service binaries; no Docker daemon needed.

Uses Python's configured HTTP(S) proxy support. Every image manifest and every
downloaded layer is checked against a SHA-256 digest. No archive paths, owners,
links, startup hooks, or OS files are installed from the images.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import platform
import tarfile
import urllib.request

SOURCES = [
    {"name": "gotrue", "repository": "supabase/gotrue", "tag": "v2.143.0",
     "manifest": "sha256:fb3c5ba85da7f02a84500b69b86f7a1d121b8922dde5ffb987d10fd6e23de330",
     "target": "usr/local/bin/auth"},
    {"name": "postgrest", "repository": "postgrest/postgrest", "tag": "v12.0.1",
     "manifest": "sha256:d3d040b53ed98cf4281266589523943cf727cc30b43cdcec346f073842042122",
     "target": "bin/postgrest"},
]

def download(url, headers=None):
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=60) as response:
        return response.read()

def checked_download(url, digest, headers):
    data = download(url, headers)
    actual = "sha256:" + hashlib.sha256(data).hexdigest()
    if actual != digest:
        raise RuntimeError(f"Checksum mismatch for {url}: {actual} != {digest}")
    return data

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "artifacts" / "tools")
    args = parser.parse_args()
    if platform.system() != "Linux" or platform.machine() not in ("x86_64", "amd64"):
        raise SystemExit("Pinned product-service binaries currently support Linux x86_64 only; SQL baseline supports more platforms.")
    args.output.mkdir(parents=True, exist_ok=True)
    evidence = []
    for source in SOURCES:
        repo = source["repository"]
        token = json.loads(download(f"https://auth.docker.io/token?service=registry.docker.io&scope=repository:{repo}:pull"))["token"]
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.docker.distribution.manifest.v2+json"}
        base = f"https://registry-1.docker.io/v2/{repo}"
        manifest = json.loads(checked_download(f"{base}/manifests/{source['manifest']}", source["manifest"], headers))
        binary = None
        layer_digest = None
        # Image overlay order matters: a later regular-file replacement wins.
        for layer in manifest["layers"]:
            data = checked_download(f"{base}/blobs/{layer['digest']}", layer["digest"], headers)
            with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
                for member in archive:
                    if member.name.lstrip("./") == source["target"]:
                        if not member.isfile() or member.size > 150_000_000:
                            raise RuntimeError("Expected a bounded regular executable file")
                        binary = archive.extractfile(member).read()
                        layer_digest = layer["digest"]
        if binary is None:
            raise RuntimeError(f"Missing executable {source['target']} in pinned image {repo}")
        destination = args.output / source["name"]
        destination.write_bytes(binary)
        destination.chmod(0o755)
        evidence.append({**source, "layer": layer_digest, "sha256": hashlib.sha256(binary).hexdigest(), "bytes": len(binary)})
        print(f"Verified {source['name']} {source['tag']}: {len(binary)} bytes")
    (args.output / "sources.json").write_text(json.dumps(evidence, indent=2) + "\n")

if __name__ == "__main__":
    main()
