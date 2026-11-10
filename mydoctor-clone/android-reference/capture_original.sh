#!/usr/bin/env bash
# Capture ORIGINAL Android 6.50.0 running inside a real Android emulator.
# Strictly read-only navigation. Never simulate appointments or login.
set -Eeuo pipefail
ROOT="${GITHUB_WORKSPACE:-$(pwd)}"
OUT="$ROOT/mydoctor-clone/android-reference/artifacts"
APP_DIR="${RUNNER_TEMP:-/tmp}/mydoctor_v650_app"
mkdir -p "$OUT" "$APP_DIR"
printf 'Capture UTC: %s\n' "$(date -u +%FT%TZ)" > "$OUT/device_metadata.txt"
adb devices -l >> "$OUT/device_metadata.txt"
adb shell getprop ro.build.version.release >> "$OUT/device_metadata.txt" || :
adb shell getprop ro.product.cpu.abilist >> "$OUT/device_metadata.txt" || :
adb shell getprop ro.dalvik.vm.native.bridge >> "$OUT/device_metadata.txt" || :
adb shell wm size 1080x2340
adb shell wm density 440
adb shell settings put system screen_brightness 150 || :
adb shell settings put global animator_duration_scale 0 || :
adb shell settings put global transition_animation_scale 0 || :
adb shell settings put global window_animation_scale 0 || :
# Source is the same signed original version, downloaded on the CI runner.
XAPK_ABI="${MYDOCTOR_XAPK_ABI:-arm64-v8a}"
case "$XAPK_ABI" in
  arm64-v8a|armeabi-v7a) ;;
  *) echo "INVALID_XAPK_ABI: $XAPK_ABI" >&2; exit 12 ;;
esac
echo "APKPURE_ABI=$XAPK_ABI" | tee -a "$OUT/device_metadata.txt"
URL="https://d.apkpure.net/b/XAPK/com.merakiplace.mydoctor?nc=${XAPK_ABI}&sv=24&versionCode=1206"
echo "Downloading signed v6.50.0 Android split package ABI=$XAPK_ABI (never using web mockups)"
curl -fL --retry 3 --retry-delay 3 --connect-timeout 15 --max-time 240 \
  --user-agent 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36' \
  "$URL" -o "$APP_DIR/original.xapk"
BYTES=$(wc -c < "$APP_DIR/original.xapk")
test "$BYTES" -gt 80000000 || { echo "INVALID APK DOWNLOAD ($BYTES bytes)"; exit 5; }
unzip -tqq "$APP_DIR/original.xapk" || { echo 'Corrupted XAPK'; exit 5; }
unzip -oq "$APP_DIR/original.xapk" -d "$APP_DIR/extracted"
# Compatible with both GNU bash and macOS bash 3.2.
APKS=()
while IFS= read -r -d '' apk_file; do APKS+=("$apk_file"); done \
  < <(find "$APP_DIR/extracted" -name '*.apk' -type f -print0)
test "${#APKS[@]}" -gt 1 || { echo "Expected split APKs"; exit 5; }
# Record native shared-library ABIs from actual downloaded split APKs.
python3 - "$APP_DIR" "$OUT" <<'PY'
import pathlib,sys,zipfile
root,out=map(pathlib.Path,sys.argv[1:])
abis=set()
for apk in root.rglob("*.apk"):
    with zipfile.ZipFile(apk) as z:
        abis.update(x.split("/")[1] for x in z.namelist()
                    if x.startswith("lib/") and x.endswith(".so"))
(out/"apk_native_abis.txt").write_text("\\n".join(sorted(abis)),encoding="utf8")
print("DOWNLOADED_NATIVE_ABIS:",sorted(abis))
PY

BASE=""
for p in "${APKS[@]}"; do
  if [[ "$p" == */base.apk || "$p" == */com.merakiplace.mydoctor.apk ]]; then BASE="$p"; break; fi
done
if [[ -z "$BASE" ]]; then BASE="${APKS[0]}"; fi
# apk metadata and signature MUST be source-derived (not fabricated).
AAPT="$(python3 - <<'PY'
from pathlib import Path
import os
root=Path(os.environ.get("ANDROID_HOME","/opt/android-sdk"))/"build-tools"
files=list(root.glob("*/aapt"))
files.sort(key=lambda f:tuple(int(x) for x in f.parent.name.replace("-","\.").split(".") if x.isdigit()))
print(files[-1] if files else "")
PY
)"
if [ -n "$AAPT" ]; then
  "$AAPT" dump badging "$BASE" > "$OUT/package_badging_all.txt"
  head -n 6 "$OUT/package_badging_all.txt" > "$OUT/package_info.txt"
  grep -q "name='com.merakiplace.mydoctor'" "$OUT/package_info.txt"
  grep -q "versionName='6.50.0'" "$OUT/package_info.txt"
