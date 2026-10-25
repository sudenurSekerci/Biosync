import type {
  Buyer,
  EliminationSummary,
  Match,
  MatchListing,
  QualityResult,
  VehicleType,
} from "./schema.js";

// ===== DEMO VARSAYIMLARI =====
// Gerçek piyasa verisi değildir; prototipte davranışı göstermek için seçilmiş değerlerdir.

/** Eşleşmeye izin verilen en büyük kuş uçuşu mesafe (km). Bunu aşan alıcı listeye girmez. */
export const MAX_RADIUS_KM = 50;

/**
 * Araç sınıfları (küçükten büyüğe). Miktarı taşıyabilen en küçük araç seçilir; en büyük aracın
 * kapasitesi aşılırsa çoklu sefer yapılır (maliyet ve CO₂ sefer sayısıyla çarpılır).
 * - capacityKg:     tek seferde taşınabilecek yük.
 * - baseFeeTRY:     sabit sefer ücreti (araç çağırma, yükleme/boşaltma, şoför zamanı); mesafeden
 *                   bağımsız olduğu için 10-20 kg'lık partilerde uzak alıcılar doğal olarak zarara düşer.
 * - costPerKmTRY:   araç-km maliyeti (yakıt + aşınma), dönüş yolu dahil; tek yön mesafe ile çarpılır.
 * - emissionKgPerKm: kg CO₂ / km, dönüş yolu dahil (yaklaşık: panelvan ≈0,25, kamyonet ≈0,4,
 *                   kamyon ≈0,8 kg/km tek yön × 2); taşınan miktardan bağımsız (araç bazlı).
 */
export const VEHICLE_CLASSES: readonly VehicleClass[] = [
  { type: "hafif_ticari", label: "Hafif ticari (panelvan)", capacityKg: 1_000, baseFeeTRY: 50, costPerKmTRY: 10, emissionKgPerKm: 0.5 },
  { type: "kamyonet", label: "Kamyonet", capacityKg: 3_500, baseFeeTRY: 150, costPerKmTRY: 16, emissionKgPerKm: 0.8 },
  { type: "kamyon", label: "Kamyon", capacityKg: 12_000, baseFeeTRY: 400, costPerKmTRY: 26, emissionKgPerKm: 1.6 },
];

/** Toplama + işleme için gereken asgari süre (gün). Raf ömrü bunun altındaysa eşleşme olmaz. */
export const HANDLING_DAYS = 1;

/** Yol süresi tahmini: ortalama hız (km/sa) × günlük sürüş saati. */
export const AVG_SPEED_KMH = 40;
export const DRIVING_HOURS_PER_DAY = 8;

/** Raf ömrü, gereken süreyi bu kadar günden az aşıyorsa skor yarıya iner (riskli eşleşme). */
export const SHELF_LIFE_BUFFER_DAYS = 1;

/**
 * Çöplükten çevrilen her kg organik yan ürün için önlenen emisyon (kg CO₂e / kg). TAHMİNİDİR.
 * Kaynak: ABD EPA, "Modeling Food Donation Benefits in EPA's Waste Reduction Model" (WARM v15, Haziran 2019),
 * Tablo 1, düşük tahmin (yalnızca önlenen çöplüğe gönderme): "Fruits and Vegetables" = 0,54 MTCO2E / kısa ton.
 * https://19january2021snapshot.epa.gov/sites/static/files/2019-06/documents/warm_v15_food_donation_guidance.pdf
 * Dönüşüm: 1 kısa ton = 0,90718474 metrik ton → 0,54 / 0,90718474 ≈ 0,595 kg CO₂e / kg.
 * Varsayım: ABD ortalama çöplük gazı toplama koşulları; Türkiye'deki değer farklı olabilir.
 * Alıcının işleme emisyonu hesaba katılmaz.
 */
export const AVOIDED_LANDFILL_KG_CO2E_PER_KG = 0.54 / 0.90718474;

/**
 * Sıralamada taşıma CO₂'sinin parasal karşılığı (TL / kg CO₂). DEMO VARSAYIMI: Türkiye'de bu
 * taşımaya uygulanan bir karbon fiyatı yoktur; referans olarak AB ETS fiyatı TL'ye çevrilmiştir.
 * - AB ETS (EUA) uzlaşma fiyatı: 85,92 € / t CO₂, 23 Ekim 2026
 *   (https://www.purelyenergy.co.uk/tools/carbon/eu-ets, 25 Ekim 2026'da erişildi).
 * - EUR/TRY: 55,4997 TL, TCMB gösterge döviz alış kuru, 23.10.2026, bülten 2026/201
 *   (https://www.tcmb.gov.tr/kurlar/202610/23102026.xml).
 * 85,92 × 55,4997 / 1000 ≈ 4,77 TL / kg CO₂. Yalnızca sıralamayı etkiler; net kâra eklenmez.
 */
export const CARBON_PRICE_TL_PER_KG = (85.92 * 55.4997) / 1000;

/**
 * Elenen alıcı özetine yalnızca bu mesafedeki alıcılar girer. Daha uzaktakiler
 * (örn. başka şehirdeki alıcılar) "bölge dışı" sayılır ve özette gösterilmez.
 */
export const NEARBY_CONTEXT_KM = 100;

