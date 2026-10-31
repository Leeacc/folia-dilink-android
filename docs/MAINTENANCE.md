# DiLink branch maintenance

## Baseline and patch boundaries

`UPSTREAM.json` pins the exact official tag and commit. The migration joins upstream Git ancestry so later updates can use a normal three-way merge; it does not claim the Android fork is byte-identical to upstream. Android code lives in `android/`, the private local music service in `mobile/`, UI adapters in `src/platform`, `src/services/android`, `src/components/car` and the dedicated car hooks. Build/CSS compatibility is in `build/postcss-webview95.mjs` and `postcss.config.js`.

Keep the original AGPL license, contributor files and NOTICE. Update package version, Android versionCode, UPSTREAM.json and release notes together. Do not replace the whole frontend on each future update. Do not remove @note comments; R10 source notes are archived verbatim before the baseline replacement.

## Release contract

1. Merge a pinned upstream tag on an update branch. Resolve conflicts while retaining native playback, stream URL handling, Android hooks and CSS compatibility.
2. Audit new Electron/native dependencies separately. Android uses Node.js Mobile 18.20.4; successful desktop installation on Node 24 is not proof that a dependency works on Android.
3. Run types/unit checks, the compiled Chromium 95 UI fixtures (all 17 visualizers), production settings at five pane sizes, then API 29/35 smoke tests. API 29's old WebView exercises the explanatory fallback, API 35 exercises playback. These emulators do not prove BYD firmware behavior.
4. Verify real native stream playback, linear app gain, media volume keys, session callbacks, background progress and optional spectrum. The native output must remain a single MediaPlayer with one audio focus owner. Do not connect it to a second WebAudio output graph.
5. Push a `v*-dilink.*` tag after CI passes. The tag workflow reruns validation and publishes the fixed-key signed release APK with SHA256, build commit and upstream provenance. Prereleases remain marked until real-car regression results are available.

`FOLIA_ANDROID_KEYSTORE_B64` and `FOLIA_ANDROID_KEYSTORE_PASSWORD` are repository secrets. Alias `folia-dilink`, PKCS12. Keep an offline backup outside Git. Losing the key prevents seamless future upgrades. Test and release variants share this key but only the test variant enables Android debugging.

## Upstream monitor

`.github/workflows/upstream-sync.yml` checks weekly and on demand. It compares official releases, attempts a merge in `upstream/<tag>`, and creates a draft PR when clean. A merge conflict produces a deduplicated issue listing files. It never automatically merges or publishes upstream code and never activates newly imported upstream workflows. Review the PR and run car regression before a release. If GitHub disables automatic PR creation, the run reports that permission failure; do not claim the update was merged.

## Current boundaries

All 17 built-in visualizers and 6 background categories remain registered. Optional third-party desktop Folium mods can require Node/filesystem/FFmpeg or desktop windows; those are not Android-compatible merely because their JavaScript can be copied. Automix/AI stems, browser effects/equalizer and device selection are unavailable on the native Android path and must be presented honestly.

The native spectrum uses Android Visualizer on Folia's nonzero session only. It is opt-in with Android RECORD_AUDIO permission; no microphone AudioRecord is created. Denial/unavailable OEM audio effect does not fail playback. Native events update MotionValues directly at 20 Hz and stop when hidden. General timed animation remains available without a spectrum.

BYD support: retain the application-level integer `BYD_SUPPORT_SPLIT_ACTIVITY=1`, resizable activity and no fixed orientation. Insets protect controls. Transparent app system bars are a request, not authority over the OEM caption. Do not spoof another media package, guess protected Binder transactions or copy a proprietary OEM SDK. Home-card producer integration remains an open real-device issue.

## Runtime diagnostics

Node.js Mobile has no ICU. `mobile/runtime/compat.cjs` supplies strict UTF-8 decoding only when the native fatal decoder reports ERR_NO_ICU; malformed UTF-8 remains rejected. Unit tests cover Chinese, emoji, split sequences, byte offsets and BOM handling.

For diagnosis, workflow_dispatch `apk_run_id` + `runtime_probe=true` installs an existing debug APK in a disposable emulator and overlays current backend JS. Its report explicitly records the runtime source revision and is **not release verification**. Publication is disabled in that mode. A fix must still be rebuilt into an APK and pass normal tests before release.

KuGou's desktop `safeStorage` contract is supplied by the Android private-file adapter: AES-256-GCM, a separate key file with mode 0600 inside the app sandbox, and authenticated ciphertext. This is Android app-private persistence, not a claim of hardware-backed key storage. Plaintext legacy sessions are migrated by the upstream bridge; login no longer depends on an Electron keychain.

## Major 0.7.25 / Qishui integration

Qishui uses upstream qishui-music-api 0.2.2 via the typed Omni provider and the authenticated native EmbeddedMusic bridge, with the protocol and ticket guard running inside the APK. No user-deployed server or remote signing service is required. Account authorization remains an explicit user scan; credentials stay in encrypted app-private storage. The package declares Node >=24; this exact pinned release is separately tested under Node 18 (QR/network reads, crypto guard, encrypted restart/logout and real private-listener startup), with the mobile no-ICU decoder preserved. Re-evaluate this compatibility on every dependency update. Desktop packages such as mpv/librespot and dual-deck Automix remain outside the Android playback path.

Actual device scan, account expiry/renewal and BYD firmware behavior remain real-car regression items. Protected full tracks are not decrypted; a platform-issued plaintext preview is labeled as such. Production native playback, steering controls and linear app gain are validated separately from browser media playback. The OEM home card issue remains open.
