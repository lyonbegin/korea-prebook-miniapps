#!/usr/bin/env python3
"""Check whether the entire verified original Hermes program can be recovered as JS.

Full reconstructed source stays inside the ephemeral runner and is never added
to the public GitHub repo or GitHub Actions artifacts.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import subprocess
import tempfile
from pathlib import Path
from extract_original_ui import bundle_from_xapk

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--xapk",type=Path,required=True)
    ap.add_argument("--decompiler",required=True)
    ap.add_argument("--out",type=Path,required=True)
    args=ap.parse_args()
    binary,origin=bundle_from_xapk(args.xapk)
    args.out.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="hbc96-full-js-private-") as d:
        root=Path(d)
        hbc=root/"index.android.bundle"
        hbc.write_bytes(binary)
        recovered=root/"recovered.js"
        command=[args.decompiler,"decompile",str(hbc),"-o",str(recovered)]
        try:
            p=subprocess.run(command,text=True,capture_output=True,timeout=480)
        except subprocess.TimeoutExpired:
            report={"status":"timeout","full_web_executable":False,"hbc_sha256":origin["sha256"]}
            (args.out/"full_bundle_audit.json").write_text(json.dumps(report,indent=2))
            print("FULL_HBC_DECOMPILE_TIMEOUT")
            return
        exists=recovered.is_file()
        size=recovered.stat().st_size if exists else 0
        syntax=None
        if exists and size>0:
            try:
                check=subprocess.run(["node","--check",str(recovered)],
                    text=True,capture_output=True,timeout=100)
                syntax=(check.returncode==0)
            except subprocess.TimeoutExpired:syntax=False
        # Run in an isolated short-lived VM to test entrypoint behavior;
        # a valid JS syntax tree alone does not imply a runnable React web app.
        isolated_status="not_tested"
        if exists and syntax:
            vm = (
              "const fs=require('fs'),vm=require('vm');"
              "try{vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),"
              "{console:{log(){},warn(){},error(){}}},{timeout:1800});"
              "process.stdout.write('completed')}catch(e){process.stdout.write(e.name||'Error')}"
            )
            try:
                outcome=subprocess.run(["node","-e",vm,str(recovered)],
                                       capture_output=True,text=True,timeout=12)
                isolated_status=outcome.stdout.strip()[:60] or "no_result"
            except subprocess.TimeoutExpired:
                isolated_status="timeout"
        # The source is not output; only coarse structure & module dependencies.
        head=recovered.open("r",encoding="utf-8",errors="replace").read(1024*1024) if exists else ""
        report={
            "hbc_sha256":origin["sha256"],
            "source_size_bytes":origin["bytes"],
            "decompiler_exit":p.returncode,
            "decompiled_js_bytes":size,
            "whole_bundle_syntax_valid":syntax,
            "isolated_vm_result":isolated_status,
            "has_metro_modules":bool(re.search(r"\\b(__d|__r|metroRequire)\\b",head)),
            "has_native_modules":bool(re.search(r"\\b(NativeModules|TurboModule|ReactNative)\\b",head)),
            "full_web_executable":False,
            "notes":"Syntax validity is insufficient for execution; module dependencies and the native-to-web bridge must be resolved."
        }
        (args.out/"full_bundle_audit.json").write_text(
            json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
        print("FULL_HBC_EXTRACT",json.dumps(report,ensure_ascii=False))
if __name__=="__main__":
    main()
