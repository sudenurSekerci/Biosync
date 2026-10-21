import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { qualityResultSchema, type QualityResult } from "./schema.js";

const TIMEOUT_MS = 30_000;

// CLAUDE.md §7'deki sabit prompt + Faz 2 ekleri (Türkçe metin, organik değilse düşük puan ve sebep,
// en uygun 1-3 endüstri sıralı).
const SYSTEM_PROMPT =
  "Sen bir endüstriyel hammadde ve tarım kalite uzmanısın. Fotoğraftaki tarımsal yan ürünün türünü belirle, kalite standardını ve bozulma durumunu analiz et, kalan raf ömrünü tahmin et, 0-100 arası 'Kalite Güven Puanı' ver ve uygun olduğu endüstrileri (biyoplastik, 3d_filament, vegan_deri, kozmetik, alternatif_gida) seç. Fotoğrafta tarımsal yan ürün yoksa qualityScore 0 ver. Sadece şemaya uygun JSON dön." +
  " Tüm metin alanlarını (productType, summary) Türkçe yaz; summary 1-2 cümle olsun." +
  " Fotoğraf organik bir yan ürün değilse (ör. plastik, metal, insan, ekran görüntüsü) isOrganicByproduct false olsun, düşük puan ver, suitableIndustries listesini boş bırak ve summary içinde sebebini açıkla." +
  " suitableIndustries için tüm endüstrileri listeleme; yalnızca en uygun 1 ila 3 endüstriyi, en uygundan başlayarak uygunluk sırasına göre seç.";

// Gemini responseJsonSchema yalnızca bu anahtarları destekler (SDK dokümanı); gerisi ayıklanır.
const SUPPORTED_SCHEMA_KEYS = new Set([
  "$id", "$defs", "$ref", "$anchor", "type", "format", "title", "description", "enum",
  "items", "prefixItems", "minItems", "maxItems", "minimum", "maximum", "anyOf", "oneOf",
  "properties", "additionalProperties", "required", "propertyOrdering",
]);

function toGeminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  if (node === null || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (!SUPPORTED_SCHEMA_KEYS.has(key)) continue;
    if (key === "properties" || key === "$defs") {
      out[key] = Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, toGeminiSchema(v)])
      );
    } else if (key === "enum" || key === "required" || key === "propertyOrdering") {
      out[key] = value;
    } else {
      out[key] = toGeminiSchema(value);
    }
  }
  return out;
}

const RESPONSE_JSON_SCHEMA = toGeminiSchema(z.toJSONSchema(qualityResultSchema));

export class GeminiError extends Error {
  constructor(
    public status: number,
    message: string,
    public logDetail?: string
  ) {
    super(message);
  }
}

// Log satırlarına anahtar veya base64 sızmasın diye: kısalt, anahtarı ve uzun base64 dizilerini maskele.
function safeForLog(text: string): string {
  let out = text;
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) out = out.split(apiKey).join("[GİZLİ]");
  out = out.replace(/[A-Za-z0-9+/=]{100,}/g, "[base64]");
  return out.length > 300 ? `${out.slice(0, 300)}…` : out;
}

let client: GoogleGenAI | null = null;

function getConfig(): { ai: GoogleGenAI; model: string } {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!apiKey || !model) {
    throw new GeminiError(500, "Sunucu yapılandırması eksik: GEMINI_API_KEY ve GEMINI_MODEL .env içinde tanımlı olmalı.");
  }
  client ??= new GoogleGenAI({ apiKey });
  return { ai: client, model };
}

function mapApiError(err: ApiError): GeminiError {
  const detail = `Gemini ApiError ${err.status}: ${safeForLog(err.message)}`;
  // Geçersiz anahtar Google'da 400 + API_KEY_INVALID olarak döner.
  if (err.status === 401 || err.status === 403 || err.message.includes("API_KEY_INVALID")) {
    return new GeminiError(502, "AI servisi isteği reddetti (API anahtarını kontrol edin).", detail);
  }
  if (err.status === 404) {
    return new GeminiError(502, "AI modeli bulunamadı (GEMINI_MODEL değerini kontrol edin).", detail);
  }
  if (err.status === 429) {
    return new GeminiError(502, "AI servisinin kullanım sınırı aşıldı. Biraz sonra tekrar deneyin.", detail);
  }
  return new GeminiError(502, "AI servisi şu an yanıt veremiyor. Lütfen tekrar deneyin.", detail);
}

type AnalyzeInput = { imageBase64: string; mimeType: string; wasteType: string };

export async function analyzeImage({ imageBase64, mimeType, wasteType }: AnalyzeInput): Promise<QualityResult> {
  const { ai, model } = getConfig();
  const signal = AbortSignal.timeout(TIMEOUT_MS);

  let text: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            {
              text: `Kullanıcının beyan ettiği atık türü: "${wasteType.slice(0, 100)}". Beyanı fotoğrafla doğrula; uyuşmuyorsa fotoğraftakini esas al.`,
            },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: RESPONSE_JSON_SCHEMA,
        temperature: 0.2,
        abortSignal: signal,
      },
    });
    text = response.text;
  } catch (err) {
    if (signal.aborted) {
      throw new GeminiError(504, "AI analizi 30 saniye içinde tamamlanamadı. Lütfen tekrar deneyin.");
    }
    if (err instanceof ApiError) throw mapApiError(err);
    const detail = err instanceof Error ? `${err.name}: ${safeForLog(err.message)}` : "bilinmeyen hata";
    throw new GeminiError(502, "AI servisine ulaşılamadı. Lütfen tekrar deneyin.", detail);
  }

  if (!text) {
    throw new GeminiError(502, "AI boş yanıt döndürdü. Lütfen tekrar deneyin.");
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new GeminiError(502, "AI yanıtı geçerli JSON değil. Lütfen tekrar deneyin.");
  }

  const parsed = qualityResultSchema.safeParse(json);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".") || "(kök)"))];
    throw new GeminiError(
      502,
      "AI yanıtı beklenen formata uymuyor. Lütfen tekrar deneyin.",
      `şema doğrulaması başarısız: ${fields.join(", ")}`
    );
  }
  return parsed.data;
}
