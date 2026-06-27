(function () {
  const DATA_JSON_URL = 'assets/data/artworks.json';
  const FIREBASE_COLLECTION = 'artworks';
  let currentArtworks = [];
  let activeFilter = 'all';
  let sliderCleanup = null;

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
      const snapshot = await firebase.firestore().collection(FIREBASE_COLLECTION).orderBy('order', 'asc').get();
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

  const observeReveals = () => {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
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

  const getHomeArtworks = (publicArtworks) => {
    const homeArtworkIds = ['white-lilies', 'orman', 'kirlar'];
    const preferred = homeArtworkIds
      .map((id) => publicArtworks.find((art) => art.id === id))
      .filter(Boolean);
    return preferred.length ? preferred : publicArtworks.slice(0, 3);
  };

  const applyActiveFilter = () => {
    document.querySelectorAll('.art-card').forEach((card) => {
      const show = activeFilter === 'all' || card.dataset.category === activeFilter;
      card.style.display = show ? '' : 'none';
    });
  };

  const initHeroSlider = (publicArtworks) => {
    if (sliderCleanup) {
      sliderCleanup();
      sliderCleanup = null;
    }

    const heroSlider = document.querySelector('[data-hero-slider]');
    if (!heroSlider) return;

    const heroSlideData = (typeof HERO_HOME_SLIDES !== 'undefined' && Array.isArray(HERO_HOME_SLIDES))
      ? HERO_HOME_SLIDES
      : getHomeArtworks(publicArtworks).map((art) => ({ artId: art.id, image: art.image }));
    let slides = heroSlideData
      .map((item) => {
        const art = publicArtworks.find((entry) => entry.id === item.artId);
        return art ? { ...art, image: item.image || art.image } : null;
      })
      .filter(Boolean);
    if (!slides.length) slides = getHomeArtworks(publicArtworks);

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
        <img src="${escapeHtml(safeUrl(art.image) || 'assets/img/ness-logo.png')}" alt="${escapeHtml(art.title)} - ${escapeHtml(art.technique)}" ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} />
        <div class="hero-slide-copy">
          <div>
            <span class="hero-slide-tag">${escapeHtml(art.technique)} · ${escapeHtml(art.size)}</span>
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
      if (titleCard) titleCard.innerHTML = `<span>öne çıkan tablo</span><strong>${escapeHtml(activeArt.title)}</strong>`;
      if (metaCard) metaCard.innerHTML = `<span>koleksiyon</span><strong>${escapeHtml(activeArt.size)} tuvaller</strong>`;
    };

    const stopAuto = () => { if (autoTimer) window.clearInterval(autoTimer); };
    const startAuto = () => {
      stopAuto();
      autoTimer = window.setInterval(() => updateSlider(activeIndex + 1), 5200);
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
    if (customGrid) {
      customGrid.innerHTML = publicArtworks
        .filter((art) => art.collection === 'custom')
        .map((art) => renderArtworkCard(art))
        .join('');
    }

    initHeroSlider(publicArtworks);
    observeReveals();
    applyActiveFilter();
  };

  const renderStaticLinks = () => {
    const linkGrids = document.querySelectorAll('[data-link-grid]');
    linkGrids.forEach((grid) => {
      grid.innerHTML = SITE_LINKS.map((link) => `
        <a class="link-card reveal" href="${escapeHtml(safeUrl(link.url))}" target="_blank" rel="noopener">
          <span>${escapeHtml(link.type)}</span>
          <h3>${escapeHtml(link.name)}</h3>
          <p>${escapeHtml(link.handle)}</p>
          <small>${escapeHtml(link.description)}</small>
        </a>`).join('');
    });
  };

  const setupRealtimeArtworks = () => {
    const app = getFirebaseApp();
    if (!app || !firebase.firestore) return;
    try {
      firebase.firestore().collection(FIREBASE_COLLECTION).orderBy('order', 'asc')
        .onSnapshot((snapshot) => {
          if (snapshot.empty) return;
          const items = snapshot.docs.map((doc, index) => normalizeArtwork({ id: doc.id, ...doc.data() }, index));
          renderPageArtworks(items);
        }, (error) => {
          console.warn('Firebase canlı takip kapandı:', error);
        });
    } catch (error) {
      console.warn('Firebase canlı takip başlatılamadı:', error);
    }
  };

  const init = async () => {
    document.querySelectorAll('[data-year]').forEach((node) => (node.textContent = new Date().getFullYear()));

    const navToggle = document.querySelector('[data-nav-toggle]');
    const nav = document.querySelector('[data-nav]');
    if (navToggle && nav) {
      navToggle.addEventListener('click', () => {
        nav.classList.toggle('open');
        navToggle.classList.toggle('open');
      });
    }

    renderStaticLinks();
    renderPageArtworks(await loadArtworks());
    setupRealtimeArtworks();

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
      const detailButton = event.target.closest('[data-art-id]');
      if (detailButton) openDetail(detailButton.dataset.artId);
    });

    if (closeDialog && dialog) {
      closeDialog.addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', (event) => {
        const rect = dialog.getBoundingClientRect();
        const clickedOutside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
        if (clickedOutside) dialog.close();
      });
    }

    const filterButtons = document.querySelectorAll('[data-filter]');
    filterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        filterButtons.forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');
        activeFilter = button.dataset.filter || 'all';
        applyActiveFilter();
      });
    });
  };

  init();
})();
