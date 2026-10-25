# BioSync – Eşleştirme Mantığı (Faz 3)

Bu belge, bir ilanın hangi alıcıyla neden eşleştiğini (ya da neden eşleşmediğini) açıklar.
Kodun karşılığı: [server/lib/matching.ts](../server/lib/matching.ts), alıcı verisi:
[server/data/buyers.ts](../server/data/buyers.ts), testler: [server/lib/matching.test.ts](../server/lib/matching.test.ts) (`cd server && npm test`).

> Buradaki tüm sayılar **demo varsayımıdır**; gerçek piyasa verisi değildir. Sabitler değişirse
> bu belgedeki örnekler de güncellenmelidir (testler sayıların tutarlılığını kontrol eder).

---

## 1. Akış (sıra önemli)

Bir ilan için her alıcı sırayla şu kapılardan geçer. İlk takıldığı kapı, elenme sebebi olarak sayılır.

| # | Kontrol | Takılırsa |
|---|---------|-----------|
| 0 | Ürün organik yan ürün mü? (`isOrganicByproduct`) | Hiçbir alıcı değerlendirilmez, liste boş |
| 1 | Mesafe ≤ 100 km mi? (`NEARBY_CONTEXT_KM`) | Sessizce atlanır (başka bölge; özete girmez) |
| 2 | Mesafe ≤ 50 km mi? (`MAX_RADIUS_KM`) | **mesafe** nedeniyle elendi |
| 3 | Alıcının endüstrisi, AI'ın önerdiği endüstrilerle kesişiyor mu? | **endüstri uyumsuzluğu** nedeniyle elendi |
| 4 | Raf ömrü, taşıma için gereken süreye yetiyor mu? | **raf ömrü** nedeniyle elendi |
| 5 | Net kâr > 0 mı? | **zarar** nedeniyle elendi |

Geçen alıcılar sıralanır (ayrıntı §2.8):
1. **Raf ömrü güvenli olanlar önce** (`shelfLifeRisk = false`); riskli eşleşme ne kadar kârlı olursa olsun güvenlinin önüne geçemez.
2. **Karbon düzeltmeli değer** yüksekten düşüğe: `netKâr − co2Kg × CARBON_PRICE_TRY_PER_KG`.
3. Eşitlikte **mesafe** kısa olan önde.

İlk sıradaki "Önerilen Eşleşme" rozetiyle vurgulanır ("Kâr ve karbon birlikte değerlendirildi").
En yüksek net kâr başka bir karttaysa o kartta ayrıca küçük bir "Size en çok kalan" etiketi görünür.

`matchBuyers()` yalnızca sıralı eşleşmeleri döner (CLAUDE.md §6 imzası). `evaluateBuyers()` aynı hesabı
yapar ve ek olarak elenme sayılarını döner; sonuç ekranındaki "2 alıcı zarar nedeniyle, 1 alıcı mesafe
nedeniyle elendi." satırı buradan gelir. İkisi de **saf fonksiyondur** (yan etki yok, aynı girdi → aynı çıktı).

---

## 2. Formüller

### 2.1 Mesafe – Haversine (kuş uçuşu)

```
a = sin²(Δφ/2) + cos φ₁ · cos φ₂ · sin²(Δλ/2)
d = 2 · R · asin(√a)          R = 6371 km
```

φ enlem, λ boylam (radyan). Sonuç 0,1 km'ye yuvarlanır. Kuş uçuşu olduğu için gerçek yol mesafesinden
kısadır (şehir içinde tipik olarak %20-40 daha kısa); demo için bilinçli bir basitleştirmedir.

### 2.2 Taşıma maliyeti – araç bazlı, kapasiteli

Önce miktara göre araç seçilir (`selectVehicle`): miktarı **tek seferde taşıyabilen en küçük araç**.
En büyük aracın kapasitesi aşılırsa kamyon **çoklu sefer** yapar.

| Araç | Kapasite | Sefer ücreti | Araç-km (tek yön) | Emisyon (tek yön) |
|------|---------:|-------------:|------------------:|------------------:|
| Hafif ticari (panelvan) | 1.000 kg | 50 TL | 5 TL/km | 0,25 kg CO₂/km |
| Kamyonet | 3.500 kg | 150 TL | 8 TL/km | 0,4 kg CO₂/km |
| Kamyon | 12.000 kg | 400 TL | 13 TL/km | 0,8 kg CO₂/km |

