import { StyleSheet, Text } from "react-native";

// Sade yazı tabanlı logo (ikon/maskot yok): "Bio" vurgulu, "Sync" koyu. inverted: koyu zemin için.
export default function Wordmark({ inverted = false }: { inverted?: boolean }) {
  return (
    <Text style={styles.wordmark} accessibilityRole="header" accessibilityLabel="BioSync">
      <Text style={[styles.bio, inverted && styles.bioInverted]}>Bio</Text>
      <Text style={[styles.sync, inverted && styles.syncInverted]}>Sync</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  wordmark: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  bio: { color: "#2e7d32" },
  sync: { color: "#1b3a1b" },
  bioInverted: { color: "#a5d6a7" },
  syncInverted: { color: "#ffffff" },
});
