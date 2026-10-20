import type { Buyer } from "../lib/schema";

// TÜM ALICILAR KURGUSALDIR (demo). Firma adları uydurmadır; konumlar yalnızca
// gerçekçi olsun diye bilinen sanayi bölgeleri/teknoparklar civarına yerleştirildi.
//
// Her şehirde 4 alıcı (şehir merkezindeki demo noktasına göre, 100 kg / ~90 puanlık ilan için):
//   - 50 km içinde, farklı endüstrilerden 2 kârlı alıcı
//   - 50 km içinde ama düşük fiyat + uzak mesafe yüzünden zarar eden 1 alıcı
//   - 60-80 km uzakta, yarıçap dışı 1 alıcı
// Demo noktaları: İstanbul Ümraniye (41.0160, 29.1200), Ankara Kızılay (39.9200, 32.8540),
// Antalya Muratpaşa (36.8870, 30.7050). Mesafeler lib/matching.test.ts'te doğrulanır.

export const BUYERS: Buyer[] = [
  // --- İstanbul ---
  {
    id: "ist-1",
    name: "Kabuktan Polimer Ar-Ge",
    industries: ["biyoplastik", "3d_filament"],
    lat: 41.1055,
    lng: 29.0230,
    pricePerKg: 12,
    locationName: "İTÜ Arı Teknokent, Maslak",
    isFictional: true,
  },
  {
    id: "ist-2",
    name: "Liflen Vegan Deri Atölyesi",
    industries: ["vegan_deri", "kozmetik"],
    lat: 40.8800,
    lng: 29.3300,
    pricePerKg: 9,
    locationName: "Tuzla Deri OSB",
    isFictional: true,
  },
  {
    id: "ist-3",
    name: "Marmara Lif Hammadde",
    industries: ["alternatif_gida", "biyoplastik"],
    lat: 40.7800,
    lng: 29.5300,
    pricePerKg: 2,
    locationName: "Dilovası OSB, Kocaeli",
    isFictional: true,
  },
  {
    id: "ist-4",
    name: "Trakya Doğal Kozmetik",
    industries: ["kozmetik", "alternatif_gida"],
    lat: 41.0730,
    lng: 28.2470,
    pricePerKg: 14,
    locationName: "Silivri Sanayi Bölgesi",
    isFictional: true,
  },

  // --- Ankara ---
  {
    id: "ank-1",
    name: "Bozkır Biyoaktif Kozmetik",
    industries: ["kozmetik", "alternatif_gida"],
    lat: 39.9000,
    lng: 32.7760,
    pricePerKg: 13,
    locationName: "ODTÜ Teknokent",
    isFictional: true,
  },
  {
    id: "ank-2",
    name: "Başkent Biyomalzeme",
    industries: ["biyoplastik", "vegan_deri"],
    lat: 39.9600,
    lng: 32.5600,
    pricePerKg: 8,
    locationName: "Sincan OSB",
    isFictional: true,
  },
  {
    id: "ank-3",
    name: "Anadolu Filament Geri Kazanım",
    industries: ["3d_filament", "kozmetik"],
    lat: 39.7800,
    lng: 32.3700,
    pricePerKg: 2.5,
    locationName: "Başkent OSB, Malıköy",
    isFictional: true,
  },
  {
    id: "ank-4",
    name: "Polatlı Tarım Biyoteknoloji",
    industries: ["biyoplastik", "alternatif_gida"],
    lat: 39.5800,
    lng: 32.1500,
    pricePerKg: 15,
    locationName: "Polatlı OSB",
    isFictional: true,
  },

  // --- Antalya ---
  {
    id: "ayt-1",
    name: "Akdeniz Narenciye Gıda Ar-Ge",
    industries: ["alternatif_gida", "3d_filament"],
    lat: 36.8970,
    lng: 30.6500,
    pricePerKg: 11,
    locationName: "Antalya Teknokent, Akdeniz Üniversitesi",
    isFictional: true,
  },
  {
    id: "ayt-2",
    name: "Toros Yeşil Polimer",
    industries: ["kozmetik", "biyoplastik"],
    lat: 36.9300,
    lng: 30.5800,
    pricePerKg: 10,
    locationName: "Antalya OSB, Döşemealtı",
    isFictional: true,
  },
  {
    id: "ayt-3",
    name: "Serik Lif ve Deri Hammadde",
    industries: ["vegan_deri", "alternatif_gida"],
    lat: 36.9200,
    lng: 31.1000,
    pricePerKg: 2,
    locationName: "Serik Sanayi Sitesi",
    isFictional: true,
  },
  {
    id: "ayt-4",
    name: "Manavgat Doğal Özler",
    industries: ["kozmetik", "biyoplastik"],
    lat: 36.7900,
    lng: 31.4200,
    pricePerKg: 14,
    locationName: "Manavgat OSB",
    isFictional: true,
  },
];
