// Tipler server/lib/schema.ts'teki zod şemalarından türetilir (tek kaynak).
// Sadece tip import'u: çalışma zamanında zod mobil pakete girmez.
import type { EliminationSummary, Industry, Match } from "../../server/lib/schema";

export type {
  Industry,
  SpoilageStatus,
  QualityResult,
  Listing,
  Buyer,
  Match,
  MatchResponse,
  EliminationSummary,
} from "../../server/lib/schema";

export type Step = "form" | "loading" | "result";

// Teklif simülasyonu (demo): ilan başına tek teklif; "sent" → birkaç sn sonra "accepted".
export type Offer = { buyerId: string; buyerName: string; status: "sent" | "accepted" };

// Oturum etki sayacı: kabul edilen tekliflerin toplamı. Kalıcı değildir (uygulama kapanınca sıfırlanır).
export type SessionImpact = { acceptedOffers: number; wasteKg: number; netCo2eKg: number };

// Sonuç ekranındaki eşleştirme bölümünün durumu. "skipped": organik değil, eşleştirme çağrılmadı.
export type MatchState =
  | { status: "skipped" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "done"; radiusKm: number; matches: Match[]; eliminated: EliminationSummary };

export const INDUSTRY_LABELS: Record<Industry, string> = {
  biyoplastik: "Biyoplastik",
  "3d_filament": "3D Filament",
  vegan_deri: "Vegan Deri",
  kozmetik: "Kozmetik",
  alternatif_gida: "Alternatif Gıda",
};
