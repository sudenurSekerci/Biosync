import { z } from "zod";

// Tek kaynak: mobil (app/src/types.ts) tipleri buradan `import type` ile alır.
// Faz 2'de Gemini yanıtı qualityResultSchema ile doğrulanır.

export const INDUSTRIES = [
  "biyoplastik",
  "3d_filament",
  "vegan_deri",
  "kozmetik",
  "alternatif_gida",
] as const;

export const industrySchema = z.enum(INDUSTRIES);

export const spoilageStatusSchema = z.enum(["taze", "hafif_bozulmus", "bozulmus"]);

// .describe() metinleri Gemini'ye giden JSON şemasında alan açıklaması olarak kullanılır.
export const qualityResultSchema = z.object({
  productType: z.string().min(1).describe("Ürün türü, Türkçe (örn. portakal kabuğu)"),
  // false ise ilan eşleştirmeye girmez (Faz 3).
  isOrganicByproduct: z
    .boolean()
    .describe("Fotoğrafta organik (tarımsal/gıda kökenli) bir yan ürün var mı"),
  qualityScore: z.number().min(0).max(100).describe("Kalite Güven Puanı, 0-100"),
  spoilageStatus: spoilageStatusSchema,
  estimatedShelfLifeDays: z.number().min(0).describe("Tahmini kalan raf ömrü, gün"),
  suitableIndustries: z
    .array(industrySchema)
    .max(3)
    .describe("En uygun 1-3 endüstri, en uygundan başlayarak; organik yan ürün değilse boş"),
  summary: z
    .string()
    .min(1)
    .describe("1-2 cümlelik Türkçe değerlendirme; düşük puanda sebebini açıkla"),
});

export const listingSchema = z.object({
  wasteType: z.string().min(1),
  quantityKg: z.number().positive(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  imageBase64: z.string().min(1),
  mimeType: z.string().min(1),
});

// POST /match: görsel yeniden gönderilmez; yalnızca eşleştirmeye gereken alanlar.
export const matchRequestSchema = z.object({
  quantityKg: listingSchema.shape.quantityKg,
  lat: listingSchema.shape.lat,
  lng: listingSchema.shape.lng,
  quality: qualityResultSchema,
});

// Sunucu tarafında üretilir (mock veri + saf hesap), bu yüzden zod doğrulaması gerekmez.
export type Buyer = {
  id: string;
  name: string;
  industries: Industry[];
  lat: number;
  lng: number;
  pricePerKg: number;
  locationName: string; // gerçek sanayi bölgesi/teknopark adı; alıcının kendisi kurgusal
  isFictional: true;
};

export type VehicleType = "hafif_ticari" | "kamyonet" | "kamyon";

export type Match = {
  buyer: Buyer;
  distanceKm: number;
  transportCostTRY: number;
  materialValueTRY: number;
  netProfitTRY: number;
  co2Kg: number;
  netImpactCo2eKg: number; // tahmini: önlenen çöplük emisyonu − taşıma CO₂ (pozitif = tasarruf)
  vehicle: { type: VehicleType; label: string; trips: number }; // miktara göre seçilen araç
  score: number;
};

// Elenen alıcı sayıları (yalnızca NEARBY_CONTEXT_KM içindeki alıcılar sayılır).
export type EliminationSummary = { distance: number; industry: number; shelfLife: number; loss: number };

// MAX_RADIUS_KM tek yerde (lib/matching.ts) tanımlı; harita dairesi için yanıtla gönderilir.
export type MatchResponse = { radiusKm: number; matches: Match[]; eliminated: EliminationSummary };

export type Industry = z.infer<typeof industrySchema>;
export type SpoilageStatus = z.infer<typeof spoilageStatusSchema>;
export type QualityResult = z.infer<typeof qualityResultSchema>;
export type Listing = z.infer<typeof listingSchema>;
export type MatchRequest = z.infer<typeof matchRequestSchema>;
export type MatchListing = Pick<Listing, "quantityKg" | "lat" | "lng">;