```
sefer          = 1                                   (miktar ≤ seçilen aracın kapasitesi)
               = ⌈miktar / 12.000⌉                   (miktar > 12.000 kg, kamyon)
gidilenKm      = d × EMPTY_RETURN_FACTOR             (EMPTY_RETURN_FACTOR = 2: boş dönüş)
taşımaMaliyeti = sefer × (seferÜcreti + araçKm × gidilenKm)      (buyerOwn: alıcı teslim alır)
```

**Neden ton-km değil araç bazlı?** Küçük partiler tek bir araçla taşınır; araç yarı boş da gitse yakıt
ve şoför maliyeti aynıdır. Ton-km modeli küçük miktarlarda taşımayı neredeyse bedava gösterir ve
"taşıma maliyeti > atık değeri" riskini (PDR §2) hiç ortaya çıkarmaz. Kapasite ise büyük partilerde
"tek panelvan her şeyi taşır" gerçek dışılığını giderir.

- **Sabit sefer ücreti:** araç çağırma, yükleme/boşaltma, şoför zamanı. Mesafeden bağımsız olduğu için
  küçük partilerde belirleyicidir.
- **Araç-km:** yakıt + aşınma, tek yön değer. **Boş dönüş** (dönüş yükü yok) `EMPTY_RETURN_FACTOR` ile her iki taşıma
  modunda eklenir. Faz A2 notu: eski tablo "dönüş dahil" 10 / 16 / 26 TL/km ve 0,5 / 0,8 / 1,6 kg/km idi; değerler
  tek yöne bölünüp × 2 açıkça yazıldı. "Alıcı teslim alır" (`buyerOwn`) maliyetleri ve CO₂ **sayısal olarak değişmedi**.
- 1.000 kg'a kadar her şey hafif ticari araçla hesaplanır; bu belgedeki 100 kg / 15 kg örnekleri bu yüzden
  değişmedi.
