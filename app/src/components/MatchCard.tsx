import { StyleSheet, Text, View } from "react-native";
import { INDUSTRY_LABELS, type Match } from "../types";

type Props = { match: Match; quantityKg: number; isBest: boolean };

const formatTRY = (value: number) => `${Math.round(value).toLocaleString("tr-TR")} ₺`;
const formatNumber = (value: number) => value.toLocaleString("tr-TR", { maximumFractionDigits: 1 });

export default function MatchCard({ match, quantityKg, isBest }: Props) {
  const { buyer } = match;

  return (
    <View style={[styles.card, isBest && styles.bestCard]}>
      {isBest && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>En Kârlı Eşleşme</Text>
        </View>
      )}
      <Text style={styles.name}>{buyer.name}</Text>
      <Text style={styles.location}>
        {buyer.locationName} · <Text style={styles.fictional}>Kurgusal demo alıcısı</Text>
      </Text>
      <Text style={styles.industries}>
        {buyer.industries.map((industry) => INDUSTRY_LABELS[industry]).join(", ")}
      </Text>

      <View style={styles.row}>
        <Text style={styles.label}>Mesafe</Text>
        <Text style={styles.value}>{formatNumber(match.distanceKm)} km</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Malzeme değeri</Text>
        <Text style={styles.value}>{formatTRY(match.materialValueTRY)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Araç</Text>
        <Text style={styles.value}>
          {match.vehicle.label}
          {match.vehicle.trips > 1 ? ` × ${match.vehicle.trips} sefer` : ""}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Taşıma maliyeti</Text>
        <Text style={styles.value}>−{formatTRY(match.transportCostTRY)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.label, styles.strong]}>Net kâr</Text>
        <Text style={[styles.value, styles.profit]}>{formatTRY(match.netProfitTRY)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Taşıma CO₂</Text>
        <Text style={styles.value}>{formatNumber(match.co2Kg)} kg</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Çöpe gitmesi önlenen</Text>
        <Text style={styles.value}>{formatNumber(quantityKg)} kg</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 14, gap: 4, backgroundColor: "#fff" },
  bestCard: { borderColor: "#2e7d32", borderWidth: 2, backgroundColor: "#f4f8f4" },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#2e7d32",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 4,
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  name: { fontSize: 17, fontWeight: "700", color: "#1b3a1b" },
  location: { fontSize: 13, color: "#555" },
  fictional: { fontStyle: "italic", color: "#8a4b00" },
  industries: { fontSize: 13, color: "#2e7d32", fontWeight: "600", marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  label: { fontSize: 14, color: "#555" },
  value: { fontSize: 14, color: "#222", fontWeight: "600" },
  strong: { color: "#222", fontWeight: "700" },
  profit: { color: "#2e7d32", fontWeight: "800" },
});
