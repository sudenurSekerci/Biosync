import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { Match } from "../types";

type Props = { lat: number; lng: number; radiusKm: number; matches: Match[] };

// Harita: WebView içinde Leaflet + OpenStreetMap görüntüleri (anahtarsız, Expo Go'da çalışır).
// react-native-maps bırakıldı: Expo Go/Android'de Google Maps SDK haritayı hiç çizmedi
// (onMapReady geldi, onMapLoaded ve tek bir görüntü isteği gelmedi). Ayrıntı: docs/ESLESTIRME_MANTIGI.md §7.
// Leaflet CDN'den sabit sürüm + SRI ile yüklenir; OSM kullanım koşulu gereği atıf görünür kalır.

const COLORS = { user: "#1565c0", best: "#2e7d32", other: "#ef6c00" };

// OSM kullanım koşulu: geçerli Referer. Sayfa bu adres altında yüklenmiş sayılır.
const BASE_URL = "https://github.com/sudenurSekerci/Biosync";

type MapPoint = { lat: number; lng: number; label: string; color: string };

function buildHtml(center: [number, number], radiusM: number, points: MapPoint[]): string {
  // JSON'u <script> içine güvenle gömmek için "<" kaçırılır.
  const data = JSON.stringify({ center, radiusM, points }).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
  integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<style>html, body, #map { height: 100%; margin: 0; background: #e8eee8; }</style>
</head>
<body>
<div id="map"></div>
<script>
  // Sayfadaki JS hataları uygulamaya iletilir (sessizce boş harita kalmasın).
  window.onerror = function (message) {
    window.ReactNativeWebView.postMessage("error:" + message);
  };
</script>
<script>
  var data = ${data};
  var map = L.map("map");
  map.attributionControl.setPrefix(false);
  // Görünüm katmanlardan ÖNCE kurulur: circle.getBounds() daire haritaya
  // bağlanmadan çağrılırsa TypeError verir ve hiçbir katman çizilmez.
  map.fitBounds(L.latLng(data.center).toBounds(data.radiusM * 2));
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap katkıda bulunanlar"
  }).addTo(map);
  L.circle(data.center, {
    radius: data.radiusM, color: "#2e7d32", weight: 2, fillOpacity: 0.08
  }).addTo(map);
  data.points.forEach(function (p) {
    var label = document.createElement("div");
    label.textContent = p.label;
    L.circleMarker([p.lat, p.lng], {
      radius: 8, color: "#ffffff", weight: 2, fillColor: p.color, fillOpacity: 1
    }).addTo(map).bindPopup(label);
  });
</script>
</body>
</html>`;
}

// Kullanıcı + yalnızca eşleşen (yarıçap içindeki) alıcılar + yarıçap dairesi.
export default function MatchMap({ lat, lng, radiusKm, matches }: Props) {
  const [error, setError] = useState<string | null>(null);

  function handleMessage(event: WebViewMessageEvent) {
    const message = event.nativeEvent.data;
    if (message.startsWith("error:")) {
      console.warn(`[harita] ${message}`);
      setError("Harita çizilirken bir hata oluştu.");
    }
  }

  const html = useMemo(() => {
    const points: MapPoint[] = [
      { lat, lng, label: "İlanınız", color: COLORS.user },
      ...matches.map((match, index) => ({
        lat: match.buyer.lat,
        lng: match.buyer.lng,
        label: `${match.buyer.name} (kurgusal) · ${match.distanceKm} km · ${match.buyer.locationName}`,
        color: index === 0 ? COLORS.best : COLORS.other,
      })),
    ];
    return buildHtml([lat, lng], radiusKm * 1000, points);
  }, [lat, lng, radiusKm, matches]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {error ? (
          <View style={styles.error}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <WebView
            source={{ html, baseUrl: BASE_URL }}
            originWhitelist={["*"]}
            nestedScrollEnabled
            setSupportMultipleWindows={false}
            onMessage={handleMessage}
            onError={() => setError("Harita yüklenemedi. İnternet bağlantınızı kontrol edin.")}
            style={styles.map}
          />
        )}
      </View>
      <View style={styles.legend}>
        <Text style={[styles.legendItem, { color: COLORS.user }]}>● İlanınız</Text>
        <Text style={[styles.legendItem, { color: COLORS.best }]}>● En kârlı</Text>
        <Text style={[styles.legendItem, { color: COLORS.other }]}>● Diğer eşleşmeler</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  // borderRadius + overflow:"hidden" yok: Android'de WebView kırpması çizim sorunlarına yol açabiliyor.
  container: { height: 280, backgroundColor: "#e8eee8" },
  map: { flex: 1 },
  error: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  errorText: { color: "#c62828", fontSize: 14, textAlign: "center" },
  legend: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  legendItem: { fontSize: 12, fontWeight: "600" },
});
