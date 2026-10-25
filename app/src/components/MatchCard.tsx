import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { INDUSTRY_LABELS, TRANSPORT_MODE_LABELS, type Match, type Offer, type TransportMode } from "../types";

type Props = {
  match: Match;
  quantityKg: number;
  isBest: boolean;
  // En yüksek net kârlı eşleşme; önerilen eşleşmeden farklıysa ayrıca etiketlenir.
  isTopProfit: boolean;
  // Aynı alıcının iki taşıma modundaki sonucu; null = o modda zarar nedeniyle elenir.
  comparison: Record<TransportMode, Match | null>;
  expanded: boolean;
  onPress: () => void;
  // Bu ilan için verilmiş teklif (herhangi bir alıcıya); ilan başına tek teklif.
  offer: Offer | null;
  onSendOffer: (match: Match) => void;
};

const formatTRY = (value: number) => `${Math.round(value).toLocaleString("tr-TR")} ₺`;
const formatNumber = (value: number) => value.toLocaleString("tr-TR", { maximumFractionDigits: 1 });

function vehicleText(match: Match): string {
  return match.vehicle.trips > 1
    ? `${match.vehicle.label} × ${match.vehicle.trips} sefer`
    : match.vehicle.label;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, strong && styles.strongLabel]}>{label}</Text>
      <Text style={[styles.value, strong && styles.profit]}>{value}</Text>
    </View>
  );
}

