import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import type { Listing } from "../types";

type Photo = { uri: string; base64: string; mimeType: string };

// Form verisi App'te tutulur: form yalnızca "form" adımında çizilir, "Forma dön"de veri korunur.
export type FormDraft = {
  photo: Photo | null;
  wasteType: string;
  quantityText: string;
  latText: string;
  lngText: string;
  manualLocation: boolean;
};

export const EMPTY_DRAFT: FormDraft = {
  photo: null,
  wasteType: "",
  quantityText: "",
  latText: "",
  lngText: "",
  manualLocation: false,
};

type Props = {
  draft: FormDraft;
  onDraftChange: (patch: Partial<FormDraft>) => void;
  onSubmit: (listing: Listing) => void;
};

// "12,5" gibi virgüllü girişleri de kabul eder; geçersizse null.
function parseNumber(text: string): number | null {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 0.5,
  base64: true,
};

export default function UploadForm({ draft, onDraftChange, onSubmit }: Props) {
  const { photo, wasteType, quantityText, latText, lngText, manualLocation } = draft;
  // Kısmi güncelleme: App tarafında önceki duruma birleştirilir (async akışlarda eski değer ezilmez).
  const setPhoto = (value: Photo) => onDraftChange({ photo: value });
  const setWasteType = (value: string) => onDraftChange({ wasteType: value });
  const setQuantityText = (value: string) => onDraftChange({ quantityText: value });
  const setLatText = (value: string) => onDraftChange({ latText: value });
  const setLngText = (value: string) => onDraftChange({ lngText: value });
  const setManualLocation = (value: boolean) => onDraftChange({ manualLocation: value });
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function pickPhoto(source: "camera" | "gallery") {
    setNotice(null);
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setNotice(
          source === "camera"
            ? "Kamera izni verilmedi. Galeriden seçebilir veya ayarlardan izin verebilirsiniz."
            : "Galeri izni verilmedi. Kamerayı kullanabilir veya ayarlardan izin verebilirsiniz."
        );
        return;
      }
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
          : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64) {
        setNotice("Fotoğraf okunamadı. Lütfen tekrar deneyin.");
        return;
      }
      setPhoto({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType ?? "image/jpeg" });
    } catch {
      setNotice(
        source === "camera"
          ? "Kamera açılamadı. Galeriden seçmeyi deneyin."
          : "Galeri açılamadı. Lütfen tekrar deneyin."
      );
    }
  }

  async function fetchLocation() {
    setNotice(null);
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setManualLocation(true);
        setNotice("Konum izni verilmedi. Enlem ve boylamı elle girebilirsiniz.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      onDraftChange({
        latText: position.coords.latitude.toFixed(5),
        lngText: position.coords.longitude.toFixed(5),
      });
    } catch {
      setManualLocation(true);
      setNotice("Konum alınamadı. Enlem ve boylamı elle girebilirsiniz.");
    } finally {
      setLocating(false);
    }
  }

  const quantityKg = parseNumber(quantityText);
  const lat = parseNumber(latText);
  const lng = parseNumber(lngText);

  const missing: string[] = [];
  if (!photo) missing.push("fotoğraf");
  if (wasteType.trim() === "") missing.push("atık türü");
  if (quantityKg === null || quantityKg <= 0) missing.push("miktar");
  if (lat === null || lat < -90 || lat > 90 || lng === null || lng < -180 || lng > 180) {
    missing.push("konum");
  }
  const canSubmit = missing.length === 0;

  function handleSubmit() {
    if (!canSubmit || !photo || quantityKg === null || lat === null || lng === null) return;
    onSubmit({
      wasteType: wasteType.trim(),
      quantityKg,
      lat,
      lng,
      imageBase64: photo.base64,
      mimeType: photo.mimeType,
    });
  }

  const hasLocation = lat !== null && lng !== null;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Yeni İlan</Text>
      <Text style={styles.subtitle}>Yan ürününüzü yükleyin, AI kalitesini değerlendirsin.</Text>

      {notice && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      )}

      <Text style={styles.label}>Fotoğraf</Text>
      {photo ? (
        <Image source={{ uri: photo.uri }} style={styles.preview} />
      ) : (
        <View style={[styles.preview, styles.previewEmpty]}>
          <Text style={styles.muted}>Henüz fotoğraf seçilmedi</Text>
        </View>
      )}
      <View style={styles.row}>
        <Pressable style={[styles.button, styles.secondary]} onPress={() => pickPhoto("camera")}>
          <Text style={styles.secondaryText}>Kamera</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.secondary]} onPress={() => pickPhoto("gallery")}>
          <Text style={styles.secondaryText}>Galeri</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Atık türü</Text>
      <TextInput
        style={styles.input}
        value={wasteType}
        onChangeText={setWasteType}
        placeholder="örn. portakal kabuğu, kahve posası"
      />

      <Text style={styles.label}>Miktar (kg)</Text>
      <TextInput
        style={styles.input}
        value={quantityText}
        onChangeText={setQuantityText}
        placeholder="örn. 500"
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Konum</Text>
      <Pressable
        style={[styles.button, styles.secondary, locating && styles.disabled]}
        onPress={fetchLocation}
        disabled={locating}
      >
        {locating ? (
          <ActivityIndicator />
        ) : (
          <Text style={styles.secondaryText}>Konumumu al</Text>
        )}
      </Pressable>
      {manualLocation ? (
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex]}
            value={latText}
            onChangeText={setLatText}
            placeholder="Enlem (örn. 38.42)"
            keyboardType="numbers-and-punctuation"
          />
          <TextInput
            style={[styles.input, styles.flex]}
            value={lngText}
            onChangeText={setLngText}
            placeholder="Boylam (örn. 27.14)"
            keyboardType="numbers-and-punctuation"
          />
        </View>
      ) : (
        <Text style={styles.muted}>
          {hasLocation ? `Konum: ${latText}, ${lngText}` : "Konum henüz alınmadı"}
        </Text>
      )}
      {!manualLocation && (
        <Pressable onPress={() => setManualLocation(true)}>
          <Text style={styles.link}>Konumu elle gir</Text>
        </Pressable>
      )}

      <Pressable
        style={[styles.button, styles.primary, !canSubmit && styles.disabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        <Text style={styles.primaryText}>Analiz Et</Text>
      </Pressable>
      {!canSubmit && <Text style={styles.muted}>Eksik: {missing.join(", ")}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 56, gap: 8 },
  title: { fontSize: 24, fontWeight: "700", color: "#1b3a1b" },
  subtitle: { fontSize: 14, color: "#555", marginBottom: 8 },
  label: { fontSize: 15, fontWeight: "600", marginTop: 12, color: "#222" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  row: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
  preview: { width: "100%", height: 180, borderRadius: 8 },
  previewEmpty: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#bbb",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fafafa",
  },
  button: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: "#2e7d32", marginTop: 24 },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondary: { backgroundColor: "#e8f5e9" },
  secondaryText: { color: "#2e7d32", fontSize: 15, fontWeight: "600" },
  disabled: { opacity: 0.4 },
  muted: { fontSize: 13, color: "#777" },
  link: { fontSize: 13, color: "#2e7d32", textDecorationLine: "underline" },
  notice: { backgroundColor: "#fff4e5", borderRadius: 8, padding: 12 },
  noticeText: { color: "#8a4b00", fontSize: 14 },
});
