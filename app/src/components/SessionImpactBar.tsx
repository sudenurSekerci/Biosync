import { StyleSheet, Text, View } from "react-native";
import type { SessionImpact } from "../types";

export const EMPTY_SESSION_IMPACT: SessionImpact = { acceptedOffers: 0, wasteKg: 0, netCo2eKg: 0 };

const formatNumber = (value: number) => value.toLocaleString("tr-TR", { maximumFractionDigits: 1 });

// Oturum etki sayacı (Faz C.5): kabul edilen tekliflerin toplamı; yalnızca en az bir kabul varsa görünür.
export default function SessionImpactBar({ impact }: { impact: SessionImpact }) {
  if (impact.acceptedOffers === 0) return null;
  const co2Label = impact.netCo2eKg >= 0 ? "tasarruf" : "ek emisyon";
  return (
    <View style={styles.bar} accessibilityRole="summary">
      <Text style={styles.title}>Bu oturumda (demo)</Text>
      <Text style={styles.text}>
        {impact.acceptedOffers} kabul edilen teklif · {formatNumber(impact.wasteKg)} kg atık çöpe gitmedi · ≈
        {formatNumber(Math.abs(impact.netCo2eKg))} kg CO₂e {co2Label} (tahmini)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: "#e8f5e9",
    borderBottomWidth: 1,
    borderBottomColor: "#c8e6c9",
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 2,
  },
  title: { fontSize: 12, fontWeight: "700", color: "#1b5e20" },
  text: { fontSize: 13, color: "#1b3a1b" },
});
