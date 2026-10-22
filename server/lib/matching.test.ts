import { test } from "node:test";
import assert from "node:assert/strict";
import { BUYERS } from "../data/buyers.js";
import {
  AVOIDED_LANDFILL_KG_CO2E_PER_KG,
  CARBON_PRICE_TRY_PER_KG,
  evaluateBuyers,
  haversineKm,
  MAX_RADIUS_KM,
  matchBuyers,
  selectVehicle,
} from "./matching.js";
import { INDUSTRIES, type Buyer, type QualityResult } from "./schema.js";

// Çalıştırma: npm test  (Node yerleşik test koşucusu, ek bağımlılık yok)

const CITY_POINTS = {
  ist: { lat: 41.016, lng: 29.12 },
  ank: { lat: 39.92, lng: 32.854 },
  ayt: { lat: 36.887, lng: 30.705 },
} as const;

const goodQuality: QualityResult = {
  productType: "mandalina kabuğu",
  isOrganicByproduct: true,
  qualityScore: 90,
  spoilageStatus: "taze",
  estimatedShelfLifeDays: 7,
  suitableIndustries: [...INDUSTRIES],
  summary: "test",
};

const ids = (list: { buyer: Buyer }[]) => list.map((m) => m.buyer.id).sort();

for (const [city, point] of Object.entries(CITY_POINTS)) {
  test(`${city}: 100 kg → yalnız 2 kârlı yerel alıcı; zarar eden ve yarıçap dışı yok`, () => {
    const matches = matchBuyers({ quantityKg: 100, ...point }, goodQuality, BUYERS);
    assert.deepEqual(ids(matches), [`${city}-1`, `${city}-2`]);
  });

  test(`${city}: veri tasarımı – 3 alıcı yarıçap içinde, 1 alıcı 60-80 km`, () => {
    const cityBuyers = BUYERS.filter((b) => b.id.startsWith(city));
    const distances = cityBuyers.map((b) => haversineKm(point.lat, point.lng, b.lat, b.lng));
    assert.equal(distances.filter((d) => d <= MAX_RADIUS_KM).length, 3);
    const outside = distances.filter((d) => d > MAX_RADIUS_KM);
    assert.equal(outside.length, 1);
    assert.ok(outside[0] >= 60 && outside[0] <= 80, `yarıçap dışı mesafe ${outside[0]}`);
  });
}

test("yarıçap dışı alıcı, kârlı olsa bile listeye girmez", () => {
  const all = matchBuyers({ quantityKg: 5000, ...CITY_POINTS.ist }, goodQuality, BUYERS);
  assert.ok(all.every((m) => m.distanceKm <= MAX_RADIUS_KM));
  assert.ok(!all.some((m) => m.buyer.id === "ist-4"));
});

test("netProfit ≤ 0 olan eşleşme çıkmaz", () => {
  for (const point of Object.values(CITY_POINTS)) {
    for (const quantityKg of [10, 15, 20, 100, 1000]) {
      const matches = matchBuyers({ quantityKg, ...point }, goodQuality, BUYERS);
      assert.ok(matches.every((m) => m.netProfitTRY > 0));
    }
  }
});

test("küçük miktar (15 kg): yalnızca çok yakın alıcı kârlı kalır", () => {
  assert.deepEqual(ids(matchBuyers({ quantityKg: 15, ...CITY_POINTS.ank }, goodQuality, BUYERS)), ["ank-1"]);
  assert.deepEqual(ids(matchBuyers({ quantityKg: 15, ...CITY_POINTS.ayt }, goodQuality, BUYERS)), ["ayt-1"]);
  assert.deepEqual(matchBuyers({ quantityKg: 15, ...CITY_POINTS.ist }, goodQuality, BUYERS), []);
});

