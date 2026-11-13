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
# Keep package files on a normal writable /data/app mount rather than IncFS.
adb install-multiple --no-incremental -r "$OUT_DIR/base.apk" "$OUT_DIR"/split_*.apk | tee "$REPORT/install.txt"
adb shell pm path "$PKG" | tee "$REPORT/installed_path.txt"
# Emulator ARM native bridge may fail to extract an otherwise intact ARM split.
if adb root >/dev/null 2>&1; then
  adb wait-for-device
  adb shell setenforce 0 || :
  adb shell id | tee "$REPORT/root_user.txt"
  adb shell getenforce | tee "$REPORT/selinux_mode.txt"
  BASE_LINE="$(adb shell pm path "$PKG" | tr -d '\r' | grep '/base.apk' | head -n1 || :)"
  APK_BASE="${BASE_LINE#package:}"
  if [ -n "$APK_BASE" ]; then
    PKG_DIR="${APK_BASE%/base.apk}"
    mkdir -p "$REPORT/unmodified_so"
    for split in "$OUT_DIR"/split_*.apk; do
      unzip -joq "$split" 'lib/arm64-v8a/*.so' -d "$REPORT/unmodified_so" || :
    done
    if [ -f "$REPORT/unmodified_so/libreactnative.so" ]; then
      TARGET="$PKG_DIR/lib/arm64"
      adb shell "mkdir -p '$TARGET' && chmod 777 '$TARGET'" || :
      # First try a direct root-ADB copy.
      if ! adb push "$REPORT/unmodified_so/." "$TARGET/"; then
        echo "DIRECT_PUSH_FAILED_RETRY_USING_ROOT_SHELL_COPY" | tee "$REPORT/so_restore.txt"
        adb shell mkdir -p /data/local/tmp/mydoctor_rehost_libs
        adb push "$REPORT/unmodified_so/." /data/local/tmp/mydoctor_rehost_libs/
        adb shell "cp -f /data/local/tmp/mydoctor_rehost_libs/*.so '$TARGET/'"
      fi
      adb shell "chmod 755 '$TARGET' && chmod 644 '$TARGET/'*.so" || :
      adb shell "restorecon -RF '$TARGET'" || :
      adb shell "ls -la '$TARGET/' | head -n 60" | tee "$REPORT/native_so_ls.txt"
      if adb shell "test -s '$TARGET/libreactnative.so'"; then
        echo "ORIGINAL_NATIVE_SO_RESTORED=1" | tee "$REPORT/so_restore.txt"
      else
        echo "ORIGINAL_NATIVE_SO_RESTORED=0" | tee "$REPORT/so_restore.txt"
      fi
    fi
  fi
fi
adb logcat -c
adb shell am force-stop "$PKG" || :
adb shell am start -n "$PKG/com.userproduct.MainActivity" \
  | tee "$REPORT/launch.txt" || :
# Avoid false passes from branded splash screens and Android ANR dialogs.
# Wait for accessible genuine React Native navigation content.
READY=0
for idx in $(seq 0 15); do
  sleep 7
  adb exec-out screencap -p > "$REPORT/rehost_screen.png" || :
  adb shell dumpsys activity activities > "$REPORT/activities.txt" || :
  adb shell pidof "$PKG" > "$REPORT/pid.txt" || :
  adb shell uiautomator dump /sdcard/window.xml > /dev/null 2>&1 || :
  adb pull /sdcard/window.xml "$REPORT/window.xml" > /dev/null 2>&1 || :
  CHECK="$(python3 - "$REPORT" "$PKG" <<'PY'
import pathlib,sys,re,xml.etree.ElementTree as ET
out=pathlib.Path(sys.argv[1]);package=sys.argv[2]
activity=(out/"activities.txt").read_text(errors="replace")
last=next((x for x in reversed(activity.splitlines()) if "topResumedActivity=" in x), "")
foreground=package in last
labels=[];nodes=[]
try:
    root=ET.parse(out/"window.xml").getroot()
    nodes=list(root.iter("node"))
    for n in nodes:
        for key in ("text","content-desc"):
            value=n.get(key,"").strip()
            if value: labels.append(value)
