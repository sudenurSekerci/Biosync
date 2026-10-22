import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { Match } from "../types";

type Props = {
  lat: number;
  lng: number;
  radiusKm: number;
  matches: Match[];
  selectedBuyerId: string | null;
  onSelectBuyer: (buyerId: string) => void;
};

// Harita: WebView içinde Leaflet + OpenStreetMap görüntüleri (anahtarsız, Expo Go'da çalışır).
// react-native-maps bırakıldı: Expo Go/Android'de Google Maps SDK haritayı hiç çizmedi
// (onMapReady geldi, onMapLoaded ve tek bir görüntü isteği gelmedi). Ayrıntı: docs/ESLESTIRME_MANTIGI.md §7.
// Leaflet CDN'den sabit sürüm + SRI ile yüklenir; OSM kullanım koşulu gereği atıf görünür kalır.
//
// Mesajlaşma (sayfa yeniden yüklenmez, zoom korunur):
// - Sayfa → uygulama: "biosync-harita:" + JSON {type:"error",message} | {type:"select",id}
// - Uygulama → sayfa: mobilde injectJavaScript, web'de iframe postMessage → window.biosyncSelect(id)

const COLORS = { user: "#1565c0", best: "#2e7d32", other: "#ef6c00", selected: "#111111" };

// OSM kullanım koşulu: geçerli Referer. Sayfa bu adres altında yüklenmiş sayılır.
const BASE_URL = "https://github.com/sudenurSekerci/Biosync";

type MapPoint = { id: string | null; lat: number; lng: number; label: string; color: string };

const MESSAGE_PREFIX = "biosync-harita:";
const MAP_ERROR_TEXT = "Harita çizilirken bir hata oluştu.";

type PageMessage = { type: "error"; message: string } | { type: "select"; id: string };

