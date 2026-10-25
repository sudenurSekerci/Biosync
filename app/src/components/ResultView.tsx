import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MatchCard from "./MatchCard";
import MatchMap from "./MatchMap";
import Wordmark from "./Wordmark";
import { industryInfo } from "../industryInfo";
import {
  INDUSTRY_LABELS,
  type EliminationSummary,
  type Industry,
  type Listing,
  type Match,
  type MatchState,
  type Offer,
  type QualityResult,
  type SpoilageStatus,
} from "../types";

type Props = {
  result: QualityResult;
  listing: Listing;
  matchState: MatchState;
  offer: Offer | null;
  onSendOffer: (match: Match) => void;
  onRetryMatch: () => void;
  onReset: () => void;
};

// Seçili alıcı (kart açık + haritada vurgulu) ve kart konumları (işaretçiye dokununca kaydırma için).
type Selection = {
  selectedBuyerId: string | null;
  onSelectFromCard: (buyerId: string) => void;
  onSelectFromMap: (buyerId: string) => void;
  onCardsLayout: (y: number) => void;
  onCardLayout: (buyerId: string, y: number) => void;
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

// Sıralama karbon ve raf ömrünü de hesaba kattığı için en yüksek net kâr ilk kartta olmayabilir.
function topProfitBuyerId(matches: Match[]): string | undefined {
  return matches.reduce<Match | undefined>(
    (top, match) => (!top || match.netProfitTRY > top.netProfitTRY ? match : top),
    undefined
  )?.buyer.id;
}

// Tahmini net iklim etkisi (önerilen eşleşme). Katsayı ve kaynak: server/lib/matching.ts.
function impactText(netImpactCo2eKg: number): string {
  const amount = Math.abs(netImpactCo2eKg).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
  return netImpactCo2eKg >= 0
    ? `Tahmini net iklim etkisi: ≈${amount} kg CO₂e tasarruf`
    : `Tahmini net iklim etkisi: ≈${amount} kg CO₂e ek emisyon`;
}

// Puan ölçeği (renk + metin; bilgi yalnızca renge bağlı kalmasın).
function scoreLevel(score: number): { color: string; label: string } {
  if (score >= 80) return { color: "#1b5e20", label: "Yüksek" };
  if (score >= 60) return { color: "#2e7d32", label: "İyi" };
  if (score >= 40) return { color: "#ef6c00", label: "Orta" };
  return { color: "#c62828", label: "Düşük" };
}

function MatchSection({
  listing,
  matchState,
  offer,
  onSendOffer,
  onRetryMatch,
  selection,
}: Pick<Props, "listing" | "matchState" | "offer" | "onSendOffer" | "onRetryMatch"> & {
  selection: Selection;
}) {
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
              <View style={styles.impact}>
                <Text style={styles.impactText}>
                  {impactText(matchState.matches[0].netImpactCo2eKg)}
                </Text>
                <Text style={styles.impactNote}>
                  Önerilen eşleşmeye göre: çöplüğe gitmesi önlenen emisyon (EPA WARM tahmini) −
                  taşıma CO₂
                </Text>
              </View>
              <MatchMap
                lat={listing.lat}
                lng={listing.lng}
                radiusKm={matchState.radiusKm}
                matches={matchState.matches}
                selectedBuyerId={selection.selectedBuyerId}
                onSelectBuyer={selection.onSelectFromMap}
              />
              <Text style={styles.muted}>Karta dokunun: detay açılır ve alıcı haritada vurgulanır.</Text>
              <View
                style={styles.cards}
                onLayout={(event) => selection.onCardsLayout(event.nativeEvent.layout.y)}
              >
                {matchState.matches.map((match, index) => (
                  <View
                    key={match.buyer.id}
                    onLayout={(event) => selection.onCardLayout(match.buyer.id, event.nativeEvent.layout.y)}
                  >
                    <MatchCard
                      match={match}
                      quantityKg={listing.quantityKg}
                      isBest={index === 0}
                      isTopProfit={match.buyer.id === topProfitBuyerId(matchState.matches)}
                      expanded={selection.selectedBuyerId === match.buyer.id}
                      onPress={() => selection.onSelectFromCard(match.buyer.id)}
                      offer={offer}
                      onSendOffer={onSendOffer}
                    />
                  </View>
                ))}
              </View>
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
          {matchState.matches.length === 0 && (
            <MatchMap
              lat={listing.lat}
              lng={listing.lng}
              radiusKm={matchState.radiusKm}
              matches={[]}
              selectedBuyerId={null}
              onSelectBuyer={selection.onSelectFromMap}
            />
          )}
          {eliminatedText && <Text style={styles.eliminated}>{eliminatedText}</Text>}
        </>
      );
    }
  }
}

