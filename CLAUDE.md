Yol haritası: @docs/YOL_HARITASI.md

# BioSync – Cursor Kuralları (PDR'a sadık)

> Kaynak: BioSync PDR. Bu dosya ile PDR çelişirse PDR geçerlidir. PDR'da olmayan hiçbir özellik ekleme.

Expo kuralları: @app/AGENTS.md (çelişirse bu dosya geçerlidir)

## 1. Ürün (PDR özeti)
BioSync, üretim/lojistikte elde kalan **temiz tarımsal yan ürünleri** (meyve kabukları, kahve posası, standart dışı sebzeler) bunları hammadde olarak kullanan **biyomateryal (biyoplastik, 3D filament, vegan deri), kozmetik ve alternatif gıda** üreticileriyle eşleştiren B2B pazar yeridir.

**Kullanıcı:** çiftçi / gıda tesisi. Ürünün **miktarını, konumunu, fotoğrafını** yükler.

**Sistem sırası (bu sıra değişmez):**
1. AI (görüntü işleme) fotoğraftan **kalite standardı + bozulma durumunu** analiz eder, alıcıya güven verir (puanlama/rating).
2. Algoritma **kalan raf ömrü, lojistik mesafe, taşıma maliyeti** hesaplar; **en düşük karbon ayak iziyle en kârlı** eşleşmeyi bulur.
3. Sadece **belirli km çapındaki (lokal)** eşleşmelere izin verilir (risk: taşıma maliyeti > atık değeri).
4. Eşleşmeler **harita üzerinde** gösterilir.

**Fark (PDR §4):** Hedef downcycling (enerji/yem) değil **upcycling**. Eşleşme hedefleri yeni nesil biyomateryal/kozmetik tesisleridir; biyogaz/yem tesisi eşleştirme.

## 2. Prototip Kapsamı (Task 3)
**Yapılacak:** (a) ilan formu, (b) AI kalite değerlemesi (gerçek çalışır), (c) lokal eşleştirme + harita (alıcılar mock).
**Yapılmayacak:** Auth, ödeme, veritabanı, push bildirim, çoklu dil, admin paneli, sohbet/mesajlaşma, gerçek alıcı onboarding. İstenmeden ekleme.

## 3. Teknoloji (sabit, değiştirme)
- **Mobil:** React Native + **Expo (managed, Expo Go ile çalışmalı)** + **TypeScript**
  - Sürüm: **Expo SDK 57** (expo 57.0.x, React Native 0.86, React 19.2). Expo Go uyumu için SDK 58'e yükseltme yapma; Expo paketlerini `npx expo install` ile SDK 57 uyumlu sürümde tut.