- Kartta "Araç" satırı seçilen aracı (ve 1'den fazlaysa sefer sayısını) gösterir.

### 2.2b Taşıma modu: 3. parti taşıyıcı (Faz A2)

`transportMode`: `buyerOwn` (varsayılan, alıcının kendi aracı) | `thirdParty` (taşıyıcı firma). Maliyeti her iki
modda alıcı öder; net kâr ve "zarar → elenir" kuralı aynıdır. Taşıyıcı ayrı kullanıcı rolü değildir.

```
seferBaşı      = max( CARRIER_MIN_FEE_TRY, (CARRIER_FIXED_FEE_TRY + araçKm × d × EMPTY_RETURN_FACTOR) × (1 + CARRIER_MARGIN) )
taşımaMaliyeti = sefer × seferBaşı
taşıyıcıPayı   = sefer × (seferBaşı − (CARRIER_FIXED_FEE_TRY + araçKm × d × EMPTY_RETURN_FACTOR))   (carrierShareTRY)
```

| Sabit (demo) | Değer | Anlamı |
|-------|------:|--------|
| `CARRIER_FIXED_FEE_TRY` | 150 TL | Taşıyıcının sabit sefer ücreti (araç sınıfından bağımsız) |
| `CARRIER_MARGIN` | 0,25 | Taşıyıcı kâr payı |
| `CARRIER_MIN_FEE_TRY` | 300 TL | Kısa mesafe asgari sefer ücreti (panelvanla ~9 km'ye kadar devrede) |

- CO₂ iki modda aynıdır (aynı araç, aynı boş dönüş).
- **Aracı olmayan alıcı** (`hasOwnVehicle: false`): "Alıcı teslim alır" mümkün değildir. Bu görünümde alıcı
  elenmez; taşıyıcı maliyetiyle hesaplanır (`transportMode: "thirdParty"`) ve sıralama/"Önerilen" bu rakamla
  yapılır. Taşıyıcıyla zarar ediyorsa normal "zarar" kuralıyla elenir. Kartta "Aracı yok – yalnızca taşıyıcı
  ile" etiketi; detayda yalnızca taşıyıcı maliyeti.
- `carrierShareTRY` = taşıyıcının kâr payı + asgari ücret tamamlaması; kendi araçta 0.
- Küçük partilerde asgari ücret belirleyicidir: Ankara 15 kg'da ODTÜ alıcısı kendi araçla +56 TL kârlı, taşıyıcıyla
  300 TL > 176 TL değer → zarar, elenir.
- Sonuç ekranında liste üstünde "Alıcı teslim alır / Taşıyıcı firma" seçimi; kart detayında iki modun taşıma maliyeti ve
  net kârı yan yana. `POST /match` iki modu tek yanıtta döner (`byMode`).

### 2.3 Malzeme değeri (alıcı teslim fiyatı)

```
malzemeDeğeri = miktarKg × alıcı.pricePerKg × (qualityScore / 100)
```

`pricePerKg`, alıcının malzemeyi **kendi tesisine teslim edilmiş** hâliyle ödemeye razı olduğu fiyattır.
Ekranda "Alıcı teslim fiyatı" olarak gösterilir; alıcının toplam harcaması budur.

Kalite puanı fiyatı doğrudan ölçekler: 90 puanlık ürün liste fiyatının %90'ını alır. Alıcı fiyatları
2-15 TL/kg aralığında seçildi.

### 2.4 Net kâr (satıcıya kalan)

```
netKâr = malzemeDeğeri − taşımaMaliyeti        netKâr ≤ 0 → eşleşme yok
```

Taşımayı alıcı ayarlar ve öder, ama tutarı teslim fiyatından düşer. Bu yüzden `netProfitTRY` **satıcının
cebine giren** tutardır; ekranda "Size kalan (net)". Net ≤ 0 ise alıcının satıcıya ödeyebileceği bir şey
kalmaz ve eşleşme olmaz. Taşıyıcı firma pahalıysa düşen tutar satıcının payıdır.

Para değerleri tam TL'ye yuvarlanır.

### 2.5 CO₂ – araç-km bazlı

```
co2Kg = sefer × d × EMPTY_RETURN_FACTOR × aracınEmisyonu        (hafif ticari: d × 2 × 0,25 kg/km)
```

Yaklaşık tek yön değerler (demo varsayımı): panelvan ≈0,25, kamyonet ≈0,4, kamyon ≈0,8 kg CO₂/km;
boş dönüş her iki taşıma modunda × 2 olarak eklenir. Taşınan kilogramla doğrudan orantılı değildir; seçilen araca ve sefer sayısına bağlıdır.
Kartta "Taşıma CO₂" olarak gösterilir; sıralamada karbon fiyatıyla paraya çevrilerek kullanılır (§2.8).

### 2.5b Net iklim etkisi (tahmini)

```
önlenenÇöplükEmisyonu = miktarKg × AVOIDED_LANDFILL_KG_CO2E_PER_KG      (≈ 0,595 kg CO₂e/kg)
netİklimEtkisi        = önlenenÇöplükEmisyonu − co2Kg                     (pozitif = tasarruf)
```

- **Kaynak:** ABD EPA, *Modeling Food Donation Benefits in EPA's Waste Reduction Model* (WARM v15, Haziran 2019),
  Tablo 1, düşük tahmin (yalnızca önlenen çöplüğe gönderme), "Fruits and Vegetables": **0,54 MTCO2E / kısa ton**.
  [PDF (EPA arşivi)](https://19january2021snapshot.epa.gov/sites/static/files/2019-06/documents/warm_v15_food_donation_guidance.pdf)
- **Dönüşüm:** 1 kısa ton = 0,90718474 metrik ton → 0,54 / 0,90718474 ≈ **0,595 kg CO₂e / kg**.
- **Varsayımlar:** ABD ortalama çöplük gazı toplama koşulları (Türkiye'de farklı olabilir); alıcının işleme
  emisyonu dahil değildir. Bu yüzden ekranda **"tahmini"** yazılır.
- Her eşleşme için `netImpactCo2eKg` olarak hesaplanır; sonuç ekranında **önerilen (ilk) eşleşmenin** değeri gösterilir.
- Örnek: İstanbul, 100 kg, İTÜ Arı Teknokent → 100 × 0,595 = 59,5 kg önlenir − 6,5 kg taşıma = **≈53 kg CO₂e tasarruf**.

### 2.6 Raf ömrü kuralı

```
gerekenGün = HANDLING_DAYS + d / (AVG_SPEED_KMH × DRIVING_HOURS_PER_DAY)
           = 1 gün + d / 320 km
```

- `estimatedShelfLifeDays < gerekenGün` → **elenir** (ürün yolda bozulur).
- `estimatedShelfLifeDays < gerekenGün + 1 gün` (`SHELF_LIFE_BUFFER_DAYS`) → eşleşir ama **riskli** sayılır
  (`shelfLifeRisk = true`): skor yarıya iner, sıralamada tüm güvenli eşleşmelerin arkasına düşer ve kartta
  "Raf ömrü sınırda" rozeti görünür.

50 km yarıçap içinde yol süresi en fazla ~0,16 gündür; yani pratikte kural "raf ömrü ~1,2 günden kısaysa
ele, ~2,2 günden kısaysa riskli say" demektir.

### 2.7 Skor (0-100, yalnızca gösterim)

```
skor = max(0, round( düzeltilmişDeğer / enİyiDüzeltilmişDeğer × 100 × tazelikKatsayısı ))
tazelikKatsayısı = 0,5 (shelfLifeRisk) | 1
```

Güvenli eşleşmeler arasında ilk sıradaki genellikle 100'dür. Ayrı bir puan alanı yoktur; karbon ve raf ömrü
cezası mevcut `score`'a yansır. **Skor sıralamayı değiştirmez**; sıralama §2.8'e göredir.

### 2.8 Karbon düzeltmeli sıralama

```
düzeltilmişDeğer = round( netKâr − co2Kg × CARBON_PRICE_TRY_PER_KG )      (TL)
sıralama: shelfLifeRisk (false önce) → düzeltilmişDeğer (azalan) → mesafe (artan)
```

- **`CARBON_PRICE_TRY_PER_KG` ≈ 4,77 TL / kg CO₂ (demo varsayımı).** Türkiye'de bu taşımaya uygulanan bir
  karbon fiyatı yoktur; referans olarak AB ETS fiyatı TL'ye çevrildi:
  - AB ETS (EUA) birincil piyasa ihale fiyatı: **85,89 € / t CO₂**, 23.10.2026, EEX "Auction 4. Period DE"
    (birincil kaynak: [EEX Emission Spot Primary Market Auction Report 2026](https://public.eex-group.com/eex/eua-auction-report/emission-spot-primary-market-auction-report-2026-data.xlsx), 25 Ekim 2026'da erişildi).
    İkincil kontrol: aynı gün ikincil piyasa uzlaşması 85,92 €/t
    ([Purely Energy – EU ETS](https://www.purelyenergy.co.uk/tools/carbon/eu-ets)); sonuç değişmez.
  - EUR/TRY: **55,4997 TL**, TCMB gösterge döviz alış kuru, 23.10.2026, bülten 2026/201
    ([TCMB XML](https://www.tcmb.gov.tr/kurlar/202610/23102026.xml)).
  - 85,89 × 55,4997 / 1000 ≈ **4,77 TL / kg**.
- Karbon fiyatı **yalnızca sıralamada** kullanılır; kartta gösterilen net kâr değişmez. Bu yüzden önerilen
  eşleşme her zaman en yüksek net kârlı eşleşme olmayabilir (PDR §2: "en düşük karbon ayak iziyle en kârlı").
- Örnek: 100 kg, panelvan. 20 km uzaktaki alıcı 10,2 kg CO₂ → ≈49 TL karbon maliyeti. Yakındaki (0 km) alıcının
  net kârı 49 TL'den az farkla düşükse, yakındaki alıcı öne geçer.

---

## 3. Başabaş noktası (en kullanışlı sezgi)

Net kârın sıfır olduğu yerden (alıcı teslim alır, hafif ticari, miktar ≤ 1.000 kg; 10 = 5 TL/km × 2 boş dönüş; daha büyük
araçta 50 ve 10 yerine o aracın sefer ücreti ve 2 × araç-km değeri, çoklu seferde ayrıca × sefer):

```
Bir alıcının kârlı olabileceği en uzak mesafe:   d_maks = (miktar × fiyat × kalite/100 − 50) / 10
Bir alıcının kârlı olması için en az miktar:     miktar_min = (50 + 10 × d) / (fiyat × kalite/100)
```

Örnekler (kalite 90):

| Durum | Hesap | Sonuç |
|-------|-------|-------|
| 15 kg, 13 TL/kg alıcı | (15 × 13 × 0,9 − 50) / 10 | en fazla **12,6 km** uzakta kârlı |
| 100 kg, 2 TL/kg alıcı | (100 × 2 × 0,9 − 50) / 10 | en fazla **13 km** uzakta kârlı |
| Dilovası (2 TL/kg, 43,3 km) | (50 + 433) / 1,8 | **268 kg** üstünde kârlı |
| Başkent OSB (2,5 TL/kg, 44,2 km) | (50 + 442) / 2,25 | **219 kg** üstünde kârlı |
| Serik (2 TL/kg, 35,3 km) | (50 + 353) / 1,8 | **224 kg** üstünde kârlı |

Bu yüzden 10-20 kg'lık partilerde yalnızca birkaç km'deki alıcılar kalır; "zarar eden" demo alıcıları
~220-270 kg'ın altındaki ilanlarda zarar eder (demo için 100 kg önerilir).

---

## 4. Alıcı verisi nasıl tasarlandı

**Tüm alıcılar kurgusaldır.** Firma adları uydurmadır; konumlar yalnızca gerçekçi olsun diye bilinen
sanayi bölgeleri ve teknoparklar civarına konuldu. Kodda (`isFictional: true`), kartta
("Kurgusal demo alıcısı") ve harita işaretinde belirtilir.

Her şehirde 4 alıcı vardır; şehir merkezindeki demo noktasına göre:

| Rol | Amaç |
|-----|------|
| 2 kârlı alıcı (50 km içi, farklı endüstriler) | Normal eşleşme ve sıralamayı göstermek |
| 1 zarar eden alıcı (50 km içi, 2-2,5 TL/kg, 35-45 km) | "netKâr ≤ 0 → listede yok" kuralını göstermek |
| 1 yarıçap dışı alıcı (60-80 km, yüksek fiyat) | Kârlı olsa bile 50 km dışında kaldığı için elendiğini göstermek |

Şehir içindeki alıcılar birlikte 5 endüstrinin hepsini kapsar; böylece AI hangi endüstrileri önerirse
önersin en az bir uygun alıcı bulunur.

### Demo noktalarından mesafeler (100 kg / 15 kg, kalite 90)

Net kâr sütunları "Alıcı teslim alır" görünümüdür. Her şehrin 2. kârlı alıcısının aracı yoktur
(`hasOwnVehicle: false`, * ile işaretli); onlar bu görünümde de taşıyıcı maliyetiyle hesaplanır.

| Alıcı | Konum | Mesafe | Fiyat | Net kâr 100 kg | Net kâr 15 kg |
|-------|-------|-------:|------:|---------------:|--------------:|
| ist-1 Kabuktan Polimer Ar-Ge | İTÜ Arı Teknokent | 12,9 km | 12 | +901 | −17 |
| ist-2 Liflen Vegan Deri * | Tuzla Deri OSB | 23,2 km | 9 | +332 | zarar |
| ist-3 Marmara Lif | Dilovası OSB | 43,3 km | 2 | −303 | −456 |
| ist-4 Trakya Doğal Kozmetik | Silivri | 73,5 km | 14 | yarıçap dışı | yarıçap dışı |
| ank-1 Bozkır Biyoaktif | ODTÜ Teknokent | 7,0 km | 13 | +1.050 | +56 |
| ank-2 Başkent Biyomalzeme * | Sincan OSB | 25,5 km | 8 | +214 | zarar |
| ank-3 Anadolu Filament | Başkent OSB, Malıköy | 44,2 km | 2,5 | −267 | −458 |
| ank-4 Polatlı Tarım Biyotek. | Polatlı OSB | 71,1 km | 15 | yarıçap dışı | yarıçap dışı |
| ayt-1 Akdeniz Narenciye | Antalya Teknokent | 5,0 km | 11 | +890 | +49 |
| ayt-2 Toros Yeşil Polimer * | Antalya OSB | 12,1 km | 10 | +561 | zarar |
| ayt-3 Serik Lif ve Deri | Serik | 35,3 km | 2 | −223 | −376 |
| ayt-4 Manavgat Doğal Özler | Manavgat OSB | 64,5 km | 14 | yarıçap dışı | yarıçap dışı |

### Test koordinatları (formda "Konumu elle gir")

| Şehir | Enlem | Boylam |
|-------|------:|-------:|
| İstanbul (Ümraniye) | 41.0160 | 29.1200 |
| Ankara (Kızılay) | 39.9200 | 32.8540 |
| Antalya (Muratpaşa) | 36.8870 | 30.7050 |

---

## 5. Uçtan uca örnek: İstanbul, 100 kg, kalite 90, tüm endüstriler uygun

| Alıcı | d | Taşıma = 50 + 10·d | Değer = 100 · fiyat · 0,9 | Net kâr | CO₂ = 0,5·d | Düzeltilmiş = net − CO₂ × 4,77 | Skor | Sonuç |
|-------|---:|---:|---:|---:|---:|---:|---:|---|
| İTÜ Arı Teknokent | 12,9 | 179 | 1.080 | **901** | 6,5 | 870 | 100 | 1. (Önerilen) |
| Tuzla Deri OSB (aracı yok → taşıyıcı) | 23,2 | 478 ¹ | 810 | **332** | 11,6 | 277 | 32 | 2. |
| Dilovası OSB | 43,3 | 483 | 180 | −303 | – | – | – | zarar → elendi |
| Silivri | 73,5 | – | – | – | – | – | – | mesafe → elendi |
| Ankara/Antalya alıcıları | >100 | – | – | – | – | – | – | bölge dışı (özete girmez) |

¹ Tuzla alıcısının aracı olmadığı için "Alıcı teslim alır" görünümünde de taşıyıcı formülü: (150 + 10 × 23,2) × 1,25.

Bu örnekte önerilen eşleşme aynı zamanda en yüksek net kârlıdır; "Size en çok kalan" etiketi görünmez.

**Aynı ilan, taşıyıcı firma (`thirdParty`):**

| Alıcı | Taşıma = max(300, (150 + 10·d) × 1,25) | Net kâr | "Alıcı teslim alır"a göre | Skor | Sonuç |
|-------|---:|---:|---:|---:|---|
| İTÜ Arı Teknokent | 349 | **731** | −170 | 100 | 1. (Önerilen) |
| Tuzla Deri OSB | 478 | **332** | 0 (zaten taşıyıcı) | 40 | 2. |
| Dilovası OSB | 729 | −549 | – | – | zarar → elendi |

Sıra iki modda aynıdır; taşıyıcı yalnızca maliyeti artırır.

Ekrandaki özet: **"1 alıcı zarar nedeniyle, 1 alıcı mesafe nedeniyle elendi."**

---

## 6. Sabitler (tek yer: `server/lib/matching.ts` başı)

| Sabit | Değer | Anlamı |
|-------|------:|--------|
| `MAX_RADIUS_KM` | 50 | Eşleşmeye izin verilen en büyük mesafe (harita dairesi de buradan) |
| `NEARBY_CONTEXT_KM` | 100 | Elenme özetine girecek en uzak alıcı |
| `VEHICLE_CLASSES` | 3 sınıf | Kapasite, sefer ücreti, araç-km maliyeti ve emisyon (bkz. §2.2 tablosu) |
| `AVOIDED_LANDFILL_KG_CO2E_PER_KG` | ≈0,595 | Çöplükten çevrilen kg başına önlenen emisyon (EPA WARM v15) |
| `EMPTY_RETURN_FACTOR` | 2 | Boş dönüş: gidilen araç-km = tek yön × 2 (her iki modda) |
| `CARRIER_FIXED_FEE_TRY` / `CARRIER_MARGIN` / `CARRIER_MIN_FEE_TRY` | 150 / 0,25 / 300 | 3. parti taşıyıcı (§2.2b) |
| `CARBON_PRICE_TRY_PER_KG` | ≈4,77 | Sıralamada taşıma CO₂'sinin TL karşılığı (EEX EUA ihalesi 23.10.2026 × TCMB kuru, §2.8) |
| `HANDLING_DAYS` | 1 | Toplama + işleme süresi (gün) |
| `AVG_SPEED_KMH` × `DRIVING_HOURS_PER_DAY` | 40 × 8 | Günlük yol kapasitesi = 320 km |
| `SHELF_LIFE_BUFFER_DAYS` | 1 | Bu paydan az kalırsa riskli: skor yarıya iner, sıralamada güvenlilerin arkasında |

`MAX_RADIUS_KM` mobilde ayrıca tanımlanmaz; `POST /match` yanıtındaki `radiusKm` ile gelir.

---

## 7. Kararların özeti (neden böyle?)

| Karar | Gerekçe |
|-------|---------|
| Araç bazlı taşıma (ton-km yerine) | Küçük partilerde gerçek maliyet araçtır; PDR'daki "taşıma > atık değeri" riskini görünür kılar |
| Araç sınıfı + kapasite (Faz B) | En küçük uygun araç seçilir, 12 t üstü çoklu kamyon seferi; büyük partilerde tek panelvan varsayımı kalkar. 1 t'a kadar sonuçlar değişmez |
| Sabit sefer ücreti | 10-20 kg'lık ilanlarda uzak alıcıların doğal olarak zarara düşmesi |
| Boş dönüş iki modda da (Faz A2) | Alıcının kendi aracı da boş döner; yalnız taşıyıcıda saymak iki modu haksız kıyaslardı. Eski "dönüş dahil" sabitler tek yöne bölündü, kendi araç rakamları değişmedi |
| Taşıyıcı asgari ücreti (Faz A2) | Kısa mesafede taşıyıcı gerçekte sefer başı en az bir ücret ister; küçük partilerde kendi aracı avantajını görünür kılar |
| Kuş uçuşu (Haversine) | Ek servis/anahtar gerektirmez; demo için yeterli |
| Organik değilse hiç eşleştirme yok | AI "tarımsal yan ürün değil" dediyse alıcı aramak anlamsız |
| AI en fazla 3 endüstri önerir, sıralı | Her ürüne her endüstri uygun görünmesin; eşleşme anlamlı kalsın |
| Karbon düzeltmeli sıralama (Faz A) | PDR §2 "en düşük karbon ayak iziyle en kârlı": CO₂ yalnız eşitlik bozucuyken sıralamaya pratikte etkisi yoktu. Fiyat AB ETS referanslı demo varsayımı; net kâr gösterimi değişmez |
| Riskli raf ömrü güvenlinin önüne geçemez (Faz A) | Yolda bozulma riski kârla telafi edilmez; skorun yarıya inmesi tek başına sıralamayı değiştirmiyordu |
| Skor sıralamayı değiştirmez | Ayrı puan alanı yok; sıralama §2.8'deki kurala göre |
| Elenme özeti yalnız 100 km içi | Diğer şehirlerin alıcıları "mesafe" sayılırsa özet anlamsızlaşır |
| Görsel `/match`'e tekrar gönderilmez | Eşleştirme yalnızca miktar, konum ve kalite sonucuna ihtiyaç duyar |
| Harita: WebView + Leaflet + OpenStreetMap | Expo Go/Android'de `react-native-maps` (Google Maps SDK) haritayı hiç çizmedi: `onMapReady` geldi, `onMapLoaded` ve görüntü isteği hiç gelmedi (sunucu üzerinden yapılan teşhisle kanıtlandı). Leaflet WebView içinde çalışır, anahtar gerektirmez; OSM atfı zorunlu, sunucusu yoğun trafik için değildir (demo) |

## 8. Bilinen sınırlar

- Mesafe kuş uçuşudur; gerçek yol mesafesi ve trafik dikkate alınmaz.
- Araç seçimi yalnızca kapasiteye bakar; maliyet açısından daha ucuz kombinasyon (ör. iki panelvan yerine
  bir kamyonet) aranmaz. Araç değerleri yaklaşık demo varsayımıdır.
- Net iklim etkisi ABD ortalamasına dayalı tek bir katsayı kullanır (EPA WARM); ürün türüne, yerel çöplük
  koşullarına ve alıcının işleme emisyonuna göre değişmez.
- Fiyatlar ve maliyetler sabittir; mevsim, yakıt fiyatı veya alıcı kapasitesi yoktur.
