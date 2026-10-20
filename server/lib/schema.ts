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

export const qualityResultSchema = z.object({
  productType: z.string().min(1),
  qualityScore: z.number().min(0).max(100),
  spoilageStatus: spoilageStatusSchema,
  estimatedShelfLifeDays: z.number().min(0),
  suitableIndustries: z.array(industrySchema),
  summary: z.string().min(1),
});

export const listingSchema = z.object({
  wasteType: z.string().min(1),
  quantityKg: z.number().positive(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  imageBase64: z.string().min(1),
  mimeType: z.string().min(1),
});

export type Industry = z.infer<typeof industrySchema>;
export type SpoilageStatus = z.infer<typeof spoilageStatusSchema>;
export type QualityResult = z.infer<typeof qualityResultSchema>;
export type Listing = z.infer<typeof listingSchema>;
