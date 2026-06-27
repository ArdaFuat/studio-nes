const SITE_LINKS = [
  {
    name: "Instagram",
    handle: "@bynessart",
    description: "Güncel işler, atölye paylaşımları ve duyurular.",
    url: "https://www.instagram.com/bynessart?igsh=OWxyYWI5YWpseWE1",
    type: "Sosyal medya"
  },
  {
    name: "TikTok",
    handle: "@artness_",
    description: "Kısa video içerikleri ve üretim sürecinden kesitler.",
    url: "https://www.tiktok.com/@artness_",
    type: "Sosyal medya"
  },
  {
    name: "Shopier",
    handle: "nessbyk",
    description: "Tablo ürün sayfaları, fiyatlar ve sipariş kontrolü.",
    url: "https://www.shopier.com/nessbyk?utm_source=ig&utm_medium=social&utm_content=link_in_bio&utm_id=97760_v0_s00_e0_tv3",
    type: "Satış"
  },
  {
    name: "Gardrops",
    handle: "nessbyk",
    description: "Satış profili, özel sipariş örnekleri ve ürün yönlendirmeleri.",
    url: "https://www.gardrops.com/nessbyk-u-15646955",
    type: "Satış"
  },
  {
    name: "Dolap",
    handle: "nessbyk",
    description: "Dolap satış profiline yönlendirme.",
    url: "https://link.dolap.com/ukcevl",
    type: "Satış"
  }
];

const ARTWORKS = [
  {
    id: "kirlar",
    title: "Kırlar",
    category: "doga",
    collection: "ready",
    technique: "Akrilik boya",
    size: "25×35 cm",
    price: "1.100 TL",
    status: "Satış durumunu kontrol et",
    image: "https://cdn.shopier.app/pictures_large/nessbyk_a889e1f7d60fefc05cb7c6f9c76e1f5a.jpeg",
    url: "https://www.shopier.com/nessbyk/47791488",
    sourceLabel: "Shopier",
    actionLabel: "Shopier’da Gör",
    short: "Gün batımı tonlarıyla sıcak ve huzurlu bir kır manzarası.",
    detail: "Kır manzarası, gün batımı renkleri ve yumuşak ışık hissiyle sakin bir atmosfer sunan orijinal akrilik çalışma. Yaşam alanı dekorasyonu veya özel hediye için uygun bir parça olarak kurgulanmıştır."
  },
  {
    id: "orman",
    title: "Orman",
    category: "doga",
    collection: "ready",
    technique: "Akrilik boya",
    size: "25×35 cm",
    price: "1.000 TL",
    status: "Satış durumunu kontrol et",
    image: "https://cdn.shopier.app/pictures_large/nessbyk_d578454d1de377c66a921432d86c89e3.jpeg",
    url: "https://www.shopier.com/nessbyk/47684234",
    sourceLabel: "Shopier",
    actionLabel: "Shopier’da Gör",
    short: "Ağaçların arasından süzülen ışık, su kenarı ve geyikler.",
    detail: "Orman atmosferi, su kenarı ve zarif geyik figürleriyle doğa hissini öne çıkaran akrilik çalışma. Koyu yeşil konseptli site kimliğinin de en güçlü görsel referanslarından biridir."
  },
  {
    id: "yelkenli",
    title: "Yelkenli",
    category: "deniz",
    collection: "ready",
    technique: "Akrilik boya",
    size: "25×35 cm",
    price: "850 TL",
    status: "Satış durumunu kontrol et",
    image: "https://cdn.shopier.app/pictures_large/nessbyk_7a71f101d34ee8872d1e770e7a730d3a.jpeg",
    url: "https://www.shopier.com/nessbyk/47684169",
    sourceLabel: "Shopier",
    actionLabel: "Shopier’da Gör",
    short: "Ay ışığı altında denize açılan huzurlu bir yelkenli.",
    detail: "Mavi tonların ve gece ışığının öne çıktığı deniz temalı akrilik tablo. Deniz tutkunları için sakin, mistik ve dekoratif bir atmosfer taşır."
  },
  {
    id: "white-lilies",
    title: "White Lilies",
    category: "cicek",
    collection: "ready",
    technique: "Akrilik boya",
    size: "25×35 cm",
    price: "1.000 TL",
    status: "Satış durumunu kontrol et",
    image: "https://cdn.shopier.app/pictures_large/nessbyk_65d690a7ad2a4c0b952d82d37daa6ce7.jpeg",
    url: "https://www.shopier.com/nessbyk/47673441",
    sourceLabel: "Shopier",
    actionLabel: "Shopier’da Gör",
    short: "Beyaz zambakların sakin ve zarif çiçek kompozisyonu.",
    detail: "Beyaz zambakları konu alan çiçek kompozisyonu. Canlı dokusu ve yumuşak arka planı ile sade ama dikkat çekici bir dekoratif etki verir."
  },
  {
    id: "friends-custom-scene",
    title: "Kişiye Özel Dizi/Film Sahnesi – Friends",
    category: "ozel",
    collection: "custom",
    technique: "Akrilik boya",
    size: "Kişiye özel ölçü",
    price: "600 TL’den başlayan fiyatlar",
    status: "Özel sipariş örneği",
    image: "assets/img/custom-friends.jpg",
    url: "https://www.gardrops.com/nessbyk-u-15646955",
    sourceLabel: "Gardrops",
    actionLabel: "Gardrops’ta Gör",
    short: "Sevilen dizi/film sahnelerini tuval üzerine kişiye özel çalışma.",
    detail: "Bu çalışma özel sipariş almak adına örnek olarak listelenmiştir; hazır satılık ürün değildir. Sevdiğiniz dizi, film sahnesi veya animasyon karesini tuval üzerine akrilik boya ile kişiye özel olarak çalıştırabilirsiniz. Sahne, boyut, çerçeve tercihi ve detay yoğunluğuna göre fiyat değişebilir."
  },
  {
    id: "spiderman-custom-scene",
    title: "Kişiye Özel Dizi/Film Sahnesi – Spider-Man",
    category: "ozel",
    collection: "custom",
    technique: "Akrilik boya",
    size: "Kişiye özel ölçü",
    price: "600 TL’den başlayan fiyatlar",
    status: "Özel sipariş örneği",
    image: "assets/img/custom-spiderman.jpg",
    url: "https://www.gardrops.com/nessbyk-u-15646955",
    sourceLabel: "Gardrops",
    actionLabel: "Gardrops’ta Gör",
    short: "Animasyon ve film sahneleri için kişiye özel tuval seçeneği.",
    detail: "Bu ilan özel sipariş fikrini göstermek için örnek olarak hazırlanmıştır; satılık hazır ürün değildir. İstediğiniz sahne, kompozisyon, boyut ve renk yoğunluğuna göre akrilik tuval çalışması yapılabilir. Detay seviyesi arttıkça hazırlık süresi ve fiyat değişebilir."
  },
  {
    id: "pet-portrait-custom",
    title: "Kişiye Özel Evcil Hayvan Portresi",
    category: "portre",
    collection: "custom",
    technique: "Akrilik boya",
    size: "13×13 cm örnek çalışma",
    price: "700 TL’den başlayan fiyatlar",
    status: "Özel sipariş örneği",
    image: "assets/img/custom-pet-portrait.jpg",
    url: "https://www.gardrops.com/nessbyk-u-15646955",
    sourceLabel: "Gardrops",
    actionLabel: "Gardrops’ta Gör",
    short: "Evcil hayvan fotoğrafından kişiye özel akrilik tuval portre.",
    detail: "Görseldeki çalışmalar örnektir ve hazır satılık değildir. Evcil hayvanınızın fotoğrafını göndererek tamamen kişiye özel akrilik tuval portre siparişi verebilirsiniz. Fiyat; tuval boyutu, arka plan, detay yoğunluğu ve istenen kompozisyona göre değişebilir. Görseldeki örnek tuvaller 13×13 cm ölçüsündedir."
  }
];

