import express from "express";

const PORT = Number(process.env.PORT ?? 3000);

const app = express();
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// 0.0.0.0: fiziksel cihazın LAN IP üzerinden erişebilmesi için
app.listen(PORT, "0.0.0.0", () => {
  console.log(`BioSync server http://0.0.0.0:${PORT}`);
});
