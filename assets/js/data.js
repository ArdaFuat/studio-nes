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

const DEFAULT_SITE_CONTENT = {
  nav: {
    home: "Ana Sayfa",
    gallery: "Galeri",
    fairs: "Fuarlar",
    reachedCities: "Ulaşılan Şehirler",
    route: "Rotamız",
    custom: "Özel Sipariş",
    about: "Hakkında",
    contact: "İletişim"
  },
  footer: {
    tagline: "El yapımı akrilik tuval çalışmaları.",
    copyrightSuffix: "Studio Nes. Tüm hakları saklıdır."
  },
  home: {
    heroEyebrow: "Akrilik boya · Orijinal tuval · El emeği",
    heroTitle: "Orman yeşilinden ilham alan sakin, zarif ve özgün tablolar.",
    heroLead: "Studio Nes, yaşam alanlarına sıcaklık ve karakter katmak için hazırlanan el yapımı akrilik tuval çalışmalarını bir araya getirir.",
    heroPrimaryButton: "Galeriyi İncele",
    heroSecondaryButton: "Satış Linkleri",
    approachEyebrow: "Sanatçı yaklaşımı",
    approachTitle: "Her çalışma tek, özgün ve elle hazırlanmış bir parça.",
    approachText: "Doğa manzaraları, sakin renk geçişleri, çiçekler, deniz ve orman atmosferi Studio Nes’in öne çıkan temaları arasında. Sitedeki her eser için ölçü, teknik, fiyat ve satış platformu bağlantısı ayrı ayrı gösterilir.",
    featuredEyebrow: "Öne çıkanlar",
    featuredTitle: "Galeriden seçilen tablolar",
    featuredLink: "Tüm galeriyi gör",
    featuredArtworkIds: "white-lilies, orman, kirlar",
    heroSlideArtworkIds: "white-lilies, orman, kirlar",
    customPanelEyebrow: "Özel sipariş",
    customPanelTitle: "Renk paleti, ölçü ve tema seçerek kişiye özel çalışma talep edebilirsin.",
    customPanelText: "Özel siparişlerde istenen renkler, odanın tarzı ve hediye edilecek kişinin zevki birlikte düşünülerek tablo fikri oluşturulur.",
    customPanelButton: "Özel Sipariş Detayları",
    linksEyebrow: "Satış & sosyal medya",
    linksTitle: "Studio Nes’e ulaşabileceğin tüm bağlantılar"
  },
  gallery: {
    eyebrow: "Galeri",
    title: "El yapımı akrilik tuvaller",
    intro: "Tabloları ve özel sipariş örneklerini konuya göre filtreleyebilir, detaylarını inceleyebilir ve satış platformlarındaki güncel durumuna gidebilirsin.",
    note: "Not: Fiyat, stok ve özel sipariş bilgileri satış platformlarında değişebilir. Özel tasarım örnekleri hazır satılık ürün değil; sipariş fikri göstermek için eklenmiştir.",
    filters: [
      { value: "all", label: "Tümü" },
      { value: "doga", label: "Doğa" },
      { value: "deniz", label: "Deniz" },
      { value: "cicek", label: "Çiçek" },
      { value: "ozel", label: "Dizi/Film Özel Tasarım" },
      { value: "portre", label: "Evcil Hayvan Portresi" },
      { value: "soyut", label: "Soyut" },
      { value: "manzara", label: "Manzara" },
      { value: "diger", label: "Diğer" }
    ]
  },
  fairs: {
    eyebrow: "Fuarlar & Sergiler",
    title: "Studio Nes’in etkinlik takvimi",
    intro: "Katılım yapılan fuarlar, stant fotoğrafları ve gelecek etkinlikler bu sayfada düzenli şekilde listelenebilir.",
    emptyDate: "Yakında",
    emptyTitle: "Fuar bilgileri yakında eklenecek",
    emptyText: "Katılım yapılan fuarlar, sergi bilgileri ve stant fotoğrafları hazır olduğunda bu alanda yayınlanacaktır.",
    emptyItems: "Etkinlik adı ve konumu\nKatılım tarihi\nSergilenen işler\nStanttan fotoğraflar"
  },
  reachedCities: {
    eyebrow: "Studio Nes Türkiye Haritası",
    title: "Ulaşılan Şehirler",
    intro: "Tablolarımızın Türkiye'de hayat bulduğu şehirler.",
    counterLabel: "ulaşılan şehir",
    mapHint: "Renkli bir şehre dokunarak oradaki tabloyu görebilirsin."
  },
  route: {
    eyebrow: "Studio Nes Türkiye Haritası",
    title: "Rotamız",
    intro: "Tablolarımızın Türkiye'de hayat bulduğu şehirler.",
    counterLabel: "ulaşılan şehir",
    mapHint: "Renkli bir şehre dokunarak oradaki tabloyu görebilirsin."
  },
  custom: {
    eyebrow: "Özel Sipariş",
    title: "Size özel renklerde, ölçülerde ve temalarda tuval çalışması.",
    intro: "Hediye, oda dekorasyonu veya kişisel koleksiyon için özel çalışma talep edilebilir.",
    process: [
      { no: "01", title: "Fikir", text: "İstenilen tema, renk paleti, ölçü ve kullanım alanı belirlenir." },
      { no: "02", title: "Tasarım", text: "Sanatçı, seçilen stile uygun kompozisyonu ve renk hissini oluşturur." },
      { no: "03", title: "Üretim", text: "Tuval, akrilik veya uygun teknikle el emeğiyle hazırlanır." },
      { no: "04", title: "Teslim", text: "Çalışma verniklenir, özenle paketlenir ve satış kanalındaki sürece göre gönderilir." }
    ],
    examplesEyebrow: "Özel tasarım örnekleri",
    examplesTitle: "Dizi/film sahnesi ve evcil hayvan portresi gibi kişiye özel işler.",
    examplesLink: "Galeride filtrele",
    customArtworkIds: "friends-custom-scene, spiderman-custom-scene, pet-portrait-custom",
    examplesNote: "Bu çalışmalar özel sipariş fikrini göstermek için eklenmiştir. Net fiyat; ölçü, detay yoğunluğu ve istenen sahneye göre değişebilir.",
    orderEyebrow: "Sipariş notu",
    orderTitle: "En net sonuç için 3 bilgi yeterli: ölçü, renk paleti ve tema.",
    orderText: "Örnek: “13×13 cm evcil hayvan portresi” ya da “sevdiğim dizi sahnesi, akrilik tuval, çerçeveli teslim.”",
    orderButton: "İletişime Geç"
  },
  about: {
    eyebrow: "Hakkında",
    title: "Renkleri, doğayı ve duyguyu tuvale taşıyan butik bir sanat alanı.",
    image: "https://cdn.shopier.app/pictures_large/nessbyk_a889e1f7d60fefc05cb7c6f9c76e1f5a.jpeg",
    imageAlt: "Studio Nes kır manzarası tablosu",
    paragraph1: "Studio Nes; akrilik boya ile hazırlanmış, tek ve özgün tuval çalışmalarını bir araya getirir. Doğa manzaraları, deniz atmosferi, çiçek kompozisyonları ve sakin renk geçişleri markanın görsel dünyasını oluşturur.",
    paragraph2: "Bu site, eserlerin daha düzenli sunulması, satış platformlarına kolay yönlendirme yapılması ve özel sipariş taleplerinin net şekilde alınabilmesi için hazırlanmıştır.",
    values: [
      { title: "El emeği", text: "Her tuval tek tek çalışılır; seri üretim veya dijital baskı hissinden uzak bir yaklaşım hedeflenir." },
      { title: "Doğal tonlar", text: "Orman yeşili, toprak tonları, krem ve yumuşak ışık geçişleri tasarım kimliğinin ana parçalarıdır." },
      { title: "Hediye değeri", text: "Tablolar hem ev dekorasyonu hem de kişisel ve anlamlı hediye seçeneği olarak sunulur." }
    ]
  },
  contact: {
    eyebrow: "İletişim & Satış",
    title: "Studio Nes’e sosyal medya ve satış platformlarından ulaş.",
    intro: "Güncel ürün durumu, sipariş, özel çalışma ve soru sormak için aşağıdaki bağlantıları kullanabilirsin.",
    faqEyebrow: "SSS",
    faqTitle: "Sık sorulabilecek sorular",
    faqs: [
      { question: "Tablolar baskı mı?", answer: "Galeri metinleri, çalışmaların tuval üzerine el emeğiyle hazırlanmış orijinal akrilik işler olarak sunulduğunu belirtir." },
      { question: "Kargo ve paketleme nasıl olur?", answer: "Satış platformundaki ürün sayfasında belirtilen güncel teslimat ve kargo bilgileri esas alınır." },
      { question: "Özel sipariş alınır mı?", answer: "Evet, ölçü, renk paleti ve tema üzerinden özel çalışma talebi için sosyal medya bağlantılarından iletişime geçilebilir." }
    ]
  },
  links: SITE_LINKS
};

const DEFAULT_FAIRS = [];
const DEFAULT_JOURNEYS = [];

