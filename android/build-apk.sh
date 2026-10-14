#!/usr/bin/env bash
# Construit l'APK Android sans Gradle (aapt2 + javac + d8 + apksigner).
# Prérequis : JDK 17+, Android SDK avec "platforms;android-34" et "build-tools;34.0.0".
# Usage : ANDROID_HOME=/chemin/sdk ./android/build-apk.sh   →  android/build/Nightshift.apk
set -euo pipefail
cd "$(dirname "$0")/.."
SDK="${ANDROID_HOME:-/opt/android-sdk}"
BT="$SDK/build-tools/34.0.0"
JAR="$SDK/platforms/android-34/android.jar"
OUT=android/build
rm -rf "$OUT" && mkdir -p "$OUT/assets" "$OUT/classes" "$OUT/dex" "$OUT/compiled"

echo "1/6 Compilation du jeu (fichier HTML autonome)"
npx vite build --mode single >/dev/null
cp dist-single/index.html "$OUT/assets/index.html"

echo "2/6 Ressources"
"$BT/aapt2" compile --dir android/res -o "$OUT/compiled/res.zip"
"$BT/aapt2" link -o "$OUT/base.apk" -I "$JAR" --manifest android/AndroidManifest.xml \
  -A "$OUT/assets" --java "$OUT/gen" "$OUT/compiled/res.zip" --min-sdk-version 24 --target-sdk-version 34

echo "3/6 Java"
javac --release 11 -nowarn -cp "$JAR" -d "$OUT/classes" $(find android/src "$OUT/gen" -name '*.java') 2>&1 | grep -v '^Note:' || true

echo "4/6 Dex"
"$BT/d8" --release --min-api 24 --lib "$JAR" --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')

echo "5/6 Assemblage"
cp "$OUT/base.apk" "$OUT/unsigned.apk"
(cd "$OUT/dex" && zip -q -j ../unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

echo "6/6 Signature"
KS="${NIGHTSHIFT_KEYSTORE:-android/nightshift.keystore}"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -storepass nightshift -keypass nightshift -alias nightshift \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=SUPERESSENCE, O=SUPERESSENCE, C=FR" >/dev/null 2>&1
fi
"$BT/apksigner" sign --ks "$KS" --ks-pass pass:nightshift --key-pass pass:nightshift --ks-key-alias nightshift \
  --out "$OUT/Nightshift.apk" "$OUT/aligned.apk"
"$BT/apksigner" verify "$OUT/Nightshift.apk"
ls -lh "$OUT/Nightshift.apk"
