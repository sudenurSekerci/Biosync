// Tipler server/lib/schema.ts'teki zod şemalarından türetilir (tek kaynak).
// Sadece tip import'u: çalışma zamanında zod mobil pakete girmez.
import type { Industry, Match } from "../../server/lib/schema";

export type {
  Industry,
  SpoilageStatus,
  QualityResult,
  Listing,
  Buyer,
  Match,
  MatchResponse,
} from "../../server/lib/schema";

export type Step = "form" | "loading" | "result";

// Sonuç ekranındaki eşleştirme bölümünün durumu. "skipped": organik değil, eşleştirme çağrılmadı.
export type MatchState =
  | { status: "skipped" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "done"; radiusKm: number; matches: Match[] };

export const INDUSTRY_LABELS: Record<Industry, string> = {
  biyoplastik: "Biyoplastik",
  "3d_filament": "3D Filament",
  vegan_deri: "Vegan Deri",
  kozmetik: "Kozmetik",
  alternatif_gida: "Alternatif Gıda",
};