const HERO_HOME_SLIDES = [
  {
    artId: "white-lilies",
    image: "assets/img/white_lilies.jpeg"
  },
  {
    artId: "orman",
    image: "assets/img/orman.jpeg"
  },
  {
    artId: "kirlar",
    image: "assets/img/kirlar.jpeg"
  }
];

const ARTWORK_CATEGORIES = [
  { value: "doga", label: "Doğa" },
  { value: "deniz", label: "Deniz" },
  { value: "cicek", label: "Çiçek" },
  { value: "ozel", label: "Dizi/Film Özel Tasarım" },
  { value: "portre", label: "Evcil Hayvan Portresi" },
  { value: "soyut", label: "Soyut" },
  { value: "manzara", label: "Manzara" },
  { value: "diger", label: "Diğer" }
];

const ARTWORK_STATUSES = [
  "Satılık",
  "Satıldı",
  "Rezerve",
  "Satışta değil",
  "Özel sipariş örneği",
  "Fiyat sorunuz",
  "Yakında"
];

const ARTWORK_TECHNIQUES = [
  "Akrilik boya",
  "Yağlı boya",
  "Yağlı pastel boya",
  "Karışık teknik",
  "Sulu boya",
  "Karakalem",
  "Dijital çalışma",
  "Diğer"
];

const ARTWORK_COLLECTIONS = [
  { value: "ready", label: "Hazır / satılık ürün" },
  { value: "custom", label: "Özel sipariş örneği" },
  { value: "archive", label: "Arşiv / sadece galeri" }
];

const SALES_PLATFORMS = [
  { value: "", label: "Link yok", sourceLabel: "", actionLabel: "" },
  { value: "Shopier", label: "Shopier", sourceLabel: "Shopier", actionLabel: "Shopier’da Gör" },
  { value: "Shopify", label: "Shopify", sourceLabel: "Shopify", actionLabel: "Shopify’da Gör" },
  { value: "Gardrops", label: "Gardrops", sourceLabel: "Gardrops", actionLabel: "Gardrops’ta Gör" },
  { value: "Dolap", label: "Dolap", sourceLabel: "Dolap", actionLabel: "Dolap’ta Gör" },
  { value: "Instagram", label: "Instagram", sourceLabel: "Instagram", actionLabel: "Instagram’da Gör" }
];
