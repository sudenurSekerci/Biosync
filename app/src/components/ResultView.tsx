import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Industry, QualityResult, SpoilageStatus } from "../types";

type Props = { result: QualityResult; onReset: () => void };

const INDUSTRY_LABELS: Record<Industry, string> = {
  biyoplastik: "Biyoplastik",
  "3d_filament": "3D Filament",
  vegan_deri: "Vegan Deri",
  kozmetik: "Kozmetik",
  alternatif_gida: "Alternatif Gıda",
};

const SPOILAGE: Record<SpoilageStatus, { label: string; color: string }> = {
  taze: { label: "Taze", color: "#2e7d32" },
  hafif_bozulmus: { label: "Hafif bozulmuş", color: "#ef6c00" },
  bozulmus: { label: "Bozulmuş", color: "#c62828" },
};

function scoreColor(score: number): string {
  if (score >= 70) return "#2e7d32";
  if (score >= 40) return "#ef6c00";
  return "#c62828";
}

export default function ResultView({ result, onReset }: Props) {
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

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Bozulma durumu</Text>
        <Text style={[styles.infoValue, { color: spoilage.color }]}>{spoilage.label}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Tahmini raf ömrü</Text>
        <Text style={styles.infoValue}>{result.estimatedShelfLifeDays} gün</Text>
      </View>

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
  section: { fontSize: 15, fontWeight: "600", marginTop: 16, color: "#222" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: "#e8f5e9", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { color: "#2e7d32", fontSize: 14, fontWeight: "600" },
  summary: { fontSize: 15, color: "#333", lineHeight: 22 },
  muted: { fontSize: 13, color: "#777" },
  button: {
    backgroundColor: "#2e7d32",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 24,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
