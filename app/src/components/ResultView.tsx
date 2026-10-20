import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MatchCard from "./MatchCard";
import MatchMap from "./MatchMap";
import {
  INDUSTRY_LABELS,
  type EliminationSummary,
  type Listing,
  type MatchState,
  type QualityResult,
  type SpoilageStatus,
} from "../types";

type Props = {
  result: QualityResult;
  listing: Listing;
  matchState: MatchState;
  onRetryMatch: () => void;
  onReset: () => void;
};

const SPOILAGE: Record<SpoilageStatus, { label: string; color: string }> = {
  taze: { label: "Taze", color: "#2e7d32" },
  hafif_bozulmus: { label: "Hafif bozulmuş", color: "#ef6c00" },
  bozulmus: { label: "Bozulmuş", color: "#c62828" },
};

// Örn. "2 alıcı zarar nedeniyle, 1 alıcı mesafe nedeniyle elendi."
function eliminationText(eliminated: EliminationSummary): string | null {
  const parts = [
    [eliminated.loss, "zarar"],
    [eliminated.distance, "mesafe"],
    [eliminated.industry, "endüstri uyumsuzluğu"],
    [eliminated.shelfLife, "raf ömrü"],
  ] as const;
  const text = parts
    .filter(([count]) => count > 0)
    .map(([count, reason]) => `${count} alıcı ${reason} nedeniyle`)
    .join(", ");
  return text ? `${text} elendi.` : null;
}

function scoreColor(score: number): string {
  if (score >= 70) return "#2e7d32";
  if (score >= 40) return "#ef6c00";
  return "#c62828";
}

function MatchSection({
  listing,
  matchState,
  onRetryMatch,
}: Pick<Props, "listing" | "matchState" | "onRetryMatch">) {
  switch (matchState.status) {
    case "skipped":
      return (
        <Text style={styles.muted}>
          Organik yan ürün tespit edilmediği için alıcı eşleştirmesi yapılmadı.
        </Text>
      );
    case "loading":
      return (
        <View style={styles.matchLoading}>
          <ActivityIndicator color="#2e7d32" />
          <Text style={styles.muted}>Yakındaki alıcılar aranıyor...</Text>
        </View>
      );
    case "error":
      return (
        <View style={styles.matchError}>
          <Text style={styles.matchErrorText}>{matchState.error}</Text>
          <Pressable style={styles.retryButton} onPress={onRetryMatch}>
            <Text style={styles.retryText}>Tekrar dene</Text>
          </Pressable>
        </View>
      );
    case "done": {
      const eliminatedText = eliminationText(matchState.eliminated);
      return (
        <>
          {matchState.matches.length > 0 ? (
            <>
              <Text style={styles.matchFound}>
                Eşleşme Bulundu: {matchState.matches.length} alıcı ({matchState.radiusKm} km içinde)
              </Text>
              {matchState.matches.map((match, index) => (
                <MatchCard
                  key={match.buyer.id}
                  match={match}
                  quantityKg={listing.quantityKg}
                  isBest={index === 0}
                />
              ))}
            </>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Yakın çapta uygun alıcı bulunamadı</Text>
              <Text style={styles.muted}>
                {matchState.radiusKm} km içinde bu ürünü kârlı şekilde alabilecek alıcı yok. Küçük
                miktarlarda taşıma maliyeti ürün değerini aşabilir.
              </Text>
            </View>
          )}
          {eliminatedText && <Text style={styles.eliminated}>{eliminatedText}</Text>}
          <MatchMap
            lat={listing.lat}
            lng={listing.lng}
            radiusKm={matchState.radiusKm}
            matches={matchState.matches}
          />
        </>
      );
    }
  }
}

export default function ResultView({ result, listing, matchState, onRetryMatch, onReset }: Props) {
  const spoilage = SPOILAGE[result.spoilageStatus];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.product}>{result.productType}</Text>

      <View style={styles.scoreBox}>
        <Text style={[styles.score, { color: scoreColor(result.qualityScore) }]}>
          {Math.round(result.qualityScore)}
        </Text>
        <Text style={styles.scoreLabel}>Kalite Güven Puanı / 100</Text>
      </View>

      {result.isOrganicByproduct ? (
        <>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Bozulma durumu</Text>
            <Text style={[styles.infoValue, { color: spoilage.color }]}>{spoilage.label}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tahmini raf ömrü</Text>
            <Text style={styles.infoValue}>{result.estimatedShelfLifeDays} gün</Text>
          </View>
        </>
      ) : (
        <View style={styles.notOrganic}>
          <Text style={styles.notOrganicText}>Organik yan ürün tespit edilmedi</Text>
        </View>
      )}

      <Text style={styles.section}>Uygun endüstriler</Text>
      {result.suitableIndustries.length > 0 ? (
        <View style={styles.chips}>
          {result.suitableIndustries.map((industry) => (
            <View key={industry} style={styles.chip}>
              <Text style={styles.chipText}>{INDUSTRY_LABELS[industry]}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.muted}>Uygun endüstri bulunamadı.</Text>
      )}

      <Text style={styles.section}>Değerlendirme</Text>
      <Text style={styles.summary}>{result.summary}</Text>

      <Text style={styles.section}>Alıcı eşleşmeleri</Text>
      <MatchSection listing={listing} matchState={matchState} onRetryMatch={onRetryMatch} />

      <Pressable style={styles.button} onPress={onReset}>
        <Text style={styles.buttonText}>Yeni ilan</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 56, gap: 8 },
  product: { fontSize: 22, fontWeight: "700", color: "#1b3a1b", textTransform: "capitalize" },
  scoreBox: {
    alignItems: "center",
    paddingVertical: 20,
    backgroundColor: "#f4f8f4",
    borderRadius: 12,
    marginVertical: 8,
  },
  score: { fontSize: 64, fontWeight: "800" },
  scoreLabel: { fontSize: 14, color: "#555" },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  infoLabel: { fontSize: 15, color: "#555" },
  infoValue: { fontSize: 15, fontWeight: "600", color: "#222" },
  notOrganic: { backgroundColor: "#fdecea", borderRadius: 8, padding: 12 },
  notOrganicText: { color: "#c62828", fontSize: 15, fontWeight: "600", textAlign: "center" },
  section: { fontSize: 15, fontWeight: "600", marginTop: 16, color: "#222" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: "#e8f5e9", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { color: "#2e7d32", fontSize: 14, fontWeight: "600" },
  summary: { fontSize: 15, color: "#333", lineHeight: 22 },
  muted: { fontSize: 13, color: "#777" },
  matchFound: { fontSize: 15, fontWeight: "700", color: "#2e7d32" },
  matchLoading: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  matchError: { backgroundColor: "#fdecea", borderRadius: 8, padding: 12, gap: 8 },
  matchErrorText: { color: "#c62828", fontSize: 14 },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#2e7d32",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryText: { color: "#fff", fontWeight: "700" },
  empty: { backgroundColor: "#fff4e5", borderRadius: 8, padding: 12, gap: 4 },
  eliminated: { fontSize: 13, color: "#777", fontStyle: "italic" },
  emptyTitle: { color: "#8a4b00", fontSize: 15, fontWeight: "700" },
  button: {
    backgroundColor: "#2e7d32",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 24,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
