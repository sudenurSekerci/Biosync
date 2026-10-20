import express, { type ErrorRequestHandler } from "express";
import { analyzeRouter } from "./routes/analyze";

const PORT = Number(process.env.PORT ?? 3000);

const app = express();
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use(analyzeRouter);

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

// 0.0.0.0: fiziksel cihazın LAN IP üzerinden erişebilmesi için
app.listen(PORT, "0.0.0.0", () => {
  console.log(`BioSync server http://0.0.0.0:${PORT}`);
});
