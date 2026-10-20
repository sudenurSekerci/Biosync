// Tipler server/lib/schema.ts'teki zod şemalarından türetilir (tek kaynak).
// Sadece tip import'u: çalışma zamanında zod mobil pakete girmez.
export type {
  Industry,
  SpoilageStatus,
  QualityResult,
  Listing,
} from "../../server/lib/schema";

export type Step = "form" | "loading" | "result";
