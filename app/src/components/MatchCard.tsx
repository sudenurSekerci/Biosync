import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { INDUSTRY_LABELS, type Match, type Offer } from "../types";

type Props = {
  match: Match;
  quantityKg: number;
  isBest: boolean;
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

function OfferArea({ match, quantityKg, offer, onSendOffer }: Omit<Props, "isBest" | "expanded" | "onPress">) {
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
          {formatNumber(quantityKg)} kg ürünü {match.buyer.name} firmasına ≈{formatTRY(match.materialValueTRY)}{" "}
          karşılığında teklif edilsin mi? (Taşıma sonrası net ≈{formatTRY(match.netProfitTRY)})
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
  const { match, quantityKg, isBest, expanded, onPress } = props;
  const { buyer } = match;

  return (
    <View style={[styles.card, isBest && styles.bestCard, expanded && styles.expandedCard]}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded }}>
        {(isBest || match.shelfLifeRisk) && (
          <View style={styles.badgeRow}>
            {isBest && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Önerilen Eşleşme</Text>
              </View>
            )}
            {match.shelfLifeRisk && (
              <View style={[styles.badge, styles.riskBadge]}>
                <Text style={[styles.badgeText, styles.riskBadgeText]}>Raf ömrü sınırda</Text>
              </View>
            )}
          </View>
        )}
        <View style={styles.headerRow}>
          <Text style={styles.name}>{buyer.name}</Text>
          <Text style={styles.toggle}>{expanded ? "Kapat" : "Detay"}</Text>
        </View>
        <Text style={styles.fictional}>Kurgusal demo alıcısı</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryItem}>{formatNumber(match.distanceKm)} km</Text>
          <Text style={styles.summaryItem}>{vehicleText(match)}</Text>
          <Text style={[styles.summaryItem, styles.profit]}>{formatTRY(match.netProfitTRY)} net</Text>
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.detail}>
          <Text style={styles.location}>{buyer.locationName}</Text>
          <Text style={styles.industries}>
            {buyer.industries.map((industry) => INDUSTRY_LABELS[industry]).join(", ")}
          </Text>
          <Row label="Malzeme değeri" value={formatTRY(match.materialValueTRY)} />
          <Row label={`Taşıma (${vehicleText(match)})`} value={`−${formatTRY(match.transportCostTRY)}`} />
          <Row label="Net kâr" value={formatTRY(match.netProfitTRY)} strong />
          <Row label="Taşıma CO₂" value={`${formatNumber(match.co2Kg)} kg`} />
          <Row
            label="Tahmini net iklim etkisi"
            value={`≈${formatNumber(Math.abs(match.netImpactCo2eKg))} kg CO₂e ${
              match.netImpactCo2eKg >= 0 ? "tasarruf" : "ek emisyon"
            }`}
          />
          <Row label="Çöpe gitmesi önlenen" value={`${formatNumber(quantityKg)} kg`} />
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
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 },
  badge: { backgroundColor: "#2e7d32", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  riskBadge: { backgroundColor: "#fff3e0", borderWidth: 1, borderColor: "#e0a050" },
  riskBadgeText: { color: "#8a4b00" },
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
