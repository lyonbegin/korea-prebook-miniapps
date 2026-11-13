#!/usr/bin/env python3
"""Byte-for-byte Hermes HBC rehost experiment.

Makes a separately installable Android test package from the original split APK
runtime. It does NOT decompile, recompile or alter index.android.bundle.
Use only with an APK that you are entitled to inspect and run.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

SOURCE_PACKAGE = "com.merakiplace.mydoctor"
TEST_PACKAGE = "com.hitel.mydoctor.hermes"
EXPECTED_HBC_SHA256 = "6c99d3d6766668dd29909eb49edb92a004e588b7f49c8f93a54730c31e9a4802"
BUNDLE_PATH = "assets/index.android.bundle"

def sha256(blob: bytes) -> str:
    return hashlib.sha256(blob).hexdigest()

def command(*args):
    print("RUN", " ".join(map(str, args)), flush=True)
    subprocess.run(list(map(str, args)), check=True)

def bundle_sha(apk: Path) -> str:
    with zipfile.ZipFile(apk) as z:
        return sha256(z.read(BUNDLE_PATH))

def check_original(apks: list[Path]) -> tuple[Path, dict]:
    bases = []
    for apk in apks:
        with zipfile.ZipFile(apk) as archive:
            if BUNDLE_PATH in archive.namelist():
                bases.append(apk)
    if len(bases) != 1:
        raise RuntimeError(f"Need exactly one APK with the Hermes bundle, found {bases}; input APKs: {[p.name for p in apks]}")
    base = bases[0]
    actual = bundle_sha(base)
    if actual != EXPECTED_HBC_SHA256:
        raise RuntimeError(f"Wrong ORIGINAL bundle. Expected {EXPECTED_HBC_SHA256}, got {actual}")
    so = {}
    for path in apks:
        with zipfile.ZipFile(path) as z:
            for item in z.namelist():
                if item.startswith("lib/") and item.endswith(".so"):
                    so[item] = sha256(z.read(item))
    if "lib/arm64-v8a/libreactnative.so" not in so:
        raise RuntimeError("Original ARM64 React Native runtime missing from XAPK")
    return base, so

def change_manifest(decoded_dir: Path):
    manifest = decoded_dir / "AndroidManifest.xml"
    s = manifest.read_text(encoding="utf-8")
    # Preserve original component class names: merely changing the package
    # would redirect relative component names to missing Java/Kotlin classes.
    for attr in ("android:name", "android:targetActivity"):
        s = re.sub(
            rf'({attr}=")(\.[A-Za-z_][A-Za-z0-9_.$]*")',
            lambda m: m.group(1) + SOURCE_PACKAGE + m.group(2)[0:],
            s,
        )
    match = re.search(r'(<manifest\b[^>]*\bpackage=")([^"]+)(")', s, re.S)
    if match is None or match.group(2) != SOURCE_PACKAGE:
        raise RuntimeError("Manifest package not recognized; refusing blind rewrite")
    start, end = match.span(2)
    s = s[:start] + TEST_PACKAGE + s[end:]
    # Provider authorities must be unique for side-by-side installation.
    s = re.sub(
        r'(android:(?:authorities|taskAffinity|permission|readPermission|writePermission)=")([^"]+)(")',
        lambda m: m.group(1) + m.group(2).replace(SOURCE_PACKAGE, TEST_PACKAGE) + m.group(3),
        s,
    )
    manifest.write_text(s, encoding="utf-8")

def build(xapk: Path, apktool: Path, keystore: Path, out: Path):
    if not xapk.is_file():
        raise RuntimeError(f"Missing XAPK: {xapk}")
    if not apktool.is_file():
        raise RuntimeError(f"Missing apktool.jar: {apktool}")
    out.mkdir(parents=True, exist_ok=True)
    report = {
        "source_xapk": xapk.name,
        "source_package": SOURCE_PACKAGE,
        "test_package": TEST_PACKAGE,
        "expected_hbc_sha256": EXPECTED_HBC_SHA256,
        "app_files": [],
        "native_libraries": 0,
        "HBC_UNMODIFIED": False,
        "SIGNED": False,
        "RUNTIME_UI_VERIFIED": False,
    }
    with tempfile.TemporaryDirectory(prefix="hbc-rehost-") as temp:
        temp = Path(temp)
        with zipfile.ZipFile(xapk) as archive:
            apk_members = [n for n in archive.namelist() if n.lower().endswith(".apk")]
            if len(apk_members) < 2:
                raise RuntimeError("Expected Android split XAPK, not a single APK")
            for member in apk_members:
                if ".." in Path(member).parts:
                    raise RuntimeError("Unsafe zip member path")
                archive.extract(member, temp / "source")
        apks = sorted((temp / "source").rglob("*.apk"))
        base, so_before = check_original(apks)
        report["native_libraries"] = len(so_before)
        split_idx = 0
        for i, apk in enumerate(apks):
            dest = temp / f"decoded_{i}"
            command("java", "-jar", apktool, "d", "-f", "-s", "-o", dest, apk)
            change_manifest(dest)
            unsigned = temp / f"unsigned_{i}.apk"
            command("java", "-jar", apktool, "b", "-o", unsigned, dest)
            aligned = temp / f"aligned_{i}.apk"
            command("zipalign", "-f", "-p", "4", unsigned, aligned)
            if apk == base:
                target = out / "base.apk"
            else:
                target = out / f"split_{split_idx}.apk"
                split_idx += 1
            command("apksigner", "sign", "--ks", keystore,
                    "--ks-key-alias", "rehost",
                    "--ks-pass", "pass:android",
                    "--key-pass", "pass:android",
                    "--out", target, aligned)
            command("apksigner", "verify", "--verbose", target)
            report["app_files"].append(target.name)
        rebound = out / "base.apk"
        report["actual_hbc_sha256"] = bundle_sha(rebound)
        report["HBC_UNMODIFIED"] = report["actual_hbc_sha256"] == EXPECTED_HBC_SHA256
        so_after = {}
        for signed in out.glob("*.apk"):
            with zipfile.ZipFile(signed) as z:
                for name in z.namelist():
                    if name.startswith("lib/") and name.endswith(".so"):
                        so_after[name] = sha256(z.read(name))
        report["NATIVE_LIBRARIES_UNMODIFIED"] = so_before == so_after
        if not report["HBC_UNMODIFIED"] or not report["NATIVE_LIBRARIES_UNMODIFIED"]:
            raise RuntimeError("Bytecode or native libraries changed during packaging")
        report["SIGNED"] = True
    (out / "build_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print("BUILD_RESULT", json.dumps(report, ensure_ascii=False), flush=True)

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--xapk", type=Path, required=True)
    p.add_argument("--apktool", type=Path, required=True)
    p.add_argument("--keystore", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    a = p.parse_args()
    build(a.xapk, a.apktool, a.keystore, a.out)