// ==============================

const EARTH_RADIUS_KM = 6371;

/** İki nokta arası kuş uçuşu mesafe (Haversine), km. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

const round = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

type VehicleClass = {
  type: VehicleType;
  label: string;
  capacityKg: number;
  baseFeeTRY: number;
  costPerKmTRY: number;
  emissionKgPerKm: number;
};

/** Miktarı taşıyabilen en küçük araç; hiçbiri tek seferde taşıyamıyorsa en büyük araçla çoklu sefer. */
export function selectVehicle(quantityKg: number): { vehicle: VehicleClass; trips: number } {
  const fitting = VEHICLE_CLASSES.find((vehicle) => quantityKg <= vehicle.capacityKg);
  if (fitting) return { vehicle: fitting, trips: 1 };
  const largest = VEHICLE_CLASSES[VEHICLE_CLASSES.length - 1];
  return { vehicle: largest, trips: Math.ceil(quantityKg / largest.capacityKg) };
}

/**
 * Saf fonksiyon: aynı girdiye her zaman aynı çıktı, yan etki yok.
 * Eşleşmeleri ve elenen alıcıların sebebe göre sayısını döner.
 * Sıralama: önce raf ömrü güvenli olanlar; sonra karbon düzeltmeli değer
 * (netProfit − co2Kg × CARBON_PRICE_TL_PER_KG, TL'ye yuvarlı) yüksekten düşüğe; eşitlikte mesafe kısa olan.
 * score (0-100) yalnızca gösterim içindir: en iyi düzeltilmiş değere oranı × raf ömrü katsayısı.
 */
export function evaluateBuyers(
  listing: MatchListing,
  quality: QualityResult,
  buyers: Buyer[]
): { matches: Match[]; eliminated: EliminationSummary } {
  const eliminated: EliminationSummary = { distance: 0, industry: 0, shelfLife: 0, loss: 0 };
  if (!quality.isOrganicByproduct) return { matches: [], eliminated };

  const candidates: Array<Omit<Match, "score"> & { rankValueTRY: number }> = [];
  // Araç yalnızca miktara bağlı: tüm alıcılar için aynı.
  const { vehicle, trips } = selectVehicle(listing.quantityKg);

  for (const buyer of buyers) {
    const distanceKm = round(haversineKm(listing.lat, listing.lng, buyer.lat, buyer.lng), 1);
    if (distanceKm > NEARBY_CONTEXT_KM) continue; // bölge dışı: özete de girmez
    if (distanceKm > MAX_RADIUS_KM) {
      eliminated.distance++;
      continue;
    }

    if (!buyer.industries.some((industry) => quality.suitableIndustries.includes(industry))) {
      eliminated.industry++;
      continue;
    }

    const requiredDays = HANDLING_DAYS + distanceKm / (AVG_SPEED_KMH * DRIVING_HOURS_PER_DAY);
    if (quality.estimatedShelfLifeDays < requiredDays) {
      eliminated.shelfLife++;
      continue;
    }
    const shelfLifeRisk = quality.estimatedShelfLifeDays < requiredDays + SHELF_LIFE_BUFFER_DAYS;

    const transportCostTRY = round(trips * (vehicle.baseFeeTRY + vehicle.costPerKmTRY * distanceKm), 0);
    const materialValueTRY = round(
      listing.quantityKg * buyer.pricePerKg * (quality.qualityScore / 100),
      0
    );
    const netProfitTRY = materialValueTRY - transportCostTRY;
    if (netProfitTRY <= 0) {
      eliminated.loss++;
      continue;
    }

    const co2Kg = round(trips * distanceKm * vehicle.emissionKgPerKm, 1);
    // Net iklim etkisi = önlenen çöplük emisyonu − taşıma CO₂ (pozitif = tasarruf).
    const netImpactCo2eKg = round(listing.quantityKg * AVOIDED_LANDFILL_KG_CO2E_PER_KG - co2Kg, 1);
    candidates.push({
      buyer,
      distanceKm,
      transportCostTRY,
      materialValueTRY,
      netProfitTRY,
      co2Kg,
      netImpactCo2eKg,
      vehicle: { type: vehicle.type, label: vehicle.label, trips },
      shelfLifeRisk,
      rankValueTRY: round(netProfitTRY - co2Kg * CARBON_PRICE_TL_PER_KG, 0),
    });
  }

  candidates.sort(
    (a, b) =>
      Number(a.shelfLifeRisk) - Number(b.shelfLifeRisk) ||
      b.rankValueTRY - a.rankValueTRY ||
      a.distanceKm - b.distanceKm
  );

  const bestValue = Math.max(0, ...candidates.map((c) => c.rankValueTRY));
  const matches = candidates.map(({ rankValueTRY, ...match }) => ({
    ...match,
    score:
      bestValue > 0
        ? Math.max(0, Math.round((rankValueTRY / bestValue) * 100 * (match.shelfLifeRisk ? 0.5 : 1)))
        : 0,
  }));
  return { matches, eliminated };
}

/** CLAUDE.md §6 imzası: yalnızca sıralı eşleşmeler. */
export function matchBuyers(listing: MatchListing, quality: QualityResult, buyers: Buyer[]): Match[] {
  return evaluateBuyers(listing, quality, buyers).matches;
}
