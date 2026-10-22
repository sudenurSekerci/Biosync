# BioSync — ROADMAP (aktif plan)

> Tek aktif plan dosyası. Kalıcı kurallar CLAUDE.md'de. Bitmiş planlar `docs/archive/` (otomatik yüklenmez; fazları referans alınmaz).
> Her faz ayrı oturumda yapılır; faz bitmeden sonrakine geçilmez. Mevcut testler her fazda geçmeli.
> Kapsam: yalnızca aşağıdakiler. Listede olmayan özellik eklenmez.

## Çalışma kuralları
- **Commit:** Her faz sonunda tsc (app+server) + lint + `npm test` → kısa özet → kullanıcı onayıyla commit. Faz içinde büyük adımlar ayrı commit olabilir. Commit öncesi `git status` (`.env` ve anahtarlar asla girmez).
- **Dal:** Geliştirme `dev` dalında yapılır. `dev`'e push serbest (yedek amaçlı); Vercel `dev` dalını deploy etmez (`app/vercel.json` ve `server/vercel.json`: `git.deploymentEnabled.dev = false`).
- **main:** `main`'e merge yalnızca Faz D (Auth + security rules) bittikten sonra ve kullanıcı onayıyla. Aradaki sürümde canlıya çıkış yok.
- **İsimler:** Mevcut kod adları korunur: `quantityKg`, `transportCostTRY`, `materialValueTRY`, `netProfitTRY`, `industries[]`. Yeni alanlar da aynı kalıpla (`...TRY`, `...Kg`) adlandırılır.
- **Bağımlılık:** Yeni paket her fazın başında onayla eklenir ve CLAUDE.md §3 listesine yazılır.

## Kapsam gerekçesi (PDR eşleşmesi)
| Faz | PDR |
|---|---|
| A Eşleştirme düzeltmeleri | §2 "en düşük karbonla en kârlı", CLAUDE.md §6 raf ömrü |
| A2 Taşıma modu (3. parti taşıyıcı) | §2 taşıma maliyeti, §5 maliyet > değer riski |
| B Fotoğraf kuralları | §2 kalite güveni |
| C Firestore + Türkiye geneli | §5 lokal eşleşme, §6 kalıcı etki takibi |
| D Auth + roller | §5 "tarafların ilan açabildiği" |
| E Paneller + katkı toplamı + puanlama | §5 rating, §6 50 ton hedefi |
| F Gerçek yol rotası | §2 lojistik mesafe, §5 taşıma maliyeti riski |

---

## Faz A — Eşleştirme düzeltmeleri
Sadece matching modülü + testleri (+ ESLESTIRME_MANTIGI.md, CLAUDE.md §6).
1. `CARBON_PRICE_TRY_PER_KG` sabiti (demo varsayımı, yorumla belirt). Sıralama: `netProfitTRY - co2Kg * CARBON_PRICE_TRY_PER_KG`; eşitlikte mesafe.
2. Raf ömrü riskliyse ceza sıralamaya da yansısın (`score` ve yarıya indirme zaten var; yeni olan sıralamaya etkisi). Sonuca `shelfLifeRisk: boolean` ekle; UI'da "Raf ömrü sınırda" rozeti.
3. Testler: daha kârlı ama uzak alıcı karbon düzeltmesiyle geri düşebilir; riskli eşleşme güvenlinin önüne geçemez.

