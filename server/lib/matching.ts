import type { Buyer, EliminationSummary, Match, MatchListing, QualityResult } from "./schema.js";

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

/**
 * Saf fonksiyon: aynı girdiye her zaman aynı çıktı, yan etki yok.
 * Eşleşmeleri ve elenen alıcıların sebebe göre sayısını döner.
 * Sıralama: netProfit yüksekten düşüğe, eşitlikte co2Kg düşükten yükseğe.
 * score (0-100) yalnızca gösterim içindir: en iyi net kâra oranı × raf ömrü katsayısı.
 */
export function evaluateBuyers(
  listing: MatchListing,
  quality: QualityResult,
  buyers: Buyer[]
): { matches: Match[]; eliminated: EliminationSummary } {
  const eliminated: EliminationSummary = { distance: 0, industry: 0, shelfLife: 0, loss: 0 };
  if (!quality.isOrganicByproduct) return { matches: [], eliminated };

  const candidates: Array<Omit<Match, "score"> & { freshness: number }> = [];

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
    const freshness = quality.estimatedShelfLifeDays < requiredDays + SHELF_LIFE_BUFFER_DAYS ? 0.5 : 1;

    const transportCostTRY = round(TRIP_BASE_FEE_TRY + COST_PER_VEHICLE_KM_TRY * distanceKm, 0);
    const materialValueTRY = round(
      listing.quantityKg * buyer.pricePerKg * (quality.qualityScore / 100),
      0
    );
    const netProfitTRY = materialValueTRY - transportCostTRY;
    if (netProfitTRY <= 0) {
      eliminated.loss++;
      continue;
    }

    const co2Kg = round(distanceKm * EMISSION_KG_PER_VEHICLE_KM, 1);
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
      freshness,
    });
  }

  candidates.sort((a, b) => b.netProfitTRY - a.netProfitTRY || a.co2Kg - b.co2Kg);

  const bestProfit = candidates[0]?.netProfitTRY ?? 0;
  const matches = candidates.map(({ freshness, ...match }) => ({
    ...match,
    score: bestProfit > 0 ? Math.round((match.netProfitTRY / bestProfit) * 100 * freshness) : 0,
  }));
  return { matches, eliminated };
}

/** CLAUDE.md §6 imzası: yalnızca sıralı eşleşmeler. */
export function matchBuyers(listing: MatchListing, quality: QualityResult, buyers: Buyer[]): Match[] {
  return evaluateBuyers(listing, quality, buyers).matches;
}
