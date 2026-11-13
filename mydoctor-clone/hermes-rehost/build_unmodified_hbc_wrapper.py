#!/usr/bin/env python3
"""Rehost the ORIGINAL Hermes HBC96 and native runtime without recompilation.

Re-signs all original APK splits with a different, same-length package ID.
The binary AndroidManifest.xml strings are patched in-place to preserve
Android resource tables, DEX, JS bytecode and all native shared libraries.
This is a private inspection tool, NOT a production or redistributable app.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import tempfile
import zipfile
from pathlib import Path

SOURCE_PACKAGE = "com.merakiplace.mydoctor"
TEST_PACKAGE = "com.hitelrehost.mydoctor"
EXPECTED_HBC_SHA256 = "6c99d3d6766668dd29909eb49edb92a004e588b7f49c8f93a54730c31e9a4802"
BUNDLE_PATH = "assets/index.android.bundle"
assert len(SOURCE_PACKAGE) == len(TEST_PACKAGE)

def sha256(blob: bytes) -> str:
    return hashlib.sha256(blob).hexdigest()

def command(*args):
    cmd = [str(a) for a in args]
    print("RUN", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)

def hbc_sha(apk: Path) -> str:
    with zipfile.ZipFile(apk) as z:
        return sha256(z.read(BUNDLE_PATH))

def find_bundle_base(apks: list[Path]) -> Path:
    bases=[]
    for apk in apks:
        with zipfile.ZipFile(apk) as z:
            if BUNDLE_PATH in z.namelist():
                bases.append(apk)
    if len(bases)!=1:
        raise RuntimeError(f"Need one original HBC APK, found {bases}; APKs: {[p.name for p in apks]}")
    actual=hbc_sha(bases[0])
    if actual!=EXPECTED_HBC_SHA256:
        raise RuntimeError(f"Unrecognized HBC: {actual}, expected {EXPECTED_HBC_SHA256}")
    return bases[0]

def native_hashes(apks: list[Path]) -> dict[str,str]:
    native={}
    for apk in apks:
        with zipfile.ZipFile(apk) as z:
            for name in z.namelist():
                if name.startswith("lib/") and name.endswith(".so"):
                    native[name]=sha256(z.read(name))
    return native

def rewrite_manifest_only(blob: bytes) -> tuple[bytes,int]:
    # This is length-neutral for both Android binary XML UTF-8 and UTF-16
    # string tables; unlike APKTool rebuild it leaves every XML chunk intact.
    original_len=len(blob)
    replacements=0
    for encoding in ("utf-16le","utf-8"):
        old=SOURCE_PACKAGE.encode(encoding)
        new=TEST_PACKAGE.encode(encoding)
        if len(old)!=len(new):
            raise RuntimeError("Unsafe binary XML string length change")
        occurrences=blob.count(old)
        blob=blob.replace(old,new)
        replacements+=occurrences
    if len(blob)!=original_len or replacements<1:
        raise RuntimeError("Original APK manifest does not reference source package")
    return blob,replacements

def is_old_signature(name: str) -> bool:
    up=name.upper()
    return (up.startswith("META-INF/") and
            (up.endswith(".SF") or up.endswith(".RSA") or
             up.endswith(".DSA") or up.endswith(".EC") or
             up.endswith("MANIFEST.MF")))

def clone_apk(original: Path, dst: Path) -> dict:
    manifest_hits=0
    total=0
    with zipfile.ZipFile(original) as src, zipfile.ZipFile(dst,"w") as out:
        for item in src.infolist():
            if is_old_signature(item.filename):
                continue
            payload=src.read(item.filename)
            if item.filename=="AndroidManifest.xml":
                payload,manifest_hits=rewrite_manifest_only(payload)
            out.writestr(item,payload)
            total+=1
    if manifest_hits<1:
        raise RuntimeError(f"Missing AndroidManifest.xml in {original.name}")
    return {"input":original.name,"manifest_string_replacements":manifest_hits,
            "copied_entries":total}

def build(xapk: Path, keystore: Path, out: Path):
    if not xapk.exists(): raise RuntimeError(f"Original XAPK absent: {xapk}")
    out.mkdir(parents=True,exist_ok=True)
    report={"original":xapk.name,"original_package":SOURCE_PACKAGE,
            "rehost_package":TEST_PACKAGE,
            "expected_hbc_sha256":EXPECTED_HBC_SHA256,
            "splits":[],"SIGNED":False,"HBC_UNMODIFIED":False,
            "NATIVE_LIBRARIES_UNMODIFIED":False,
            "RUNTIME_UI_VERIFIED":False}
    with tempfile.TemporaryDirectory(prefix="mydoctor-native-hbc-") as tmp:
        temp=Path(tmp)
        with zipfile.ZipFile(xapk) as z:
            apknames=[name for name in z.namelist() if name.lower().endswith(".apk")]
            if len(apknames)<2: raise RuntimeError("Expected split XAPK")
            for name in apknames:
                if ".." in Path(name).parts: raise RuntimeError("Unsafe XAPK entry")
                z.extract(name,temp/"source")
        source=sorted((temp/"source").rglob("*.apk"))
        base=find_bundle_base(source)
        original_native=native_hashes(source)
        if "lib/arm64-v8a/libreactnative.so" not in original_native:
            raise RuntimeError("Missing original ARM64 React Native library")
        split_number=0
        for apk in source:
            output_name="base.apk" if apk==base else f"split_{split_number}.apk"
            if apk!=base:split_number+=1
            repacked=temp/("tmp_"+output_name)
            entry=clone_apk(apk,repacked)
            aligned=temp/("aligned_"+output_name)
            command("zipalign","-f","-P","16","4",repacked,aligned)
            signed=out/output_name
            command("apksigner","sign","--min-sdk-version","24",
                    "--ks",keystore,"--ks-key-alias","rehost",
                    "--ks-pass","pass:android","--key-pass","pass:android",
                    "--out",signed,aligned)
            command("apksigner","verify","--min-sdk-version","24",
                    "--verbose",signed)
            entry["output"]=output_name
            report["splits"].append(entry)
        report["actual_hbc_sha256"]=hbc_sha(out/"base.apk")
        report["HBC_UNMODIFIED"]=report["actual_hbc_sha256"]==EXPECTED_HBC_SHA256
        report["native_libraries"]=len(original_native)
        report["NATIVE_LIBRARIES_UNMODIFIED"]=(original_native==native_hashes(list(out.glob("*.apk"))))
        report["SIGNED"]=True
        (out/"build_report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
        print("BUILD_RESULT",json.dumps(report,ensure_ascii=False),flush=True)
        if not report["HBC_UNMODIFIED"] or not report["NATIVE_LIBRARIES_UNMODIFIED"]:
            raise RuntimeError("Hermes bytecode or original native .so bytes changed")

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--xapk",type=Path,required=True)
    parser.add_argument("--apktool",type=Path,required=False,
                        help="Unused compatibility switch; binary XML is preserved directly")
    parser.add_argument("--keystore",type=Path,required=True)
    parser.add_argument("--out",type=Path,required=True)
    args=parser.parse_args()
    build(args.xapk,args.keystore,args.out)