test("organik yan ürün değilse hiç eşleşme yok", () => {
  const notOrganic = { ...goodQuality, isOrganicByproduct: false, qualityScore: 0, suitableIndustries: [] };
  assert.deepEqual(matchBuyers({ quantityKg: 1000, ...CITY_POINTS.ist }, notOrganic, BUYERS), []);
});

test("endüstri kesişmeyen alıcı elenir", () => {
  const onlyVeganLeather: QualityResult = { ...goodQuality, suitableIndustries: ["vegan_deri"] };
  assert.deepEqual(ids(matchBuyers({ quantityKg: 100, ...CITY_POINTS.ist }, onlyVeganLeather, BUYERS)), ["ist-2"]);
});

test("raf ömrü gereken süreden kısaysa elenir, sınırdaysa riskli ve skor yarıya iner", () => {
  const expired = { ...goodQuality, estimatedShelfLifeDays: 0 };
  assert.deepEqual(matchBuyers({ quantityKg: 100, ...CITY_POINTS.ank }, expired, BUYERS), []);

  const tight = { ...goodQuality, estimatedShelfLifeDays: 1.5 };
  const matches = matchBuyers({ quantityKg: 100, ...CITY_POINTS.ank }, tight, BUYERS);
  assert.ok(matches.every((m) => m.shelfLifeRisk));
  assert.equal(matches[0].score, 50);

  const safe = matchBuyers({ quantityKg: 100, ...CITY_POINTS.ank }, goodQuality, BUYERS);
  assert.ok(safe.every((m) => !m.shelfLifeRisk));
});

const rankBase = { industries: ["kozmetik" as const], pricePerKg: 10, locationName: "test", isFictional: true as const };

test("sıralama: karbon düzeltmeli değer azalan; ilk skor 100", () => {
  // Aynı fiyat; daha uzak alıcı daha az kâr ve daha çok CO₂.
  const buyers: Buyer[] = [
    { ...rankBase, id: "far", name: "Uzak", lat: 41.2, lng: 29.12 },
    { ...rankBase, id: "near", name: "Yakın", lat: 41.05, lng: 29.12 },
  ];
  const matches = matchBuyers({ quantityKg: 100, ...CITY_POINTS.ist }, goodQuality, buyers);
  assert.deepEqual(matches.map((m) => m.buyer.id), ["near", "far"]);
  assert.equal(matches[0].score, 100);
  assert.ok(matches[0].netProfitTRY > matches[1].netProfitTRY);
});

test("karbon düzeltmesi: biraz daha kârlı ama uzak alıcı geri düşer", () => {
  const far: Buyer = { ...rankBase, id: "far", name: "Uzak", lat: 41.2, lng: 29.12 };
  const farMatch = matchBuyers({ quantityKg: 100, ...CITY_POINTS.ist }, goodQuality, [far])[0];
  const carbonGapTRY = farMatch.co2Kg * CARBON_PRICE_TRY_PER_KG; // yakın alıcı 0 km → CO₂ 0
  assert.ok(carbonGapTRY > 20);
  // Yakın alıcının net kârı uzaktakinden 20 TL az: 100 kg × fiyat × 0,9 kalite − 50 TL sefer.
  const near: Buyer = {
    ...rankBase,
    id: "near",
    name: "Yakın",
    ...CITY_POINTS.ist,
    pricePerKg: (farMatch.netProfitTRY - 20 + 50) / 90,
  };
  const matches = matchBuyers({ quantityKg: 100, ...CITY_POINTS.ist }, goodQuality, [far, near]);
  assert.deepEqual(matches.map((m) => m.buyer.id), ["near", "far"]);
  assert.ok(matches[0].netProfitTRY < matches[1].netProfitTRY);
});

