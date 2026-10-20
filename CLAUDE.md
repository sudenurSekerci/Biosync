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
- **Backend:** **Node.js + Express** (tek `server` klasörü). Gemini anahtarı **sadece** burada, `.env`'de. Mobil kodda API anahtarı ASLA olmaz.
- **AI:** Gemini Vision (resmi `@google/genai` SDK). Model adı `.env` → `GEMINI_MODEL`; koda sabit yazma.
- **Harita:** `react-native-maps`
- **Konum/Foto:** `expo-location`, `expo-image-picker`
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
  src/components/   (UploadForm, LoadingView, ResultView, MatchCard, MatchMap)
  src/services/api.ts
  src/types.ts
/server
  index.ts
  routes/analyze.ts
  routes/match.ts
  lib/gemini.ts
  lib/matching.ts
  data/buyers.ts
  .env.example
```
Bunun dışında klasör/katman icat etme.

## 5. Veri Sözleşmeleri (types.ts ve server ile aynı olmalı)
```ts
type Industry = "biyoplastik" | "3d_filament" | "vegan_deri" | "kozmetik" | "alternatif_gida";

type Listing = { quantityKg: number; lat: number; lng: number; imageBase64: string; mimeType: string };

type QualityResult = {
  productType: string;          // örn. "portakal kabuğu"
  qualityScore: number;         // 0-100, "Kalite Güven Puanı"
  spoilageStatus: "taze" | "hafif_bozulmus" | "bozulmus";
  estimatedShelfLifeDays: number;
  suitableIndustries: Industry[];
  summary: string;              // 1-2 cümle, Türkçe
};

type Buyer = { id: string; name: string; industries: Industry[]; lat: number; lng: number; pricePerKg: number };

type Match = {
  buyer: Buyer; distanceKm: number; transportCostTRY: number;
  materialValueTRY: number; netProfitTRY: number; co2Kg: number; score: number;
};
```

## 6. Eşleştirme Mantığı (PDR §2 ve §5)
- Mesafe: **Haversine**, km.
- `MAX_RADIUS_KM` sabiti (varsayılan 50) tek yerde tanımlı; bunu aşan alıcı **listeye girmez**.
- `transportCost = distanceKm * COST_PER_KM_PER_TON * (quantityKg/1000)`
- `materialValue = quantityKg * buyer.pricePerKg * (qualityScore/100)`
- `netProfit = materialValue - transportCost`; `netProfit <= 0` ise eşleşme yok.
- `co2Kg = distanceKm * (quantityKg/1000) * EMISSION_FACTOR` (sabitler dosya başında, açıklamalı).
- Raf ömrü düşükse (ör. `estimatedShelfLifeDays` < mesafeye göre gereken süre) skoru düşür/ele.
- Alıcı, ürünün `suitableIndustries` listesiyle kesişmiyorsa ele.
- Sıralama: önce `netProfit` yüksek, eşitlikte `co2Kg` düşük. İlk sonuç "En Kârlı Eşleşme" olarak vurgulanır.
- Bu fonksiyon **saf (pure)** olmalı; `matchBuyers(listing, quality, buyers): Match[]`.

## 7. Gemini Kuralları
- Çağrı sadece `server/lib/gemini.ts` içinde.
- Çıktıyı **JSON schema / `responseMimeType: "application/json"`** ile iste; sonucu `QualityResult` zod şemasıyla doğrula. Doğrulanamazsa 502 + anlaşılır hata dön, uydurma varsayılan değer döndürme.
- Sistem promptu (Türkçe, değiştirme): *"Sen bir endüstriyel hammadde ve tarım kalite uzmanısın. Fotoğraftaki tarımsal yan ürünün türünü belirle, kalite standardını ve bozulma durumunu analiz et, kalan raf ömrünü tahmin et, 0-100 arası 'Kalite Güven Puanı' ver ve uygun olduğu endüstrileri (biyoplastik, 3d_filament, vegan_deri, kozmetik, alternatif_gida) seç. Fotoğrafta tarımsal yan ürün yoksa qualityScore 0 ver. Sadece şemaya uygun JSON dön."*
- Görsel gönderirken boyutu küçült (`expo-image-picker` `quality: 0.5`, base64).
- Zaman aşımı 30 sn; mobilde hata ekranı + "Tekrar dene" butonu.

## 8. UI Kuralları
- Tek ekran, `step: "form" | "loading" | "result"`.
- Form: miktar (kg, sayısal), konum ("Konumumu al" butonu ile `expo-location`; izin reddedilirse elle enlem/boylam girişi), foto (kamera/galeri), "Analiz Et" (alanlar eksikse pasif).
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
- Sonuç ekranında: "Eşleşme Bulundu" kartları (alıcı, mesafe, taşıma maliyeti, net kâr, CO₂) + haritada kullanıcı ve **yalnız yarıçap içindeki** alıcılar + yarıçap dairesi.
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
