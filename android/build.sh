#!/bin/bash
# MT Karne APK derleme: web uygulamasını (PWA) APK'ya paketler.
# İmza şifresi depoda tutulmaz: android/keystore.properties dosyasında KS_PASS=... olarak ya da ortam değişkeni olarak verin.
# Gereken: Ubuntu paketleri android-sdk-platform-23 aapt apksigner zipalign dalvik-exchange, JDK.
# Sürümü yükseltmek için: VERSION_CODE ve VERSION_NAME'i artırın.
set -euo pipefail
cd "$(dirname "$0")"
VERSION_CODE=${VERSION_CODE:-1}
VERSION_NAME=${VERSION_NAME:-1.0}
PWA=${PWA_DIR:-../pwa}; [ -f "$PWA/index.html" ] || PWA=..
[ -f keystore.properties ] && . ./keystore.properties
: "${KS_PASS:?İmza şifresi yok: android/keystore.properties içine KS_PASS=... yazın}"
SDK=/usr/lib/android-sdk
JAR=$SDK/platforms/android-23/android.jar
B=${BUILD_DIR:-/tmp/mt-karne-build}
rm -rf "$B"; mkdir -p "$B/assets/www" "$B/gen" "$B/obj"
for f in index.html app.css app.js utm.js manifest.webmanifest icons lib; do cp -r "$PWA/$f" "$B/assets/www/"; done
aapt2 compile --dir res -o "$B/res.zip"
aapt2 link -o "$B/base.apk" -I "$JAR" --manifest AndroidManifest.xml -R "$B/res.zip" -A "$B/assets" \
  --java "$B/gen" --min-sdk-version 23 --target-sdk-version 34 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" --auto-add-overlay
javac -nowarn -Xlint:-options --release 8 -encoding UTF-8 -cp "$JAR" -d "$B/obj" $(find src "$B/gen" -name '*.java')
/usr/lib/android-sdk/build-tools/debian/dx --dex --min-sdk-version=23 --output="$B/classes.dex" "$B/obj"
cp "$B/base.apk" "$B/unsigned.apk"
(cd "$B" && zip -q -j unsigned.apk classes.dex)
zipalign -f -p 4 "$B/unsigned.apk" "$B/aligned.apk"
if [ ! -f mt-karne.keystore ]; then
  keytool -genkeypair -keystore mt-karne.keystore -alias mtkarne -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" -dname "CN=MT Karne, O=Tatvan MT Kampi, C=TR" 2>/dev/null
fi
export KS_PASS
apksigner sign --ks mt-karne.keystore --ks-key-alias mtkarne --ks-pass env:KS_PASS --key-pass env:KS_PASS \
  --min-sdk-version 23 --out "MT-Karne-$VERSION_NAME.apk" "$B/aligned.apk"
apksigner verify --print-certs "MT-Karne-$VERSION_NAME.apk" | head -2
ls -la "MT-Karne-$VERSION_NAME.apk"
