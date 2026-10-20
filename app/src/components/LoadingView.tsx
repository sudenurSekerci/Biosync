import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function LoadingView() {
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
});
