#!/usr/bin/env python3
"""Extract and verify the real MyDoctor HBC96 for a React-web port.

The original source and recovered decompilation are kept on the local runner;
only a structural, non-source-code JSON audit is written to the public output.
No claim is made that a decompiled Hermes function is executable web JS.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import tempfile
import zipfile
from pathlib import Path

EXPECTED_SHA256 = "6c99d3d6766668dd29909eb49edb92a004e588b7f49c8f93a54730c31e9a4802"
BUNDLE = "assets/index.android.bundle"
# Names and function indices were traced in the previous HBC96 disassembly.
FUNCTIONS = {
    "HomeScreen": 45594,
    "HomeScreenGNB": 45644,
    "HomeNavigationSectionStyle": 45992,
    "HomeNavigationSection": 45993,
    "HomeNavigationCard": 46003,
    "MedicalAppointmentStyle": 45648,
    "MedicalAppointmentSection": 45649,
    "HospitalListScreen": 48385,
    "HospitalListScreenComponent": 48386,
    "HospitalListItem": 30064,
}
UI_PRIMITIVES = ("ScrollView", "View", "Text", "Image", "FlashList",
                 "TouchableOpacity", "Pressable", "StyleSheet", "SvgIcon")
STYLE_PROPERTIES = ("flexDirection", "gap", "padding", "paddingTop",
                    "marginHorizontal", "backgroundColor", "borderRadius",
                    "alignItems", "justifyContent", "height", "width")

def digest(blob: bytes) -> str:
    return hashlib.sha256(blob).hexdigest()

def bundle_from_xapk(xapk: Path) -> tuple[bytes, dict]:
    with zipfile.ZipFile(xapk) as outer:
        names = [n for n in outer.namelist() if n.lower().endswith(".apk")]
        if not names:
            raise ValueError("No APK entries in XAPK")
        found = []
        assets = []
        for name in names:
            with outer.open(name) as apk_stream:
                with zipfile.ZipFile(apk_stream) as apk:
                    if BUNDLE in apk.namelist():
                        found.append((name, apk.read(BUNDLE)))
                    for f in apk.infolist():
                        if (f.filename.startswith(("assets/", "res/")) and
                            f.filename.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".svg", ".ttf", ".otf"))):
                            assets.append({"apk": name, "name": f.filename, "size": f.file_size})
        if len(found) != 1:
            raise ValueError(f"Expected exactly one Hermes bundle; found {len(found)}")
        source, binary = found[0]
        actual = digest(binary)
        if actual != EXPECTED_SHA256:
            raise ValueError(f"HBC SHA256 mismatch: {actual}")
        return binary, {"source_apk": source, "sha256": actual,
                        "bytes": len(binary), "split_count": len(names),
                        "assets_total": len(assets),
                        "asset_extensions": {ext: sum(Path(x["name"]).suffix.lower()==ext for x in assets)
                                             for ext in sorted({Path(x["name"]).suffix.lower() for x in assets})}}

def decompile_functions(decompiler: str, hbc_file: Path, private_dir: Path) -> dict:
    private_dir.mkdir(parents=True, exist_ok=True)
    audit = {}
    for label, number in FUNCTIONS.items():
        result = subprocess.run([decompiler, "decompile", str(hbc_file),
                                 "--function", str(number)],
                                text=True, capture_output=True, timeout=90)
        output = result.stdout
        js_path = private_dir / f"{number}.js"
        js_path.write_text(output, encoding="utf-8")
        parse = subprocess.run(["node", "--check", str(js_path)],
                               text=True, capture_output=True, timeout=20) if output else None
        audit[label] = {
            "function_id": number,
            "exit_code": result.returncode,
            "output_bytes": len(output.encode("utf-8")),
            "output_sha256": digest(output.encode("utf-8")),
            "ui_tokens": [p for p in UI_PRIMITIVES if re.search(r"\b"+re.escape(p)+r"\b",output)],
            "style_tokens": [p for p in STYLE_PROPERTIES if re.search(r"\b"+re.escape(p)+r"\b",output)],
            "has_decompilation": result.returncode == 0 and len(output.strip()) > 20,
            "js_syntax_valid": bool(parse and parse.returncode == 0),
            "direct_web_js_verified": False
        }
    return audit

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--xapk", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--decompiler", default="hermes-decomp")
    args = p.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    binary, origin = bundle_from_xapk(args.xapk)
    # Never place proprietary bundle/decompiled source in repository or action artifact.
    with tempfile.TemporaryDirectory(prefix="original-hbc96-private-") as tmp:
        private = Path(tmp)
        hbc = private / "index.android.bundle"
        hbc.write_bytes(binary)
        with (private / "info.txt").open("w") as fp:
            subprocess.run([args.decompiler, "info", str(hbc)],
                           stdout=fp, stderr=subprocess.PIPE, text=True, check=True, timeout=60)
        audit = decompile_functions(args.decompiler, hbc, private / "functions")
        report = {
            "app": "com.merakiplace.mydoctor",
            "original_version": "6.50.0",
            "hbc_version": 96,
            "source": origin,
            "functions": audit,
            "web_js_executable": False,
            "notes": "Bytecode is verified and selected function decompilation attempted; RN native modules are NOT browser-compatible as-is."
        }
        (args.out / "structural_audit.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print("HBC_VERIFIED", origin["sha256"], "ASSETS", origin["assets_total"])
        for name, item in audit.items():
            print("FUNCTION", name, item["function_id"], "decoded", item["has_decompilation"],
                  "primitives", ",".join(item["ui_tokens"]),
                  "js_syntax_valid",item["js_syntax_valid"])
        if not all(x["has_decompilation"] for x in audit.values()):
            raise SystemExit("Selected Hermes functions were not all decompiled")
        print("STRUCTURAL_AUDIT_READY", args.out / "structural_audit.json")
        print("WEB_RUNTIME_STATUS=NOT_YET_EXECUTABLE")

if __name__ == "__main__":
    main()