fi
# The downloaded APK must contain the EXACT SAME Hermes UI program as
# the XAPK provided by the user. Otherwise a 6.50.0 label is insufficient.
HERMES_EXPECTED="6c99d3d6766668dd29909eb49edb92a004e588b7f49c8f93a54730c31e9a4802"
HERMES_ACTUAL=$(python3 - "$BASE" <<'PY'
import hashlib,sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
    print(hashlib.sha256(z.read("assets/index.android.bundle")).hexdigest())
PY
)
printf 'Hermes expected user-uploaded SHA256: %s\\nDownloaded Hermes SHA256: %s\\n' "$HERMES_EXPECTED" "$HERMES_ACTUAL" >> "$OUT/device_metadata.txt"
if [[ "$HERMES_ACTUAL" != "$HERMES_EXPECTED" ]]; then
  echo 'WRONG_BINARY: downloaded app has different Hermes UI from user-provided v6.50.0 XAPK' | tee "$OUT/installation_blocker.txt"
  exit 6
fi
SHA=$(python3 - "$BASE" <<'PY'
import hashlib,sys
with open(sys.argv[1],"rb") as f:
    h=hashlib.sha256()
    for block in iter(lambda:f.read(1024*1024),b""):
        h.update(block)
    print(h.hexdigest())
PY
)
printf 'Source: APKPure original 6.50.0 (1206) ARM64\nXAPK bytes: %s\nbase.apk sha256: %s\n' "$BYTES" "$SHA" >> "$OUT/device_metadata.txt"
adb install-multiple -r "${APKS[@]}" | tee "$OUT/install_result.txt"
adb shell pm path com.merakiplace.mydoctor | tee -a "$OUT/install_result.txt"
adb shell pm clear com.merakiplace.mydoctor || :
# Android 11 x86_64's ARM native bridge advertises ARM64, but SoLoader
# searches /data/app/<pkg>/lib/arm64 while a modern split APK may retain
# only the uncompressed .so files INSIDE split_config.arm64_v8a.apk.
# On disposable Google APIs emulator only, put the EXACT unmodified
# libraries from the signed split in the expected native library folder.
# This does NOT alter any APK signature, code, Hermes bytecode or public API.
if [[ "${MYDOCTOR_EMULATOR_EXTRACT_ORIGINAL_SO:-0}" == "1" ]]; then
  {
    echo "NATIVE_LIB_RESTORE_MODE=original_signed_split_only"
    adb root
    adb wait-for-device
    adb shell id
    PKG_BASE=$(adb shell pm path com.merakiplace.mydoctor | tr -d '\r' | grep '/base.apk
# Collect ALL startup logcat from before launch. Previous tail-of-3200 cut off
# the actual crash due excessive fresh Google service log volume.
adb logcat -G 16M || :
adb logcat -c || :
adb shell am start -n 'com.merakiplace.mydoctor/com.userproduct.MainActivity' \
   > "$OUT/launch_result.txt" 2>&1 || :
adb exec-out screencap -p > "$OUT/android_launch_early_not_reference.png" || :
sleep 2
adb exec-out screencap -p > "$OUT/android_launch_after2s_not_reference.png" || :
sleep 10
adb shell dumpsys activity activities | grep -m 9 -E '(mResumedActivity|topResumedActivity|merakiplace|MainActivity)' \
  >> "$OUT/launch_result.txt" || :
adb logcat -d -v threadtime > "$OUT/launch_logcat_full.txt" || :
grep -Ei '(AndroidRuntime|FATAL EXCEPTION|com[.]merakiplace|com[.]userproduct|Fatal signal|SoLoader|UnsatisfiedLinkError|native.bridge|ndk.translation|CRASH|Caused by|libhermes|linker|ReactNative|ReactHost|ReactInstance)' \
  "$OUT/launch_logcat_full.txt" | tail -n 300 > "$OUT/crash_diagnostics.txt" || :
TOP=$(adb shell dumpsys activity activities | grep 'topResumedActivity=' | tail -1 || :)
echo "VERIFIED_TOP_ACTIVITY=$TOP" >> "$OUT/launch_result.txt"
if ! adb shell pidof com.merakiplace.mydoctor >/dev/null || [[ "$TOP" != *com.merakiplace.mydoctor* ]]; then
  echo 'APP_LAUNCH_FAILED: process exited or original app not foreground; no native UI reference' | tee -a "$OUT/launch_result.txt"
  adb exec-out screencap -p > "$OUT/android_launch_failed_not_a_reference.png" || :
  exit 8
fi

# Save real emulator frames, full Android UI hierarchy, and visible screen text.
capture(){
  local label="$1"
  adb exec-out screencap -p > "$OUT/android_${label}.png"
  adb shell uiautomator dump /sdcard/window.xml > /dev/null 2>&1 || :
  adb pull /sdcard/window.xml "$OUT/android_${label}.xml" >/dev/null 2>&1 || :
  echo "CAPTURED_ANDROID:$label $(file "$OUT/android_${label}.png")"
}
capture home
# Native React UI labels are extracted from uiautomator when accessibility permits.
# Each scenario restarts original home and taps only a discovered, displayed element.
find_tap(){
  local label="$1"; local terms="$2"
  python3 - "$OUT/android_home.xml" "$terms" <<'PY'
import sys,xml.etree.ElementTree as ET,re
try: root=ET.parse(sys.argv[1]).getroot()
except Exception: sys.exit(3)
terms=sys.argv[2].split('|')
candidates=[]
for n in root.iter('node'):
  caption=" ".join((n.get('text',''),n.get('content-desc',''))).strip()
  box=n.get('bounds','')
  m=re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',box)
  if not m: continue
  x1,y1,x2,y2=map(int,m.groups())
  if x2<=x1 or y2<=y1 or not caption:continue
  for rank,t in enumerate(terms):
    if t in caption and len(caption)<110:
      candidates.append((rank,len(caption),caption,(x1+x2)//2,(y1+y2)//2))
if candidates:
 candidates.sort()
 print(candidates[0][3],candidates[0][4],candidates[0][2],sep='|')
else:sys.exit(2)
PY
}
for spec in 'medical-cost:최저가|가격 비교|가격비교|최저가 병원|약값' \
            'telemedicine:비대면 진료|비대면진료|진료받기' \
            'hospital:병원 찾기|병원찾기|주변 병원' \
            'mounjaro:마운자로'; do
  label="${spec%%:*}"; names="${spec#*:}"
  # Return to actual app home between tests.
  adb shell am force-stop com.merakiplace.mydoctor || :
  adb shell monkey -p com.merakiplace.mydoctor -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1 || :
  sleep 6
  adb shell uiautomator dump /sdcard/window.xml > /dev/null 2>&1 || :
  adb pull /sdcard/window.xml "$OUT/android_home.xml" >/dev/null 2>&1 || :
  if found=$(find_tap "$label" "$names"); then
    x="$(echo "$found" | cut -d'|' -f1)"
    y="$(echo "$found" | cut -d'|' -f2)"
    echo "$label: tapped native element $(echo "$found" | cut -d'|' -f3-) at ($x,$y)" | tee -a "$OUT/navigation_actions.txt"
    adb shell input tap "$x" "$y"
    sleep 5
    capture "$label"
  else
    echo "$label: NOT_FOUND_IN_ORIGINAL_UI_TREE (not pretending navigated)" | tee -a "$OUT/navigation_actions.txt"
  fi
done
# Original app and overlay are not successful merely because files were created.
test -s "$OUT/android_home.png"
echo 'ANDROID_EMULATOR_CAPTURE_COMPLETED'
 | head -1)
    PKG_BASE="${PKG_BASE#package:}"
    test -n "$PKG_BASE"
    PKG_DIR="${PKG_BASE%/base.apk}"
    case "$XAPK_ABI" in
      arm64-v8a) LIB_ABI="arm64-v8a"; LIB_ABBREV="arm64" ;;
      armeabi-v7a) LIB_ABI="armeabi-v7a"; LIB_ABBREV="arm" ;;
    esac
    mkdir -p "$APP_DIR/extracted_native_libs"
    for APK in "${APKS[@]}"; do
      unzip -joq "$APK" "lib/$LIB_ABI/*.so" -d "$APP_DIR/extracted_native_libs" 2>/dev/null || :
    done
    test -s "$APP_DIR/extracted_native_libs/libreactnative.so"
    TARGET="$PKG_DIR/lib/$LIB_ABBREV"
    adb shell "mkdir -p '$TARGET'"
    adb push "$APP_DIR/extracted_native_libs/." "$TARGET/"
    adb shell "chmod 755 '$TARGET'" || :
    adb shell "chmod 644 '$TARGET'/*.so" || :
    adb shell "restorecon -RF '$TARGET'" || :
    adb shell "ls -la '$TARGET/libreactnative.so'"
    echo "EMULATOR_ORIGINAL_NATIVE_LIB_RESTORE_COMPLETED"
  } > "$OUT/native_library_restore.txt" 2>&1 || {
    echo "EMULATOR_ORIGINAL_NATIVE_LIB_RESTORE_FAILED" | tee -a "$OUT/native_library_restore.txt"
  }