test("riskli eşleşme, daha kârlı olsa bile güvenli eşleşmenin önüne geçemez", () => {
  // Raf ömrü 2,05 gün: 0 km'de gereken 1 gün + 1 gün pay → güvenli; ~20 km'de pay yetmez → riskli.
  const quality = { ...goodQuality, estimatedShelfLifeDays: 2.05 };
  const buyers: Buyer[] = [
    { ...rankBase, id: "far-rich", name: "Uzak", lat: 41.2, lng: 29.12, pricePerKg: 30 },
    { ...rankBase, id: "near", name: "Yakın", ...CITY_POINTS.ist, pricePerKg: 2 },
  ];
  const matches = matchBuyers({ quantityKg: 100, ...CITY_POINTS.ist }, quality, buyers);
  assert.deepEqual(matches.map((m) => [m.buyer.id, m.shelfLifeRisk]), [["near", false], ["far-rich", true]]);
  assert.ok(matches[1].netProfitTRY > matches[0].netProfitTRY);
});

test("eşit düzeltilmiş değer: yakın alıcı önde", () => {
  // 10 km'deki alıcı: net kâr 750, CO₂ 5 kg → düzeltilmiş 750 − 5 × 4 = 730 (tam sayı).
  // 0 km'deki alıcının fiyatı aynı değeri verecek şekilde: 100 kg × fiyat × 0,9 − 50 TL sefer = 730.
  const far: Buyer = { ...rankBase, id: "far", name: "Uzak", lat: 41.106, lng: 29.12 };
  const near: Buyer = { ...rankBase, id: "near", name: "Yakın", ...CITY_POINTS.ist, pricePerKg: 780 / 90 };
  const matches = matchBuyers({ quantityKg: 100, ...CITY_POINTS.ist }, goodQuality, [far, near]);
  const adjusted = matches.map((m) => m.netProfitTRY - m.co2Kg * CARBON_PRICE_TRY_PER_KG);
  assert.equal(adjusted[0], adjusted[1]);
  assert.deepEqual(matches.map((m) => m.buyer.id), ["near", "far"]);
  assert.equal(matches[1].score, 100);
});

test("elenen özeti: sebeplere göre sayılar, yalnız yakın çevredeki (100 km) alıcılar", () => {
  const ist = evaluateBuyers({ quantityKg: 100, ...CITY_POINTS.ist }, goodQuality, BUYERS);
  assert.deepEqual(ist.eliminated, { distance: 1, industry: 0, shelfLife: 0, loss: 1 });

  const ank15 = evaluateBuyers({ quantityKg: 15, ...CITY_POINTS.ank }, goodQuality, BUYERS);
  assert.deepEqual(ank15.eliminated, { distance: 1, industry: 0, shelfLife: 0, loss: 2 });

  const onlyVeganLeather: QualityResult = { ...goodQuality, suitableIndustries: ["vegan_deri"] };
  const istLeather = evaluateBuyers({ quantityKg: 100, ...CITY_POINTS.ist }, onlyVeganLeather, BUYERS);
  assert.deepEqual(istLeather.eliminated, { distance: 1, industry: 2, shelfLife: 0, loss: 0 });

  const expired = evaluateBuyers({ quantityKg: 100, ...CITY_POINTS.ayt }, { ...goodQuality, estimatedShelfLifeDays: 0 }, BUYERS);
  assert.deepEqual(expired.eliminated, { distance: 1, industry: 0, shelfLife: 3, loss: 0 });

  // Organik değilse alıcı hiç değerlendirilmez.
  const notOrganic = evaluateBuyers({ quantityKg: 100, ...CITY_POINTS.ist }, { ...goodQuality, isOrganicByproduct: false }, BUYERS);
  assert.deepEqual(notOrganic.eliminated, { distance: 0, industry: 0, shelfLife: 0, loss: 0 });
});

test("net iklim etkisi = önlenen çöplük emisyonu − taşıma CO₂", () => {
  // 100 kg × 0,54/0,90718474 ≈ 59,52 kg CO₂e önlenir; İTÜ (12,9 km) taşıma 6,5 kg → net ≈ 53,0.
  const [best] = matchBuyers({ quantityKg: 100, ...CITY_POINTS.ist }, goodQuality, BUYERS);
  assert.equal(best.buyer.id, "ist-1");
  assert.equal(best.co2Kg, 6.5);
  assert.equal(best.netImpactCo2eKg, 53);
  assert.ok(Math.abs(AVOIDED_LANDFILL_KG_CO2E_PER_KG - 0.595) < 0.001);
});

