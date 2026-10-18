# ClaudeShot

A small floating button for Android. Tap it on any screen to take a screenshot, mark it up, and
copy, save or share it. Think Lightshot, but for your phone.

## Install on your phone

1. Download [`ClaudeShot.apk`](ClaudeShot.apk) on your Android phone (Android 11 or newer).
2. Open it. Android asks you to allow installs from that app (Chrome, Files, WhatsApp…). Allow it.
3. Tap **Install**, then open **ClaudeShot**.

Play Protect may show a "scan app" prompt because the app isn't from the Play Store. That's normal
for apps you install yourself.

## Set it up (once)

1. **Allow the floating button.** Tap *Allow display over other apps*, find **ClaudeShot** in the
   list and turn it on. If Android says it's a *restricted setting*, open App info, tap ⋮ at the
   top right, choose *Allow restricted settings* and try again.
2. **Turn on the floating button.** It's on by default once step 1 is done. Allow notifications
   if asked: they show a "ClaudeShot is on" notice with a Stop button.
3. **Take your first screenshot.** Tap the floating button. Android asks *"Start recording or
   casting with ClaudeShot?"*. Tap **Start**. ClaudeShot only grabs one picture each time you tap.

## Use it

- **Tap** the button: screenshot, which opens straight in the editor.
- **Drag** the button to move it; it tucks against the nearest edge. Drag it onto **✕** at the
  bottom to turn it off.
- **Editor tools:** Pen, Marker (highlighter), Arrow, Box, Text, **Blur** (hide account numbers,
  OTPs, faces…) and Crop. Eight colours and three line sizes. Undo and redo everything, crop
  included.
- **Two fingers** zoom in and move around; one finger draws. Long screenshots open fitted to the
  width, with a scroll bar on the right: scroll through them with two fingers.
- **Top bar:** Copy (paste into any app), Save (to *Pictures/ClaudeShot* in your gallery) and Share.
- **Button style:** seven colours, five icons (viewfinder, camera, scissors, pencil, or your own one
  or two letters, such as *JC*), a size slider (from tiny to large), and what it does when not in use: stay solid, fade, or
  fade and tuck half off the edge. A tucked button comes out on the first tap and takes a
  screenshot on the second. It starts as a small blue *JC* button.

### Power + Volume down

Android keeps the Power + Volume down combination for itself; no app can take it over. Turn on
**Phone screenshot buttons** instead: every screenshot you take with those keys (or your phone's
own screenshot gesture) then opens straight in the ClaudeShot editor, about a second later. Your
phone still saves the original to its Screenshots album and shows its own preview for a moment.

Only want the keys? Turn **Floating button** off and keep *Phone screenshot buttons* on; keep
"display over other apps" allowed, because that's what lets ClaudeShot open its editor by itself.
(ClaudeShot targets Android 14 for this reason: for apps targeting 15, Android would only allow
it while the floating button is on screen.)

How fast the editor opens depends mostly on the phone. Many phones show a preview thumbnail for a
few seconds and only save the screenshot when it goes away; swiping the thumbnail away saves it
straight away, and ClaudeShot opens right after.

This needs access to your photos, so ClaudeShot can see the new screenshot. On Android 14 and
newer choose **Allow all**: with "selected photos only" it can't see new screenshots.

**Scrolling (long) screenshots.** Press Power + Volume down as usual, then tap **Scroll** (or
*Capture more*) on your phone's preview and let it scroll down the page. When the phone has saved
the long screenshot, it opens in ClaudeShot like any other. Very long ones (more than about nine
screens) open at half resolution so they fit in memory. The floating button can't scroll other
apps, so its screenshots are always one screen.

### Good to know

- **Screen-sharing icon.** Android only lets apps take screenshots through its screen-capture
  feature, so while *Keep screen capture ready* is on, your phone shows a casting or screen-sharing
  icon in the status bar. Newer Android versions ask for permission again after you lock the
  phone. Turn the setting off if you'd rather be asked before every screenshot instead.
- **Black screenshots.** Banking and video apps block screenshots, so those come out black,
  the same as with the phone's own screenshot button. Right after you allow screen capture, some
  phones send black frames for a moment; ClaudeShot waits for a real one (up to about four
  seconds), so the first screenshot can take a little longer.
- **The floating button appears in phone-button screenshots**, because it's on screen when the
  phone takes them. Choose *Tuck in*, or turn the floating button off if you only use the keys.
- **Button disappears by itself?** Some phones close background apps. In App info → Battery,
  choose *Unrestricted* or *Allow background activity*. ClaudeShot turns itself back on after the
  phone restarts.
- **Privacy.** ClaudeShot has no internet permission. Screenshots stay on your phone unless you
  share them. With photo access it only looks at the newest picture, and only to check whether
  it's a screenshot.

## Build it yourself

No Android Studio or SDK needed; every tool comes from Maven Central:

```sh
claudeshot/android/build-apk.sh   # writes claudeshot/ClaudeShot.apk
```

Requires bash, curl, unzip, python3 and JDK 11+. The code is plain Java without lambdas (the
dexer used here can't convert them) and compiles against Android 11, the oldest version it
supports, so any newer API that slips in fails the build instead of crashing older phones.

Signing: the first build generates `claudeshot/android/keystore/claudeshot.p12`, which is never
committed. Android only installs an update signed with the same key. To install a build signed
with a different key, uninstall ClaudeShot first. The GitHub workflow uses the repository secrets
`CLAUDESHOT_KEYSTORE_B64` and `CLAUDESHOT_KEYSTORE_PASS` when they are set.

### How it works

| Piece | File |
| --- | --- |
| Settings screen, button style picker | `MainActivity.java`, `StylePicker.java` |
| Floating button and the ✕ target; its look | `Bubble.java`; `BubbleView.java`, `BubbleStyle.java` |
| Foreground service that runs the button, the capture session and the watcher | `BubbleService.java` |
| Opening screenshots taken with Power + Volume down | `ScreenshotWatcher.java` |
| Turning back on after a restart or update | `BootReceiver.java` |
| Android's "start screen capture?" prompt | `CaptureActivity.java` |
| Screen capture (MediaProjection → virtual display → ImageReader) | `ScreenGrabber.java` |
| Editor screen and canvas | `EditorActivity.java`, `EditorView.java` |
| Saving to the gallery, files for sharing | `Exporter.java`, `ShareProvider.java` |

ClaudeShot uses Android's screen-capture permission instead of an accessibility service on
purpose: Google Play Protect blocks sideloaded apps that ask for accessibility access in several
countries, India included.
