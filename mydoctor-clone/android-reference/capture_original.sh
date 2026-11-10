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
URL="https://d.apkpure.net/b/XAPK/com.merakiplace.mydoctor?nc=arm64-v8a&sv=24&versionCode=1206"
echo "Downloading signed v6.50.0 Android split package (never using web mockups)"
curl -fL --retry 3 --retry-delay 3 --connect-timeout 15 --max-time 240 \
  --user-agent 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36' \
  "$URL" -o "$APP_DIR/original.xapk"
BYTES=$(wc -c < "$APP_DIR/original.xapk")
test "$BYTES" -gt 80000000 || { echo "INVALID APK DOWNLOAD ($BYTES bytes)"; exit 5; }
unzip -tqq "$APP_DIR/original.xapk" || { echo 'Corrupted XAPK'; exit 5; }
unzip -oq "$APP_DIR/original.xapk" -d "$APP_DIR/extracted"
mapfile -d '' APKS < <(find "$APP_DIR/extracted" -name '*.apk' -type f -print0)
test "${#APKS[@]}" -gt 1 || { echo "Expected split APKs"; exit 5; }
BASE=""
for p in "${APKS[@]}"; do
  if [[ "$p" == */base.apk || "$p" == */com.merakiplace.mydoctor.apk ]]; then BASE="$p"; break; fi
done
if [[ -z "$BASE" ]]; then BASE="${APKS[0]}"; fi
# apk metadata and signature MUST be source-derived (not fabricated).
AAPT="$(find "${ANDROID_HOME:-/opt/android-sdk}" -path '*/build-tools/*/aapt' -type f | sort -V | tail -1)"
if [ -n "$AAPT" ]; then
  "$AAPT" dump badging "$BASE" | head -n 6 > "$OUT/package_info.txt"
  grep -q "name='com.merakiplace.mydoctor'" "$OUT/package_info.txt"
  grep -q "versionName='6.50.0'" "$OUT/package_info.txt"
fi
# The downloaded APK must contain the EXACT SAME Hermes UI program as
# the XAPK provided by the user. Otherwise a 6.50.0 label is insufficient.
HERMES_EXPECTED="6c99d3d6766668dd29909eb49edb92a004e588b7f49c8f93a54730c31e9a4802"
HERMES_ACTUAL=$(unzip -p "$BASE" assets/index.android.bundle | sha256sum | awk '{print $1}')
printf 'Hermes expected user-uploaded SHA256: %s\\nDownloaded Hermes SHA256: %s\\n' "$HERMES_EXPECTED" "$HERMES_ACTUAL" >> "$OUT/device_metadata.txt"
if [[ "$HERMES_ACTUAL" != "$HERMES_EXPECTED" ]]; then
  echo 'WRONG_BINARY: downloaded app has different Hermes UI from user-provided v6.50.0 XAPK' | tee "$OUT/installation_blocker.txt"
  exit 6
fi
SHA=$(sha256sum "$BASE" | awk '{print $1}')
printf 'Source: APKPure original 6.50.0 (1206) ARM64\nXAPK bytes: %s\nbase.apk sha256: %s\n' "$BYTES" "$SHA" >> "$OUT/device_metadata.txt"
adb install-multiple -r "${APKS[@]}" | tee "$OUT/install_result.txt"
adb shell pm path com.merakiplace.mydoctor | tee -a "$OUT/install_result.txt"
adb shell pm clear com.merakiplace.mydoctor || :
adb shell am force-stop com.merakiplace.mydoctor || :
adb shell monkey -p com.merakiplace.mydoctor -c android.intent.category.LAUNCHER 1 \
    > "$OUT/launch_result.txt" 2>&1 || true
sleep 18
if ! adb shell pidof com.merakiplace.mydoctor >/dev/null; then
  echo 'APP_LAUNCH_FAILED: no running process' | tee -a "$OUT/launch_result.txt"
  adb shell dumpsys activity activities | grep -m 7 -E '(mResumedActivity|topResumedActivity|merakiplace)' >> "$OUT/launch_result.txt" || :
fi
# Save real emulator frames, full Android UI hierarchy, and visible screen text.
capture(){
  local label="$1"
  adb exec-out screencap -p > "$OUT/android_${label}.png"
  timeout 28 adb shell uiautomator dump /sdcard/window.xml > /dev/null 2>&1 || :
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
  timeout 25 adb shell uiautomator dump /sdcard/window.xml > /dev/null 2>&1 || :
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