test("araç seçimi: en küçük uygun araç, kapasite aşılırsa çoklu sefer", () => {
  const pick = (kg: number) => {
    const { vehicle, trips } = selectVehicle(kg);
    return `${vehicle.type}×${trips}`;
  };
  assert.equal(pick(15), "hafif_ticari×1");
  assert.equal(pick(1_000), "hafif_ticari×1");
  assert.equal(pick(1_001), "kamyonet×1");
  assert.equal(pick(12_000), "kamyon×1");
  assert.equal(pick(12_001), "kamyon×2");
  assert.equal(pick(30_000), "kamyon×3");
});

test("500 kg: hafif ticari, 1 sefer; maliyet ve CO₂ panelvan değerleriyle", () => {
  const [best] = matchBuyers({ quantityKg: 500, ...CITY_POINTS.ist }, goodQuality, BUYERS);
  assert.equal(best.buyer.id, "ist-1");
  assert.deepEqual(best.vehicle, { type: "hafif_ticari", label: "Hafif ticari (panelvan)", trips: 1 });
  assert.equal(best.transportCostTRY, 179); // 50 + 10 × 12,9
  assert.equal(best.co2Kg, 6.5); // 0,5 × 12,9
});

test("5.000 kg: kamyon, 1 sefer; maliyet ve CO₂ kamyon değerleriyle", () => {
  const { matches, eliminated } = evaluateBuyers({ quantityKg: 5_000, ...CITY_POINTS.ist }, goodQuality, BUYERS);
  const best = matches[0];
  assert.deepEqual(best.vehicle, { type: "kamyon", label: "Kamyon", trips: 1 });
  assert.equal(best.transportCostTRY, 735); // 400 + 26 × 12,9 = 735,4
  assert.equal(best.co2Kg, 20.6); // 1,6 × 12,9 = 20,64
  // Büyük partide zarar eden alıcı (Dilovası, 2 TL/kg) kâra geçer: 5.000 × 2 × 0,9 = 9.000 > 400 + 26 × 43,3.
  assert.ok(matches.some((m) => m.buyer.id === "ist-3"));
  assert.deepEqual(eliminated, { distance: 1, industry: 0, shelfLife: 0, loss: 0 });
});

test("kapasite aşımı: 30.000 kg → 3 kamyon seferi, maliyet ve CO₂ ×3", () => {
  const [best] = matchBuyers({ quantityKg: 30_000, ...CITY_POINTS.ist }, goodQuality, BUYERS);
  assert.equal(best.vehicle.trips, 3);
  assert.equal(best.transportCostTRY, 2206); // 3 × (400 + 26 × 12,9) = 2.206,2
  assert.equal(best.co2Kg, 61.9); // 3 × 1,6 × 12,9 = 61,92
});

test("matchBuyers, evaluateBuyers'ın eşleşmeleriyle aynıdır", () => {
  const listing = { quantityKg: 100, ...CITY_POINTS.ank };
  assert.deepEqual(matchBuyers(listing, goodQuality, BUYERS), evaluateBuyers(listing, goodQuality, BUYERS).matches);
});

test("saf fonksiyon: girdiyi değiştirmez, aynı girdiye aynı çıktı", () => {
  const snapshot = JSON.stringify(BUYERS);
  const a = matchBuyers({ quantityKg: 100, ...CITY_POINTS.ayt }, goodQuality, BUYERS);
  const b = matchBuyers({ quantityKg: 100, ...CITY_POINTS.ayt }, goodQuality, BUYERS);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(BUYERS), snapshot);
});
