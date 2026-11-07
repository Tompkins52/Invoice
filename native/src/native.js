/* Billhead native glue. Bundled by esbuild into www/native.js and loaded before the app scripts
   in the Android (and later iOS) build. It sets window.BHNative, which js/app.js uses when present:
   the state file that Android backs up and carries to a new phone, the share sheet, saving a PDF
   to the phone, the back button, the system bars and the splash screen. In a browser it does nothing. */
import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { App } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";

var STATE_PATH = "billhead/state.json";
var SAVE_FOLDER = "Billhead";

function toBase64(bytes) {
  var u8 = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  var out = "", chunk = 0x8000;
  for (var i = 0; i < u8.length; i += chunk) out += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
  return btoa(out);
}

function safeName(name) { return String(name || "invoice.pdf").replace(/[\\/:*?"<>|]+/g, "-"); }

async function writeTemp(bytes, name) {
  var r = await Filesystem.writeFile({ path: "share/" + safeName(name), data: toBase64(bytes), directory: Directory.Cache, recursive: true });
  return r.uri;
}

async function sharePdf(bytes, name, title) {
  var uri = await writeTemp(bytes, name);
  return Share.share({ title: title || name, dialogTitle: title || "Share invoice", files: [uri] });
}

async function saveFile(bytes, name, mime) {
  var file = safeName(name);
  try {
    await Filesystem.writeFile({ path: SAVE_FOLDER + "/" + file, data: toBase64(bytes), directory: Directory.Documents, recursive: true });
    return "Documents/" + SAVE_FOLDER + "/" + file;
  } catch (e) {
    /* Some phones will not let an app write to Documents; the share sheet still gets the file anywhere (Files, Drive, Mail). */
    var uri = await writeTemp(bytes, file);
    await Share.share({ title: file, dialogTitle: "Save " + file, files: [uri] });
    return "the app you picked";
  }
}

async function saveState(text) {
  await Filesystem.writeFile({ path: STATE_PATH, data: text, directory: Directory.Data, encoding: Encoding.UTF8, recursive: true });
}

async function loadState() {
  try {
    var r = await Filesystem.readFile({ path: STATE_PATH, directory: Directory.Data, encoding: Encoding.UTF8 });
    return typeof r.data === "string" ? r.data : null;
  } catch (e) { return null; }
}

/* Edge to edge: the bars are transparent over the app's own header and tab bar, so only the icon color changes. */
async function setDark(dark) {
  try { await SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }); } catch (e) { }
}

var backHandlers = [];
function onBack(fn) { backHandlers.push(fn); }

var splashHidden = false;
function ready() {
  if (splashHidden) return;
  splashHidden = true;
  SplashScreen.hide({ fadeOutDuration: 200 }).catch(function () { });
}

if (Capacitor.isNativePlatform()) {
  App.addListener("backButton", function () {
    if (backHandlers.length) backHandlers[backHandlers.length - 1]();
    else App.minimizeApp();
  });
  /* Never leave the splash up if the page fails early. */
  setTimeout(ready, 4000);
  window.BHNative = {
    platform: Capacitor.getPlatform(),
    saveState: saveState,
    loadState: loadState,
    sharePdf: sharePdf,
    saveFile: saveFile,
    setDark: setDark,
    onBack: onBack,
    minimize: function () { return App.minimizeApp(); },
    ready: ready,
    info: function () { return App.getInfo(); }
  };
}
