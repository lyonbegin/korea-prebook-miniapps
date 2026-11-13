# MyDoctor 6.50.0 Hermes HBC 96 — independent native rehost experiment

## Goal

Run the **actual, unmodified** HBC96 UI program from the original
`base.apk/assets/index.android.bundle` in a separately installable Android
package, **without translating screens into HTML or recreating React UI**.

The original RN Java/Dex, split APK native modules, images, resources and Hermes
bytecode are preserved in the rehost. This is a packaging-based *native wrapper
probe*, **not yet a fresh React Native host implementation**.

## Provenance and acceptance

Source XAPK: `나만의닥터_6.50.0.xapk`, package
`com.merakiplace.mydoctor`. Required original HBC SHA256:
`6c99d3d6766668dd29909eb49edb92a004e588b7f49c8f93a54730c31e9a4802`.

The Python tool refuses to proceed if the SHA does not match and also rejects
changed native `.so` bytes after repackaging.

The rehost package ID is `com.hitel.mydoctor.hermes`, to enable side-by-side
installation. All splits are re-signed with one **temporary testing key**.
This will invalidate any original-app signature checks and could change the
behavior of login, push notifications, provider authorities, Play Integrity and
authentication APIs. Such failures must not be marked as UI pass.

## Scripts

- `build_unmodified_hbc_wrapper.py` extracts, verifies, rehosts and signs the
  original APK splits; its **original Hermes bytecode remains unchanged**.
- `probe_runtime.sh` installs the new package on an Android emulator, records
  the actual foreground process, Android UI hierarchy, screenshot and logcat;
  a launcher screen or splash screen does **not** count as an original UI pass.
- GitHub Actions:
  `.github/workflows/mydoctor-hermes-rehost-original.yml`.

## Status criteria

1. **EXTRACTED**: original XAPK obtained, correct HBC SHA256.
2. **REPACKAGED**: signed APK splits with correct target app ID, unchanged HBC
   and native library hashes.
3. **RUNTIME_STARTED**: target process is foreground on a test emulator.
4. **ORIGINAL_UI_VISIBLE**: the screenshot and Android accessibility tree contain
   real app content, not the launcher or a plain splash.
5. **INDEPENDENT_UI_VALIDATED**: tapping and scrolling are verified on screen.

These are five distinct states, and none should be inferred from the previous.

## Limitations

The original XAPK is not stored in this public repository; the CI job downloads
a purported 6.50.0 ARM64 split XAPK and **checks the exact user-uploaded HBC hash**
before continuing. No proprietary APK or Hermes bytecode is uploaded as a
GitHub Actions artifact. The proof-of-concept is confined to inspection/testing.

A web browser cannot render HBC96 + RN views on its own. A browser preview
would need either a separately engineered RN-to-DOM bridge or a live stream
of an Android process. Neither is silently substituted for the native test.
