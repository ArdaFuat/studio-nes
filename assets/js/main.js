(function () {
  const DATA_JSON_URL = 'assets/data/artworks.json';
  const FIREBASE_ARTWORKS_COLLECTION = 'artworks';
  const FIREBASE_CONTENT_COLLECTION = 'siteContent';
  const FIREBASE_CONTENT_DOC = 'main';
  const FIREBASE_FAIRS_COLLECTION = 'fairs';

  let currentArtworks = [];
  let currentFairs = [];
  let siteContent = clone(typeof DEFAULT_SITE_CONTENT !== 'undefined' ? DEFAULT_SITE_CONTENT : {});
  let activeFilter = 'all';
  let sliderCleanup = null;
  let revealObserver = null;
  let fairLightboxState = { images: [], index: 0, title: '' };
  const PUBLIC_CACHE_KEY = 'studio-nes-public-cache-v5';
  let hasPaintedOnce = false;
  let lastRenderSignature = '';


  const readPublicCache = () => {
    try {
      const raw = window.localStorage?.getItem(PUBLIC_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (_) {
      return null;
    }
  };

  const writePublicCache = () => {
    try {
      const payload = {
        cachedAt: new Date().toISOString(),
        siteContent,
        artworks: normalizeArtworks(currentArtworks).slice(0, 80),
        fairs: normalizeFairs(currentFairs).slice(0, 40)
      };
      window.localStorage?.setItem(PUBLIC_CACHE_KEY, JSON.stringify(payload));
    } catch (_) {
      // localStorage doluysa site normal şekilde Firebase'den devam eder.
    }
  };

  const hasUsefulCache = (cache) => Boolean(
    cache && (
      cache.siteContent ||
      (Array.isArray(cache.artworks) && cache.artworks.length) ||
      (Array.isArray(cache.fairs) && cache.fairs.length)
    )
  );

  const markSiteReady = () => {
    const body = document.body;
    if (!body) return;
    hasPaintedOnce = true;
    window.requestAnimationFrame(() => {
      body.classList.remove('content-pending');
      body.classList.add('content-settled');
      observeReveals();
    });
  };

  const stableStringify = (value) => {
    const seen = new WeakSet();
    return JSON.stringify(value, (key, val) => {
      if (key === 'updatedAt' || key === 'updatedBy') return undefined;
      if (val && typeof val === 'object') {
        if (seen.has(val)) return undefined;
        seen.add(val);
        if (!Array.isArray(val)) {
          return Object.keys(val).sort().reduce((acc, itemKey) => {
            acc[itemKey] = val[itemKey];
            return acc;
          }, {});
        }
      }
      return val;
    });
  };

  const getRenderSignature = () => stableStringify({
    siteContent,
    artworks: normalizeArtworks(currentArtworks).map(({ updatedAt, updatedBy, ...art }) => art),
    fairs: normalizeFairs(currentFairs).map(({ updatedAt, updatedBy, ...fair }) => fair)
  });

  function clone(value) {
    if (value === undefined || value === null) return value;
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
  }

  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const safeUrl = (value = '') => {
    const url = String(value || '').trim();
    if (!url) return '';
    if (url.startsWith('assets/') || url.startsWith('./') || url.startsWith('../') || url.startsWith('data:image/')) return url;
    try {
      const parsed = new URL(url, window.location.href);
      return ['http:', 'https:'].includes(parsed.protocol) ? url : '';
    } catch (_) {
      return '';
    }
  };

  const slugify = (value) => String(value || 'urun')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `urun-${Date.now()}`;

  const deepMerge = (base, override) => {
    const out = clone(base) || {};
    if (!override || typeof override !== 'object') return out;
    Object.keys(override).forEach((key) => {
      const value = override[key];
      if (Array.isArray(value)) out[key] = clone(value);
      else if (value && typeof value === 'object') out[key] = deepMerge(out[key] || {}, value);
      else if (value !== undefined && value !== null) out[key] = value;
    });
    return out;
  };

  const pathGet = (obj, path, fallback = '') => {
    const value = String(path || '').split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
    return value === undefined || value === null ? fallback : value;
  };

  const csvToArray = (value) => String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const newlineToArray = (value) => String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

  const isFirebaseConfigured = () => {
    try {
      return typeof firebase !== 'undefined' && typeof window.NESS_FIREBASE_IS_CONFIGURED === 'function' && window.NESS_FIREBASE_IS_CONFIGURED();
    } catch (_) {
      return false;
    }
  };

  const getFirebaseApp = () => {
    if (!isFirebaseConfigured()) return null;
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.NESS_FIREBASE_CONFIG);
      return firebase.app();
    } catch (error) {
      console.warn('Firebase başlatılamadı:', error);
      return null;
    }
  };

  const platformAction = (art) => {
    if (art.actionLabel) return art.actionLabel;
    if (art.sourceLabel) return `${art.sourceLabel}${art.sourceLabel.endsWith('r') ? '’da' : '’de'} Gör`;
    return 'Satış Sayfasına Git';
  };

  const normalizeArtwork = (art = {}, index = 0) => ({
    id: art.id || slugify(art.title || `urun-${index}`),
    title: art.title || 'İsimsiz ürün',
    category: art.category || 'doga',
    collection: art.collection || 'ready',
    technique: art.technique || 'Akrilik boya',
    width: art.width || '',
    height: art.height || '',
    size: art.size || ((art.width && art.height) ? `${art.width}×${art.height} cm` : 'Ölçü girilmedi'),
    price: art.price || 'Fiyat sorunuz',
    status: art.status || 'Satılık',
    image: art.image || 'assets/img/ness-logo.png',
    url: art.url || '',
    sourceLabel: art.sourceLabel || '',
    actionLabel: art.actionLabel || '',
    short: art.short || '',
    detail: art.detail || art.short || '',
    hidden: Boolean(art.hidden),
    order: Number.isFinite(Number(art.order)) ? Number(art.order) : index,
    updatedAt: art.updatedAt || ''
  });

  const normalizeArtworks = (items) => (Array.isArray(items) ? items : [])
    .map(normalizeArtwork)
    .sort((a, b) => a.order - b.order);

  const normalizeFair = (fair = {}, index = 0) => {
    const rawImages = Array.isArray(fair.images) ? fair.images : newlineToArray(fair.images || '');
    return {
      id: fair.id || slugify(fair.title || `fuar-${index}`),
      title: fair.title || 'İsimsiz fuar',
      date: fair.date || '',
      location: fair.location || '',
      status: fair.status || '',
      description: fair.description || '',
      images: rawImages.map(safeUrl).filter(Boolean),
      visible: fair.visible !== false,
      upcoming: Boolean(fair.upcoming),
      order: Number.isFinite(Number(fair.order)) ? Number(fair.order) : index,
      updatedAt: fair.updatedAt || ''
    };
  };

  const normalizeFairs = (items) => (Array.isArray(items) ? items : [])
    .map(normalizeFair)
    .filter((fair) => fair.visible)
    .sort((a, b) => a.order - b.order);

  const fetchJsonArtworks = async () => {
    try {
      const response = await fetch(DATA_JSON_URL, { cache: 'no-store' });
      if (!response.ok) return null;
      const parsed = await response.json();
      return normalizeArtworks(Array.isArray(parsed) ? parsed : parsed.artworks);
    } catch (_) {
      return null;
    }
  };

  const loadFallbackArtworks = async () => {
    const json = await fetchJsonArtworks();
    if (json && json.length) return json;
    return normalizeArtworks(typeof ARTWORKS !== 'undefined' ? ARTWORKS : []);
  };

  const loadFirebaseArtworks = async () => {
    const app = getFirebaseApp();
    if (!app || !firebase.firestore) return null;
    try {
      const snapshot = await firebase.firestore().collection(FIREBASE_ARTWORKS_COLLECTION).orderBy('order', 'asc').get();
      const items = snapshot.docs.map((doc, index) => normalizeArtwork({ id: doc.id, ...doc.data() }, index));
      return items.length ? items : null;
    } catch (error) {
      console.warn('Firebase ürünleri okunamadı:', error);
      return null;
    }
  };

  const loadArtworks = async () => {
    const firebaseItems = await loadFirebaseArtworks();
    if (firebaseItems && firebaseItems.length) return firebaseItems;
    return loadFallbackArtworks();
  };

  const loadFirebaseContent = async () => {
    const app = getFirebaseApp();
    if (!app || !firebase.firestore) return null;
    try {
      const doc = await firebase.firestore().collection(FIREBASE_CONTENT_COLLECTION).doc(FIREBASE_CONTENT_DOC).get();
      return doc.exists ? doc.data() : null;
    } catch (error) {
      console.warn('Firebase site içeriği okunamadı:', error);
      return null;
    }
  };

  const loadContent = async () => {
    const defaults = typeof DEFAULT_SITE_CONTENT !== 'undefined' ? DEFAULT_SITE_CONTENT : {};
    const firebaseContent = await loadFirebaseContent();
    return deepMerge(defaults, firebaseContent || {});
  };

  const loadFirebaseFairs = async () => {
    const app = getFirebaseApp();
    if (!app || !firebase.firestore) return null;
    try {
      const snapshot = await firebase.firestore().collection(FIREBASE_FAIRS_COLLECTION).orderBy('order', 'asc').get();
      const items = snapshot.docs.map((doc, index) => normalizeFair({ id: doc.id, ...doc.data() }, index));
      return items.length ? items : null;
    } catch (error) {
      console.warn('Firebase fuarları okunamadı:', error);
      return null;
    }
  };

  const loadFairs = async () => {
    const firebaseItems = await loadFirebaseFairs();
    if (firebaseItems && firebaseItems.length) return normalizeFairs(firebaseItems);
    return normalizeFairs(typeof DEFAULT_FAIRS !== 'undefined' ? DEFAULT_FAIRS : []);
  };

  const observeReveals = () => {
    if (revealObserver) revealObserver.disconnect();
    const revealNodes = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      revealNodes.forEach((el) => el.classList.add('visible'));
      return;
    }

    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver?.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    revealNodes.forEach((el) => {
      if (el.classList.contains('visible')) return;

      // Cache/Firebase sessiz güncellemesi ilk görünür alanda yeniden çizim yaparsa
      // o alanı direkt görünür bırakıyoruz; aşağıdaki elemanlar yine scroll ile
      // yavaş yavaş gelmeye devam ediyor.
      if (hasPaintedOnce) {
        const rect = el.getBoundingClientRect();
        const alreadyPassedOrVisible = rect.top < window.innerHeight * 0.92;
        if (alreadyPassedOrVisible) {
          el.classList.add('visible');
          return;
        }
      }

      revealObserver.observe(el);
    });
  };

  const renderArtworkCard = (art) => {
    const url = safeUrl(art.url);
    const action = url
      ? `<a class="mini-btn filled" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(art.collection === 'custom' ? (art.actionLabel || art.sourceLabel || 'Detay') : (art.sourceLabel || art.actionLabel || 'Satış'))}</a>`
      : '';

    return `
      <article class="art-card reveal ${art.collection === 'custom' ? 'is-custom' : ''}" data-category="${escapeHtml(art.category)}">
        <button class="art-image-button" type="button" data-art-id="${escapeHtml(art.id)}" aria-label="${escapeHtml(art.title)} detayını aç">
          <img src="${escapeHtml(safeUrl(art.image) || 'assets/img/ness-logo.png')}" alt="${escapeHtml(art.title)} - ${escapeHtml(art.technique)}" loading="lazy" />
          <span class="art-status">${escapeHtml(art.status)}</span>
        </button>
        <div class="art-content">
          <div>
            <p class="art-meta">${escapeHtml(art.technique)} · ${escapeHtml(art.size)}</p>
            <h3>${escapeHtml(art.title)}</h3>
            <p>${escapeHtml(art.short)}</p>
          </div>
          <div class="art-bottom">
            <strong>${escapeHtml(art.price)}</strong>
            <div class="mini-actions">
              <button class="mini-btn" type="button" data-art-id="${escapeHtml(art.id)}">Detay</button>
              ${action}
            </div>
          </div>
        </div>
      </article>`;
  };

  const findByIds = (publicArtworks, ids, fallback) => {
    const selected = ids.map((id) => publicArtworks.find((art) => art.id === id)).filter(Boolean);
    return selected.length ? selected : fallback;
  };

  const getHomeArtworks = (publicArtworks) => {
    const ids = csvToArray(pathGet(siteContent, 'home.featuredArtworkIds', 'white-lilies, orman, kirlar'));
    return findByIds(publicArtworks, ids, publicArtworks.slice(0, 3));
  };

  const getCustomArtworks = (publicArtworks) => {
    const ids = csvToArray(pathGet(siteContent, 'custom.customArtworkIds', ''));
    const fallback = publicArtworks.filter((art) => art.collection === 'custom');
    return ids.length ? findByIds(publicArtworks, ids, fallback) : fallback;
  };

  const applyActiveFilter = () => {
    document.querySelectorAll('.art-card').forEach((card) => {
      const show = activeFilter === 'all' || card.dataset.category === activeFilter;
      card.style.display = show ? '' : 'none';
    });
  };

  const getIndependentHeroSlides = () => {
    const defaults = (typeof window !== 'undefined' && Array.isArray(window.NESS_DEFAULT_HERO_SLOTS)) ? window.NESS_DEFAULT_HERO_SLOTS : [];
    const configured = Array.isArray(siteContent?.home?.heroSlots) && siteContent.home.heroSlots.length ? siteContent.home.heroSlots : defaults;
    return configured.slice(0, 3).map((slot, index) => {
      const image = safeUrl(slot.image || '');
      if (!image) return null;
      return {
        id: `hero-slot-${index}`,
        title: slot.title || `Görsel ${index + 1}`,
        image,
        heroAlt: slot.alt || slot.title || `Studio Nes görsel ${index + 1}`,
        heroTag: slot.subtitle || slot.meta || '',
        short: slot.text || slot.short || '',
        heroBadgeLabel: slot.badgeLabel || 'öne çıkan tablo',
        heroBadgeText: slot.badgeText || slot.title || '',
        heroMetaLabel: slot.metaLabel || 'koleksiyon',
        heroMetaText: slot.metaText || slot.subtitle || slot.meta || ''
      };
    }).filter(Boolean);
  };

  const initHeroSlider = (publicArtworks) => {
    if (sliderCleanup) {
      sliderCleanup();
      sliderCleanup = null;
    }

    const heroSlider = document.querySelector('[data-hero-slider]');
    if (!heroSlider) return;

    let slides = getIndependentHeroSlides();
    if (!slides.length) {
      const slideIds = csvToArray(pathGet(siteContent, 'home.heroSlideArtworkIds', 'white-lilies, orman, kirlar'));
      slides = findByIds(publicArtworks, slideIds, getHomeArtworks(publicArtworks));
      if (!slides.length && typeof HERO_HOME_SLIDES !== 'undefined' && Array.isArray(HERO_HOME_SLIDES)) {
        slides = HERO_HOME_SLIDES.map((item) => {
          const art = publicArtworks.find((entry) => entry.id === item.artId);
          return art ? { ...art, image: item.image || art.image } : null;
        }).filter(Boolean);
      }
    }

    const track = heroSlider.querySelector('[data-hero-slider-track]');
    const dotsWrap = heroSlider.querySelector('[data-hero-slider-dots]');
    const prevButton = heroSlider.querySelector('[data-hero-slider-prev]');
    const nextButton = heroSlider.querySelector('[data-hero-slider-next]');
    const titleCard = heroSlider.querySelector('[data-hero-slider-title]');
    const metaCard = heroSlider.querySelector('[data-hero-slider-meta]');
    let activeIndex = 0;
    let autoTimer = null;

    if (!slides.length || !track || !dotsWrap) return;

    track.innerHTML = slides.map((art, index) => `
      <article class="hero-slide" aria-hidden="${index === 0 ? 'false' : 'true'}">
        <img src="${escapeHtml(safeUrl(art.image) || 'assets/img/ness-logo.png')}" alt="${escapeHtml(art.heroAlt || `${art.title} - ${art.technique || ''}`)}" ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} />
        <div class="hero-slide-copy">
          <div>
            <span class="hero-slide-tag">${escapeHtml(art.heroTag || [art.technique, art.size].filter(Boolean).join(' · '))}</span>
            <h3>${escapeHtml(art.title)}</h3>
            <p>${escapeHtml(art.short)}</p>
          </div>
        </div>
      </article>`).join('');

    dotsWrap.innerHTML = slides.map((art, index) => `
      <button class="hero-slider-dot" type="button" aria-label="${escapeHtml(art.title)} tablosunu göster" data-hero-slide-dot="${index}"></button>`).join('');

    const dotButtons = Array.from(dotsWrap.querySelectorAll('[data-hero-slide-dot]'));
    const slideNodes = Array.from(track.querySelectorAll('.hero-slide'));

    const updateSlider = (nextIndex) => {
      activeIndex = (nextIndex + slides.length) % slides.length;
      const activeArt = slides[activeIndex];
      track.style.transform = `translateX(-${activeIndex * 100}%)`;
      slideNodes.forEach((slide, index) => slide.setAttribute('aria-hidden', index === activeIndex ? 'false' : 'true'));
      dotButtons.forEach((dot, index) => {
        dot.classList.toggle('active', index === activeIndex);
        dot.setAttribute('aria-current', index === activeIndex ? 'true' : 'false');
      });
      if (titleCard) titleCard.innerHTML = `<span>${escapeHtml(activeArt.heroBadgeLabel || 'öne çıkan tablo')}</span><strong>${escapeHtml(activeArt.heroBadgeText || activeArt.title)}</strong>`;
      if (metaCard) metaCard.innerHTML = `<span>${escapeHtml(activeArt.heroMetaLabel || 'koleksiyon')}</span><strong>${escapeHtml(activeArt.heroMetaText || (activeArt.size ? `${activeArt.size} tuvaller` : ''))}</strong>`;
    };

    const stopAuto = () => { if (autoTimer) window.clearInterval(autoTimer); };
    const startAuto = () => {
      stopAuto();
      if (slides.length > 1) autoTimer = window.setInterval(() => updateSlider(activeIndex + 1), 5200);
    };

    const prevHandler = () => { updateSlider(activeIndex - 1); startAuto(); };
    const nextHandler = () => { updateSlider(activeIndex + 1); startAuto(); };
    prevButton?.addEventListener('click', prevHandler);
    nextButton?.addEventListener('click', nextHandler);
    dotButtons.forEach((dot) => dot.addEventListener('click', () => { updateSlider(Number(dot.dataset.heroSlideDot)); startAuto(); }));
    heroSlider.addEventListener('mouseenter', stopAuto);
    heroSlider.addEventListener('mouseleave', startAuto);
    heroSlider.addEventListener('focusin', stopAuto);
    heroSlider.addEventListener('focusout', startAuto);

    updateSlider(0);
    startAuto();
    sliderCleanup = stopAuto;
  };

  const renderPageArtworks = (items) => {
    currentArtworks = normalizeArtworks(items);
    const publicArtworks = currentArtworks.filter((art) => !art.hidden);
    window.NESS_ACTIVE_ARTWORKS = publicArtworks;

    const featuredGrid = document.querySelector('[data-featured-grid]');
    if (featuredGrid) featuredGrid.innerHTML = getHomeArtworks(publicArtworks).map((art) => renderArtworkCard(art)).join('');

    const galleryGrid = document.querySelector('[data-gallery-grid]');
    if (galleryGrid) galleryGrid.innerHTML = publicArtworks.map((art) => renderArtworkCard(art)).join('');

    const customGrid = document.querySelector('[data-custom-grid]');
    if (customGrid) customGrid.innerHTML = getCustomArtworks(publicArtworks).map((art) => renderArtworkCard(art)).join('');

    initHeroSlider(publicArtworks);
    observeReveals();
    applyActiveFilter();
  };

  const renderTextContent = () => {
    document.querySelectorAll('[data-content]').forEach((node) => {
      const value = pathGet(siteContent, node.dataset.content, node.textContent || '');
      if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') node.value = value;
      else node.textContent = value;
    });

    document.querySelectorAll('[data-content-src]').forEach((node) => {
      const url = safeUrl(pathGet(siteContent, node.dataset.contentSrc, node.getAttribute('src') || ''));
      if (url) node.setAttribute('src', url);
    });

    document.querySelectorAll('[data-content-alt]').forEach((node) => {
      node.setAttribute('alt', pathGet(siteContent, node.dataset.contentAlt, node.getAttribute('alt') || ''));
    });

    document.querySelectorAll('[data-year]').forEach((node) => (node.textContent = new Date().getFullYear()));
  };

  const renderStaticLinks = () => {
    const links = Array.isArray(siteContent.links) && siteContent.links.length ? siteContent.links : (typeof SITE_LINKS !== 'undefined' ? SITE_LINKS : []);
    const linkGrids = document.querySelectorAll('[data-link-grid]');
    linkGrids.forEach((grid) => {
      grid.dataset.linkCount = String(Math.min(Math.max(links.length, 1), 5));
      grid.innerHTML = links.map((link) => `
        <a class="link-card reveal" href="${escapeHtml(safeUrl(link.url))}" target="_blank" rel="noopener">
          <span>${escapeHtml(link.type || '')}</span>
          <h3>${escapeHtml(link.name || '')}</h3>
          <p>${escapeHtml(link.handle || '')}</p>
          <small>${escapeHtml(link.description || '')}</small>
        </a>`).join('');
    });
  };

  const renderGalleryFilters = () => {
    const bar = document.querySelector('[data-gallery-filters]');
    if (!bar) return;
    const filters = Array.isArray(siteContent.gallery?.filters) && siteContent.gallery.filters.length
      ? siteContent.gallery.filters
      : [{ value: 'all', label: 'Tümü' }, ...(typeof ARTWORK_CATEGORIES !== 'undefined' ? ARTWORK_CATEGORIES : [])];
    if (!filters.some((filter) => filter.value === activeFilter)) activeFilter = 'all';
    bar.innerHTML = filters.map((filter) => `
      <button class="filter ${filter.value === activeFilter ? 'active' : ''}" type="button" data-filter="${escapeHtml(filter.value)}">${escapeHtml(filter.label)}</button>
    `).join('');
  };

  const renderProcessGrid = () => {
    const grid = document.querySelector('[data-process-grid]');
    if (!grid) return;
    const process = Array.isArray(siteContent.custom?.process) ? siteContent.custom.process : [];
    grid.innerHTML = process.map((item, index) => `
      <article class="process-card reveal ${index ? `delay-${Math.min(index, 3)}` : ''}">
        <span>${escapeHtml(item.no || String(index + 1).padStart(2, '0'))}</span>
        <h2>${escapeHtml(item.title || '')}</h2>
        <p>${escapeHtml(item.text || '')}</p>
      </article>`).join('');
  };

  const renderValuesGrid = () => {
    const grid = document.querySelector('[data-values-grid]');
    if (!grid) return;
    const values = Array.isArray(siteContent.about?.values) ? siteContent.about.values : [];
    grid.innerHTML = values.map((item) => `<article><h2>${escapeHtml(item.title || '')}</h2><p>${escapeHtml(item.text || '')}</p></article>`).join('');
  };

  const renderFaqGrid = () => {
    const grid = document.querySelector('[data-faq-grid]');
    if (!grid) return;
    const faqs = Array.isArray(siteContent.contact?.faqs) ? siteContent.contact.faqs : [];
    grid.innerHTML = faqs.map((item, index) => `
      <details ${index === 0 ? 'open' : ''}>
        <summary>${escapeHtml(item.question || '')}</summary>
        <p>${escapeHtml(item.answer || '')}</p>
      </details>`).join('');
  };

  const renderFairs = (items) => {
    currentFairs = normalizeFairs(items);
    const grid = document.querySelector('[data-fairs-grid]');
    const empty = document.querySelector('[data-fairs-empty]');
    if (!grid) return;

    if (!currentFairs.length) {
      grid.innerHTML = '';
      if (empty) {
        empty.removeAttribute('hidden');
        empty.innerHTML = `
          <div class="timeline-card reveal">
            <span class="date-pill">${escapeHtml(pathGet(siteContent, 'fairs.emptyDate', 'Yakında'))}</span>
            <h2>${escapeHtml(pathGet(siteContent, 'fairs.emptyTitle', 'Fuar bilgileri yakında eklenecek'))}</h2>
            <p>${escapeHtml(pathGet(siteContent, 'fairs.emptyText', ''))}</p>
            <ul class="clean-list">${newlineToArray(pathGet(siteContent, 'fairs.emptyItems', '')).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </div>`;
      }
      observeReveals();
      return;
    }

    if (empty) empty.setAttribute('hidden', '');
    grid.innerHTML = currentFairs.map((fair) => {
      const cover = fair.images[0] || 'assets/img/ness-logo.png';
      const imagesPreview = fair.images.slice(0, 4).map((image, index) => `
        <button type="button" class="fair-thumb" data-fair-id="${escapeHtml(fair.id)}" data-fair-image-index="${index}" aria-label="${escapeHtml(fair.title)} fotoğraf ${index + 1}">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(fair.title)} fotoğraf ${index + 1}" loading="lazy">
        </button>`).join('');
      return `
        <article class="fair-card reveal">
          <button class="fair-cover" type="button" data-fair-id="${escapeHtml(fair.id)}" data-fair-image-index="0" aria-label="${escapeHtml(fair.title)} fotoğraflarını aç">
            <img src="${escapeHtml(cover)}" alt="${escapeHtml(fair.title)}" loading="lazy">
            <span>${escapeHtml(fair.images.length ? `${fair.images.length} fotoğraf` : 'Fotoğraf yok')}</span>
          </button>
          <div class="fair-copy">
            <span class="date-pill">${escapeHtml(fair.status || fair.date || (fair.upcoming ? 'Yakında' : 'Geçmiş fuar'))}</span>
            <h2>${escapeHtml(fair.title)}</h2>
            <p class="fair-meta">${escapeHtml([fair.date, fair.location].filter(Boolean).join(' · '))}</p>
            <p>${escapeHtml(fair.description)}</p>
            <div class="fair-thumbs">${imagesPreview}</div>
          </div>
        </article>`;
    }).join('');
    observeReveals();
  };

  const renderAllContent = ({ force = false } = {}) => {
    const signature = getRenderSignature();
    if (!force && signature && signature === lastRenderSignature) return false;
    lastRenderSignature = signature;

    renderTextContent();
    renderGalleryFilters();
    renderProcessGrid();
    renderValuesGrid();
    renderFaqGrid();
    renderStaticLinks();
    renderFairs(currentFairs);
    renderPageArtworks(currentArtworks);
    observeReveals();
    return true;
  };

  const setupRealtime = () => {
    const app = getFirebaseApp();
    if (!app || !firebase.firestore) return;
    try {
      firebase.firestore().collection(FIREBASE_ARTWORKS_COLLECTION).orderBy('order', 'asc')
        .onSnapshot((snapshot) => {
          if (snapshot.empty) return;
          const items = snapshot.docs.map((doc, index) => normalizeArtwork({ id: doc.id, ...doc.data() }, index));
          currentArtworks = normalizeArtworks(items);
          if (renderAllContent()) writePublicCache();
        }, (error) => console.warn('Firebase ürün canlı takip kapandı:', error));

      firebase.firestore().collection(FIREBASE_CONTENT_COLLECTION).doc(FIREBASE_CONTENT_DOC)
        .onSnapshot((doc) => {
          if (!doc.exists) return;
          siteContent = deepMerge(typeof DEFAULT_SITE_CONTENT !== 'undefined' ? DEFAULT_SITE_CONTENT : {}, doc.data());
          if (renderAllContent()) writePublicCache();
        }, (error) => console.warn('Firebase site içeriği canlı takip kapandı:', error));

      firebase.firestore().collection(FIREBASE_FAIRS_COLLECTION).orderBy('order', 'asc')
        .onSnapshot((snapshot) => {
          currentFairs = normalizeFairs(snapshot.docs.map((doc, index) => normalizeFair({ id: doc.id, ...doc.data() }, index)));
          if (renderAllContent()) writePublicCache();
        }, (error) => console.warn('Firebase fuar canlı takip kapandı:', error));
    } catch (error) {
      console.warn('Firebase canlı takip başlatılamadı:', error);
    }
  };

  const updateFairLightbox = () => {
    const dialog = document.querySelector('[data-fair-dialog]');
    const body = document.querySelector('[data-fair-dialog-body]');
    if (!dialog || !body || !fairLightboxState.images.length) return;
    const image = fairLightboxState.images[fairLightboxState.index];
    body.innerHTML = `
      <div class="fair-lightbox">
        <button class="fair-lightbox-arrow" type="button" data-fair-lightbox-prev aria-label="Önceki fotoğraf">‹</button>
        <img src="${escapeHtml(image)}" alt="${escapeHtml(fairLightboxState.title)} fotoğraf ${fairLightboxState.index + 1}">
        <button class="fair-lightbox-arrow" type="button" data-fair-lightbox-next aria-label="Sonraki fotoğraf">›</button>
        <p>${escapeHtml(fairLightboxState.title)} · ${fairLightboxState.index + 1}/${fairLightboxState.images.length}</p>
      </div>`;
  };

  const openFairLightbox = (fairId, index = 0) => {
    const fair = currentFairs.find((item) => item.id === fairId);
    const dialog = document.querySelector('[data-fair-dialog]');
    if (!fair || !dialog || !fair.images.length) return;
    fairLightboxState = {
      images: fair.images,
      index: Math.max(0, Math.min(Number(index) || 0, fair.images.length - 1)),
      title: fair.title
    };
    updateFairLightbox();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  };

  const setupDialogsAndClicks = () => {
    if (window.NESS_PUBLIC_DIALOGS_READY) return;
    window.NESS_PUBLIC_DIALOGS_READY = true;
    const dialog = document.querySelector('[data-art-dialog]');
    const dialogBody = document.querySelector('[data-dialog-body]');
    const closeDialog = document.querySelector('[data-close-dialog]');
    const openDetail = (id) => {
      const art = currentArtworks.filter((item) => !item.hidden).find((item) => item.id === id);
      if (!art || !dialog || !dialogBody) return;
      const url = safeUrl(art.url);
      const action = url ? `<a class="btn primary" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(platformAction(art))}</a>` : '';
      dialogBody.innerHTML = `
        <img src="${escapeHtml(safeUrl(art.image) || 'assets/img/ness-logo.png')}" alt="${escapeHtml(art.title)}" />
        <div class="dialog-copy">
          <p class="eyebrow dark">${escapeHtml(art.technique)} · ${escapeHtml(art.size)}</p>
          <h2>${escapeHtml(art.title)}</h2>
          <p>${escapeHtml(art.detail)}</p>
          <dl>
            <div><dt>Fiyat</dt><dd>${escapeHtml(art.price)}</dd></div>
            <div><dt>Durum</dt><dd>${escapeHtml(art.status)}</dd></div>
            <div><dt>Kategori</dt><dd>${escapeHtml(art.category)}</dd></div>
          </dl>
          ${action}
        </div>`;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    };

    document.addEventListener('click', (event) => {
      const artButton = event.target.closest('[data-art-id]');
      if (artButton) openDetail(artButton.dataset.artId);

      const filterButton = event.target.closest('[data-filter]');
      if (filterButton) {
        document.querySelectorAll('[data-filter]').forEach((btn) => btn.classList.remove('active'));
        filterButton.classList.add('active');
        activeFilter = filterButton.dataset.filter || 'all';
        applyActiveFilter();
      }

      const fairButton = event.target.closest('[data-fair-id]');
      if (fairButton) openFairLightbox(fairButton.dataset.fairId, fairButton.dataset.fairImageIndex || 0);

      if (event.target.closest('[data-fair-lightbox-prev]')) {
        fairLightboxState.index = (fairLightboxState.index - 1 + fairLightboxState.images.length) % fairLightboxState.images.length;
        updateFairLightbox();
      }
      if (event.target.closest('[data-fair-lightbox-next]')) {
        fairLightboxState.index = (fairLightboxState.index + 1) % fairLightboxState.images.length;
        updateFairLightbox();
      }
    });

    if (closeDialog && dialog) {
      closeDialog.addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', (event) => {
        const rect = dialog.getBoundingClientRect();
        const clickedOutside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
        if (clickedOutside) dialog.close();
      });
    }

    const fairDialog = document.querySelector('[data-fair-dialog]');
    const fairClose = document.querySelector('[data-close-fair-dialog]');
    if (fairDialog && fairClose) {
      fairClose.addEventListener('click', () => fairDialog.close());
      fairDialog.addEventListener('click', (event) => {
        const rect = fairDialog.getBoundingClientRect();
        const clickedOutside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
        if (clickedOutside) fairDialog.close();
      });
    }
  };

  const applyLoadedState = (loadedContent, loadedFairs, loadedArtworks, { force = false } = {}) => {
    siteContent = loadedContent;
    currentFairs = loadedFairs;
    currentArtworks = loadedArtworks;
    const didRender = renderAllContent({ force });
    if (didRender) writePublicCache();
    return didRender;
  };

  const loadLiveState = async () => {
    const [loadedContent, loadedFairs, loadedArtworks] = await Promise.all([loadContent(), loadFairs(), loadArtworks()]);
    return { loadedContent, loadedFairs, loadedArtworks };
  };

  const init = async () => {
    const navToggle = document.querySelector('[data-nav-toggle]');
    const nav = document.querySelector('[data-nav]');
    if (navToggle && nav) {
      navToggle.addEventListener('click', () => {
        nav.classList.toggle('open');
        navToggle.classList.toggle('open');
      });
    }

    const defaults = typeof DEFAULT_SITE_CONTENT !== 'undefined' ? DEFAULT_SITE_CONTENT : {};
    const cached = readPublicCache();
    let paintedFromCache = false;

    if (hasUsefulCache(cached)) {
      siteContent = deepMerge(defaults, cached.siteContent || {});
      currentFairs = normalizeFairs(Array.isArray(cached.fairs) ? cached.fairs : []);
      currentArtworks = normalizeArtworks(
        Array.isArray(cached.artworks) && cached.artworks.length
          ? cached.artworks
          : (typeof ARTWORKS !== 'undefined' ? ARTWORKS : [])
      );
      renderAllContent({ force: true });
      setupDialogsAndClicks();
      markSiteReady();
      paintedFromCache = true;
    }

    try {
      const { loadedContent, loadedFairs, loadedArtworks } = await loadLiveState();
      applyLoadedState(loadedContent, loadedFairs, loadedArtworks, { force: !paintedFromCache });
      if (!paintedFromCache) {
        setupDialogsAndClicks();
        markSiteReady();
      }
    } catch (error) {
      console.warn('Site içeriği hazırlanırken hata oluştu:', error);
      if (!paintedFromCache) {
        siteContent = deepMerge(defaults, siteContent || {});
        currentFairs = normalizeFairs(currentFairs);
        currentArtworks = normalizeArtworks(currentArtworks.length ? currentArtworks : (typeof ARTWORKS !== 'undefined' ? ARTWORKS : []));
        renderAllContent({ force: true });
        setupDialogsAndClicks();
        markSiteReady();
      }
    } finally {
      setupRealtime();
    }
  };

  init();
})();
