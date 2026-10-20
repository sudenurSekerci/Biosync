import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
};

// "loading" adımı: analiz sürerken spinner, başarısız olursa hata + tekrar dene.
export default function LoadingView({ error, onRetry, onBack }: Props) {
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>Analiz tamamlanamadı</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={[styles.button, styles.primary]} onPress={onRetry}>
          <Text style={styles.primaryText}>Tekrar dene</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.secondary]} onPress={onBack}>
          <Text style={styles.secondaryText}>Forma dön</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2e7d32" />
      <Text style={styles.text}>AI Ürün Kalitesini Analiz Ediyor...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 20 },
  text: { fontSize: 16, color: "#333" },
  errorTitle: { fontSize: 20, fontWeight: "700", color: "#c62828" },
  errorText: { fontSize: 15, color: "#333", textAlign: "center", lineHeight: 22 },
  button: {
    alignSelf: "stretch",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  primary: { backgroundColor: "#2e7d32" },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondary: { backgroundColor: "#e8f5e9" },
  secondaryText: { color: "#2e7d32", fontSize: 15, fontWeight: "600" },
});
