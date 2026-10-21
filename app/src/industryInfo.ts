import type { Industry } from "./types";

// Endüstri etiketine dokununca gösterilen kısa bilgi (statik sözlük, Faz C.3).
// Atık türü + sektör → bu atıktan tipik olarak ne üretilir. Genel örneklerdir; firma/ürün iddiası değildir.

type WasteCategory = "narenciye" | "kahve" | "elma_armut" | "sebze" | "genel";

const CATEGORY_KEYWORDS: [WasteCategory, RegExp][] = [
  ["narenciye", /portakal|mandalina|limon|greyfurt|narenciye|turunç|bergamot/i],
  ["kahve", /kahve/i],
  ["elma_armut", /elma|armut|ayva/i],
  ["sebze", /domates|patates|havuç|soğan|biber|lahana|sebze|marul|ıspanak|kabak/i],
];

const CATEGORY_LABELS: Record<WasteCategory, string> = {
  narenciye: "narenciye kabuğu",
  kahve: "kahve posası",
  elma_armut: "elma/armut posası",
  sebze: "sebze atığı",
  genel: "meyve-sebze yan ürünü",
};

const INFO: Record<WasteCategory, Record<Industry, string>> = {
  narenciye: {
    kozmetik: "Kabuktan soğuk sıkım veya damıtma ile limonen içeren uçucu yağ; parfüm ve cilt bakımında koku/aktif bileşen.",
    biyoplastik: "Kabuktaki pektin ve selüloz; pektin bazlı biyobozunur film ve ambalaj denemelerinde kullanılır.",
    alternatif_gida: "Kurutulmuş kabuktan pektin (jel yapıcı) ve diyet lifi; gıdalarda kıvam ve lif katkısı.",
    "3d_filament": "Kurutulup öğütülen kabuk tozu, PLA ile karıştırılarak biyokompozit filament katkısı olarak kullanılabilir.",
    vegan_deri: "Meyve posası ve lifleri bitkisel deri alternatiflerinde dolgu malzemesi olarak denenmektedir (gelişen alan).",
  },
  kahve: {
    kozmetik: "Kurutulmuş posa peeling/ovma ürünlerinde; posadan elde edilen kahve yağı cilt bakımında.",
    biyoplastik: "Posa, biyopolimerlerle karıştırılarak kahve posası katkılı biyokompozit (kap, kapak) üretiminde.",
    alternatif_gida: "Posanın lif ve antioksidan içeriği gıda katkısı olarak araştırılmaktadır (araştırma aşaması).",
    "3d_filament": "İnce öğütülmüş posa PLA ile karıştırılarak kahve posası katkılı filament yapılır.",
    vegan_deri: "Kahve posası, bitkisel deri ve tekstil kaplamalarında dolgu/katkı olarak kullanılmaktadır (gelişen alan).",
  },
  elma_armut: {
    kozmetik: "Posadan polifenol ve meyve asidi özütleri; cilt bakım ürünlerinde aktif bileşen.",
    biyoplastik: "Elma posasındaki pektin ve selüloz, biyobozunur film ve kompozitlerde ham madde.",
    alternatif_gida: "Kurutulup öğütülen posadan meyve lifi/unu; unlu mamullerde lif katkısı.",
    "3d_filament": "Kurutulmuş posa lifleri biyokompozit filament katkısı olarak denenebilir.",
    vegan_deri: "Elma posası, bazı ticari bitkisel deri alternatiflerinde temel bileşenlerden biridir.",
  },
  sebze: {
    kozmetik: "Sebze özütleri (ör. domates kabuğundan likopen) cilt bakım ürünlerinde antioksidan bileşen.",
    biyoplastik: "Nişastalı sebzeler (ör. patates) nişasta bazlı biyoplastik üretiminde ham madde.",
    alternatif_gida: "Kurutulmuş sebze tozları ve lif konsantreleri; gıdalarda besin ve renk katkısı.",
    "3d_filament": "Lifli sebze atıkları kurutulup öğütülerek biyokompozit filament katkısı olarak denenebilir.",
    vegan_deri: "Sebze lifleri bitkisel deri alternatiflerinde dolgu/takviye olarak araştırılmaktadır.",
  },
  genel: {
    kozmetik: "Meyve-sebze özütleri ve yağları cilt bakım ürünlerinde aktif bileşen veya koku olarak.",
    biyoplastik: "Pektin, nişasta ve selüloz içeren yan ürünler biyobozunur plastik ve kompozitlerde ham madde.",
    alternatif_gida: "Kurutulup öğütülen yan ürünler lif/un olarak veya özüt olarak gıda katkısı.",
    "3d_filament": "Kurutulup öğütülen lifli yan ürünler PLA bazlı biyokompozit filamentlerde katkı.",
    vegan_deri: "Meyve-sebze posası bitkisel deri alternatiflerinde dolgu malzemesi olarak (gelişen alan).",
  },
};

function detectCategory(text: string): WasteCategory {
  return CATEGORY_KEYWORDS.find(([, pattern]) => pattern.test(text))?.[0] ?? "genel";
}

/** AI'ın ürün türü ve kullanıcının beyanından kategori belirlenir; bulunamazsa genel metin. */
export function industryInfo(
  industry: Industry,
  productType: string,
  wasteType: string
): { wasteLabel: string; text: string } {
  const category = detectCategory(`${productType} ${wasteType}`);
  return { wasteLabel: CATEGORY_LABELS[category], text: INFO[category][industry] };
}
