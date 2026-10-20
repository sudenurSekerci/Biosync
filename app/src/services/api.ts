import type { Listing, QualityResult } from "../types";

// Faz 1: sahte analiz. Faz 2'de bu gövde POST /analyze çağrısıyla değişecek.
const MOCK_DELAY_MS = 2000;

export const MOCK_QUALITY_RESULT: QualityResult = {
  productType: "portakal kabuğu",
  qualityScore: 86,
  spoilageStatus: "taze",
  estimatedShelfLifeDays: 5,
  suitableIndustries: ["biyoplastik", "kozmetik", "alternatif_gida"],
  summary:
    "Kabuklar temiz ve nemli görünüyor, küf belirtisi yok. Pektin ve uçucu yağ eldesi için uygun.",
};

export async function analyzeListing(_listing: Listing): Promise<QualityResult> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
  return MOCK_QUALITY_RESULT;
}
