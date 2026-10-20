import { StyleSheet, View } from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";
import type { Match } from "../types";

type Props = { lat: number; lng: number; radiusKm: number; matches: Match[] };

const KM_PER_DEGREE_LAT = 111;

// Kullanıcı + yalnızca eşleşen (yarıçap içindeki) alıcılar + yarıçap dairesi.
export default function MatchMap({ lat, lng, radiusKm, matches }: Props) {
  // Dairenin tamamı görünsün: çap + %20 pay.
  const latitudeDelta = ((radiusKm * 2) / KM_PER_DEGREE_LAT) * 1.2;
  const longitudeDelta = latitudeDelta / Math.max(Math.cos((lat * Math.PI) / 180), 0.1);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{ latitude: lat, longitude: lng, latitudeDelta, longitudeDelta }}
      >
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 280, borderRadius: 12, overflow: "hidden" },
  map: { flex: 1 },
});