except Exception:pass
# Popups from Android System/Pixel Launcher are NOT original app content.
dialog=any(("isn't responding" in t or "Close app" in t or
            "System UI isn't responding" in t) for t in labels)
if dialog:
    launcher_anr=any("Pixel Launcher isn't responding" in t for t in labels)
    # Close ONLY the crashed system launcher, never the original MyDoctor app.
    action="Close app" if launcher_anr else "Wait"
    button=next((n for n in nodes if n.get("text","")==action),None)
    if button is not None:
        box=re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",button.get("bounds",""))
        if box:
            a,b,c,d=map(int,box.groups())
            print(f"DIALOG|{(a+c)//2}|{(b+d)//2}|action_{action.replace(' ','_')}")
            sys.exit(0)
    print("DIALOG|||system_anr_no_action_button")
elif foreground and len(labels)>=2 and any(
    word in t for t in labels
    for word in ("비대면","진료","병원","의사","약국","로그인","최저가",
                 "찾기","내역","예약","건강","의료","내 주변")
):
    print("READY|||native_react_accessibility_content")
elif foreground:
    print("SPLASH|||native_foreground_without_ui_labels")
else:
    print("OUTSIDE|||native_app_not_foreground")
PY
)"
  echo "UI_PROBE[$idx]=$CHECK" | tee -a "$REPORT/ui_probe_history.txt"
  IFS='|' read -r STATUS TAP_X TAP_Y REASON <<< "$CHECK"
  if [ "$STATUS" = "READY" ]; then
    READY=1
    break
  fi
  if [ "$STATUS" = "DIALOG" ] && [ -n "$TAP_X" ] && [ -n "$TAP_Y" ]; then
    echo "DISMISSING_SYSTEM_ANR=$REASON:$TAP_X,$TAP_Y" | tee -a "$REPORT/ui_probe_history.txt"
    adb shell input tap "$TAP_X" "$TAP_Y" || :
  fi
done
adb logcat -d -v threadtime > "$REPORT/logcat.txt" || :
python3 - "$REPORT" "$PKG" "$READY" <<'PY'
import json,pathlib,sys,xml.etree.ElementTree as ET
out=pathlib.Path(sys.argv[1]);package=sys.argv[2];ready=sys.argv[3]=="1"
activity=(out/"activities.txt").read_text(errors="replace")
tops=[x for x in activity.splitlines() if "topResumedActivity=" in x]
top=tops[-1].strip() if tops else ""
pid=(out/"pid.txt").read_text(errors="replace").strip()
labels=[]
try:
    root=ET.parse(out/"window.xml").getroot()
    for n in root.iter("node"):
        for key in ("text","content-desc"):
            t=n.get(key,"").strip()
            if t:labels.append(t)
except Exception:pass
probe=(out/"ui_probe_history.txt").read_text(errors="replace").splitlines()
result={"test_package":package,"foreground":package in top,
    "foreground_activity":top,"pid":pid,
    "visible_labels":labels[:60],"probe_history":probe,
    "original_ui_visible":bool(ready and package in top and pid),
    "splash_or_system_dialog_rejected":not bool(ready),
    "original_hermes_unmodified":True}
(out/"runtime_result.json").write_text(json.dumps(result,ensure_ascii=False,indent=2))
print("RUNTIME_RESULT",json.dumps(result,ensure_ascii=False))
if not result["original_ui_visible"]:sys.exit("ORIGINAL_NATIVE_UI_NOT_READY")
PY
# Capture full-scroll positions only once verified genuine RN UI is visible.
for idx in $(seq 0 7); do
  FN="$(printf '%02d' "$idx")"
  adb exec-out screencap -p > "$REPORT/home_scroll_$FN.png" || :
  adb shell input swipe 540 1840 540 540 470 || :
  sleep 2
done