// İki modun taşıma maliyeti ve net kârı yan yana; seçili mod vurgulu.
// Aracı olmayan alıcıda yalnızca taşıyıcı firma sütunu.
function ModeComparison({
  current,
  comparison,
  hasOwnVehicle,
}: {
  current: TransportMode;
  comparison: Props["comparison"];
  hasOwnVehicle: boolean;
}) {
  const modes: TransportMode[] = hasOwnVehicle ? ["buyerOwn", "thirdParty"] : ["thirdParty"];
  return (
    <View style={styles.compare}>
      {modes.map((mode) => {
        const result = comparison[mode];
        return (
          <View key={mode} style={[styles.compareCol, mode === current && styles.compareColActive]}>
            <Text style={styles.compareTitle}>{TRANSPORT_MODE_LABELS[mode]}</Text>
            {result ? (
              <>
                <Text style={styles.compareText}>Taşıma −{formatTRY(result.transportCostTRY)}</Text>
                <Text style={[styles.compareText, styles.profit]}>Size kalan {formatTRY(result.netProfitTRY)}</Text>
              </>
            ) : (
              <Text style={styles.compareLoss}>Zarar – elenir</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

function OfferArea({ match, quantityKg, offer, onSendOffer }: Omit<Props, "isBest" | "isTopProfit" | "comparison" | "expanded" | "onPress">) {
  const [confirming, setConfirming] = useState(false);
  const own = offer?.buyerId === match.buyer.id ? offer : null;

  if (own?.status === "sent") {
    return (
      <View style={[styles.offerBox, styles.offerPending]}>
        <ActivityIndicator color="#1565c0" />
        <Text style={styles.offerPendingText}>
          Talebiniz {match.buyer.name} firmasına iletildi. Yanıt bekleniyor…
        </Text>
      </View>
    );
  }
  if (own?.status === "accepted") {
    return (
      <View style={[styles.offerBox, styles.offerAccepted]}>
        <Text style={styles.offerAcceptedText}>Kabul edildi (demo)</Text>
        <Text style={styles.offerNote}>
          {formatNumber(quantityKg)} kg yan ürün {match.buyer.name} firmasına gidecek. Kurgusal alıcı; gerçek
          bir sipariş oluşmaz.
        </Text>
      </View>
    );
  }
  if (offer) {
    return (
      <Text style={styles.offerNote}>
        Bu ilan için {offer.buyerName} firmasına teklif gönderildi; ilan başına tek teklif.
      </Text>
    );
  }
  if (confirming) {
    return (
      <View style={styles.offerBox}>
        <Text style={styles.confirmText}>
          {formatNumber(quantityKg)} kg ürün {match.buyer.name} firmasına teklif edilsin mi? Size kalan ≈
          {formatTRY(match.netProfitTRY)} (teslim fiyatı {formatTRY(match.materialValueTRY)} − taşıma{" "}
          {formatTRY(match.transportCostTRY)}, taşımayı alıcı ayarlar).
        </Text>
        <View style={styles.confirmButtons}>
          <Pressable style={[styles.button, styles.secondary]} onPress={() => setConfirming(false)}>
            <Text style={styles.secondaryText}>Vazgeç</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.primary]}
            onPress={() => {
              setConfirming(false);
              onSendOffer(match);
            }}
          >
            <Text style={styles.primaryText}>Onayla</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  return (
    <Pressable style={[styles.button, styles.primary]} onPress={() => setConfirming(true)}>
      <Text style={styles.primaryText}>Teklif gönder</Text>
    </Pressable>
  );
}

export default function MatchCard(props: Props) {
  const { match, quantityKg, isBest, isTopProfit, comparison, expanded, onPress } = props;
  const showTopProfit = isTopProfit && !isBest;
  const noVehicle = !match.buyer.hasOwnVehicle;
  const { buyer } = match;

  return (
    <View style={[styles.card, isBest && styles.bestCard, expanded && styles.expandedCard]}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded }}>
        {(isBest || showTopProfit || match.shelfLifeRisk || noVehicle) && (
          <View style={styles.badges}>
            {isBest && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Önerilen Eşleşme</Text>
              </View>
            )}
            {showTopProfit && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>Size en çok kalan</Text>
              </View>
            )}
            {match.shelfLifeRisk && (
              <View style={[styles.badge, styles.riskBadge]}>
                <Text style={styles.badgeText}>Raf ömrü sınırda</Text>
              </View>
            )}
            {noVehicle && (
              <View style={[styles.tag, styles.noVehicleTag]}>
                <Text style={[styles.tagText, styles.noVehicleText]}>Aracı yok – yalnızca taşıyıcı ile</Text>
              </View>
            )}
          </View>
        )}
        {isBest && <Text style={styles.bestNote}>Kâr ve karbon birlikte değerlendirildi</Text>}
        <View style={styles.headerRow}>
          <Text style={styles.name}>{buyer.name}</Text>
          <Text style={styles.toggle}>{expanded ? "Kapat" : "Detay"}</Text>
        </View>
        <Text style={styles.fictional}>Kurgusal demo alıcısı</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryItem}>{formatNumber(match.distanceKm)} km</Text>
          <Text style={styles.summaryItem}>{vehicleText(match)}</Text>
          <Text style={[styles.summaryItem, styles.profit]}>Size kalan {formatTRY(match.netProfitTRY)}</Text>
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.detail}>
          <Text style={styles.location}>{buyer.locationName}</Text>
          <Text style={styles.industries}>
            {buyer.industries.map((industry) => INDUSTRY_LABELS[industry]).join(", ")}
          </Text>
          <Row label="Alıcı teslim fiyatı" value={formatTRY(match.materialValueTRY)} />
          <Row label="Taşıma (teslim fiyatından düşülür)" value={`−${formatTRY(match.transportCostTRY)}`} />
          <Row label="Taşıma şekli" value={`${TRANSPORT_MODE_LABELS[match.transportMode]} · ${vehicleText(match)}`} />
          {match.transportMode === "thirdParty" && (
            <Row label="Taşıyıcı payı (taşımaya dahil)"value={formatTRY(match.carrierShareTRY)} />
          )}
          <Row label="Size kalan (net)" value={formatTRY(match.netProfitTRY)} strong />
          <Row label="Taşıma CO₂" value={`${formatNumber(match.co2Kg)} kg`} />
          <Row
            label="Tahmini net iklim etkisi"
            value={`≈${formatNumber(Math.abs(match.netImpactCo2eKg))} kg CO₂e ${
              match.netImpactCo2eKg >= 0 ? "tasarruf" : "ek emisyon"
            }`}
          />
          <Row label="Çöpe gitmesi önlenen" value={`${formatNumber(quantityKg)} kg`} />
          <Text style={styles.compareHeading}>
            {noVehicle ? "Taşıma (boş dönüş dahil)" : "Taşıma modu kıyası (boş dönüş dahil)"}
          </Text>
          <ModeComparison current={match.transportMode} comparison={comparison} hasOwnVehicle={!noVehicle} />
          <OfferArea {...props} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 14, gap: 4, backgroundColor: "#fff" },
  bestCard: { borderColor: "#2e7d32", borderWidth: 2, backgroundColor: "#f4f8f4" },
  expandedCard: { borderColor: "#1b3a1b" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 },
  badge: { backgroundColor: "#2e7d32", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  riskBadge: { backgroundColor: "#8a4b00" },
  tag: { borderWidth: 1, borderColor: "#2e7d32", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { color: "#2e7d32", fontSize: 12, fontWeight: "600" },
  noVehicleTag: { borderColor: "#555" },
  noVehicleText: { color: "#555" },
  bestNote: { fontSize: 12, color: "#555", marginBottom: 4 },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  name: { flex: 1, fontSize: 16, fontWeight: "700", color: "#1b3a1b" },
  toggle: { fontSize: 13, color: "#2e7d32", fontWeight: "600" },
  fictional: { fontSize: 12, fontStyle: "italic", color: "#8a4b00" },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 6 },
  summaryItem: { fontSize: 14, color: "#333", fontWeight: "600" },
  detail: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#e3e3e3", gap: 4 },
  location: { fontSize: 13, color: "#555" },
  industries: { fontSize: 13, color: "#2e7d32", fontWeight: "600", marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2, gap: 8 },
  label: { flexShrink: 1, fontSize: 14, color: "#555" },
  strongLabel: { color: "#222", fontWeight: "700" },
  value: { fontSize: 14, color: "#222", fontWeight: "600" },
  profit: { color: "#2e7d32", fontWeight: "800" },
  compareHeading: { fontSize: 13, fontWeight: "700", color: "#1b3a1b", marginTop: 8 },
  compare: { flexDirection: "row", gap: 8 },
  compareCol: { flex: 1, borderWidth: 1, borderColor: "#e3e3e3", borderRadius: 8, padding: 8, gap: 2 },
  compareColActive: { borderColor: "#2e7d32", backgroundColor: "#f4f8f4" },
  compareTitle: { fontSize: 13, fontWeight: "700", color: "#333" },
  compareText: { fontSize: 13, color: "#222" },
  compareLoss: { fontSize: 13, color: "#c62828", fontWeight: "600" },
  offerBox: { marginTop: 10, borderRadius: 8, padding: 12, gap: 8, backgroundColor: "#f5f5f5" },
  offerPending: { flexDirection: "row", alignItems: "center", backgroundColor: "#e3f2fd" },
  offerPendingText: { flex: 1, color: "#0d47a1", fontSize: 14 },
  offerAccepted: { backgroundColor: "#e8f5e9" },
  offerAcceptedText: { color: "#1b5e20", fontSize: 16, fontWeight: "800" },
  offerNote: { fontSize: 13, color: "#555", marginTop: 6 },
  confirmText: { fontSize: 14, color: "#222", lineHeight: 20 },
  confirmButtons: { flexDirection: "row", gap: 8 },
  button: { flex: 1, borderRadius: 8, paddingVertical: 11, alignItems: "center", marginTop: 10 },
  primary: { backgroundColor: "#2e7d32" },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  secondary: { backgroundColor: "#e8f5e9" },
  secondaryText: { color: "#2e7d32", fontSize: 15, fontWeight: "600" },
});
