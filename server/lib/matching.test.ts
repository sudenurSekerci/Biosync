import { test } from "node:test";
import assert from "node:assert/strict";
import { BUYERS } from "../data/buyers";
import { evaluateBuyers, haversineKm, MAX_RADIUS_KM, matchBuyers } from "./matching";
import { INDUSTRIES, type Buyer, type QualityResult } from "./schema";

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
  assert.equal(matches[0].score, 50);
});

test("sıralama: netProfit azalan, eşitlikte co2 artan; ilk skor 100", () => {
  const base = { industries: ["kozmetik" as const], pricePerKg: 10, locationName: "test", isFictional: true as const };
  // Aynı fiyat; daha uzak alıcı daha az kâr ve daha çok CO₂.
  const buyers: Buyer[] = [
    { ...base, id: "far", name: "Uzak", lat: 41.2, lng: 29.12 },
    { ...base, id: "near", name: "Yakın", lat: 41.05, lng: 29.12 },
  ];
  const matches = matchBuyers({ quantityKg: 100, ...CITY_POINTS.ist }, goodQuality, buyers);
  assert.deepEqual(matches.map((m) => m.buyer.id), ["near", "far"]);
  assert.equal(matches[0].score, 100);
  assert.ok(matches[0].netProfitTRY > matches[1].netProfitTRY);

  // Eşit net kâr: fiyat farkı mesafe farkını tam dengeliyor → CO₂ düşük olan önde.
  const tie: Buyer[] = [
    { ...base, id: "tie-far", name: "A", lat: 41.106, lng: 29.12, pricePerKg: 10 },
    { ...base, id: "tie-near", name: "B", lat: 41.016, lng: 29.12, pricePerKg: 0 },
  ];
  // tie-near demo noktasında (0 km → taşıma = sabit sefer ücreti 50 TL); fiyatını tie-far'ın
  // net kârını tutturacak şekilde seç (100 kg × fiyat × 0,9 kalite = net kâr + 50).
  const farMatch = matchBuyers({ quantityKg: 100, ...CITY_POINTS.ist }, goodQuality, [tie[0]])[0];
  const pricePerKgForTie = (farMatch.netProfitTRY + 50) / 90;
  const tieMatches = matchBuyers({ quantityKg: 100, ...CITY_POINTS.ist }, goodQuality, [
    tie[0],
    { ...tie[1], pricePerKg: pricePerKgForTie },
  ]);
  assert.equal(tieMatches[0].netProfitTRY, tieMatches[1].netProfitTRY);
  assert.deepEqual(tieMatches.map((m) => m.buyer.id), ["tie-near", "tie-far"]);
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
