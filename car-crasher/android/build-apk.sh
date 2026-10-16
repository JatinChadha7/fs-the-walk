#!/usr/bin/env bash
# Builds JC Car Crasher as an installable APK without Android Studio or the Android SDK.
# Every tool comes from Maven Central:
#   aapt2 + framework resources  (org.apktool:apktool-lib)
#   android.jar to compile against (org.robolectric:android-all)
#   dx dexer                     (com.jakewharton.android.repackaged:dalvik-dx)
#   apksig signer                (com.android.tools.build:apksig)
# Requires: bash, curl, unzip, python3, JDK 11+.
#
# Signing: uses $KEYSTORE (PKCS12) with $KEYSTORE_PASS / $KEY_ALIAS. If no keystore exists yet,
# one is generated at android/keystore/jc-release.p12 — keep that file safe and reuse it, or
# Android will refuse to install future builds over the old one.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
GAME="$(cd "$HERE/.." && pwd)"
BUILD="${BUILD_DIR:-$HERE/build}"
TOOLS="${TOOLS_DIR:-$HERE/.tools}"
OUT_APK="${OUT_APK:-$GAME/JC-Car-Crasher.apk}"
MIRRORS=("${MAVEN_MIRROR:-https://maven-central.storage-download.googleapis.com/maven2}" "https://repo1.maven.org/maven2")

VERSION_CODE="${VERSION_CODE:-1}"
VERSION_NAME="${VERSION_NAME:-1.0}"
KEYSTORE="${KEYSTORE:-$HERE/keystore/jc-release.p12}"
KEYSTORE_PASS="${KEYSTORE_PASS:-jc-car-crasher}"
KEY_ALIAS="${KEY_ALIAS:-jc}"

APKTOOL_V=3.0.3
ANDROID_ALL_V=15-robolectric-13954326
DX_V=16.0.1
APKSIG_V=2.3.0

mkdir -p "$TOOLS" "$BUILD"

fetch() { # maven-path -> local file
  local rel="$1" file="$TOOLS/$(basename "$1")"
  if [ ! -s "$file" ]; then
    for m in "${MIRRORS[@]}"; do
      echo "  downloading $(basename "$rel")" >&2
      if curl -fsSL --retry 4 --retry-delay 2 -o "$file.part" "$m/$rel"; then mv "$file.part" "$file"; break; fi
    done
  fi
  [ -s "$file" ] || { echo "could not download $rel" >&2; exit 1; }
  echo "$file"
}

echo "== tools"
APKTOOL_JAR=$(fetch "org/apktool/apktool-lib/$APKTOOL_V/apktool-lib-$APKTOOL_V.jar")
ANDROID_JAR=$(fetch "org/robolectric/android-all/$ANDROID_ALL_V/android-all-$ANDROID_ALL_V.jar")
DX_JAR=$(fetch "com/jakewharton/android/repackaged/dalvik-dx/$DX_V/dalvik-dx-$DX_V.jar")
APKSIG_JAR=$(fetch "com/android/tools/build/apksig/$APKSIG_V/apksig-$APKSIG_V.jar")

case "$(uname -s)" in
  Darwin) AAPT_OS=macosx ;;
  *) AAPT_OS=linux ;;
esac
AAPT2="$TOOLS/aapt2-$AAPT_OS"
FRAMEWORK="$TOOLS/android-framework.jar"
if [ ! -x "$AAPT2" ] || [ ! -s "$FRAMEWORK" ]; then
  unzip -o -q -j "$APKTOOL_JAR" "prebuilt/$AAPT_OS/aapt2" -d "$TOOLS/x"
  mv "$TOOLS/x/aapt2" "$AAPT2" && chmod +x "$AAPT2"
  unzip -o -q -j "$APKTOOL_JAR" "prebuilt/android-framework.jar" -d "$TOOLS"
  rmdir "$TOOLS/x" 2>/dev/null || true
fi

