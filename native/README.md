# Billhead for Android

The Android app is the web app in a Capacitor shell: the same `index.html`, `app.css`, `js/`, `vendor/`,
`fonts/` and `icons/` from the repo root, packaged into the app, plus `www/native.js` (built from
`src/native.js`) which gives the app its native parts:

- the state file `files/billhead/state.json`, written on every save and read at start, which Android
  backs up to the user's Google account and carries to a new phone (`res/xml/backup_rules.xml` and
  `data_extraction_rules.xml` back up only that file; the WebView's own storage is rebuilt from it)
- the share sheet for PDFs (`Share PDF`) and `Save to phone` into `Documents/Billhead/`
- the back button, the system bars (edge to edge; the web app pads its header and tab bar with the
  safe-area insets) and the splash screen, which is plain navy (no icon, `windowSplashScreenAnimatedIcon`
  is transparent in `res/values/styles.xml`) and stays up until the first screen is drawn; then the app's
  own launch animation shows the mark (see the main README). It goes without a fade (`launchFadeOutDuration` 0 in
  `capacitor.config.json`): the animation starts on the same navy, and a fade would be run by the app's main thread,
  which is busiest right then and on a slow phone kept the splash up over the animation

Nothing in the web app changes for the browser: `js/app.js` looks for `window.BHNative` and uses the
normal download and share paths when it is not there.

## Build

GitHub Actions does it (`.github/workflows/android.yml`) on every push that touches the app: tests, assemble,
`cap sync`, `gradlew bundleRelease`, then the debug build on an emulator (start, state file, Auto Backup
round trip). The bundle is in the run's artifacts. It is signed with the upload key when these repository
secrets exist (Settings, Secrets and variables, Actions):

| Secret | Value |
| --- | --- |
| `BILLHEAD_KEYSTORE_BASE64` | the upload keystore, base64 (`base64 -w0 billhead-upload.jks`) |
| `BILLHEAD_KEYSTORE_PASSWORD` | its password |
| `BILLHEAD_KEY_ALIAS` | `upload` |
| `BILLHEAD_KEY_PASSWORD` | the same password |

Play App Signing holds the real signing key; the upload key only proves a bundle came from us, and Play
Console can reset it if it is ever lost.

Version code: 100 plus the Actions run number; hand builds use 1 to 99. Version name: `1.0.0` or the
`versionName` input when the workflow is run by hand.

By hand (needs Node 22, Java 21 and the Android SDK with `ANDROID_HOME` set):

```
cd native && npm ci
python3 ../tools/assemble_native.py      # web app plus native.js into www/
npx cap sync android                     # into android/app/src/main/assets/public
cd android && ./gradlew bundleRelease -PversionCode=2 -PversionName=1.0.1
```

Signing by hand: set `BILLHEAD_KEYSTORE_FILE`, `BILLHEAD_KEYSTORE_PASSWORD`, `BILLHEAD_KEY_ALIAS` and
`BILLHEAD_KEY_PASSWORD` in the environment before `gradlew`.

Icons and splash: `python3 tools/make_icons.py android` draws the source images into `native/assets/`,
then `npx capacitor-assets generate --android --iconBackgroundColor '#1C3F7A' --splashBackgroundColor '#1C3F7A'`.
The adaptive icon background is a solid color set in `res/values/ic_launcher_background.xml`: afterwards put
back `mipmap-anydpi-v26/ic_launcher.xml` and `ic_launcher_round.xml` (`git checkout` them) and delete the
`mipmap-*/ic_launcher_background.png` files the tool adds. The splash images are plain navy.

## Tests

- `python3 tests/native_check.py` (after assembling): the app with the shell stubbed, in Chromium.
- `native/smoke/smoke.sh app-debug.apk`: on an emulator or a phone with USB debugging. After the checks it
  records a cold start as `native/smoke/out/launch.mp4` (the splash, then the launch animation), kept with the
  run's artifacts.
