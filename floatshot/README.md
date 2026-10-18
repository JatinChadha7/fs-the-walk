# FloatShot

A small floating button for Android. Tap it on any screen to take a screenshot, mark it up, and
copy, save or share it. Think Lightshot, but for your phone.

## Install on your phone

1. Download [`FloatShot.apk`](FloatShot.apk) on your Android phone (Android 11 or newer).
2. Open it. Android asks you to allow installs from that app (Chrome, Files, WhatsApp…). Allow it.
3. Tap **Install**, then open **FloatShot**.

Play Protect may show a "scan app" prompt because the app isn't from the Play Store. That's normal
for apps you install yourself.

## Set it up (once)

1. **Allow the floating button.** Tap *Allow display over other apps*, find **FloatShot** in the
   list and turn it on. If Android says it's a *restricted setting*, open App info, tap ⋮ at the
   top right, choose *Allow restricted settings* and try again.
2. **Start the floating button.** Allow notifications if asked. They show a "FloatShot is on"
   notice with a Stop button.
3. **Take your first screenshot.** Tap the floating button. Android asks *"Start recording or
   casting with FloatShot?"*. Tap **Start**. FloatShot only grabs one picture each time you tap.

## Use it

- **Tap** the button: screenshot, which opens straight in the editor.
- **Drag** the button to move it; it tucks against the nearest edge. Drag it onto **✕** at the
  bottom to turn it off.
- **Editor tools:** Pen, Marker (highlighter), Arrow, Box, Text, **Blur** (hide account numbers,
  OTPs, faces…) and Crop. Eight colours and three line sizes. Undo and redo everything, crop
  included.
- **Top bar:** Copy (paste into any app), Save (to *Pictures/FloatShot* in your gallery) and Share.

### Good to know

- **Screen-sharing icon.** Android only lets apps take screenshots through its screen-capture
  feature, so while *Keep screen capture ready* is on, your phone shows a casting or screen-sharing
  icon in the status bar. Newer Android versions ask for permission again after you lock the
  phone. Turn the setting off if you'd rather be asked before every screenshot instead.
- **Black screenshots.** Banking and video apps block screenshots, so those come out black,
  the same as with the phone's own screenshot button.
- **Button disappears by itself?** Some phones close background apps. In App info → Battery,
  choose *Unrestricted* or *Allow background activity*. After restarting the phone, open FloatShot
  and tap *Start floating button* again.
- **Privacy.** FloatShot has no internet permission. Screenshots stay on your phone unless you
  share them.

## Build it yourself

No Android Studio or SDK needed; every tool comes from Maven Central:

```sh
floatshot/android/build-apk.sh   # writes floatshot/FloatShot.apk
```

Requires bash, curl, unzip, python3 and JDK 11+. The code is plain Java without lambdas (the
dexer used here can't convert them) and compiles against Android 11, the oldest version it
supports, so any newer API that slips in fails the build instead of crashing older phones.

Signing: the first build generates `floatshot/android/keystore/floatshot.p12`, which is never
committed. Android only installs an update signed with the same key. To install a build signed
with a different key, uninstall FloatShot first. The GitHub workflow uses the repository secrets
`FLOATSHOT_KEYSTORE_B64` and `FLOATSHOT_KEYSTORE_PASS` when they are set.

### How it works

| Piece | File |
| --- | --- |
| Setup screen | `MainActivity.java` |
| Floating button and the ✕ target | `Bubble.java` |
| Foreground service that owns the button and the capture session | `BubbleService.java` |
| Android's "start screen capture?" prompt | `CaptureActivity.java` |
| Screen capture (MediaProjection → virtual display → ImageReader) | `ScreenGrabber.java` |
| Editor screen and canvas | `EditorActivity.java`, `EditorView.java` |
| Saving to the gallery, files for sharing | `Exporter.java`, `ShareProvider.java` |

FloatShot uses Android's screen-capture permission instead of an accessibility service on
purpose: Google Play Protect blocks sideloaded apps that ask for accessibility access in several
countries, India included.
