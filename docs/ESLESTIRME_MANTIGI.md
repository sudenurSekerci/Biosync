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

Geçen alıcılar sıralanır (bkz. §2.8):
1. **Raf ömrü güvenli olanlar önce** (`shelfLifeRisk = false`); riskli eşleşme, daha kârlı olsa bile güvenlinin önüne geçemez.
2. **Karbon düzeltmeli değer** yüksekten düşüğe: `netKâr − co2Kg × CARBON_PRICE_TRY_PER_KG`.
3. Eşitlikte **mesafe** yakından uzağa.

İlk sıradaki "Önerilen Eşleşme" olarak vurgulanır. Karbon düzeltmesi yüzünden ilk sıradaki her zaman en kârlı alıcı olmayabilir; bu yüzden rozet "En Kârlı" demez.

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

| Araç | Kapasite | Sefer ücreti | Araç-km (dönüş dahil) | Emisyon (dönüş dahil) |
|------|---------:|-------------:|----------------------:|----------------------:|
| Hafif ticari (panelvan) | 1.000 kg | 50 TL | 10 TL/km | 0,5 kg CO₂/km |
| Kamyonet | 3.500 kg | 150 TL | 16 TL/km | 0,8 kg CO₂/km |
| Kamyon | 12.000 kg | 400 TL | 26 TL/km | 1,6 kg CO₂/km |

```
sefer          = 1                                   (miktar ≤ seçilen aracın kapasitesi)
               = ⌈miktar / 12.000⌉                   (miktar > 12.000 kg, kamyon)
taşımaMaliyeti = sefer × (seferÜcreti + araçKm × d)
```

**Neden ton-km değil araç bazlı?** Küçük partiler tek bir araçla taşınır; araç yarı boş da gitse yakıt
ve şoför maliyeti aynıdır. Ton-km modeli küçük miktarlarda taşımayı neredeyse bedava gösterir ve
"taşıma maliyeti > atık değeri" riskini (PDR §2) hiç ortaya çıkarmaz. Kapasite ise büyük partilerde
"tek panelvan her şeyi taşır" gerçek dışılığını giderir.

- **Sabit sefer ücreti:** araç çağırma, yükleme/boşaltma, şoför zamanı. Mesafeden bağımsız olduğu için
  küçük partilerde belirleyicidir.
