import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import { analyzeRouter } from "./routes/analyze.js";
import { matchRouter } from "./routes/match.js";

const PORT = Number(process.env.PORT ?? 3000);

// CORS: web sürümü (tarayıcı) için. CORS_ORIGINS virgülle ayrılmış adres listesidir
// (örn. https://biosync-web.vercel.app). Tanımsızsa her kaynağa izin verilir (yerel geliştirme).
// Mobil uygulama (Expo Go) Origin göndermez, CORS'tan etkilenmez.
const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const cors: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.length === 0 || allowedOrigins.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
};

const app = express();
app.use(cors);
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use(analyzeRouter);
app.use(matchRouter);

// JSON ayrıştırma/boyut hataları: varsayılan işleyici hata mesajında gövdeden parça
// (base64) basabildiği için burada yakalanır ve gövde loglanmaz.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status: unknown = err?.status;
  if (status === 413) {
    res.status(413).json({ error: "Fotoğraf çok büyük (en fazla 10 MB)." });
    return;
  }
  if (status === 400) {
    res.status(400).json({ error: "İstek gövdesi geçerli JSON değil." });
    return;
  }
  console.error(`[server] beklenmeyen hata: ${err instanceof Error ? err.name : typeof err}`);
  res.status(500).json({ error: "Sunucuda beklenmeyen bir hata oluştu." });
};
app.use(errorHandler);

// Vercel uygulamayı varsayılan dışa aktarımdan tek bir fonksiyon olarak çalıştırır.
export default app;

// Yerel: 0.0.0.0, fiziksel cihazın LAN IP üzerinden erişebilmesi için. Vercel'de dinleme yapılmaz.
if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BioSync server http://0.0.0.0:${PORT}`);
  });
}
