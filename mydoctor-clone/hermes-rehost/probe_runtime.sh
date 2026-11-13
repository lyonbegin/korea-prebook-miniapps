#!/usr/bin/env bash
# Execute the independently packaged original React Native/Hermes bytecode.
set -Eeuo pipefail
OUT_DIR="$PWD/mydoctor-clone/hermes-rehost/out"
REPORT="$PWD/mydoctor-clone/hermes-rehost/runtime-report"
PKG="com.hitelrehost.mydoctor"
mkdir -p "$REPORT"
adb devices -l | tee "$REPORT/adb_devices.txt"
adb shell getprop ro.product.cpu.abilist | tee "$REPORT/abi.txt"
adb shell getprop ro.dalvik.vm.native.bridge | tee "$REPORT/native_bridge.txt"
adb install-multiple -r "$OUT_DIR/base.apk" "$OUT_DIR"/split_*.apk | tee "$REPORT/install.txt"
adb shell pm path "$PKG" | tee "$REPORT/installed_path.txt"
# Emulator ARM native bridge may fail to extract an otherwise intact ARM split.
if adb root >/dev/null 2>&1; then
  adb wait-for-device
  BASE_LINE="$(adb shell pm path "$PKG" | tr -d '\r' | grep '/base.apk' | head -n1 || :)"
  APK_BASE="${BASE_LINE#package:}"
  if [ -n "$APK_BASE" ]; then
    PKG_DIR="${APK_BASE%/base.apk}"
    mkdir -p "$REPORT/unmodified_so"
    for split in "$OUT_DIR"/split_*.apk; do
      unzip -joq "$split" 'lib/arm64-v8a/*.so' -d "$REPORT/unmodified_so" || :
    done
    if [ -f "$REPORT/unmodified_so/libreactnative.so" ]; then
      adb shell "mkdir -p '$PKG_DIR/lib/arm64' && chmod 755 '$PKG_DIR/lib/arm64'"
      adb push "$REPORT/unmodified_so/." "$PKG_DIR/lib/arm64/" || :
      adb shell "chmod 644 '$PKG_DIR/lib/arm64/'*.so" || :
      adb shell "restorecon -RF '$PKG_DIR/lib/arm64'" || :
      echo "ORIGINAL_NATIVE_SO_RESTORED=1" | tee "$REPORT/so_restore.txt"
    fi
  fi
fi
adb logcat -c
adb shell am force-stop "$PKG" || :
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 \
  | tee "$REPORT/launch.txt" || :
sleep 12
adb exec-out screencap -p > "$REPORT/rehost_screen.png" || :
adb shell dumpsys activity activities > "$REPORT/activities.txt" || :
adb shell pidof "$PKG" > "$REPORT/pid.txt" || :
adb logcat -d -v threadtime > "$REPORT/logcat.txt" || :
adb shell uiautomator dump /sdcard/window.xml > /dev/null 2>&1 || :
adb pull /sdcard/window.xml "$REPORT/window.xml" > /dev/null 2>&1 || :
python3 - "$REPORT" "$PKG" <<'PY'
import json,pathlib,sys,xml.etree.ElementTree as ET
from PIL import Image
out=pathlib.Path(sys.argv[1]);package=sys.argv[2]
activities=(out/"activities.txt").read_text(errors="replace")
tops=[l for l in activities.splitlines() if "topResumedActivity=" in l]
top=tops[-1].strip() if tops else ""
pid=(out/"pid.txt").read_text(errors="replace").strip()
labels=[]
if (out/"window.xml").exists():
    try:
        root=ET.parse(out/"window.xml").getroot()
        for n in root.iter("node"):
            for attr in ("text","content-desc"):
                s=n.get(attr,"").strip()
                if s:labels.append(s)
    except Exception:pass
image_ready=False
if (out/"rehost_screen.png").exists():
    im=Image.open(out/"rehost_screen.png").convert("RGB")
    colors=im.resize((120,240)).getcolors(maxcolors=30000)
    image_ready=bool(colors and len(colors)>500)
result={
  "test_package":package,
  "foreground":package in top,
  "foreground_activity":top,
  "pid":pid,
  "visible_labels":labels[:50],
  "pixel_variety_screen_not_uniform":image_ready,
  "original_ui_visible":bool(package in top and pid and labels and image_ready),
}
(out/"runtime_result.json").write_text(json.dumps(result,ensure_ascii=False,indent=2))
print("RUNTIME_RESULT",json.dumps(result,ensure_ascii=False))
if not result["original_ui_visible"]:
    sys.exit("HERMES_REHOST_NATIVE_UI_NOT_VERIFIED")
PY