fi
adb shell am force-stop com.merakiplace.mydoctor || :
# Collect ALL startup logcat from before launch. Previous tail-of-3200 cut off
# the actual crash due excessive fresh Google service log volume.
adb logcat -G 16M || :
adb logcat -c || :
adb shell am start -n 'com.merakiplace.mydoctor/com.userproduct.MainActivity' \
   > "$OUT/launch_result.txt" 2>&1 || :
adb exec-out screencap -p > "$OUT/android_launch_early_not_reference.png" || :
sleep 2
adb exec-out screencap -p > "$OUT/android_launch_after2s_not_reference.png" || :
sleep 10
adb shell dumpsys activity activities | grep -m 9 -E '(mResumedActivity|topResumedActivity|merakiplace|MainActivity)' \
  >> "$OUT/launch_result.txt" || :
adb logcat -d -v threadtime > "$OUT/launch_logcat_full.txt" || :
grep -Ei '(AndroidRuntime|FATAL EXCEPTION|com[.]merakiplace|com[.]userproduct|Fatal signal|SoLoader|UnsatisfiedLinkError|native.bridge|ndk.translation|CRASH|Caused by|libhermes|linker|ReactNative|ReactHost|ReactInstance)' \
  "$OUT/launch_logcat_full.txt" | tail -n 300 > "$OUT/crash_diagnostics.txt" || :