- **Backend:** **Node.js + Express** (tek `server` klasörü). Gemini anahtarı **sadece** burada, `.env`'de. Mobil kodda API anahtarı ASLA olmaz.
- **AI:** Gemini Vision (resmi `@google/genai` SDK). Model adı `.env` → `GEMINI_MODEL`; koda sabit yazma.
- **Harita:** `react-native-webview` (`npx expo install`, Expo Go'da hazır) içinde **Leaflet 1.9.4** (unpkg CDN, sabit sürüm + SRI; npm paketi değil) + OpenStreetMap görüntüleri. Anahtar gerekmez; "© OpenStreetMap katkıda bulunanlar" atfı zorunlu ve görünür kalır.
  - `react-native-maps` **kaldırıldı**: Expo Go/Android'de Google Maps SDK haritayı hiç çizmedi. Teşhis kanıtı: `onMapReady` geldi; `onMapLoaded` ve tek bir görüntü isteği gelmedi; işaretçiler/daire de çizilmedi. Görüntü engelleme değildi (OSM 200 döndü). Geliştirme derlemesine geçilmez; Expo Go'da kalınır.
- **Konum/Foto:** `expo-location`, `expo-image-picker`, `expo-image-manipulator` (göndermeden önce uzun kenar 1024 px, JPEG 0.6; Vercel ~4,5 MB istek sınırı).
- **Web:** `react-dom`, `react-native-web`, `@expo/metro-runtime` (`npx expo install`). Harita web'de aynı Leaflet HTML'iyle `iframe srcDoc` (tek bileşen, `Platform.OS` ayrımı). Her özellik hem Expo Go'da hem web'de çalışmalı.
- **Yerleşim:** `react-native-safe-area-context` (`SafeAreaProvider` + `SafeAreaView`, tüm kenarlar; sabit `paddingTop` yok). Geniş ekranda (web) içerik ortada en fazla 480 px sütun, kenarlar nötr gri (`#eef0f2`); dar ekranda tam genişlik.
- **Canlı:** Vercel, iki ayrı proje: `server` (Express zero-config, `export default app`, `VERCEL` varken `listen` yok; ESM olduğu için göreli import'lar `.js` uzantılı) ve `app` (`app/vercel.json`: `npx expo export -p web` → `dist`). Ortam değişkenleri: server'da `GEMINI_API_KEY`, `GEMINI_MODEL`, `CORS_ORIGINS`; app'te `EXPO_PUBLIC_API_URL`. CORS paket kullanmadan `server/index.ts` içinde.
  - `server/tsconfig.json`'daki `"typeRoots": ["./node_modules/@types"]` **silinmez**: Vercel, TS'yi `/tmp` altında bizim tsconfig'i `extends` eden geçici bir config ile derler; açık `typeRoots` yoksa `types: ["node"]` bulunamaz (TS2688, derleme durur). Değişiklikten önce `npx vercel build --yes` ile yerelde denenebilir.
- **State:** React `useState` / `useReducer`. Navigasyon kütüphanesi YOK; tek ekranda `step` state'i ile koşullu render.
- **Veri:** Alıcılar `server/data/buyers.ts` (veya `.json`) içinde statik mock.
- **Doğrulama:** `zod` (server) — Gemini yanıtı `QualityResult` zod şemasıyla doğrulanır.
- **Server TS araçları:** `tsx` (çalıştırma), `typescript`, `@types/express`, `@types/node`.
- **Env:** `dotenv` YOK; Node'un `--env-file=.env` seçeneği kullanılır.
- **Lint (app):** `eslint` + `eslint-config-expo` (devDependency, `npx expo lint` varsayılan kurulumu). Ek eklenti/kural paketi yok.
- Bu listenin dışında bağımlılık eklenmez.

## 4. Klasör Yapısı
```
/app            (Expo)
  App.tsx
  vercel.json       (web derlemesi: expo export -p web → dist)
  src/components/   (UploadForm, LoadingView, ResultView, MatchCard, MatchMap, SessionImpactBar)
  src/industryInfo.ts  (endüstri etiketi bilgisi: atık kategorisi × sektör, statik sözlük)
  src/services/api.ts
  src/types.ts
/server
  index.ts
  routes/analyze.ts
  routes/match.ts
  lib/gemini.ts
  lib/matching.ts
  lib/matching.test.ts  (node:test, `npm test`; ek bağımlılık yok)
  lib/schema.ts     (zod şemaları + türetilmiş tipler; tek kaynak)
  data/buyers.ts
  .env.example
/docs
  ESLESTIRME_MANTIGI.md   (eşleştirme formülleri, sabitler, kararlar)
  YOL_HARITASI.md         (teslim günü planı)
  gorseller/              (README ekran görüntüleri)
CLAUDE.md, README.md      (kökte kalır: CLAUDE.md yalnızca kökten otomatik yüklenir)
```
Bunun dışında klasör/katman icat etme.

## 5. Veri Sözleşmeleri (types.ts ve server ile aynı olmalı)
`Industry`, `Listing`, `QualityResult` → `server/lib/schema.ts` içinde zod şeması olarak tanımlı, tipler `z.infer` ile türetilir. `app/src/types.ts` bunları **sadece `import type`** ile yeniden dışa aktarır (mobil pakete zod girmez). Tipi elle ikinci kez yazma.
```ts
type Industry = "biyoplastik" | "3d_filament" | "vegan_deri" | "kozmetik" | "alternatif_gida";

type Listing = { wasteType: string; quantityKg: number; lat: number; lng: number; imageBase64: string; mimeType: string };

type QualityResult = {
  productType: string;          // örn. "portakal kabuğu"
  isOrganicByproduct: boolean;  // false → sonuçta "Organik yan ürün tespit edilmedi", eşleştirmeye girmez
  qualityScore: number;         // 0-100, "Kalite Güven Puanı"
  spoilageStatus: "taze" | "hafif_bozulmus" | "bozulmus";
  estimatedShelfLifeDays: number;
  suitableIndustries: Industry[]; // en uygun 1-3, uygunluk sırasına göre (en fazla 3); organik değilse boş
  summary: string;              // 1-2 cümle, Türkçe
};

type Buyer = { id: string; name: string; industries: Industry[]; lat: number; lng: number; pricePerKg: number;
  locationName: string; isFictional: true };   // locationName: gerçek bölge adı; alıcı kurgusal

type Match = {
  buyer: Buyer; distanceKm: number; transportCostTRY: number;
  materialValueTRY: number; netProfitTRY: number; co2Kg: number;
  netImpactCo2eKg: number;   // tahmini: miktar × önlenen çöplük emisyonu − co2Kg (pozitif = tasarruf)
  vehicle: { type: "hafif_ticari" | "kamyonet" | "kamyon"; label: string; trips: number };
  score: number;
};
```

## 6. Eşleştirme Mantığı (PDR §2 ve §5)
Formüllerin, sabitlerin ve kararların ayrıntılı açıklaması: [docs/ESLESTIRME_MANTIGI.md](docs/ESLESTIRME_MANTIGI.md). Sabit veya formül değişirse o belge de güncellenir.

- Mesafe: **Haversine**, km.
- `MAX_RADIUS_KM` sabiti (varsayılan 50) tek yerde tanımlı; bunu aşan alıcı **listeye girmez**.
- Taşıma **araç bazlı, kapasiteli**: `selectVehicle(quantityKg)` miktarı taşıyabilen en küçük aracı seçer (`VEHICLE_CLASSES`: hafif ticari 1 t / kamyonet 3,5 t / kamyon 12 t); 12 t üstü çoklu kamyon seferi. `transportCost = trips * (baseFeeTRY + costPerKmTRY * distanceKm)`
- `materialValue = quantityKg * buyer.pricePerKg * (qualityScore/100)`
- `netProfit = materialValue - transportCost`; `netProfit <= 0` ise eşleşme yok.
- `co2Kg = trips * distanceKm * emissionKgPerKm` (seçilen aracın araç-km emisyonu).
- `netImpactCo2eKg = quantityKg * AVOIDED_LANDFILL_KG_CO2E_PER_KG - co2Kg`. Katsayı ≈0,595 kg CO₂e/kg, kaynak EPA WARM v15 (Tablo 1, "Fruits and Vegetables" 0,54 MTCO2E/kısa ton); kaynak `lib/matching.ts`'te yazılı. Ekranda **"tahmini"** ibaresiyle, en kârlı eşleşme için tek satır gösterilir. Kaynaksız katsayı eklenmez.
- Tüm sabitler `lib/matching.ts` başında "DEMO VARSAYIMLARI" olarak açıklamalı: araç sınıfları (hafif ticari: 50 TL sefer, 10 TL/km, 0,5 kg CO₂/km; kamyonet: 150 / 16 / 0,8; kamyon: 400 / 26 / 1,6; dönüş dahil). Sabit sefer ücreti yüzünden 10-20 kg'lık partilerde yalnızca çok yakın alıcılar kârlı kalır. Kartta "Araç" satırı.
- Raf ömrü: gereken süre = `HANDLING_DAYS` + yol süresi; raf ömrü bundan kısaysa ele, `SHELF_LIFE_BUFFER_DAYS`'ten az pay varsa `score` yarıya iner.
- `score` (0-100) yalnız gösterim: en iyi net kâra oran × raf ömrü katsayısı; sıralamayı değiştirmez.
- `POST /match` gövdesi `{ quantityKg, lat, lng, quality }` (görsel tekrar gönderilmez), yanıtı `{ radiusKm, matches, eliminated }` (harita dairesi için `MAX_RADIUS_KM` buradan gelir). `eliminated` = sebebe göre elenen alıcı sayıları (`distance`, `industry`, `shelfLife`, `loss`); `evaluateBuyers` üretir, `matchBuyers` onun `matches` kısmını döner. Özete yalnızca `NEARBY_CONTEXT_KM` (100 km) içindeki alıcılar girer; sonuç ekranında tek satır: "2 alıcı zarar nedeniyle, 1 alıcı mesafe nedeniyle elendi."
- Alıcılar (`data/buyers.ts`): İstanbul/Ankara/Antalya, şehir başına 4 **kurgusal** alıcı (2 kârlı, 1 zarar eden, 1 yarıçap dışı); gerçek sanayi bölgesi/teknopark konumları. Kurgusal oldukları kodda ve kartta yazılı. Davranış `lib/matching.test.ts` (`npm test`) ile doğrulanır.
- `quality.isOrganicByproduct === false` ise ilan eşleştirmeye **hiç girmez** (boş liste döner, alıcı aranmaz).
- Alıcı, ürünün `suitableIndustries` listesiyle kesişmiyorsa ele.
- Sıralama: önce `netProfit` yüksek, eşitlikte `co2Kg` düşük. İlk sonuç "En Kârlı Eşleşme" olarak vurgulanır.
- Bu fonksiyon **saf (pure)** olmalı; `matchBuyers(listing, quality, buyers): Match[]`.

## 7. Gemini Kuralları
- Çağrı sadece `server/lib/gemini.ts` içinde.
- Çıktıyı **JSON schema / `responseMimeType: "application/json"`** ile iste; sonucu `QualityResult` zod şemasıyla doğrula. Doğrulanamazsa 502 + anlaşılır hata dön, uydurma varsayılan değer döndürme.
- Sistem promptu (Türkçe, değiştirme): *"Sen bir endüstriyel hammadde ve tarım kalite uzmanısın. Fotoğraftaki tarımsal yan ürünün türünü belirle, kalite standardını ve bozulma durumunu analiz et, kalan raf ömrünü tahmin et, 0-100 arası 'Kalite Güven Puanı' ver ve uygun olduğu endüstrileri (biyoplastik, 3d_filament, vegan_deri, kozmetik, alternatif_gida) seç. Fotoğrafta tarımsal yan ürün yoksa qualityScore 0 ver. Sadece şemaya uygun JSON dön."*
  - Faz 2 eki (sabit metnin sonuna): metin alanları Türkçe, summary 1-2 cümle; fotoğraf organik yan ürün değilse `isOrganicByproduct: false`, düşük puan, boş `suitableIndustries` ve summary'de sebep. Endüstrilerin hepsi listelenmez: en uygun 1-3 tanesi uygunluk sırasıyla seçilir. Kullanıcının beyan ettiği `wasteType` ipucu olarak gönderilir, fotoğrafla doğrulanır.
- Gemini'ye şema `responseJsonSchema` ile, `z.toJSONSchema(qualityResultSchema)`'dan türetilip desteklenmeyen anahtarlar (`$schema`, `minLength` vb.) ayıklanarak verilir.
- Loglara API anahtarı, istek gövdesi veya base64 yazılmaz.
- Görsel gönderirken boyutu küçült (`expo-image-picker` `quality: 0.5`, base64).
- Zaman aşımı 30 sn; mobilde hata ekranı + "Tekrar dene" butonu.

## 8. UI Kuralları
- Tek ekran, `step: "form" | "loading" | "result"`.
- Form: fotoğraf, atık türü (serbest metin), miktar (kg, sayısal), konum ("Konumumu al" butonu ile `expo-location`; izin reddedilirse elle enlem/boylam girişi), foto (kamera/galeri), "Analiz Et" (alanlar eksikse pasif).
- Sonuç: kalite puanı (büyük), bozulma durumu, uygun endüstriler, ardından eşleşme kartları + harita.
- Metinler Türkçe. Boş/yükleme/hata durumlarının hepsi tasarlanmış olmalı.
- Süslü animasyon/tema sistemi ekleme.

## 9. FAZLAR (her seferinde SADECE biri)

**KURAL: Kullanıcı açıkça "Faz N'i yap" demeden Faz N'e başlama. Faz bitince DUR, yaptıklarını 5 satırda özetle, "Bitti kriterleri"ni tek tek işaretle ve kullanıcının onayını bekle. Sonraki fazın kodunu yazma, hazırlık amaçlı bile olsa.**

### Faz 0 – Kurulum
- `app` (Expo TS) ve `server` (Node+Express+TS) iskeleti, `.env.example`, `.gitignore` (.env dahil).
- Paketleri `npx expo install` ile kur (Expo uyumlu sürüm).
- **Bitti:** `npx expo start` boş ekranı açıyor; `GET /health` → `{ok:true}`.

### Faz 1 – UI İskeleti (AI yok)
- 3 adımlı akış, form, loading (spinner + "AI Ürün Kalitesini Analiz Ediyor..."), sonuç ekranı (sahte `QualityResult` sabit verisiyle).
- Foto ve konum seçimi gerçek çalışır.
- **Bitti:** Form doldurulup "Analiz Et" → 2 sn loading → sonuç ekranı sahte veriyle görünüyor; eksik alanda buton pasif.

### Faz 2 – Gemini Entegrasyonu
- `POST /analyze` → Gemini → doğrulanmış `QualityResult`.
- Mobil `api.ts` ile bağla, sahte veriyi kaldır; hata/yeniden dene akışı.
- **Bitti:** Gerçek bir kabuk fotoğrafı mantıklı puan/bozulma döndürüyor; alakasız foto düşük puan alıyor; ağ hatasında hata ekranı çıkıyor.

### Faz 3 – Lokal Eşleştirme + Harita
- `buyers.ts` içinde 6-8 kurgusal alıcı (farklı endüstriler, bazıları yarıçap dışında).
- `POST /match` (veya mobilde saf fonksiyon) → `Match[]`.
- Sonuç ekranında: "Eşleşme Bulundu" kartları (alıcı, mesafe, taşıma maliyeti, net kâr, CO₂, "Çöpe gitmesi önlenen: X kg", "Kurgusal demo alıcısı") + haritada kullanıcı ve **yalnız yarıçap içindeki** alıcılar + yarıçap dairesi.
- Eşleşme yoksa "Yakın çapta uygun alıcı bulunamadı" mesajı.
- **Bitti:** Konum değişince liste/harita değişiyor; yarıçap dışı alıcı görünmüyor; netProfit ≤ 0 olan çıkmıyor.

### Faz 4 – Demo Cilası (opsiyonel, istenirse)
- Etki özeti satırı (örn. "Bu ilanla ≈X kg CO₂ tasarruf"), küçük UI düzeltmeleri, README (kurulum + demo adımları).

## 10. Hata Önleme Kuralları (Cursor için)
1. **Uydurma yok.** Emin olmadığın paket/API/prop varsa kurmadan önce resmi dokümanı veya `node_modules` tipini kontrol et. Var olmayan paket ismi yazma.
2. **Yeni bağımlılık yasak** (bu dosyadaki listenin dışında) — gerekirse önce sor, nedenini ve alternatifini yaz.
3. Her değişiklikten sonra `npx tsc --noEmit` çalıştır; hata varsa düzelt, sonra raporla. Çalıştıramıyorsan bunu açıkça söyle.
4. Tek seferde en fazla ilgili 3-4 dosyayı değiştir. Kapsam dışı refactor yapma, çalışan kodu "iyileştirme" amacıyla yeniden yazma.
5. Dosyaların tamamını yeniden yazmak yerine hedefli düzenleme yap.
6. `any` kullanma; tipler `types.ts` / server tipleriyle birebir aynı kalsın.
7. Sır (API key) hiçbir koşulda commit edilen dosyaya, mobil koda veya loga yazılmaz.
8. Fiziksel cihazda backend'e erişim için `localhost` yerine bilgisayarın LAN IP'si kullanılır; bunu `EXPO_PUBLIC_API_URL` ile ayarlanabilir yap.
9. Hata alırsan: hata mesajını tam oku → kök nedeni bul → tek düzeltme yap → tekrar çalıştır. Aynı şeyi rastgele değiştirip deneme.
10. Emin olmadığın bir gereksinimde varsayım yapıp ilerleme; kısa bir soru sor.
11. PDR dışı özellik, auth, DB, ödeme, mesajlaşma **yasak** (bkz. §2).
