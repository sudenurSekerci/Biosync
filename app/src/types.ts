// Tipler server/lib/schema.ts'teki zod şemalarından türetilir (tek kaynak).
// Sadece tip import'u: çalışma zamanında zod mobil pakete girmez.
import type { Industry, ModeResult, TransportMode } from "../../server/lib/schema";

export type {
  Industry,
  SpoilageStatus,
  QualityResult,
  Listing,
  Buyer,
  Match,
  MatchResponse,
  EliminationSummary,
  ModeResult,
  TransportMode,
} from "../../server/lib/schema";

export const TRANSPORT_MODE_LABELS: Record<TransportMode, string> = {
  buyerOwn: "Alıcı teslim alır",
  thirdParty: "Taşıyıcı firma",
};

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
  | { status: "done"; radiusKm: number; byMode: Record<TransportMode, ModeResult> };

export const INDUSTRY_LABELS: Record<Industry, string> = {
  biyoplastik: "Biyoplastik",
  "3d_filament": "3D Filament",
  vegan_deri: "Vegan Deri",
  kozmetik: "Kozmetik",
  alternatif_gida: "Alternatif Gıda",
};
