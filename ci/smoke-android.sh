#!/usr/bin/env bash
# Install, capture, and inspect the actual Android WebView without external music services.
set -euo pipefail
adb shell wm size 1080x1920
adb install artifacts/folia-dilink-test.apk
adb logcat -c
adb shell am start -W -n io.github.leeacc.folia.dilink/top.izuna.foliamajor.MainActivity
sleep 25
app_pid=$(adb shell pidof io.github.leeacc.folia.dilink | tr -d '\r')
test -n "$app_pid"
adb shell dumpsys activity activities > artifacts/activity.txt
adb logcat -d > artifacts/logcat.txt
adb exec-out screencap -p > artifacts/launch.png
adb shell dumpsys webviewupdate > artifacts/webview-provider.txt
adb forward tcp:9222 "localabstract:webview_devtools_remote_${app_pid}"
node ci/check-webview.mjs
if grep -E 'FATAL EXCEPTION|Fatal signal|Uncaught SyntaxError|Uncaught TypeError' artifacts/logcat.txt; then exit 1; fi
