import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import Wordmark from "./Wordmark";
import { LOADING_FACTS } from "../loadingFacts";

type Props = {
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
  photoUri: string | null;
};

// Arka plan videosu: Los Muertos Crew / Pexels (docs/KAYNAKLAR.md §3). 540×960, sessiz, ~0,7 MB.
const BACKGROUND_VIDEO = require("../../assets/loading-bg.mp4");
const FACT_INTERVAL_MS = 4500;
const FADE_MS = 500;

// Videolu arka plan: sessiz, döngülü, otomatik. Yüklenemezse gizlenir, düz koyu zemin kalır.
// Analiz akışı videoyu beklemez; video yalnızca görseldir.
function BackgroundVideo() {
  const player = useVideoPlayer(BACKGROUND_VIDEO, (p) => {
    p.muted = true;
    p.loop = true;
    p.play();
  });
  const { status, error } = useEvent(player, "statusChange", { status: player.status });
  // Video açılamazsa sebep Expo terminaline/konsola yazılır (arka plan düz koyu kalır).
  useEffect(() => {
    if (status === "error") console.warn(`[video] oynatılamadı: ${error?.message ?? "bilinmeyen hata"}`);
  }, [status, error]);
  // Web: setup'taki play() henüz bağlı <video> olmadığı için etkisiz kalır; VideoView kendi efektinde
  // <video>'yu bağladıktan sonra (alt bileşen efektleri önce çalışır) burada tekrar başlatılır.
  useEffect(() => {
    player.play();
  }, [player]);
  if (status === "error") return null;
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
      // Android: varsayılan SurfaceView ayrı katmanda çizilir, üstteki koyu katman/içerikle birlikte
      // görünmeyebilir; TextureView normal görünüm gibi katmanlanır.
      surfaceType="textureView"
      playsInline
      allowsPictureInPicture={false}
    />
  );
}

// Kaynaklı bilgiler sırayla, yumuşak geçişle (fade out → metin değişir → fade in).
function RotatingFact() {
  const [index, setIndex] = useState(0);
  // Animated.Value bileşen ömrü boyunca tek örnek (useState başlatıcısı: render'da ref okunmaz).
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => {
        setIndex((current) => (current + 1) % LOADING_FACTS.length);
        Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
      });
    }, FACT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [opacity]);

  const fact = LOADING_FACTS[index];
  return (
    <Animated.View style={[styles.fact, { opacity }]} accessibilityLiveRegion="polite">
      <Text style={styles.factText}>{fact.text}</Text>
      <Text style={styles.factSource}>Kaynak: {fact.source}</Text>
    </Animated.View>
  );
}

// "loading" adımı: analiz sürerken videolu bekleme ekranı, başarısız olursa hata + tekrar dene.
export default function LoadingView({ error, onRetry, onBack, photoUri }: Props) {
  if (error) {
    return (
      <View style={styles.errorContainer}>
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
      <BackgroundVideo />
      <View style={styles.overlay} />
      <View style={styles.content}>
        <Wordmark inverted />
        <View style={styles.center}>
          {photoUri && <Image source={{ uri: photoUri }} style={styles.preview} />}
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.title}>AI Ürün Kalitesini Analiz Ediyor...</Text>
        </View>
        <RotatingFact />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#16211a" },
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(10, 20, 12, 0.62)",
  },
  content: { flex: 1, padding: 20, justifyContent: "space-between" },
  center: { alignItems: "center", gap: 16 },
  preview: {
    width: 96,
    height: 96,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
  },
  title: { fontSize: 16, fontWeight: "600", color: "#ffffff", textAlign: "center" },
  fact: { minHeight: 96, gap: 6, paddingBottom: 8 },
  factText: { fontSize: 15, lineHeight: 22, color: "#ffffff", textAlign: "center" },
  factSource: { fontSize: 12, color: "rgba(255,255,255,0.75)", textAlign: "center" },
  errorContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 20 },
  errorTitle: { fontSize: 20, fontWeight: "700", color: "#c62828" },
  errorText: { fontSize: 15, color: "#333", textAlign: "center", lineHeight: 22 },
  button: { alignSelf: "stretch", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  primary: { backgroundColor: "#2e7d32" },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondary: { backgroundColor: "#e8f5e9" },
  secondaryText: { color: "#2e7d32", fontSize: 15, fontWeight: "600" },
});