// Harita sayfasından gelen ham mesajı çözer; bizim değilse null.
function parsePageMessage(raw: unknown): PageMessage | null {
  if (typeof raw !== "string" || !raw.startsWith(MESSAGE_PREFIX)) return null;
  try {
    const message = JSON.parse(raw.slice(MESSAGE_PREFIX.length)) as PageMessage;
    if (message.type === "error") console.warn(`[harita] ${message.message}`);
    return message;
  } catch {
    return null;
  }
}

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
  // Uygulamaya mesaj: mobilde WebView köprüsü, web'de iframe'in üst penceresi.
  function send(message) {
    var text = "${MESSAGE_PREFIX}" + JSON.stringify(message);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
    else if (window.parent !== window) window.parent.postMessage(text, "*");
  }
  // Sayfadaki JS hataları uygulamaya iletilir (sessizce boş harita kalmasın).
  window.onerror = function (message) {
    send({ type: "error", message: String(message) });
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

  var buyerMarkers = {};
  var line = null;
  var BASE_STYLE = { radius: 8, color: "#ffffff", weight: 2 };

  data.points.forEach(function (p) {
    var label = document.createElement("div");
    label.textContent = p.label;
    var marker = L.circleMarker([p.lat, p.lng], {
      radius: 8, color: "#ffffff", weight: 2, fillColor: p.color, fillOpacity: 1
    }).addTo(map);
    if (p.id) {
      marker.bindTooltip(label, { direction: "top" });
      marker.on("click", function () {
        window.biosyncSelect(p.id);
        send({ type: "select", id: p.id });
      });
      buyerMarkers[p.id] = marker;
    } else {
      marker.bindPopup(label);
    }
  });

  // Seçili alıcıyı vurgula + ilan–alıcı çizgisi; id null ise vurguyu kaldır.
  window.biosyncSelect = function (id) {
    Object.keys(buyerMarkers).forEach(function (key) {
      buyerMarkers[key].setStyle(BASE_STYLE);
      buyerMarkers[key].closeTooltip();
    });
    if (line) { map.removeLayer(line); line = null; }
    var marker = buyerMarkers[id];
    if (!marker) return;
    marker.setStyle({ radius: 12, color: "${COLORS.selected}", weight: 3 });
    marker.bringToFront();
    line = L.polyline([data.center, marker.getLatLng()], {
      color: "${COLORS.selected}", weight: 2, dashArray: "6 6"
    }).addTo(map);
    marker.openTooltip();
  };

  // Web (iframe): uygulamadan gelen seçim.
  window.addEventListener("message", function (event) {
    var d = event.data;
    if (d && d.source === "biosync-app" && d.type === "select") window.biosyncSelect(d.id);
  });
</script>
</body>
</html>`;
}

// Kullanıcı + yalnızca eşleşen (yarıçap içindeki) alıcılar + yarıçap dairesi.
export default function MatchMap({ lat, lng, radiusKm, matches, selectedBuyerId, onSelectBuyer }: Props) {
  const [error, setError] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Olay dinleyicileri en güncel değerleri görsün diye ref'te tutulur.
  const selectedRef = useRef(selectedBuyerId);
  const onSelectRef = useRef(onSelectBuyer);
  useEffect(() => {
    selectedRef.current = selectedBuyerId;
    onSelectRef.current = onSelectBuyer;
  });

  function handlePageMessage(raw: unknown) {
    const message = parsePageMessage(raw);
    if (message?.type === "error") setError(MAP_ERROR_TEXT);
    if (message?.type === "select") onSelectRef.current(message.id);
  }

  // Seçimi harita sayfasına ilet (sayfa yeniden yüklenmez).
  function pushSelection(id: string | null) {
    if (Platform.OS === "web") {
      iframeRef.current?.contentWindow?.postMessage({ source: "biosync-app", type: "select", id }, "*");
    } else {
      webViewRef.current?.injectJavaScript(
        `window.biosyncSelect && window.biosyncSelect(${JSON.stringify(id)}); true;`
      );
    }
  }

  useEffect(() => {
    pushSelection(selectedBuyerId);
  }, [selectedBuyerId]);

  // Web: iframe'den gelen mesajları dinle.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onMessage = (event: MessageEvent) => handlePageMessage(event.data);
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const html = useMemo(() => {
    const points: MapPoint[] = [
      { id: null, lat, lng, label: "İlanınız", color: COLORS.user },
      ...matches.map((match, index) => ({
        id: match.buyer.id,
        lat: match.buyer.lat,
        lng: match.buyer.lng,
        label: `${match.buyer.name} (kurgusal) · ${match.distanceKm} km`,
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
        ) : Platform.OS === "web" ? (
          // react-native-webview web'de çalışmaz: aynı Leaflet sayfası iframe ile gösterilir.
          <iframe
            ref={iframeRef}
            srcDoc={html}
            title="Eşleşme haritası"
            style={IFRAME_STYLE}
            onLoad={() => pushSelection(selectedRef.current)}
          />
        ) : (
          <WebView
            ref={webViewRef}
            source={{ html, baseUrl: BASE_URL }}
            originWhitelist={["*"]}
            nestedScrollEnabled
            setSupportMultipleWindows={false}
            onMessage={(event: WebViewMessageEvent) => handlePageMessage(event.nativeEvent.data)}
            onLoadEnd={() => pushSelection(selectedRef.current)}
            onError={() => setError("Harita yüklenemedi. İnternet bağlantınızı kontrol edin.")}
            style={styles.map}
          />
        )}
      </View>
      <View style={styles.legend}>
        <Text style={[styles.legendItem, { color: COLORS.user }]}>● İlanınız</Text>
        <Text style={[styles.legendItem, { color: COLORS.best }]}>● En kârlı</Text>
        <Text style={[styles.legendItem, { color: COLORS.other }]}>● Diğer eşleşmeler</Text>
        <Text style={styles.legendHint}>Noktaya dokunun: alıcı kartı açılır</Text>
      </View>
    </View>
  );
}

// Yalnız web (DOM öğesi): RN StyleSheet değil, düz CSS.
const IFRAME_STYLE = { border: 0, width: "100%", height: "100%" };

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  // borderRadius + overflow:"hidden" yok: Android'de WebView kırpması çizim sorunlarına yol açabiliyor.
  container: { height: 280, backgroundColor: "#e8eee8" },
  map: { flex: 1 },
  error: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  errorText: { color: "#c62828", fontSize: 14, textAlign: "center" },
  legend: { flexDirection: "row", gap: 12, flexWrap: "wrap", alignItems: "center" },
  legendItem: { fontSize: 12, fontWeight: "600" },
  legendHint: { fontSize: 12, color: "#777" },
});
