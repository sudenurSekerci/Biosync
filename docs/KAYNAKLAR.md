# BioSync – Kaynaklar

Uygulamada gösterilen her bilgi ve kullanılan her medya burada kaynağıyla listelenir.
**Kural:** Kaynağı birincil belgeden doğrulanamayan bilgi uygulamaya eklenmez.
Doğrulama: aşağıdaki PDF'ler indirildi, metinleri çıkarıldı ve alıntılar birebir arandı (21.10.2026).

---

## 1. Yükleme ekranı bilgileri

Kod: [app/src/loadingFacts.ts](../app/src/loadingFacts.ts). Ekrandaki metinler alıntının Türkçe özetidir.

| # | Ekranda | Birebir alıntı | Kaynak |
|---|---------|----------------|--------|
| 1 | 2022'de dünyada perakende, gıda hizmetleri ve hanelerde tahminen 1,05 milyar ton gıda israf edildi. | "In 2022, the world wasted an estimated 1.05 billion tonnes of food in the retail, food service and household sectors combined." | [UNEP-FWI-2024], PDF s. 12 |
| 2 | Tüketiciye ulaşan gıdanın yaklaşık %19'u israf ediliyor. | "This amounts to 19 per cent of food available to consumers being wasted, at the retail, food service and household levels." | [UNEP-FWI-2024], PDF s. 12 |
| 3 | Gıda kaybı ve israfı, küresel sera gazı emisyonlarının tahmini %8–10'undan sorumlu. | "food waste generates an estimated 8–10 per cent of global greenhouse gas emissions (including from both loss and waste)" | [UNEP-FWI-2024], PDF s. 11 |
| 4 | Gıda israf edilirken her yıl 783 milyona kadar insan açlıktan etkileniyor. | "even as food is being thrown away at scale, up to 783 million people are affected by hunger each year" | [UNEP-FWI-2024], PDF s. 11 |
| 5 | Üretilen gıdanın yaklaşık %14'ü hasattan sonra, perakendeye ulaşmadan kayboluyor. | "Globally, around 14 percent of food produced is lost from the post-harvest stage up to, but excluding, the retail stage." | [FAO-SOFA-2019], PDF s. 25 |
| 6 | Üretilen toplam gıdanın %25–30'u kaybediliyor ya da israf ediliyor. | "Currently, 25–30% of total food produced is lost or wasted (medium confidence)." | [IPCC-SRCCL-SPM], A.1.4, PDF s. 7 |

## 2. Hesaplamalarda kullanılan katsayılar

| Değer | Kullanım | Kaynak |
|-------|----------|--------|
| 0,54 MTCO2E / kısa ton (≈0,595 kg CO₂e/kg) | Tahmini net iklim etkisi (önlenen çöplük emisyonu) | [EPA-WARM-v15], Tablo 1, "Fruits and Vegetables", düşük tahmin. Ayrıntı: [ESLESTIRME_MANTIGI.md](ESLESTIRME_MANTIGI.md) §2.5b |
| Taşıma maliyeti, araç emisyonları, alıcı fiyatları | Eşleştirme | **Demo varsayımı** (kaynaklı değildir); `server/lib/matching.ts` başında açıklanır |

## 3. Medya

| Dosya | Kullanım | Kaynak / lisans |
|-------|----------|-----------------|
| `app/assets/loading-bg.mp4` | Yükleme ekranı arka planı (sessiz, döngülü) | **Los Muertos Crew**, "Farmer working on field", Pexels: https://www.pexels.com/video/farmer-working-on-field-10041412/ — [Pexels lisansı](https://www.pexels.com/license/). Orijinal 1080×1920 (6,8 MB) dosya ffmpeg ile 540×960, sessiz, H.264 olarak küçültüldü (728 KB). |
| Harita görüntüleri | Eşleşme haritası | © OpenStreetMap katkıda bulunanlar ([ODbL](https://www.openstreetmap.org/copyright)); Leaflet 1.9.4 (BSD-2) |

---

## Kaynakça

- **[UNEP-FWI-2024]** United Nations Environment Programme (2024). *Food Waste Index Report 2024. Think Eat Save: Tracking Progress to Halve Global Food Waste.* Nairobi.
  https://wedocs.unep.org/20.500.11822/45230
- **[FAO-SOFA-2019]** FAO (2019). *The State of Food and Agriculture 2019. Moving forward on food loss and waste reduction.* Rome.
  https://www.fao.org/3/ca6030en/ca6030en.pdf
- **[IPCC-SRCCL-SPM]** IPCC (2019). *Summary for Policymakers.* In: Climate Change and Land (SRCCL).
  https://www.ipcc.ch/site/assets/uploads/sites/4/2022/11/SRCCL_SPM.pdf
- **[EPA-WARM-v15]** U.S. EPA (2019). *Modeling Food Donation Benefits in EPA's Waste Reduction Model (WARM v15).*
  https://19january2021snapshot.epa.gov/sites/static/files/2019-06/documents/warm_v15_food_donation_guidance.pdf
