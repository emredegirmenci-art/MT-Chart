# MT Karne – Tatvan MT Kampı saha karnesi

Manyetotellürik (MT) saha karnesini telefonda doldurmak için çevrimdışı çalışan uygulama.

- **iPhone / tarayıcı (PWA):** https://emredegirmenci-art.github.io/MT-Chart/
- **Android:** [apk/MT-Karne-1.3.apk](apk/MT-Karne-1.3.apk) · doğrudan indirme: https://emredegirmenci-art.github.io/MT-Chart/apk/MT-Karne-1.3.apk
- **APK derleme:** `android/build.sh` (imza anahtarı ve şifresi depoda yoktur; `android/mt-karne.keystore` ve `android/keystore.properties` ayrıca saklanır)

---


Uygulama depo kökündeki dosyalardan oluşur: `index.html`, `app.css`, `app.js`, `utm.js`, `sw.js`, `manifest.webmanifest`, `icons/`.
iPhone'da GPS ve çevrimdışı çalışma için bu dosyaların **HTTPS** bir adreste yayınlanması gerekir (bir kere yapılır, ücretsiz).

## 1. Adres
Uygulama GitHub Pages ile yayında: **https://emredegirmenci-art.github.io/MT-Chart/**
Bu depoda `main` dalına yapılan her değişiklik birkaç dakika içinde bu adrese yansır (Settings → Pages → Branch: main / root).

## 2. iPhone'a kurma (her ekip üyesi)
1. Adresi **Safari**'de açın (Chrome'da ana ekrana ekleme çevrimdışı çalışmaz).
2. **Paylaş → Ana Ekrana Ekle → Ekle**.
3. Ana ekrandaki **MT Karne** simgesinden açın, internet açıkken bir kez açılması yeterli; sonra sahada internetsiz çalışır.
4. İlk "Konumu al"da konum iznine **İzin Ver** deyin. Ayarlar → Gizlilik ve Güvenlik → Konum Servisleri bölümünde **Tam Konum** açık olmalı.

## 3. Kullanım
- **+ Yeni karne**: Box no, ekip, sensör seri no, plaka, nöbetçi ve dipol/elektrot uzunlukları bir önceki karneden gelir; nokta no bir artar (R45 → R46).
- **Konumu al**: GPS en fazla 20 sn dinlenir, en iyi doğruluk alınır (±5 m'ye inince kendiliğinden durur; "Durdur" ile o anki değer kabul edilir). Zon/Doğu/Kuzey kilitlidir, gerekirse "Koordinatı elle düzelt".
- Eşik aşan alanlar kırmızı olur.
- **Kroki**: İlk dokunuşta kuzey bobini (Hx), ikinci dokunuşta doğu bobini (Hy) belirir; parmağı kaydırıp bırakınca yeri sabitlenir. Sonra bobine dokunup sürükleyerek taşıyabilir, boş yere parmakla çizim yapabilirsiniz. "Geri al" son işlemi geri alır.
- Her değişiklik otomatik kaydedilir (telefonun içine).
- **PDF**: PDF telefonda doğrudan üretilir (yazıcı seçmek gerekmez). iPhone'da "PDF hazır → Paylaş / Kaydet" ile Dosyalar'a veya WhatsApp'a gönderin; "Tümü PDF" bütün karneleri tek dosyada verir.
- **Datum**: WGS84 veya ED50 (Türkiye) seçilebilir; seçim değişince koordinat yeniden hesaplanır (EPSG "ED50 to WGS 84 (30)", ~2 m). Ham WGS84 enlem/boylam her zaman saklanır.
- **Harita**: İnternet varken konum alınınca OpenStreetMap haritası karneye kaydedilir ve sonra internetsiz de görünür. İnternet yoksa en yakın ilçe/beldelerin mesafe ve yönünü gösteren şematik harita çizilir; internet gelince "Haritayı yenile".
- **Karne başlığı**: Listede başlığa dokunarak değiştirin; yeni karneler bu başlıkla açılır. Her karnenin başlığı formun en üstünden de değiştirilebilir.
- **Excel (CSV)**: tüm karneler tek tablo (Türkçe Excel'e uygun: `;` ayırıcı, virgüllü ondalık).
- **Yedek al / Yedek yükle**: tüm karneler fotoğraflarıyla tek JSON dosyası. Başka telefona aktarmak için de kullanılır.

## Önemli
- Kayıtlar yalnızca o telefonda durur. iOS uzun süre açılmayan uygulamaların verisini silebilir; **her akşam Yedek al veya CSV gönderin**.
- Uygulamada değişiklik yaparsanız `sw.js` içindeki `SURUM` değerini artırın (ör. `mt-karne-v2`), yoksa telefonlar eski sürümde kalır.

## Android (APK)
- APK: `apk/MT-Karne-1.3.apk` (https://emredegirmenci-art.github.io/MT-Chart/apk/MT-Karne-1.3.apk) (eski sürümün üzerine kurulur, kayıtlar korunur). Telefona WhatsApp/Drive/USB ile gönderin, dosyaya dokunun; "Bilinmeyen kaynaklardan yüklemeye izin ver" sorulursa izin verin.
- APK tamamen çevrimdışıdır: kurulum dahil hiçbir adımda internet gerekmez. İlk açılışta konum iznine "Uygulamayı kullanırken" deyin.
- Fotoğraf eklerken kamera ya da galeri seçilebilir; kameradan çekilenler galeride "MT Karne" albümüne de kaydedilir.
- CSV / yedek / PDF: Android'in "kaydet" penceresi açılır (İndirilenler, Drive vb.). PDF artık yazıcı ekranı olmadan doğrudan kaydedilir.
- Yeni sürüm: depo kökündeki web dosyalarında değişiklik yapıp `android/build.sh` ile yeniden derleyin (VERSION_CODE artırarak). Güncellemenin eski sürümün üzerine kurulabilmesi için `android/mt-karne.keystore` dosyası **saklanmalı**; kaybolursa uygulama silinip yeniden kurulmak zorunda kalır (veriler gider, önce yedek alın).
