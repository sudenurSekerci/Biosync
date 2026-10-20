import type { Listing, MatchResponse, QualityResult } from "../types";

// app/.env → EXPO_PUBLIC_API_URL (telefonda bilgisayarın LAN IP'si, örn. http://192.168.1.108:3000)
const API_URL = process.env.EXPO_PUBLIC_API_URL;

// Sunucunun Gemini zaman aşımı 30 sn; ağ payıyla biraz üstü.
const ANALYZE_TIMEOUT_MS = 35_000;
const MATCH_TIMEOUT_MS = 15_000;

function errorMessageFrom(body: unknown): string | null {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return null;
}

async function postJson(path: string, payload: unknown, timeoutMs: number): Promise<unknown> {
  if (!API_URL) {
    throw new Error("Sunucu adresi ayarlı değil. app/.env içinde EXPO_PUBLIC_API_URL tanımlayın.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    throw new Error(
      controller.signal.aborted
        ? "Sunucu zamanında yanıt vermedi. Lütfen tekrar deneyin."
        : "Sunucuya bağlanılamadı. İnternet bağlantınızı ve sunucunun açık olduğunu kontrol edin."
    );
  } finally {
    clearTimeout(timer);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(errorMessageFrom(body) ?? `Sunucu hatası (${response.status}).`);
  }
  if (body === null) {
    throw new Error("Sunucudan geçersiz yanıt geldi.");
  }
  return body;
}

export async function analyzeListing(listing: Listing): Promise<QualityResult> {
  // Yanıt sunucuda qualityResultSchema (zod) ile doğrulandı.
  return (await postJson("/analyze", listing, ANALYZE_TIMEOUT_MS)) as QualityResult;
}

export async function findMatches(listing: Listing, quality: QualityResult): Promise<MatchResponse> {
  // Görsel tekrar gönderilmez; eşleştirme yalnızca miktar, konum ve kalite sonucunu kullanır.
  const payload = { quantityKg: listing.quantityKg, lat: listing.lat, lng: listing.lng, quality };
  return (await postJson("/match", payload, MATCH_TIMEOUT_MS)) as MatchResponse;
}
