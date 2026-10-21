# BioSync — Teslim Günü Planı (teslim 20:30)

> Repo'da `docs/YOL_HARITASI.md`; CLAUDE.md'den `@docs/YOL_HARITASI.md` ile import edilir.
> Yeni konuşmada: "YOL_HARITASI.md'deki Faz X'i yap".

## Durum
Faz 0-3 tamam: fotoğraf → Gemini kalite puanı (zod) → 50 km lokal eşleştirme (araç bazlı maliyet, CO₂, elenen özeti) → harita (WebView/Leaflet). Expo SDK 57, Express 5 + tsx.

## Genel kurallar
- Tek seferde tek faz. Bitince: tsc (app+server) + lint → kısa özet → commit onayı bekle → push (Vercel otomatik deploy eder).
- Yeni paket = önce sor. Kapsam dışı fikir = uygulama, sona "öneri" yaz.
- Görsel dil: sade ve profesyonel. Dekoratif/çocuksu ikon yok; ikon yalnızca işlevsel yerde, ince çizgi, tek renk.
- `.env` ve Firebase/Gemini anahtarları asla commit'e girmez; commit öncesi `git status`.
- Her faz hem telefonda (Expo Go) hem web'de çalışmalı.
- **19:30 özellik dondurma.** Sonrası yalnızca hata düzeltme ve teslim işleri.

---

## Faz 4 kapanış (→ ~10:15)
Faz 4 bitmediyse: etki satırı (kaynaklı katsayı, "tahmini") + README taslağı. Commit, ardından `git tag v1-calisan` (her şey bozulursa dönülecek nokta).

## Faz A — Web sürümü ve canlıya alma (→ ~12:30) ⭐ en kritik
1. Web paketleri: `npx expo install react-dom react-native-web @expo/metro-runtime`.
2. Harita web'de: `react-native-webview` web'de çalışmaz → web için aynı Leaflet HTML'i `iframe srcDoc` ile göster (Platform'a göre ayrım, tek bileşen).
3. Fotoğraf küçültme: göndermeden önce uzun kenar ~1024px, JPEG ~0.6 (Vercel istek sınırı ~4.5 MB). Gerekirse `expo-image-manipulator` (önce sor).
4. Sunucu → Vercel: Express uygulamasını Vercel'e uygun dışa aktar (`server` ayrı Vercel projesi, Root Directory = `server`). `GEMINI_API_KEY`, `GEMINI_MODEL` Vercel ortam değişkeni. CORS: web sitesinin Vercel adresine izin ver.
5. Web → Vercel: `app` ayrı Vercel projesi; build `npx expo export -p web`, çıktı `dist`. `EXPO_PUBLIC_API_URL` = sunucunun Vercel adresi.
6. Sorun çıkarsa yedek: sunucuyu Render'a al (önce sor).

**Bitti:** Vercel bağlantısı farklı ağdaki bir iPhone ve Android'de tam akışı tamamlıyor (fotoğraf → puan → eşleşme → harita). Expo Go da çalışmaya devam ediyor.

## Faz B — Hata düzeltmeleri (→ ~13:30)
1. SafeArea: kaydırınca içerik durum çubuğunun altına girmesin.
2. Araç kapasitesi: miktara göre araç sınıfı (hafif ticari / kamyonet / kamyon), her birinin sefer ücreti, km maliyeti, emisyon faktörü; kapasite aşılırsa çoklu sefer. Kartta araç yazsın. Sabitler "demo varsayımı", ESLESTIRME_MANTIGI.md güncellenir. matchBuyers testine 500 kg / 5.000 kg senaryosu.
3. Web'de geniş ekran: içerik ortada, en fazla ~480px genişlikte tek sütun; kenarlarda nötr arka plan. Mobil görünüm (Expo Go ve dar tarayıcı) değişmez.

## Faz C — Tıklanabilir sonuçlar ve teklif (→ ~15:30)
1. Kompakt kart (alıcı, mesafe, net kâr, araç) → dokununca detay (maliyet kırılımı, CO₂, önlenen atık, "Teklif gönder").
2. Karta dokununca haritada alıcı vurgulanır + ilan–alıcı çizgisi; işaretçiye dokununca kart açılır.
3. Endüstri etiketi → kısa bilgi (statik sözlük: atık + sektör → ne üretilir, ör. narenciye kabuğu → kozmetik: uçucu yağ, biyoplastik: pektin).
4. Teklif simülasyonu: onay → "Talebiniz [alıcı]'ya iletildi" → birkaç sn sonra "Kabul edildi (demo)".
5. Oturum etki sayacı: kabul edilen teklifler toplanır (kg atık, tahmini net CO₂); sonuç ekranında/üstte küçük özet. Kalıcılık yok.

## Faz D — Rafine dokunuşlar (→ ~16:30)
1. Logo: sade wordmark "BioSync" (yazı tabanlı; ikon/maskot yok). Form ve sonuç başlığında.
2. Yükleme ekranı: spinner + fotoğrafın küçük önizlemesi; altında gıda israfı/iklim bilgileri sırayla fade in/out (4-6 bilgi, ~4 sn aralık). Her bilgi FAO/IPCC/UNEP gibi bir kaynağa dayanır; kaynaklar `docs/KAYNAKLAR.md`'de. Kaynağı doğrulanamayan bilgi eklenmez.
3. Boşluk/punto tutarlılığı, puan rengi skalası. Yeni özellik yok.

## Faz E — Firebase giriş (→ ~18:30) ⚠️ yalnızca A-D bittiyse
1. Firebase Auth (e-posta/şifre), Firebase JS SDK (Expo Go + web uyumlu). Config `EXPO_PUBLIC_FIREBASE_*` env'de.
2. Kayıt: e-posta, şifre, firma adı, rol (Üretici / Alıcı), il-ilçe, sektör. TC kimlik, vergi no, kişisel telefon toplanmaz.
3. KVKK: kısa aydınlatma metni + zorunlu onay kutusu. Profil Firestore'da `users/{uid}`; güvenlik kuralı: kullanıcı yalnızca kendi belgesini okur/yazar.
4. Hazır demo hesabı (jüri için), README'de bilgileri.
5. Sunucu: `/analyze` ve `/match` Firebase ID token doğrular (firebase-admin, önce sor) → Gemini anahtarı kötüye kullanılamaz.
6. İlan/teklif Firestore'a yazılmaz (sonraki aşama).
**18:30'da bitmemişse:** dalı merge etme, `main` girişsiz teslim edilir.

## Teslim (18:30 → 20:30)
- 18:30-19:30: README son hali (canlı bağlantı, demo hesabı, ekran görüntüleri, mimari), son deploy, iki telefonda + bilgisayarda tam test.
- 19:30 özellik dondurma. Ekran kaydı (demo yedeği). Anket.
- 20:00'den sonra yalnızca teslim.

## Zaman daralırsa kesme sırası
Faz E → Faz C.3 (endüstri bilgisi) → Faz C.5 (sayaç) → Faz D.3. **Faz A asla kesilmez.**
