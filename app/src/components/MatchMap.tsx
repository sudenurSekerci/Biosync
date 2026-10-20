import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Circle, Marker, UrlTile } from "react-native-maps";
import type { Match } from "../types";

type Props = { lat: number; lng: number; radiusKm: number; matches: Match[] };

const KM_PER_DEGREE_LAT = 111;

// Anahtarsız harita: OpenStreetMap görüntüleri. Android'de Google katmanı kapatılır
// (mapType "none"), görüntüler UrlTile ile yüklenir. OSM kullanım koşulu gereği atıf zorunlu.
// Not: tile.openstreetmap.org yoğun trafik için değildir; demo içindir.
const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

// Kullanıcı + yalnızca eşleşen (yarıçap içindeki) alıcılar + yarıçap dairesi.
export default function MatchMap({ lat, lng, radiusKm, matches }: Props) {
  // Dairenin tamamı görünsün: çap + %20 pay.
  const latitudeDelta = ((radiusKm * 2) / KM_PER_DEGREE_LAT) * 1.2;
  const longitudeDelta = latitudeDelta / Math.max(Math.cos((lat * Math.PI) / 180), 0.1);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        mapType={Platform.OS === "android" ? "none" : "standard"}
        initialRegion={{ latitude: lat, longitude: lng, latitudeDelta, longitudeDelta }}
      >
        <UrlTile urlTemplate={OSM_TILE_URL} maximumZ={19} shouldReplaceMapContent />
        <Circle
          center={{ latitude: lat, longitude: lng }}
          radius={radiusKm * 1000}
          strokeColor="rgba(46,125,50,0.8)"
          strokeWidth={2}
          fillColor="rgba(46,125,50,0.08)"
        />
        <Marker
          coordinate={{ latitude: lat, longitude: lng }}
          title="İlanınız"
          pinColor="blue"
        />
        {matches.map((match, index) => (
          <Marker
            key={match.buyer.id}
            coordinate={{ latitude: match.buyer.lat, longitude: match.buyer.lng }}
            title={match.buyer.name}
            description={`${match.distanceKm} km · ${match.buyer.locationName} (kurgusal)`}
            pinColor={index === 0 ? "green" : "orange"}
          />
        ))}
      </MapView>
      <Text style={styles.attribution}>© OpenStreetMap katkıda bulunanlar</Text>
    </View>
  );
}

// Not: borderRadius + overflow:"hidden" kullanılmıyor; Android'de harita yüzeyini
// kırpmak haritanın siyah çizilmesine yol açabiliyor.
const styles = StyleSheet.create({
  container: { height: 280 },
  map: { flex: 1 },
  attribution: {
    position: "absolute",
    right: 4,
    bottom: 4,
    fontSize: 10,
    color: "#333",
    backgroundColor: "rgba(255,255,255,0.8)",
    paddingHorizontal: 4,
  },
});
