#!/usr/bin/env bash
# Install, capture, and inspect the actual Android WebView without external music services.
set -euo pipefail
adb shell wm size 1080x1920
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1
device_sdk=$(adb shell getprop ro.build.version.sdk | tr -d '\r')
if [ "$device_sdk" -le 29 ]; then
    adb shell wm set-user-rotation lock 1
    adb shell wm set-fix-to-user-rotation enabled
else
    adb shell wm user-rotation lock 1
    adb shell wm fixed-to-user-rotation enabled
fi
adb install artifacts/folia-dilink-test.apk
adb shell settings put secure immersive_mode_confirmations confirmed
adb logcat -c
adb shell am start -W -n io.github.leeacc.folia.dilink/top.izuna.foliamajor.MainActivity
sleep 25
app_pid=$(adb shell pidof io.github.leeacc.folia.dilink | tr -d '\r')
test -n "$app_pid"
adb shell dumpsys activity activities > artifacts/activity.txt
adb logcat -d > artifacts/logcat.txt
adb shell dumpsys webviewupdate > artifacts/webview-provider.txt
adb forward tcp:9222 "localabstract:webview_devtools_remote_${app_pid}"
check_status=0
node ci/check-webview.mjs || check_status=$?
# Keep independent car-control evidence even when an external provider refuses a preview.
node ci/check-car-media.mjs || check_status=$?
adb logcat -d > artifacts/logcat.txt
sleep 3
adb exec-out screencap -p > artifacts/launch.png
if [ "$check_status" -ne 0 ]; then exit "$check_status"; fi
if grep -E 'FATAL EXCEPTION|Fatal signal|Uncaught SyntaxError|Uncaught TypeError' artifacts/logcat.txt; then exit 1; fi