TOP=$(adb shell dumpsys activity activities | grep 'topResumedActivity=' | tail -1 || :)
echo "VERIFIED_TOP_ACTIVITY=$TOP" >> "$OUT/launch_result.txt"
if ! adb shell pidof com.merakiplace.mydoctor >/dev/null || [[ "$TOP" != *com.merakiplace.mydoctor* ]]; then
  echo 'APP_LAUNCH_FAILED: process exited or original app not foreground; no native UI reference' | tee -a "$OUT/launch_result.txt"
  adb exec-out screencap -p > "$OUT/android_launch_failed_not_a_reference.png" || :
  exit 8
fi

# Save real emulator frames, full Android UI hierarchy, and visible screen text.
capture(){
  local label="$1"
  adb exec-out screencap -p > "$OUT/android_${label}.png"
  adb shell uiautomator dump /sdcard/window.xml > /dev/null 2>&1 || :
  adb pull /sdcard/window.xml "$OUT/android_${label}.xml" >/dev/null 2>&1 || :
  echo "CAPTURED_ANDROID:$label $(file "$OUT/android_${label}.png")"
}
capture home
# Native React UI labels are extracted from uiautomator when accessibility permits.
# Each scenario restarts original home and taps only a discovered, displayed element.
find_tap(){
  local label="$1"; local terms="$2"
  python3 - "$OUT/android_home.xml" "$terms" <<'PY'
import sys,xml.etree.ElementTree as ET,re
try: root=ET.parse(sys.argv[1]).getroot()
except Exception: sys.exit(3)
terms=sys.argv[2].split('|')
candidates=[]
for n in root.iter('node'):
  caption=" ".join((n.get('text',''),n.get('content-desc',''))).strip()
  box=n.get('bounds','')
  m=re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',box)
  if not m: continue
  x1,y1,x2,y2=map(int,m.groups())
  if x2<=x1 or y2<=y1 or not caption:continue
  for rank,t in enumerate(terms):
    if t in caption and len(caption)<110:
      candidates.append((rank,len(caption),caption,(x1+x2)//2,(y1+y2)//2))
if candidates:
 candidates.sort()
 print(candidates[0][3],candidates[0][4],candidates[0][2],sep='|')
else:sys.exit(2)
PY
}
for spec in 'medical-cost:최저가|가격 비교|가격비교|최저가 병원|약값' \
            'telemedicine:비대면 진료|비대면진료|진료받기' \
            'hospital:병원 찾기|병원찾기|주변 병원' \
            'mounjaro:마운자로'; do
  label="${spec%%:*}"; names="${spec#*:}"
  # Return to actual app home between tests.
  adb shell am force-stop com.merakiplace.mydoctor || :
  adb shell monkey -p com.merakiplace.mydoctor -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1 || :
  sleep 6
  adb shell uiautomator dump /sdcard/window.xml > /dev/null 2>&1 || :
  adb pull /sdcard/window.xml "$OUT/android_home.xml" >/dev/null 2>&1 || :
  if found=$(find_tap "$label" "$names"); then
    x="$(echo "$found" | cut -d'|' -f1)"
    y="$(echo "$found" | cut -d'|' -f2)"
    echo "$label: tapped native element $(echo "$found" | cut -d'|' -f3-) at ($x,$y)" | tee -a "$OUT/navigation_actions.txt"
    adb shell input tap "$x" "$y"
    sleep 5
    capture "$label"
  else
    echo "$label: NOT_FOUND_IN_ORIGINAL_UI_TREE (not pretending navigated)" | tee -a "$OUT/navigation_actions.txt"
  fi
done
# Original app and overlay are not successful merely because files were created.
test -s "$OUT/android_home.png"
echo 'ANDROID_EMULATOR_CAPTURE_COMPLETED'