export default function ResultView({
  result,
  listing,
  matchState,
  offer,
  onSendOffer,
  onRetryMatch,
  onReset,
}: Props) {
  const spoilage = SPOILAGE[result.spoilageStatus];
  const level = scoreLevel(result.qualityScore);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const cardsY = useRef(0);
  const cardY = useRef<Record<string, number>>({});

  const selection: Selection = {
    selectedBuyerId,
    // Karta dokununca aç/kapat; harita vurgusu seçimden gelir.
    onSelectFromCard: (buyerId) => setSelectedBuyerId((current) => (current === buyerId ? null : buyerId)),
    // İşaretçiye dokununca kartı aç ve ona kaydır (yerleşim güncellendikten sonra).
    onSelectFromMap: (buyerId) => {
      setSelectedBuyerId(buyerId);
      setTimeout(() => {
        const y = cardsY.current + (cardY.current[buyerId] ?? 0);
        scrollRef.current?.scrollTo({ y: Math.max(y - 12, 0), animated: true });
      }, 80);
    },
    onCardsLayout: (y) => {
      cardsY.current = y;
    },
    onCardLayout: (buyerId, y) => {
      cardY.current[buyerId] = y;
    },
  };

  const info = selectedIndustry
    ? industryInfo(selectedIndustry, result.productType, listing.wasteType)
    : null;

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={styles.container}>
      <Wordmark />
      <Text style={styles.product}>{result.productType}</Text>

      <View style={styles.scoreBox}>
        <Text style={[styles.score, { color: level.color }]}>{Math.round(result.qualityScore)}</Text>
        <Text style={styles.scoreLabel}>Kalite Güven Puanı / 100</Text>
        <Text style={[styles.scoreLevel, { color: level.color }]}>{level.label}</Text>
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
        <>
          <View style={styles.chips}>
            {result.suitableIndustries.map((industry) => {
              const active = selectedIndustry === industry;
              return (
                <Pressable
                  key={industry}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setSelectedIndustry(active ? null : industry)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: active }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {INDUSTRY_LABELS[industry]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {info && selectedIndustry ? (
            <View style={styles.industryInfo}>
              <Text style={styles.industryInfoTitle}>
                {INDUSTRY_LABELS[selectedIndustry]} · {info.wasteLabel} için örnek kullanım
              </Text>
              <Text style={styles.industryInfoText}>{info.text}</Text>
            </View>
          ) : (
            <Text style={styles.muted}>Bir endüstriye dokunun: bu atıktan ne üretilebileceği görünür.</Text>
          )}
        </>
      ) : (
        <Text style={styles.muted}>Uygun endüstri bulunamadı.</Text>
      )}

      <Text style={styles.section}>Değerlendirme</Text>
      <Text style={styles.summary}>{result.summary}</Text>

      <Text style={styles.section}>Alıcı eşleşmeleri</Text>
      <MatchSection
        listing={listing}
        matchState={matchState}
        offer={offer}
        onSendOffer={onSendOffer}
        onRetryMatch={onRetryMatch}
        selection={selection}
      />

      <Pressable style={styles.button} onPress={onReset}>
        <Text style={styles.buttonText}>Yeni ilan</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 8 },
  product: { fontSize: 22, fontWeight: "700", color: "#1b3a1b", textTransform: "capitalize", marginTop: 12 },
  scoreBox: {
    alignItems: "center",
    paddingVertical: 20,
    backgroundColor: "#f4f8f4",
    borderRadius: 12,
    marginVertical: 8,
  },
  score: { fontSize: 64, fontWeight: "800" },
  scoreLabel: { fontSize: 14, color: "#555" },
  scoreLevel: { fontSize: 13, fontWeight: "700", marginTop: 2 },
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
  chipActive: { backgroundColor: "#2e7d32" },
  chipTextActive: { color: "#fff" },
  industryInfo: { borderLeftWidth: 3, borderLeftColor: "#2e7d32", paddingLeft: 10, paddingVertical: 4, gap: 2 },
  industryInfoTitle: { fontSize: 13, fontWeight: "700", color: "#1b3a1b" },
  industryInfoText: { fontSize: 14, color: "#333", lineHeight: 20 },
  cards: { gap: 8 },
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
  impact: { backgroundColor: "#e8f5e9", borderRadius: 8, padding: 10, gap: 2 },
  impactText: { fontSize: 15, fontWeight: "700", color: "#1b5e20" },
  impactNote: { fontSize: 12, color: "#555" },
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
