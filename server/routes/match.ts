import { Router } from "express";
import { matchRequestSchema, type MatchResponse } from "../lib/schema";
import { MAX_RADIUS_KM, matchBuyers } from "../lib/matching";
import { BUYERS } from "../data/buyers";

export const matchRouter = Router();

matchRouter.post("/match", (req, res) => {
  const parsed = matchRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".") || "(gövde)"))];
    res.status(400).json({ error: `Eksik veya geçersiz alan: ${fields.join(", ")}` });
    return;
  }

  const { quality, ...listing } = parsed.data;
  const matches = matchBuyers(listing, quality, BUYERS);
  console.log(`[match] ${matches.length} eşleşme (${listing.quantityKg} kg, organik=${quality.isOrganicByproduct})`);

  const body: MatchResponse = { radiusKm: MAX_RADIUS_KM, matches };
  res.json(body);
});