## Faz A2 — Taşıma modu: 3. parti taşıyıcı
Sadece matching modülü + testleri + teklif ekranında seçim. Taşıyıcı ayrı kullanıcı rolü DEĞİL (sonraki aşama).
1. `transportMode: 'buyerOwn' | 'thirdParty'` parametresi (varsayılan `buyerOwn`, mevcut davranış aynen kalır).
2. `thirdParty` maliyeti (sabitler config'te, demo varsayımı):
   `max(CARRIER_MIN_FEE_TRY, (CARRIER_FIXED_FEE_TRY + aracınKmMaliyeti * mesafe * EMPTY_RETURN_FACTOR) * (1 + CARRIER_MARGIN)) * seferSayısı`
   - `EMPTY_RETURN_FACTOR`: taşıyıcının boş dönüşü (dönüş yükü yok varsayımı, ~2).
   - `CARRIER_MARGIN`: taşıyıcı kâr payı (ör. 0.25).
   - `CARRIER_MIN_FEE_TRY`: kısa mesafe minimum sefer ücreti.
3. CO₂: boş dönüş km'si de CO₂'ye eklenir (aynı araç katsayısıyla).
4. Maliyeti alıcı öder (mevcut net kâr mantığı); zarar eden alıcı eleme kuralı her iki modda da geçerli.
5. Sonuca `transportMode`, `carrierShareTRY` (taşıyıcı payı) ekle; maliyet mevcut `transportCostTRY` alanında kalır.
6. UI: teklif ekranında "Kendi aracı / Taşıyıcı firma" seçimi; iki modun maliyet ve net kâr farkı yan yana.
7. Testler: kısa mesafede minimum ücret devreye girer; 3. parti mod aynı alıcıyı eleyebilir (kendi araçta kârlıyken); boş dönüş CO₂'yi artırır.

## Faz B — Fotoğraf yükleme kuralları
1. Yükleme ekranında kısa kural kartı: gün ışığı, ürün kadrajın çoğunu kaplasın, tek tür atık, ambalaj/etiket olmasın, bulanık olmasın.
2. Gemini ön kontrolü: mevcut `isOrganicByproduct` ile birleşik tek geçerlilik kontrolü + `rejectReason` (atık değil / bulanık / karışık tür / çok uzak). Ayrı bir `isValidWastePhoto` alanı açılmaz. Geçersizse puanlama yapma, kullanıcıya nedenle birlikte yeniden çekme iste. Sistem promptunun sabit metni değişmez; kural "Faz B eki" olarak eklenir (CLAUDE.md §7).
3. Geçersiz fotoğraf eşleştirmeye asla girmez.

## Faz C — Firestore + Türkiye geneli
Koleksiyonlar:
- `users` {uid, role: producer|buyer|admin, name, city, location, kvkkConsentAt}
- `listings` {ownerUid, wasteType, quantityKg, location, photoUrl?, ai: {...}, status, createdAt}
- `buyers` {uid?, name, industries[], acceptedWasteTypes[], monthlyCapacityKg, pricePerKg, location, city}
- `matches` {listingId, buyerId, distanceKm, transportMode, transportCostTRY, co2Kg, netProfitTRY, status: offered|accepted|rejected|completed, rating?}
- `impact` {global: totalKgDiverted, totalCo2AvoidedKg, completedMatches}
1. Kodda sabit alıcıları seed script ile Firestore'a taşı.
2. Türkiye geneli: sanayi yoğun illerde (OSB'ler) kurgusal alıcılar seed'le; her alıcı gerçekçi koordinat + 1–3 kabul edilen atık türü. Harita merkezi kullanıcı konumu; 50 km sınırı aynen kalır.
3. Gemini anahtarı ve eşleştirme Node'da kalır. Firestore kuralları kilitli başlar (`allow read, write: if false`); tüm okuma/yazma Node'da Admin SDK ile. Kullanıcı bazlı kurallar Faz D'de açılır. Test modu kuralları kullanılmaz.
4. `impact` oturum sayacının yerine geçer (kalıcı).
5. **Açık karar (Faz C başında sorulur):** fotoğraf saklanacak mı? Firebase Storage yeni bucket'lar için ücretli Blaze planı isteyebilir. Saklanmazsa `photoUrl` boş kalır, yalnızca AI sonucu kaydedilir.
6. Güvenlik: Faz D bitene kadar push/deploy yok (bkz. Çalışma kuralları).

## Faz D — Firebase Auth + roller + navigasyon
0. **D.0 — ayrı commit, davranış değişmez:** `step` yöntemi yerine `expo-router` (`npx expo install`, SDK 57 uyumlu; Expo Go + web'de çalışmalı). CLAUDE.md §3, §4, §8 bu adımda güncellenir.
1. E-posta/şifre. Kayıtta rol seçimi: üretici / alıcı. Admin yalnızca Firestore'da elle atanır.
2. KVKK: kısa aydınlatma metni + zorunlu onay kutusu. Toplanan veri: e-posta, firma/kişi adı, il, konum. TC kimlik, vergi no, kişisel telefon toplanmaz. Metne: "Fotoğraf analiz için Google Gemini'ye (yurt dışı) gönderilir; metin demo amaçlıdır."
3. Security rules: kullanıcı yalnızca kendi ilanını/profilini düzenler; `impact` yalnızca backend yazar.
4. Giriş yoksa yükleme/teklif ekranlarına erişim yok.

## Faz E — Paneller + katkı toplamı + puanlama
- **Üretici:** ilanlarım, eşleşmeler, teklif durumu. Üstte katkı kartı: toplam yönlendirilen kg, önlenen CO₂, tamamlanan eşleşme.
- **Alıcı:** profil (kabul edilen atık türleri, aylık kapasite), gelen teklifler (kabul/red), aynı katkı kartı.
  - Eşleştirmeye iki filtre: `wasteType ∈ acceptedWasteTypes`, `quantityKg ≤ kalan kapasite`.
- **Puanlama:** `completed` eşleşmede alıcı satıcıya 1–5 puan; satıcı ortalaması ilan kartında görünür.
- **Admin (minimal):** 50 ton hedefine ilerleme çubuğu, kullanıcı/ilan listesi.
- Katkı yalnızca `accepted/completed` eşleşmelerden sayılır, teklif aşamasında sayılmaz.

## Faz F — Gerçek yol rotası
1. Sağlayıcı: OpenRouteService (ücretsiz anahtar, Node `.env`). Anahtar istemciye gitmez.
2. Akış: haversine ile 50 km ön eleme → ilk N (≤5) aday için yol mesafesi/süresi → maliyet ve CO₂ yol mesafesiyle yeniden hesap → sıralama.
3. Haritada seçili eşleşmenin rotası polyline olarak çizilsin.
4. API hata/limit durumunda haversine'e düş, sonuçta `distanceSource: road|straight` göster.
5. Eşleştirme fonksiyonu saf kalsın: yol mesafeleri parametre olarak verilir; testler API'ye gitmez.

---

## Sunum notları — KOD DEĞİL, uygulanmaz
BM Sürdürülebilir Kalkınma Amacı 12 (Sorumlu Üretim ve Tüketim) ile bağ:
- **12.3** Gıda kaybı ve israfını azaltma → üretim/lojistikte elde kalan yan ürünün çöpe gitmemesi
- **12.2** Doğal kaynakların verimli kullanımı → yan ürünün yeni hammadde olması (upcycling)
- **12.5** Atık oluşumunu önleme, geri dönüşüm ve yeniden kullanım → çöplük yerine biyomateryal tesisi
Olası kullanım: sunum slaytı; ileride katkı kartında küçük SKA etiketleri.

## Bilinçli basitleştirmeler (sunumda "sonraki aşama")
- Tek EPA katsayısı (ürün bazlı katsayı yok)
- Trafik yok; fiyat miktardan bağımsız
- Alıcılar kurgusal (gerçek alıcı kaydı açık ama seed veriyle demo)
