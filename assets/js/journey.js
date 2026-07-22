(function () {
  const JOURNEY_COLLECTION = 'journeys';
  const ARTWORK_COLLECTION = 'artworks';
  let journeyByCity = new Map();
  let artworkById = new Map();
  let mapElement = null;
  let cityCard = null;
  let activeCity = '';
  let activeArtworkIndex = 0;
  let unsubscribeJourneys = null;
  let unsubscribeArtworks = null;

  const fold = (value = '') => String(value)
    .trim().toLocaleLowerCase('tr-TR')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c');

  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const cities = () => [...(window.TURKEY_CITIES || [])]
    .filter((city, index, list) => list.findIndex((item) => item.id === city.id) === index)
    .sort((a, b) => a.id - b.id);

  const resolveCity = (value = '') => {
    const key = fold(value);
    const aliases = {
      afyon: 'Afyonkarahisar', icel: 'Mersin', maras: 'Kahramanmaraş',
      'k maras': 'Kahramanmaraş', hakkari: 'Hakkâri'
    };
    if (aliases[key]) return aliases[key];
    return cities().find((city) => fold(city.name) === key)?.name || '';
  };

  const normalizeArtwork = (art = {}, index = 0) => ({
    id: String(art.id || '').trim(),
    title: String(art.title || 'İsimsiz tablo').trim(),
    image: String(art.image || 'assets/img/ness-logo.png').trim(),
    hidden: Boolean(art.hidden),
    order: Number.isFinite(Number(art.order)) ? Number(art.order) : index
  });

  const normalizeArtworks = (items) => (Array.isArray(items) ? items : [])
    .map(normalizeArtwork)
    .filter((art) => art.id)
    .sort((a, b) => a.order - b.order);

  const normalizeJourneyItems = (items) => {
    const next = new Map();
    (Array.isArray(items) ? items : []).forEach((item, index) => {
      if (item?.visible === false) return;
      const rawCity = typeof item === 'string' ? item : item?.city;
      const city = resolveCity(rawCity);
      if (!city) return;
      const artworkIds = Array.isArray(item?.artworkIds)
        ? item.artworkIds.map((id) => String(id || '').trim()).filter(Boolean)
        : [];
      next.set(city, {
        city,
        visible: true,
        order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index,
        disclosure: item?.disclosure === 'private' ? 'private' : 'public',
        artworkIds: [...new Set(artworkIds)]
      });
    });
    return next;
  };

  const updateCounter = () => {
    const count = document.querySelector('[data-journey-city-count]');
    if (count) count.textContent = String(journeyByCity.size);
  };

  const updateProvinceStates = () => {
    if (!mapElement) return;
    mapElement.querySelectorAll('[data-map-city]').forEach((province) => {
      const reached = journeyByCity.has(province.dataset.mapCity);
      province.classList.toggle('is-reached', reached);
      province.setAttribute('aria-pressed', reached ? 'true' : 'false');
    });
    updateCounter();
    if (activeCity && !journeyByCity.has(activeCity)) closeCityCard();
    else if (activeCity) renderCityCard();
  };

  const getPublicArtworks = (city) => {
    const journey = journeyByCity.get(city);
    if (!journey || journey.disclosure === 'private') return [];
    return journey.artworkIds
      .map((id) => artworkById.get(id))
      .filter((art) => art && !art.hidden);
  };

  const closeCityCard = () => {
    activeCity = '';
    activeArtworkIndex = 0;
    if (cityCard) cityCard.hidden = true;
    mapElement?.querySelectorAll('.is-card-active').forEach((item) => item.classList.remove('is-card-active'));
  };

  const positionCityCard = () => {
    const stage = document.querySelector('[data-journey-map]');
    const province = mapElement?.querySelector(`[data-map-city="${CSS.escape(activeCity)}"]`);
    if (!stage || !cityCard || !province || cityCard.hidden) return;

    const stageRect = stage.getBoundingClientRect();
    const provinceRect = province.getBoundingClientRect();
    const x = provinceRect.left - stageRect.left + provinceRect.width / 2;
    const y = provinceRect.top - stageRect.top + provinceRect.height / 2;
    const cardWidth = Math.min(cityCard.offsetWidth || 250, Math.max(190, stageRect.width - 16));
    const half = cardWidth / 2;
    cityCard.style.left = `${Math.max(half + 8, Math.min(stageRect.width - half - 8, x))}px`;

    const placeBelow = y < (cityCard.offsetHeight || 110) + 32;
    cityCard.classList.toggle('is-below', placeBelow);
    cityCard.style.top = `${Math.max(12, Math.min(stageRect.height - 12, placeBelow ? y + 16 : y - 12))}px`;
  };

  const renderCityCard = () => {
    if (!cityCard || !activeCity) return;
    const journey = journeyByCity.get(activeCity);
    if (!journey) return closeCityCard();

    const artworks = getPublicArtworks(activeCity);
    if (artworks.length) activeArtworkIndex = ((activeArtworkIndex % artworks.length) + artworks.length) % artworks.length;
    else activeArtworkIndex = 0;

    let body = '';
    if (journey.disclosure === 'private') {
      body = '<p class="journey-city-card-private">Bu şehirdeki eser bilgisi paylaşılmıyor.</p>';
    } else if (!artworks.length) {
      body = '<p class="journey-city-card-private">Tablo bilgisi belirtilmedi.</p>';
    } else {
      const art = artworks[activeArtworkIndex];
      const hasMultiple = artworks.length > 1;
      body = `<div class="journey-city-card-slider">
        <button type="button" class="journey-city-card-arrow" data-city-card-prev aria-label="Önceki tablo" ${hasMultiple ? '' : 'disabled'}>‹</button>
        <div class="journey-city-card-artwork">
          <img src="${escapeHtml(art.image)}" alt="${escapeHtml(art.title)}" loading="lazy">
          <div><span>Tablo</span><strong>${escapeHtml(art.title)}</strong></div>
        </div>
        <button type="button" class="journey-city-card-arrow" data-city-card-next aria-label="Sonraki tablo" ${hasMultiple ? '' : 'disabled'}>›</button>
      </div>`;
    }

    cityCard.innerHTML = `<div class="journey-city-card-head">
      <strong>${escapeHtml(activeCity)}</strong>
      ${artworks.length > 1 ? `<span>${activeArtworkIndex + 1} / ${artworks.length}</span>` : ''}
    </div>${body}`;
    const image = cityCard.querySelector('img');
    image?.addEventListener('error', () => { image.src = 'assets/img/ness-logo.png'; }, { once: true });
    cityCard.hidden = false;
    mapElement.querySelectorAll('.is-card-active').forEach((item) => item.classList.remove('is-card-active'));
    mapElement.querySelector(`[data-map-city="${CSS.escape(activeCity)}"]`)?.classList.add('is-card-active');
    requestAnimationFrame(positionCityCard);
  };

  const openCityCard = (province) => {
    const city = province?.dataset.mapCity || '';
    if (!city || !journeyByCity.has(city)) {
      closeCityCard();
      return;
    }
    if (activeCity !== city) activeArtworkIndex = 0;
    activeCity = city;
    renderCityCard();
  };

  const buildLocalMap = () => {
    if (!window.TURKEY_MAP_SVG) throw new Error('Türkiye haritası verisi bulunamadı.');

    const parser = new DOMParser();
    const source = parser.parseFromString(window.TURKEY_MAP_SVG, 'image/svg+xml');
    if (source.querySelector('parsererror')) throw new Error('Türkiye haritası SVG verisi okunamadı.');

    const svg = document.importNode(source.documentElement, true);
    svg.classList.add('turkey-province-map');
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', '81 ili gösteren interaktif Türkiye haritası');

    svg.querySelectorAll('#turkiye > g').forEach((province) => {
      const city = resolveCity(province.getAttribute('data-city-name') || province.getAttribute('data-iladi'));
      if (!city) return;
      province.classList.add('turkey-province');
      province.dataset.mapCity = city;
      province.setAttribute('role', 'button');
      province.setAttribute('tabindex', '0');
      province.setAttribute('aria-label', city);
    });

    return svg;
  };

  const wireMap = (svg) => {
    mapElement = svg;
    svg.addEventListener('click', (event) => {
      const province = event.target.closest?.('[data-map-city]');
      if (province) openCityCard(province);
    });
    svg.addEventListener('keydown', (event) => {
      const province = event.target.closest?.('[data-map-city]');
      if (!province || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      openCityCard(province);
    });
    updateProvinceStates();
  };

  const renderMap = () => {
    const target = document.querySelector('[data-journey-map]');
    if (!target) return;

    try {
      const svg = buildLocalMap();
      cityCard = document.createElement('div');
      cityCard.className = 'journey-city-card';
      cityCard.dataset.cityCard = '';
      cityCard.hidden = true;
      target.replaceChildren(svg, cityCard);
      wireMap(svg);
    } catch (error) {
      console.error('Rotamız haritası hazırlanamadı:', error);
      target.innerHTML = '<p class="reached-map-error">Harita şu anda görüntülenemiyor.</p>';
    }
  };

  const setJourneys = (items) => {
    journeyByCity = normalizeJourneyItems(items);
    updateProvinceStates();
  };

  const setArtworks = (items) => {
    artworkById = new Map(normalizeArtworks(items).map((art) => [art.id, art]));
    if (activeCity) renderCityCard();
  };

  const loadData = () => {
    setJourneys(typeof DEFAULT_JOURNEYS !== 'undefined' ? DEFAULT_JOURNEYS : []);
    setArtworks(typeof ARTWORKS !== 'undefined' ? ARTWORKS : []);

    try {
      if (typeof firebase === 'undefined' || !window.NESS_FIREBASE_IS_CONFIGURED?.()) return;
      if (!firebase.apps.length) firebase.initializeApp(window.NESS_FIREBASE_CONFIG);
      const db = firebase.firestore();
      unsubscribeJourneys?.();
      unsubscribeArtworks?.();
      unsubscribeJourneys = db.collection(JOURNEY_COLLECTION).onSnapshot((snapshot) => {
        setJourneys(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      }, (error) => console.warn('Rotamız şehirleri canlı olarak okunamadı:', error));
      unsubscribeArtworks = db.collection(ARTWORK_COLLECTION).orderBy('order', 'asc').onSnapshot((snapshot) => {
        setArtworks(snapshot.docs.map((doc, index) => ({ id: doc.id, ...doc.data(), order: doc.data().order ?? index })));
      }, (error) => console.warn('Rotamız tabloları canlı olarak okunamadı:', error));
    } catch (error) {
      console.warn('Rotamız Firebase bağlantısı kurulamadı:', error);
    }
  };

  document.addEventListener('click', (event) => {
    if (!activeCity) return;
    if (event.target.closest?.('[data-map-city], [data-city-card]')) return;
    closeCityCard();
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-city-card]')) return;
    const artworks = getPublicArtworks(activeCity);
    if (artworks.length < 2) return;
    if (event.target.closest('[data-city-card-prev]')) activeArtworkIndex -= 1;
    else if (event.target.closest('[data-city-card-next]')) activeArtworkIndex += 1;
    else return;
    renderCityCard();
  });

  window.addEventListener('resize', () => {
    if (activeCity) positionCityCard();
  });

  renderMap();
  loadData();
})();
