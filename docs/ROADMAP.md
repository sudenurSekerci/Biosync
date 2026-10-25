# BioSync — ROADMAP (aktif plan)

> Tek aktif plan dosyası. Kalıcı kurallar CLAUDE.md'de. Bitmiş planlar `docs/archive/`.
> Her faz ayrı oturumda yapılır; faz bitmeden sonrakine geçilmez. Mevcut testler her fazda geçmeli.
> Kapsam: yalnızca aşağıdakiler. Listede olmayan özellik eklenmez.
> **Uygulama sırası: A → A2 → B → C → D → E → F** (Auth, Firestore'dan önce gelir; güvenlik kuralları ve sunucu yazımı ona dayanır.)

## Kapsam gerekçesi (PDR eşleşmesi)
| Faz | PDR |
|---|---|
| A Eşleştirme düzeltmeleri | §2 "en düşük karbonla en kârlı", CLAUDE.md §6 raf ömrü |
| A2 Taşıma modu (3. parti taşıyıcı) | §2 taşıma maliyeti, §5 maliyet > değer riski |
| B Fotoğraf kuralları | §2 kalite güveni |
| C Auth + roller | §5 "tarafların ilan açabildiği" |
| D Firestore + Türkiye geneli | §5 lokal eşleşme, §6 kalıcı etki takibi |
| E Paneller + katkı toplamı + puanlama | §5 rating, §6 50 ton hedefi |
| F Gerçek yol rotası | §2 lojistik mesafe, §5 taşıma maliyeti riski |

---

## Faz A — Eşleştirme düzeltmeleri
Sadece matching modülü + testleri.
1. `CARBON_PRICE_TL_PER_KG` sabiti (demo varsayımı, yorumla belirt; referans: AB ETS karbon fiyatı TL'ye çevrilmiş, kaynak ve tarih yorumda). Sıralama: `netProfit - co2Kg * CARBON_PRICE_TL_PER_KG`; eşitlikte mesafe.
2. Raf ömrü riskliyse ceza sıralamaya yansısın. Sonuca `shelfLifeRisk: boolean` ekle. **Yeni puan alanı açılmaz:** mevcut gösterim puanı `score` korunur, ceza ona da yansır. UI'da "Raf ömrü sınırda" rozeti.
3. Testler: daha kârlı ama uzak alıcı karbon düzeltmesiyle geri düşebilir; riskli eşleşme güvenlinin önüne geçemez.

## Faz A2 — Taşıma modu: 3. parti taşıyıcı
Sadece matching modülü + testleri + teklif ekranında seçim. Taşıyıcı ayrı kullanıcı rolü DEĞİL (sonraki aşama).
1. `transportMode: 'buyerOwn' | 'thirdParty'` parametresi (varsayılan `buyerOwn`).
2. **Boş dönüş her iki modda da sayılır** (alıcının kendi aracı da boş döner; aksi halde iki mod haksız kıyaslanır). `buyerOwn` maliyetine yalnızca dönüş km'si eklenir, başka davranış değişmez; etkilenen mevcut testler buna göre güncellenir ve ESLESTIRME_MANTIGI.md'ye not düşülür.
3. `thirdParty` maliyeti (sabitler config'te, demo varsayımı):
   `max(CARRIER_MIN_FEE_TL, (CARRIER_FIXED_FEE_TL + aracınKmMaliyeti * mesafe * EMPTY_RETURN_FACTOR) * (1 + CARRIER_MARGIN)) * seferSayısı`
   - `EMPTY_RETURN_FACTOR`: boş dönüş (dönüş yükü yok varsayımı, ~2).
   - `CARRIER_MARGIN`: taşıyıcı kâr payı (ör. 0.25).
   - `CARRIER_MIN_FEE_TL`: kısa mesafe minimum sefer ücreti.
4. CO₂: boş dönüş km'si her iki modda da CO₂'ye eklenir (aynı araç katsayısıyla).
5. Maliyeti alıcı öder (mevcut net kâr mantığı); zarar eden alıcı eleme kuralı her iki modda da geçerli.
6. Sonuca `transportMode`, `transportCostTl`, `carrierShareTl` (taşıyıcı payı) ekle.
7. UI: teklif ekranında "Kendi aracı / Taşıyıcı firma" seçimi; iki modun maliyet ve net kâr farkı yan yana.
8. Testler: kısa mesafede minimum ücret devreye girer; 3. parti mod aynı alıcıyı eleyebilir (kendi araçta kârlıyken); boş dönüş her iki modda CO₂'yi artırır.

## Faz B — Fotoğraf yükleme kuralları
1. Yükleme ekranında kısa kural kartı: gün ışığı, ürün kadrajın çoğunu kaplasın, tek tür atık, ambalaj/etiket olmasın, bulanık olmasın.
2. Gemini ön kontrolü **tek alanda** birleşir: mevcut `isOrganicByproduct` yerine `photoCheck: { isValid: boolean, rejectReason?: 'not_waste' | 'blurry' | 'mixed' | 'too_far' }`. Mevcut "organik değil" davranışı `not_waste` olarak aynen sürer. Geçersizse puanlama yapılmaz, kullanıcıdan nedeniyle birlikte yeniden çekmesi istenir. Şema (zod + Gemini şeması) ve ilgili testler güncellenir.
3. Geçersiz fotoğraf eşleştirmeye asla girmez.

## Faz C — Firebase Auth + roller
1. E-posta/şifre. Kayıtta rol seçimi: üretici / alıcı. Admin yalnızca Firestore'da elle atanır.
2. **KVKK:** kayıtta kısa aydınlatma metni + zorunlu onay kutusu; profilde hesap silme. Toplanan veri asgari: e-posta, firma adı, rol, il-ilçe, sektör. TC kimlik, vergi no, kişisel telefon toplanmaz.
3. **Alıcı bağı:** alıcı rolüyle kayıt `buyers` koleksiyonunda `uid` alanı dolu bir belge oluşturur (`users` ↔ `buyers` bağı `buyers.uid`).
4. Sunucu: `/analyze`, `/match` ve yazma uçları Firebase ID token doğrular (firebase-admin). Servis hesabı anahtarı yalnızca Vercel ortam değişkeninde ve yerel `.env`'de; repo'ya asla girmez.
5. Security rules: kullanıcı yalnızca kendi profilini düzenler; ilan/eşleşme/`impact` yalnızca backend yazar (istemci okur).
6. Giriş yoksa yükleme/teklif ekranlarına erişim yok. Jüri/demo için hazır demo hesabı README'de.

## Faz D — Firestore + Türkiye geneli
Koleksiyonlar:
- `users` {uid, role: producer|buyer|admin, name, city, location, kvkkAcceptedAt}
- `listings` {ownerUid, wasteType, kg, location, photoUrl?, ai: {...}, status, createdAt}
- `buyers` {uid?, name, industry, acceptedWasteTypes[], monthlyCapacityKg, pricePerKg, location, city}
- `matches` {listingId, buyerId, distanceKm, costTl, co2Kg, netProfit, status: offered|accepted|rejected|completed, rating?}
- `impact` {global: totalKgDiverted, totalCo2AvoidedKg, completedMatches}
1. Kodda sabit alıcıları seed script ile Firestore'a taşı.
2. Türkiye geneli: sanayi yoğun illerde (OSB'ler) kurgusal alıcılar seed'le; her alıcı gerçekçi koordinat + 1–3 kabul edilen atık türü. Harita merkezi kullanıcı konumu; 50 km sınırı aynen kalır. Alıcı sayısı küçük olduğu için sunucu tüm alıcıları okuyup Node'da filtreler (geo sorgu sonraki aşama).
3. Gemini anahtarı ve eşleştirme Node'da kalır. **AI sonucu, ilan ve eşleşmeleri sunucu yazar** (firebase-admin); istemci yalnızca okur. İstemcinin kendi AI puanını veya katkı rakamını yazması mümkün olmamalı.
4. `impact` oturum sayacının yerine geçer (kalıcı). Sunucuda `FieldValue.increment` veya transaction ile güncellenir (eşzamanlı yazımda bozulmasın).
5. **Karar (başlamadan önce sor) — fotoğraf saklama:** Firebase Storage artık Blaze (kullandıkça öde) planı gerektiriyor. Seçenek 1: Blaze'e geç + bütçe uyarısı kur, `photoUrl` dolu. Seçenek 2: fotoğraf saklanmaz, yalnızca AI sonucu; `photoUrl` boş kalır.

## Faz E — Paneller + katkı toplamı + puanlama
- **Üretici:** ilanlarım, eşleşmeler, teklif durumu. Üstte katkı kartı: toplam yönlendirilen kg, önlenen CO₂, tamamlanan eşleşme.
- **Alıcı:** profil (kabul edilen atık türleri, aylık kapasite), gelen teklifler (kabul/red), aynı katkı kartı.
  - Eşleştirmeye iki filtre: `wasteType ∈ acceptedWasteTypes`, `kg ≤ kalan kapasite`.
  - **Kalan kapasite** = `monthlyCapacityKg` − içinde bulunulan takvim ayında `accepted/completed` olan eşleşmelerin kg toplamı; ay başında kendiliğinden sıfırlanır (ayrı sayaç tutulmaz, sorguyla hesaplanır).
- **Puanlama:** `completed` eşleşmede alıcı satıcıya 1–5 puan; satıcı ortalaması ilan kartında görünür.
- **Admin (minimal):** 50 ton hedefine ilerleme çubuğu, kullanıcı/ilan listesi.
- Katkı yalnızca `accepted/completed` eşleşmelerden sayılır, teklif aşamasında sayılmaz.

## Faz F — Gerçek yol rotası
1. Sağlayıcı: OpenRouteService (ücretsiz anahtar, Node `.env`). Anahtar istemciye gitmez.
2. Akış: haversine ile 50 km ön eleme → ilk N (≤5) aday için **tek Matrix isteğiyle** yol mesafesi/süresi → maliyet ve CO₂ yol mesafesiyle yeniden hesap → sıralama.
3. Sonuçlar önbelleğe alınır (aynı ilan konumu + alıcı için tekrar istek atılmaz); ücretsiz katman limitini korur.
4. Haritada seçili eşleşmenin rotası polyline olarak çizilsin (rota çizimi için ayrı Directions isteği yalnızca seçilen eşleşmede).
5. API hata/limit durumunda haversine'e düş, sonuçta `distanceSource: road|straight` göster.
6. Eşleştirme fonksiyonu saf kalsın: yol mesafeleri parametre olarak verilir; testler API'ye gitmez.

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
- Taşıyıcı ayrı kullanıcı rolü değil; geo sorgu yok (alıcılar Node'da filtrelenir)
