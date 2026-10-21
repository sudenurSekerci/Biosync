// Yükleme ekranında sırayla gösterilen bilgiler. Her biri birincil kaynaktan doğrulandı;
// birebir alıntılar ve sayfa numaraları: docs/KAYNAKLAR.md §1. Kaynağı doğrulanmayan bilgi eklenmez.

export type LoadingFact = { text: string; source: string };

export const LOADING_FACTS: LoadingFact[] = [
  {
    text: "2022'de dünyada perakende, gıda hizmetleri ve hanelerde tahminen 1,05 milyar ton gıda israf edildi.",
    source: "UNEP, Food Waste Index Report 2024",
  },
  {
    text: "Tüketiciye ulaşan gıdanın yaklaşık %19'u israf ediliyor.",
    source: "UNEP, Food Waste Index Report 2024",
  },
  {
    text: "Gıda kaybı ve israfı, küresel sera gazı emisyonlarının tahmini %8–10'undan sorumlu.",
    source: "UNEP, Food Waste Index Report 2024",
  },
  {
    text: "Üretilen gıdanın yaklaşık %14'ü hasattan sonra, perakendeye ulaşmadan kayboluyor.",
    source: "FAO, The State of Food and Agriculture 2019",
  },
  {
    text: "Üretilen toplam gıdanın %25–30'u kaybediliyor ya da israf ediliyor.",
    source: "IPCC, İklim Değişikliği ve Arazi (SRCCL) 2019",
  },
  {
    text: "Gıda israf edilirken her yıl 783 milyona kadar insan açlıktan etkileniyor.",
    source: "UNEP, Food Waste Index Report 2024",
  },
];