echo "== clean"
rm -rf "$BUILD/compiled" "$BUILD/classes" "$BUILD/dex" "$BUILD/assets" "$BUILD"/*.apk
mkdir -p "$BUILD/compiled" "$BUILD/classes" "$BUILD/dex" "$BUILD/assets"

echo "== assets (game)"
cp -R "$GAME/www" "$BUILD/assets/www"

echo "== resources"
"$AAPT2" compile --dir "$HERE/res" -o "$BUILD/compiled/res.zip"
"$AAPT2" link -o "$BUILD/base.apk" \
  -I "$FRAMEWORK" \
  --manifest "$HERE/AndroidManifest.xml" \
  -A "$BUILD/assets" \
  --min-sdk-version 24 --target-sdk-version 34 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  --java "$BUILD/gen" \
  "$BUILD/compiled/res.zip"

echo "== java"
find "$HERE/src" "$BUILD/gen" -name '*.java' > "$BUILD/sources.txt"
javac --release 8 -nowarn -Xlint:-options -encoding UTF-8 \
  -classpath "$ANDROID_JAR" -d "$BUILD/classes" @"$BUILD/sources.txt"

echo "== dex"
java -cp "$DX_JAR" com.android.dx.command.Main --dex --min-sdk-version=24 \
  --output="$BUILD/dex/classes.dex" "$BUILD/classes"

echo "== package + align"
python3 - "$BUILD/base.apk" "$BUILD/dex/classes.dex" "$BUILD/aligned.apk" <<'PY'
# Adds classes.dex and writes the zip zipalign-style: every uncompressed entry's data starts on a
# 4-byte boundary. resources.arsc stays uncompressed (Android 11+ refuses compressed ones).
import sys, struct, zipfile, zlib
src, dex, out = sys.argv[1:4]
zin = zipfile.ZipFile(src)
entries = [(i.filename, zin.read(i.filename), i.compress_type == zipfile.ZIP_STORED or i.filename == 'resources.arsc')
           for i in zin.infolist()]
entries.append(('classes.dex', open(dex, 'rb').read(), False))
DOS_TIME, DOS_DATE = 0, ((2026 - 1980) << 9) | (1 << 5) | 1
with open(out, 'wb') as f:
    central = []
    for name, data, stored in entries:
        if stored:
            method, raw = 0, data
        else:
            c = zlib.compressobj(9, zlib.DEFLATED, -15)
            method, raw = 8, c.compress(data) + c.flush()
        bname = name.encode('utf-8')
        offset = f.tell()
        extra = b'\x00' * ((4 - (offset + 30 + len(bname)) % 4) % 4) if stored else b''
        crc = zlib.crc32(data) & 0xffffffff
        f.write(struct.pack('<IHHHHHIIIHH', 0x04034b50, 20, 0x0800, method, DOS_TIME, DOS_DATE,
                            crc, len(raw), len(data), len(bname), len(extra)))
        f.write(bname + extra + raw)
        central.append((bname, method, crc, len(raw), len(data), offset))
    cd_start = f.tell()
    for bname, method, crc, csize, usize, offset in central:
        f.write(struct.pack('<IHHHHHHIIIHHHHHII', 0x02014b50, 20, 20, 0x0800, method, DOS_TIME, DOS_DATE,
                            crc, csize, usize, len(bname), 0, 0, 0, 0, 0, offset))
        f.write(bname)
    cd_end = f.tell()
    f.write(struct.pack('<IHHHHIIH', 0x06054b50, 0, 0, len(central), len(central), cd_end - cd_start, cd_start, 0))
PY

echo "== sign"
if [ ! -s "$KEYSTORE" ]; then
  echo "  no keystore found, generating $KEYSTORE"
  mkdir -p "$(dirname "$KEYSTORE")"
  keytool -genkeypair -storetype PKCS12 -keystore "$KEYSTORE" -storepass "$KEYSTORE_PASS" \
    -alias "$KEY_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=JC Car Crasher, O=JC" >/dev/null 2>&1
fi
# apksig 2.3 touches JDK-internal classes while starting up; open them up for it.
java --add-exports java.base/sun.security.x509=ALL-UNNAMED --add-exports java.base/sun.security.pkcs=ALL-UNNAMED \
  --add-exports java.base/sun.security.util=ALL-UNNAMED \
  -cp "$APKSIG_JAR" "$HERE/tools/ApkSign.java" "$KEYSTORE" "$KEYSTORE_PASS" "$KEY_ALIAS" "$BUILD/aligned.apk" "$OUT_APK"

echo "== done: $OUT_APK ($(du -h "$OUT_APK" | cut -f1))"
