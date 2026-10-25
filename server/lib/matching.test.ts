import { test } from "node:test";
import assert from "node:assert/strict";
import { BUYERS } from "../data/buyers.js";
import {
  AVOIDED_LANDFILL_KG_CO2E_PER_KG,
  CARBON_PRICE_TRY_PER_KG,
  CARRIER_FIXED_FEE_TRY,
  CARRIER_MIN_FEE_TRY,
  EMPTY_RETURN_FACTOR,
  evaluateBuyers,
  haversineKm,
  MAX_RADIUS_KM,
  matchBuyers,
  selectVehicle,
  VEHICLE_CLASSES,
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

test("raf ömrü gereken süreden kısaysa elenir, sınırdaysa skor yarıya iner", () => {
  const expired = { ...goodQuality, estimatedShelfLifeDays: 0 };
  assert.deepEqual(matchBuyers({ quantityKg: 100, ...CITY_POINTS.ank }, expired, BUYERS), []);

  const tight = { ...goodQuality, estimatedShelfLifeDays: 1.5 };
  const matches = matchBuyers({ quantityKg: 100, ...CITY_POINTS.ank }, tight, BUYERS);
  assert.ok(matches.every((m) => m.shelfLifeRisk));
  assert.equal(matches[0].score, 50);
});

const testBase = {
  industries: ["kozmetik" as const],
  pricePerKg: 10,
  locationName: "test",
  hasOwnVehicle: true,
  isFictional: true as const,
};
// Demo noktasında (0 km) alıcı: taşıma = sabit sefer ücreti 50 TL, CO₂ = 0.
// Net kârı istenen değere getiren fiyat (100 kg × fiyat × 0,9 kalite = net kâr + 50).
const priceForNetProfit = (netProfitTRY: number) => (netProfitTRY + 50) / 90;

test("sıralama: düzeltilmiş değer azalan; ilk skor 100", () => {
  // Aynı fiyat; daha uzak alıcı daha az kâr ve daha çok CO₂.
  const buyers: Buyer[] = [
    { ...testBase, id: "far", name: "Uzak", lat: 41.2, lng: 29.12 },
    { ...testBase, id: "near", name: "Yakın", lat: 41.05, lng: 29.12 },
  ];
  const matches = matchBuyers({ quantityKg: 100, ...CITY_POINTS.ist }, goodQuality, buyers);
  assert.deepEqual(matches.map((m) => m.buyer.id), ["near", "far"]);
  assert.equal(matches[0].score, 100);
  assert.ok(matches[0].netProfitTRY > matches[1].netProfitTRY);
});

test("karbon fiyatı: EEX ihale 85,89 €/t × 55,4997 TL/€ ≈ 4,77 TL/kg", () => {
  assert.ok(Math.abs(CARBON_PRICE_TRY_PER_KG - 4.7668) < 0.001);
});

test("karbon düzeltmesi: daha kârlı ama uzak alıcı geri düşebilir", () => {
  const far: Buyer = { ...testBase, id: "far", name: "Uzak", lat: 41.2, lng: 29.12 };
  const farMatch = matchBuyers({ quantityKg: 100, ...CITY_POINTS.ist }, goodQuality, [far])[0];
  // Yakın alıcının net kârı, uzak alıcının karbon maliyetinin yarısı kadar düşük.
  const nearNet = Math.round(farMatch.netProfitTRY - (farMatch.co2Kg * CARBON_PRICE_TRY_PER_KG) / 2);
  const near: Buyer = { ...testBase, id: "near", name: "Yakın", ...CITY_POINTS.ist, pricePerKg: priceForNetProfit(nearNet) };

  const matches = matchBuyers({ quantityKg: 100, ...CITY_POINTS.ist }, goodQuality, [far, near]);
  assert.deepEqual(matches.map((m) => m.buyer.id), ["near", "far"]);
  assert.ok(matches[1].netProfitTRY > matches[0].netProfitTRY);
});

test("eşit düzeltilmiş değerde kısa mesafe önde", () => {
  const far: Buyer = { ...testBase, id: "far", name: "Uzak", lat: 41.106, lng: 29.12 };
  const farMatch = matchBuyers({ quantityKg: 100, ...CITY_POINTS.ist }, goodQuality, [far])[0];
  const farValue = Math.round(farMatch.netProfitTRY - farMatch.co2Kg * CARBON_PRICE_TRY_PER_KG);
  const near: Buyer = { ...testBase, id: "near", name: "Yakın", ...CITY_POINTS.ist, pricePerKg: priceForNetProfit(farValue) };

  const matches = matchBuyers({ quantityKg: 100, ...CITY_POINTS.ist }, goodQuality, [far, near]);
  assert.equal(matches[0].netProfitTRY, farValue);
  assert.equal(matches[0].score, matches[1].score);
  assert.deepEqual(matches.map((m) => m.buyer.id), ["near", "far"]);
});

test("raf ömrü riskli eşleşme, daha kârlı olsa da güvenlinin önüne geçemez", () => {
  // Raf ömrü 2,03 gün: 0 km'de gereken 1 gün (+1 pay) → güvenli; ~20 km'de pay 1 günün altında → riskli.
  const tight = { ...goodQuality, estimatedShelfLifeDays: 2.03 };
  const buyers: Buyer[] = [
    { ...testBase, id: "risky", name: "Riskli", lat: 41.2, lng: 29.12, pricePerKg: 50 },
    { ...testBase, id: "safe", name: "Güvenli", ...CITY_POINTS.ist },
  ];
  const matches = matchBuyers({ quantityKg: 100, ...CITY_POINTS.ist }, tight, buyers);
  assert.deepEqual(matches.map((m) => m.buyer.id), ["safe", "risky"]);
  assert.deepEqual(matches.map((m) => m.shelfLifeRisk), [false, true]);
  assert.ok(matches[1].netProfitTRY > matches[0].netProfitTRY);
  assert.ok(matches[1].score <= 50, "riskli eşleşmenin skoru yarıya iner");
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

// ===== Faz A2: taşıma modu =====

test("varsayılan mod buyerOwn; aracı olan alıcıda taşıyıcı payı 0", () => {
  const listing = { quantityKg: 100, ...CITY_POINTS.ist };
  const matches = matchBuyers(listing, goodQuality, BUYERS);
  assert.deepEqual(matches, matchBuyers(listing, goodQuality, BUYERS, "buyerOwn"));
  const withVehicle = matches.filter((m) => m.buyer.hasOwnVehicle);
  assert.ok(withVehicle.length > 0);
  assert.ok(withVehicle.every((m) => m.transportMode === "buyerOwn" && m.carrierShareTRY === 0));
});

test("seed: her şehrin 2. kârlı alıcısının aracı yok", () => {
  assert.deepEqual(BUYERS.filter((b) => !b.hasOwnVehicle).map((b) => b.id), ["ist-2", "ank-2", "ayt-2"]);
});

test("aracı olmayan alıcı 'Alıcı teslim alır' görünümünde elenmez, taşıyıcıyla hesaplanır", () => {
  const listing = { quantityKg: 100, ...CITY_POINTS.ist };
  const own = matchBuyers(listing, goodQuality, BUYERS, "buyerOwn").find((m) => m.buyer.id === "ist-2");
  const carrier = matchBuyers(listing, goodQuality, BUYERS, "thirdParty").find((m) => m.buyer.id === "ist-2");
  assert.ok(own && carrier);
  assert.equal(own.transportMode, "thirdParty");
  assert.equal(own.transportCostTRY, 478);
  assert.equal(own.netProfitTRY, 332);
  assert.deepEqual({ ...own, score: 0 }, { ...carrier, score: 0 });
});

test("aracı olmayan alıcı taşıyıcıyla zarar ediyorsa elenir", () => {
  // 15 kg × 10 TL × 0,9 = 135 TL; 0 km: kendi araçla 50 TL (+85), taşıyıcıyla asgari 300 TL (zarar).
  const buyer: Buyer = { ...testBase, id: "b", name: "B", ...CITY_POINTS.ist };
  const listing = { quantityKg: 15, ...CITY_POINTS.ist };
  assert.equal(matchBuyers(listing, goodQuality, [buyer])[0].netProfitTRY, 85);
  const noVehicle = evaluateBuyers(listing, goodQuality, [{ ...buyer, hasOwnVehicle: false }]);
  assert.deepEqual(noVehicle.matches, []);
  assert.equal(noVehicle.eliminated.loss, 1);
});

test("önerilen eşleşme her alıcı için mümkün olan moda göre seçilir", () => {
  // İkisi de 0 km, 100 kg. A: 7 TL/kg → kendi araçla 580, taşıyıcıyla 330; B: 5 TL/kg, kendi araçla 400.
  const a: Buyer = { ...testBase, id: "a", name: "A", ...CITY_POINTS.ist, pricePerKg: 7 };
  const b: Buyer = { ...testBase, id: "b", name: "B", ...CITY_POINTS.ist, pricePerKg: 5 };
  const listing = { quantityKg: 100, ...CITY_POINTS.ist };
  assert.deepEqual(matchBuyers(listing, goodQuality, [a, b]).map((m) => m.buyer.id), ["a", "b"]);
  const ranked = matchBuyers(listing, goodQuality, [{ ...a, hasOwnVehicle: false }, b]);
  assert.deepEqual(ranked.map((m) => m.buyer.id), ["b", "a"]);
  assert.deepEqual(ranked.map((m) => m.netProfitTRY), [400, 330]);
});

test("boş dönüş: maliyet ve CO₂ tek yön araç-km × EMPTY_RETURN_FACTOR", () => {
  // İTÜ 12,9 km, panelvan: kendi araç 50 + 5 × 12,9 × 2 = 179 TL (eski 'dönüş dahil' 10 TL/km ile aynı).
  const listing = { quantityKg: 100, ...CITY_POINTS.ist };
  const own = matchBuyers(listing, goodQuality, BUYERS, "buyerOwn").find((m) => m.buyer.id === "ist-1");
  const carrier = matchBuyers(listing, goodQuality, BUYERS, "thirdParty").find((m) => m.buyer.id === "ist-1");
  assert.ok(own && carrier);
  assert.equal(EMPTY_RETURN_FACTOR, 2);
  assert.equal(own.transportCostTRY, 179);
  // Boş dönüş her iki modda CO₂'yi artırır: tek yön 0,25 × 12,9 = 3,2 → dönüşle 6,5.
  const oneWayCo2 = 12.9 * VEHICLE_CLASSES[0].emissionKgPerKm;
  for (const match of [own, carrier]) {
    assert.equal(match.co2Kg, 6.5);
    assert.ok(match.co2Kg > oneWayCo2);
  }
});

test("thirdParty maliyeti: (sabit + araç-km × mesafe × 2) × (1 + kâr payı)", () => {
  // Tuzla 23,2 km: (150 + 5 × 23,2 × 2) × 1,25 = 477,5 → 478 TL; taşıyıcı payı 382 × 0,25 = 95,5 → 96.
  const [carrier] = matchBuyers({ quantityKg: 100, ...CITY_POINTS.ist }, goodQuality, BUYERS, "thirdParty").filter(
    (m) => m.buyer.id === "ist-2"
  );
  assert.equal(carrier.transportMode, "thirdParty");
  assert.equal(carrier.transportCostTRY, 478);
  assert.equal(carrier.carrierShareTRY, 96);
  assert.equal(carrier.netProfitTRY, 810 - 478);
});

test("kısa mesafede taşıyıcının asgari sefer ücreti devreye girer", () => {
  // Antalya Teknokent 5 km: (150 + 5 × 5 × 2) × 1,25 = 250 < 300 → 300 TL.
  const [best] = matchBuyers({ quantityKg: 100, ...CITY_POINTS.ayt }, goodQuality, BUYERS, "thirdParty");
  assert.equal(best.buyer.id, "ayt-1");
  assert.equal(best.distanceKm, 5);
  assert.equal(best.transportCostTRY, CARRIER_MIN_FEE_TRY);
  assert.equal(best.carrierShareTRY, CARRIER_MIN_FEE_TRY - (CARRIER_FIXED_FEE_TRY + 5 * 5 * 2));
});

test("thirdParty, kendi araçta kârlı alıcıyı zarar nedeniyle eleyebilir", () => {
  // Ankara 15 kg: ODTÜ (7 km) kendi araçla +56 TL; taşıyıcıyla 300 TL asgari ücret > 176 TL değer.
  const listing = { quantityKg: 15, ...CITY_POINTS.ank };
  assert.deepEqual(ids(matchBuyers(listing, goodQuality, BUYERS, "buyerOwn")), ["ank-1"]);
  const carrier = evaluateBuyers(listing, goodQuality, BUYERS, "thirdParty");
  assert.deepEqual(carrier.matches, []);
  assert.deepEqual(carrier.eliminated, { distance: 1, industry: 0, shelfLife: 0, loss: 3 });
});

test("çoklu seferde taşıyıcı ücreti sefer sayısıyla çarpılır", () => {
  // 30.000 kg, kamyon × 3, İTÜ 12,9 km: 3 × (150 + 13 × 12,9 × 2) × 1,25 = 3 × 606,75 = 1.820,25.
  const [best] = matchBuyers({ quantityKg: 30_000, ...CITY_POINTS.ist }, goodQuality, BUYERS, "thirdParty");
  assert.equal(best.vehicle.trips, 3);
  assert.equal(best.transportCostTRY, 1820);
  assert.equal(best.co2Kg, 61.9); // 3 × 0,8 × 12,9 × 2
});
