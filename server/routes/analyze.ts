import { Router } from "express";
import { listingSchema } from "../lib/schema";
import { analyzeImage, GeminiError } from "../lib/gemini";

export const analyzeRouter = Router();

// Not: istek gövdesi (base64) ve API anahtarı hiçbir log satırına yazılmaz.
analyzeRouter.post("/analyze", async (req, res) => {
  const parsed = listingSchema.safeParse(req.body);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".") || "(gövde)"))];
    res.status(400).json({ error: `Eksik veya geçersiz alan: ${fields.join(", ")}` });
    return;
  }

  const { imageBase64, mimeType, wasteType } = parsed.data;
  if (!mimeType.startsWith("image/")) {
    res.status(400).json({ error: "Yüklenen dosya bir görsel olmalı." });
    return;
  }

  const startedAt = Date.now();
  const imageKb = Math.round((imageBase64.length * 3) / 4 / 1024);
  try {
    const result = await analyzeImage({ imageBase64, mimeType, wasteType });
    console.log(
      `[analyze] ok ${Date.now() - startedAt}ms görsel=${imageKb}KB puan=${result.qualityScore} durum=${result.spoilageStatus}`
    );
    res.json(result);
  } catch (err) {
    if (err instanceof GeminiError) {
      console.warn(
        `[analyze] ${err.status} ${Date.now() - startedAt}ms görsel=${imageKb}KB ${err.message}` +
          (err.logDetail ? ` | ${err.logDetail}` : "")
      );
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(`[analyze] beklenmeyen hata: ${err instanceof Error ? err.name : typeof err}`);
    res.status(500).json({ error: "Sunucuda beklenmeyen bir hata oluştu." });
  }
});