- **Araç-km:** yakıt + aşınma, **dönüş yolu dahil** (tek yön değerin ×2'si). Tek yön mesafe ile çarpılır.
- 1.000 kg'a kadar her şey hafif ticari araçla hesaplanır; bu belgedeki 100 kg / 15 kg örnekleri bu yüzden
  değişmedi.
- Kartta "Araç" satırı seçilen aracı (ve 1'den fazlaysa sefer sayısını) gösterir.

### 2.3 Malzeme değeri

```
malzemeDeğeri = miktarKg × alıcı.pricePerKg × (qualityScore / 100)
```

Kalite puanı fiyatı doğrudan ölçekler: 90 puanlık ürün liste fiyatının %90'ını alır. Alıcı fiyatları
2-15 TL/kg aralığında seçildi.

### 2.4 Net kâr

```
netKâr = malzemeDeğeri − taşımaMaliyeti        netKâr ≤ 0 → eşleşme yok
```

Para değerleri tam TL'ye yuvarlanır.

### 2.5 CO₂ – araç-km bazlı

```
co2Kg = sefer × d × aracınEmisyonu        (hafif ticari: d × 0,5 kg/km)
```

Yaklaşık tek yön değerler (demo varsayımı): panelvan ≈0,25, kamyonet ≈0,4, kamyon ≈0,8 kg CO₂/km;
dönüş dahil ×2. Taşınan kilogramla doğrudan orantılı değildir; seçilen araca ve sefer sayısına bağlıdır.
Kartta "Taşıma CO₂" olarak gösterilir; sıralamada karbon fiyatıyla net kâra yansır (§2.8).

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
- Her eşleşme için `netImpactCo2eKg` olarak hesaplanır; sonuç ekranında **önerilen (ilk sıradaki) eşleşmenin** değeri gösterilir.
- Örnek: İstanbul, 100 kg, İTÜ Arı Teknokent → 100 × 0,595 = 59,5 kg önlenir − 6,5 kg taşıma = **≈53 kg CO₂e tasarruf**.

### 2.6 Raf ömrü kuralı

```
gerekenGün = HANDLING_DAYS + d / (AVG_SPEED_KMH × DRIVING_HOURS_PER_DAY)
           = 1 gün + d / 320 km
```

- `estimatedShelfLifeDays < gerekenGün` → **elenir** (ürün yolda bozulur).
- `estimatedShelfLifeDays < gerekenGün + 1 gün` (`SHELF_LIFE_BUFFER_DAYS`) → eşleşir ama **riskli** (`shelfLifeRisk`): skor yarıya iner, sıralamada tüm güvenli eşleşmelerin arkasına düşer, kartta "Raf ömrü sınırda" rozeti çıkar.

50 km yarıçap içinde yol süresi en fazla ~0,16 gündür; yani pratikte kural "raf ömrü ~1,2 günden kısaysa
ele, ~2,2 günden kısaysa riskli say" demektir.

### 2.7 Skor (0-100, yalnızca gösterim)

```
düzeltilmişDeğer = netKâr − co2Kg × CARBON_PRICE_TRY_PER_KG
skor = round( max(0, düzeltilmişDeğer) / enİyiDüzeltilmişDeğer × 100 × tazelikKatsayısı )   tazelikKatsayısı ∈ {1; 0,5}
```

Riskli eşleşme yoksa ilk eşleşme her zaman 100'dür. Skor yalnızca gösterimdir; sıralama §1'deki kurala göredir.

### 2.8 Karbon düzeltmeli sıralama

```
düzeltilmişDeğer = netKâr − co2Kg × CARBON_PRICE_TRY_PER_KG          (CARBON_PRICE_TRY_PER_KG = 4 TL / kg CO₂)
```

- PDR §2 "en düşük karbon ayak iziyle en kârlı" eşleşmeyi tek sayıya indirger. **Demo varsayımıdır**, gerçek bir karbon piyasası fiyatı değildir.
- Yalnızca sıralamayı etkiler; kartta gösterilen kâr, maliyet ve CO₂ rakamları değişmez.
- Etkisi bilinçli olarak küçüktür: panelvanla 1 km fazla yol ≈ 0,5 kg CO₂ ≈ 2 TL ceza (taşıma maliyeti ise 10 TL/km). Yani karbon, yalnızca net kârı birbirine yakın alıcıların sırasını değiştirir.

---

## 3. Başabaş noktası (en kullanışlı sezgi)

Net kârın sıfır olduğu yerden (hafif ticari araç, miktar ≤ 1.000 kg; daha büyük araçta 50 ve 10 yerine
o aracın sefer ücreti ve araç-km değeri, çoklu seferde ayrıca × sefer):

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

| Alıcı | Konum | Mesafe | Fiyat | Net kâr 100 kg | Net kâr 15 kg |
|-------|-------|-------:|------:|---------------:|--------------:|
| ist-1 Kabuktan Polimer Ar-Ge | İTÜ Arı Teknokent | 12,9 km | 12 | +901 | −17 |
| ist-2 Liflen Vegan Deri | Tuzla Deri OSB | 23,2 km | 9 | +528 | −161 |
| ist-3 Marmara Lif | Dilovası OSB | 43,3 km | 2 | −303 | −456 |
| ist-4 Trakya Doğal Kozmetik | Silivri | 73,5 km | 14 | yarıçap dışı | yarıçap dışı |
| ank-1 Bozkır Biyoaktif | ODTÜ Teknokent | 7,0 km | 13 | +1.050 | +55 |
| ank-2 Başkent Biyomalzeme | Sincan OSB | 25,5 km | 8 | +415 | −197 |
| ank-3 Anadolu Filament | Başkent OSB, Malıköy | 44,2 km | 2,5 | −267 | −458 |
| ank-4 Polatlı Tarım Biyotek. | Polatlı OSB | 71,1 km | 15 | yarıçap dışı | yarıçap dışı |
| ayt-1 Akdeniz Narenciye | Antalya Teknokent | 5,0 km | 11 | +890 | +48 |
| ayt-2 Toros Yeşil Polimer | Antalya OSB | 12,1 km | 10 | +729 | −36 |
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

| Alıcı | d | Taşıma = 50 + 10·d | Değer = 100 · fiyat · 0,9 | Net kâr | CO₂ = 0,5·d | Skor | Sonuç |
|-------|---:|---:|---:|---:|---:|---:|---|
| İTÜ Arı Teknokent | 12,9 | 179 | 1.080 | **901** | 6,5 | 100 | 1. (Önerilen) |
| Tuzla Deri OSB | 23,2 | 282 | 810 | **528** | 11,6 | 55 | 2. |
| Dilovası OSB | 43,3 | 483 | 180 | −303 | – | – | zarar → elendi |
| Silivri | 73,5 | – | – | – | – | – | mesafe → elendi |
| Ankara/Antalya alıcıları | >100 | – | – | – | – | – | bölge dışı (özete girmez) |

Karbon düzeltmeli değerler: 901 − 6,5 × 4 = **875**; 528 − 11,6 × 4 = **481,6** → Tuzla skoru 481,6 / 875 × 100 ≈ 55.

Ekrandaki özet: **"1 alıcı zarar nedeniyle, 1 alıcı mesafe nedeniyle elendi."**

---

## 6. Sabitler (tek yer: `server/lib/matching.ts` başı)

| Sabit | Değer | Anlamı |
|-------|------:|--------|
| `MAX_RADIUS_KM` | 50 | Eşleşmeye izin verilen en büyük mesafe (harita dairesi de buradan) |
| `NEARBY_CONTEXT_KM` | 100 | Elenme özetine girecek en uzak alıcı |
| `VEHICLE_CLASSES` | 3 sınıf | Kapasite, sefer ücreti, araç-km maliyeti ve emisyon (bkz. §2.2 tablosu) |
| `AVOIDED_LANDFILL_KG_CO2E_PER_KG` | ≈0,595 | Çöplükten çevrilen kg başına önlenen emisyon (EPA WARM v15) |
| `HANDLING_DAYS` | 1 | Toplama + işleme süresi (gün) |
| `AVG_SPEED_KMH` × `DRIVING_HOURS_PER_DAY` | 40 × 8 | Günlük yol kapasitesi = 320 km |
| `SHELF_LIFE_BUFFER_DAYS` | 1 | Bu paydan az kalırsa eşleşme riskli: skor yarıya iner, sıralamada güvenlilerin arkasına düşer |
| `CARBON_PRICE_TRY_PER_KG` | 4 | Sıralamada taşıma CO₂'sinin TL karşılığı (§2.8) |

`MAX_RADIUS_KM` mobilde ayrıca tanımlanmaz; `POST /match` yanıtındaki `radiusKm` ile gelir.

---

## 7. Kararların özeti (neden böyle?)

| Karar | Gerekçe |
|-------|---------|
| Araç bazlı taşıma (ton-km yerine) | Küçük partilerde gerçek maliyet araçtır; PDR'daki "taşıma > atık değeri" riskini görünür kılar |
| Araç sınıfı + kapasite (Faz B) | En küçük uygun araç seçilir, 12 t üstü çoklu kamyon seferi; büyük partilerde tek panelvan varsayımı kalkar. 1 t'a kadar sonuçlar değişmez |
| Sabit sefer ücreti | 10-20 kg'lık ilanlarda uzak alıcıların doğal olarak zarara düşmesi |
| Kuş uçuşu (Haversine) | Ek servis/anahtar gerektirmez; demo için yeterli |
| Organik değilse hiç eşleştirme yok | AI "tarımsal yan ürün değil" dediyse alıcı aramak anlamsız |
| AI en fazla 3 endüstri önerir, sıralı | Her ürüne her endüstri uygun görünmesin; eşleşme anlamlı kalsın |
| Karbon düzeltmeli sıralama (ROADMAP Faz A) | PDR §2 "en düşük karbonla en kârlı": kâr ve CO₂ tek ölçüde; fiyat küçük tutuldu, kâr baskın kalır |
| Riskli raf ömrü sıralamada en arkada | Daha kârlı ama yolda bozulma riski olan eşleşme önerilmez; kartta rozetle görünür kalır |
| Rozet "Önerilen Eşleşme" | Karbon düzeltmesiyle ilk sıradaki her zaman en kârlı değil |
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
