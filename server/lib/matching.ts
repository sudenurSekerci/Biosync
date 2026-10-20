import type { Buyer, Match, MatchListing, QualityResult } from "./schema";

// ===== DEMO VARSAYIMLARI =====
// Gerçek piyasa verisi değildir; prototipte davranışı göstermek için seçilmiş değerlerdir.

/** Eşleşmeye izin verilen en büyük kuş uçuşu mesafe (km). Bunu aşan alıcı listeye girmez. */
export const MAX_RADIUS_KM = 50;

/**
 * Sabit sefer ücreti (TL): araç çağırma, yükleme/boşaltma, şoför zamanı.
 * Mesafeden bağımsızdır; bu yüzden 10-20 kg gibi küçük partilerde yalnızca çok yakın
 * alıcılar kârlı kalır, uzaklar doğal olarak zarara düşer.
 */
export const TRIP_BASE_FEE_TRY = 50;

/**
 * Araç-km maliyeti (TL / km): hafif ticari araç, yakıt + aşınma.
 * Dönüş yolu dahildir (≈5 TL/km × 2); tek yön mesafe ile çarpılır.
 */
export const COST_PER_VEHICLE_KM_TRY = 10;

/**
 * Emisyon faktörü (kg CO₂ / km): hafif ticari dizel araç ≈0,25 kg/km, dönüş yolu dahil × 2.
 * Tek yön mesafe ile çarpılır. Taşınan miktardan bağımsızdır (araç bazlı).
 */
export const EMISSION_KG_PER_VEHICLE_KM = 0.5;

/** Toplama + işleme için gereken asgari süre (gün). Raf ömrü bunun altındaysa eşleşme olmaz. */
export const HANDLING_DAYS = 1;

/** Yol süresi tahmini: ortalama hız (km/sa) × günlük sürüş saati. */
export const AVG_SPEED_KMH = 40;
export const DRIVING_HOURS_PER_DAY = 8;

/** Raf ömrü, gereken süreyi bu kadar günden az aşıyorsa skor yarıya iner (riskli eşleşme). */
export const SHELF_LIFE_BUFFER_DAYS = 1;

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

/**
 * Saf fonksiyon: aynı girdiye her zaman aynı çıktı, yan etki yok.
 * Sıralama: netProfit yüksekten düşüğe, eşitlikte co2Kg düşükten yükseğe.
 * score (0-100) yalnızca gösterim içindir: en iyi net kâra oranı × raf ömrü katsayısı.
 */
export function matchBuyers(listing: MatchListing, quality: QualityResult, buyers: Buyer[]): Match[] {
  if (!quality.isOrganicByproduct) return [];

  const candidates: Array<Omit<Match, "score"> & { freshness: number }> = [];

  for (const buyer of buyers) {
    if (!buyer.industries.some((industry) => quality.suitableIndustries.includes(industry))) continue;

    const distanceKm = round(haversineKm(listing.lat, listing.lng, buyer.lat, buyer.lng), 1);
    if (distanceKm > MAX_RADIUS_KM) continue;

    const requiredDays = HANDLING_DAYS + distanceKm / (AVG_SPEED_KMH * DRIVING_HOURS_PER_DAY);
    if (quality.estimatedShelfLifeDays < requiredDays) continue;
    const freshness = quality.estimatedShelfLifeDays < requiredDays + SHELF_LIFE_BUFFER_DAYS ? 0.5 : 1;

    const transportCostTRY = round(TRIP_BASE_FEE_TRY + COST_PER_VEHICLE_KM_TRY * distanceKm, 0);
    const materialValueTRY = round(
      listing.quantityKg * buyer.pricePerKg * (quality.qualityScore / 100),
      0
    );
    const netProfitTRY = materialValueTRY - transportCostTRY;
    if (netProfitTRY <= 0) continue;

    const co2Kg = round(distanceKm * EMISSION_KG_PER_VEHICLE_KM, 1);
    candidates.push({ buyer, distanceKm, transportCostTRY, materialValueTRY, netProfitTRY, co2Kg, freshness });
  }

  candidates.sort((a, b) => b.netProfitTRY - a.netProfitTRY || a.co2Kg - b.co2Kg);

  const bestProfit = candidates[0]?.netProfitTRY ?? 0;
  return candidates.map(({ freshness, ...match }) => ({
    ...match,
    score: bestProfit > 0 ? Math.round((match.netProfitTRY / bestProfit) * 100 * freshness) : 0,
  }));
}
