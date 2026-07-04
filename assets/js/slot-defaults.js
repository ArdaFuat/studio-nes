(function () {
  const heroSlots = [
    {
      title: 'White Lilies',
      subtitle: 'Akrilik boya · 25×35 cm',
      text: 'Beyaz zambakların sakin ve zarif çiçek kompozisyonu.',
      image: 'assets/img/white_lilies.jpeg',
      alt: 'White Lilies tablosu',
      badgeLabel: 'öne çıkan tablo',
      badgeText: 'White Lilies',
      metaLabel: 'koleksiyon',
      metaText: '25×35 cm tuvaller'
    },
    {
      title: 'Orman',
      subtitle: 'Akrilik boya · 25×35 cm',
      text: 'Ağaçların arasından süzülen ışık, su kenarı ve geyikler.',
      image: 'assets/img/orman.jpeg',
      alt: 'Orman tablosu',
      badgeLabel: 'öne çıkan tablo',
      badgeText: 'Orman',
      metaLabel: 'koleksiyon',
      metaText: '25×35 cm tuvaller'
    },
    {
      title: 'Kırlar',
      subtitle: 'Akrilik boya · 25×35 cm',
      text: 'Gün batımı tonlarıyla sıcak ve huzurlu bir kır manzarası.',
      image: 'assets/img/kirlar.jpeg',
      alt: 'Kırlar tablosu',
      badgeLabel: 'öne çıkan tablo',
      badgeText: 'Kırlar',
      metaLabel: 'koleksiyon',
      metaText: '25×35 cm tuvaller'
    }
  ];

  const featuredSlots = [
    {
      title: 'White Lilies',
      meta: 'Akrilik boya · 25×35 cm',
      text: 'Beyaz zambakların sakin ve zarif çiçek kompozisyonu.',
      detail: 'Beyaz zambakları konu alan çiçek kompozisyonu. Canlı dokusu ve yumuşak arka planı ile sade ama dikkat çekici bir dekoratif etki verir.',
      image: 'assets/img/white_lilies.jpeg',
      alt: 'White Lilies tablosu',
      status: 'Satış durumunu kontrol et',
      price: '1.000 TL',
      buttonLabel: 'Detay'
    },
    {
      title: 'Orman',
      meta: 'Akrilik boya · 25×35 cm',
      text: 'Ağaçların arasından süzülen ışık, su kenarı ve geyikler.',
      detail: 'Orman atmosferi, su kenarı ve zarif geyik figürleriyle doğa hissini öne çıkaran akrilik çalışma.',
      image: 'assets/img/orman.jpeg',
      alt: 'Orman tablosu',
      status: 'Satış durumunu kontrol et',
      price: '1.000 TL',
      buttonLabel: 'Detay'
    },
    {
      title: 'Kırlar',
      meta: 'Akrilik boya · 25×35 cm',
      text: 'Gün batımı tonlarıyla sıcak ve huzurlu bir kır manzarası.',
      detail: 'Kır manzarası, gün batımı renkleri ve yumuşak ışık hissiyle sakin bir atmosfer sunan orijinal akrilik çalışma.',
      image: 'assets/img/kirlar.jpeg',
      alt: 'Kırlar tablosu',
      status: 'Satış durumunu kontrol et',
      price: '1.100 TL',
      buttonLabel: 'Detay'
    }
  ];

  window.NESS_DEFAULT_HERO_SLOTS = heroSlots;
  window.NESS_DEFAULT_FEATURED_SLOTS = featuredSlots;

  try {
    if (typeof DEFAULT_SITE_CONTENT !== 'undefined') {
      DEFAULT_SITE_CONTENT.home = DEFAULT_SITE_CONTENT.home || {};
      if (!Array.isArray(DEFAULT_SITE_CONTENT.home.heroSlots)) DEFAULT_SITE_CONTENT.home.heroSlots = heroSlots;
      if (!Array.isArray(DEFAULT_SITE_CONTENT.home.featuredSlots)) DEFAULT_SITE_CONTENT.home.featuredSlots = featuredSlots;
    }
  } catch (_) {}
})();
