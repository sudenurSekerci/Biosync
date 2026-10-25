import { Router } from "express";
import { matchRequestSchema, TRANSPORT_MODES, type MatchResponse } from "../lib/schema.js";
import { evaluateBuyers, MAX_RADIUS_KM } from "../lib/matching.js";
import { BUYERS } from "../data/buyers.js";

export const matchRouter = Router();

matchRouter.post("/match", (req, res) => {
  const parsed = matchRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".") || "(gövde)"))];
    res.status(400).json({ error: `Eksik veya geçersiz alan: ${fields.join(", ")}` });
    return;
  }

  const { quality, ...listing } = parsed.data;
  const byMode: MatchResponse["byMode"] = {
    buyerOwn: evaluateBuyers(listing, quality, BUYERS, "buyerOwn"),
    thirdParty: evaluateBuyers(listing, quality, BUYERS, "thirdParty"),
  };
  for (const mode of TRANSPORT_MODES) {
    const { matches, eliminated } = byMode[mode];
    console.log(
      `[match] ${mode}: ${matches.length} eşleşme (${listing.quantityKg} kg, organik=${quality.isOrganicByproduct}) elenen=${JSON.stringify(eliminated)}`
    );
  }

  const body: MatchResponse = { radiusKm: MAX_RADIUS_KM, byMode };
  res.json(body);
});
