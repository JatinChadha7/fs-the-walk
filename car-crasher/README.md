# JC Car Crasher

A free arcade racer for Android. You drive a black Hummer with **JC** on the roof down a five-lane
highway that moves to a new place on Earth every lap. Smash into traffic for points, and stay away
from bombs and dynamite.

## Install on your phone

1. Download [`JC-Car-Crasher.apk`](JC-Car-Crasher.apk) on your Android phone (Android 7.0 or newer).
2. Open it. Android will ask you to allow installs from that app (Chrome, Files, etc.) — allow it.
3. Tap **Install**, then open **JC Car Crasher**.

Play Protect may show a "scan app" prompt because the app isn't from the Play Store; that's normal
for sideloaded apps.

## How to play

- **Swipe or tap** left or right to change lanes (arrow keys or A/D on a keyboard).
- **Crash into cars** to collect the points shown on their roofs. Small cars are worth 10–40,
  SUVs and vans 50–80, buses and trucks 120–150. A rare **golden car** is worth 500.
- **Bombs and TNT end the run.** Cars that drive into them blow up too.
- Crash cars back to back to build a **streak**: every 5 in a row raises the multiplier (up to ×5).
  Letting a car get past you resets it.
- Pick-ups: **Shield** survives one bomb for 12 s; **2×** doubles every crash for 10 s.

### Laps, places and night rides

- Each lap is 20–25 cars. Clearing a lap gives a bonus, raises the speed, and the road moves to a
  new location, announced by a "Welcome to…" gantry and a banner with the country and its flag.
- 18 locations: New York, Paris, London, Dubai, Singapore, Shanghai, the Great Wall, Agra,
  Mumbai, Manali, Lagos, Bangkok, Pattaya, the Swiss Alps, Sydney, the Outback, the Maldives and
  Giza, each with its own terrain (city, sea bridge, flyover, mountain pass, beach, desert),
  landmark, local traffic (kaali-peeli taxis, danfos, tuk-tuks, red double-deckers…), road signs
  and weather (London rain, Alpine and Himalayan snow, Saharan sand).
- Day turns to night and back at random. At night every car, bomb and stick of dynamite glows
  neon, and the Hummer's headlights and underglow light up the road.

## Play in a browser

Open `www/index.html` through any local web server, for example:

```sh
cd car-crasher/www && python3 -m http.server 8000
# then visit http://localhost:8000
```

## Build the APK yourself

```sh
car-crasher/android/build-apk.sh
```

The script needs only bash, curl, unzip, python3 and a JDK (11+). It downloads its Android tools
from Maven Central (aapt2, an `android.jar` to compile against, the `dx` dexer and the `apksig`
signer), so no Android SDK or Android Studio is required. The APK is written to
`car-crasher/JC-Car-Crasher.apk`.

**Signing key.** The first build creates `car-crasher/android/keystore/jc-release.p12` (ignored by
git). Keep that file and reuse it: Android only installs a new build *over* an old one when both
are signed with the same key. A build signed with a different key needs the old app uninstalled
first, which also clears the saved best score. Pass your own key with `KEYSTORE=… KEYSTORE_PASS=…`.

Every push that touches `car-crasher/` also builds the APK on GitHub Actions (see
`.github/workflows/car-crasher-apk.yml`); download it from the run's **Artifacts**. Add the
repository secrets `JC_KEYSTORE_B64` and `JC_KEYSTORE_PASS` to sign those builds with your key.

## Project layout

```
car-crasher/
├── JC-Car-Crasher.apk        ready-to-install build
├── www/                      the game (HTML5 canvas, no libraries, works offline)
│   ├── index.html, css/game.css, fonts/   (Bungee, Overpass, Overpass Mono — SIL OFL)
│   └── js/
│       ├── util.js           maths, seeded random, sprite cache
│       ├── vehicles.js       Hummer, traffic, bombs, dynamite, pick-ups (day + neon looks)
│       ├── locations.js      the 18 places: terrain, traffic, colours, road signs
│       ├── terrain.js        road and ground tiles for each terrain
│       ├── props.js          buildings, trees, lamps, boats, villas, gantries…
│       ├── landmarks.js      Statue of Liberty, Eiffel Tower, Taj Mahal, Burj Khalifa…
│       ├── flags.js          country flags drawn in code
│       ├── audio.js          synthesised engine, crashes, explosions and music
│       └── game.js           game loop, laps, day/night, collisions, HUD, input
└── android/
    ├── AndroidManifest.xml, res/            app name, theme, launcher icons
    ├── src/com/jc/carcrasher/MainActivity.java   fullscreen WebView host
    ├── build-apk.sh                          one-command APK build
    └── tools/                                signer and icon generator
```
