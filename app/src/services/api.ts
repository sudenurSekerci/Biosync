import type { Listing, QualityResult } from "../types";

// app/.env → EXPO_PUBLIC_API_URL (telefonda bilgisayarın LAN IP'si, örn. http://192.168.1.108:3000)
const API_URL = process.env.EXPO_PUBLIC_API_URL;

// Sunucunun Gemini zaman aşımı 30 sn; ağ payıyla biraz üstü.
const REQUEST_TIMEOUT_MS = 35_000;

function errorMessageFrom(body: unknown): string | null {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return null;
}

export async function analyzeListing(listing: Listing): Promise<QualityResult> {
  if (!API_URL) {
    throw new Error("Sunucu adresi ayarlı değil. app/.env içinde EXPO_PUBLIC_API_URL tanımlayın.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(listing),
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
  // Yanıt sunucuda qualityResultSchema (zod) ile doğrulandı.
  return body as QualityResult;
}
