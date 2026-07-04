(function () {
  const FIREBASE_CONTENT_COLLECTION = 'siteContent';
  const FIREBASE_CONTENT_DOC = 'main';
  const FIREBASE_ARTWORKS_COLLECTION = 'artworks';
  let latestContent = null;
  let latestFeaturedSlots = [];
  let renderTimer = null;

  const clone = (value) => {
    if (value === undefined || value === null) return value;
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
  };

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

  const getDefaults = () => clone(typeof DEFAULT_SITE_CONTENT !== 'undefined' ? DEFAULT_SITE_CONTENT : { home: {} });

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
    } catch (_) {
      return null;
    }
  };

  const normalizeHeroSlots = (items) => {
    const defaults = window.NESS_DEFAULT_HERO_SLOTS || [];
    const source = Array.isArray(items) && items.length ? items : defaults;
    return source.slice(0, 3).map((slot, index) => ({
      title: slot.title || `Görsel ${index + 1}`,
      subtitle: slot.subtitle || slot.meta || '',
      text: slot.text || slot.short || '',
      image: safeUrl(slot.image) || 'assets/img/ness-logo.png',
      alt: slot.alt || slot.title || `Görsel ${index + 1}`,
      badgeLabel: slot.badgeLabel || 'öne çıkan tablo',
      badgeText: slot.badgeText || slot.title || '',
      metaLabel: slot.metaLabel || 'koleksiyon',
      metaText: slot.metaText || slot.subtitle || slot.meta || ''
    })).filter((slot) => slot.image);
  };

  const normalizeFeaturedSlots = (items) => {
    const defaults = window.NESS_DEFAULT_FEATURED_SLOTS || [];
    const source = Array.isArray(items) && items.length ? items : defaults;
    return source.slice(0, 3).map((slot, index) => ({
      title: slot.title || `Görsel ${index + 1}`,
      meta: slot.meta || slot.subtitle || '',
      text: slot.text || slot.short || '',
      detail: slot.detail || slot.text || slot.short || '',
      image: safeUrl(slot.image) || 'assets/img/ness-logo.png',
      alt: slot.alt || slot.title || `Görsel ${index + 1}`,
      status: slot.status || '',
      price: slot.price || '',
      url: safeUrl(slot.url || ''),
      buttonLabel: slot.buttonLabel || 'Detay'
    })).filter((slot) => slot.image);
  };

  const renderHeroSlots = (content) => {
    const original = document.querySelector('[data-hero-slider]');
    if (!original) return;
    const hero = original.cloneNode(true);
    original.replaceWith(hero);
    const slots = normalizeHeroSlots(content?.home?.heroSlots);
    if (!slots.length) return;

    const track = hero.querySelector('[data-hero-slider-track]');
    const dotsWrap = hero.querySelector('[data-hero-slider-dots]');
    const prevButton = hero.querySelector('[data-hero-slider-prev]');
    const nextButton = hero.querySelector('[data-hero-slider-next]');
    const titleCard = hero.querySelector('[data-hero-slider-title]');
    const metaCard = hero.querySelector('[data-hero-slider-meta]');
    if (!track || !dotsWrap) return;

    let activeIndex = 0;
    let autoTimer = null;
    hero.dataset.slotRendered = 'true';

    track.innerHTML = slots.map((slot, index) => `
      <article class="hero-slide" aria-hidden="${index === 0 ? 'false' : 'true'}">
        <img src="${escapeHtml(slot.image)}" alt="${escapeHtml(slot.alt)}" ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} />
        <div class="hero-slide-copy">
          <div>
            <span class="hero-slide-tag">${escapeHtml(slot.subtitle)}</span>
            <h3>${escapeHtml(slot.title)}</h3>
            <p>${escapeHtml(slot.text)}</p>
          </div>
        </div>
      </article>`).join('');

    dotsWrap.innerHTML = slots.map((slot, index) => `
      <button class="hero-slider-dot" type="button" aria-label="${escapeHtml(slot.title)} görselini göster" data-slot-slide-dot="${index}"></button>`).join('');

    const dotButtons = Array.from(dotsWrap.querySelectorAll('[data-slot-slide-dot]'));
    const slideNodes = Array.from(track.querySelectorAll('.hero-slide'));

    const updateSlider = (nextIndex) => {
      activeIndex = (nextIndex + slots.length) % slots.length;
      const activeSlot = slots[activeIndex];
      track.style.transform = `translateX(-${activeIndex * 100}%)`;
      slideNodes.forEach((slide, index) => slide.setAttribute('aria-hidden', index === activeIndex ? 'false' : 'true'));
      dotButtons.forEach((dot, index) => {
        dot.classList.toggle('active', index === activeIndex);
        dot.setAttribute('aria-current', index === activeIndex ? 'true' : 'false');
      });
      if (titleCard) titleCard.innerHTML = `<span>${escapeHtml(activeSlot.badgeLabel)}</span><strong>${escapeHtml(activeSlot.badgeText || activeSlot.title)}</strong>`;
      if (metaCard) metaCard.innerHTML = `<span>${escapeHtml(activeSlot.metaLabel)}</span><strong>${escapeHtml(activeSlot.metaText || activeSlot.subtitle)}</strong>`;
    };

    const stopAuto = () => { if (autoTimer) window.clearInterval(autoTimer); };
    const startAuto = () => {
      stopAuto();
      if (slots.length > 1) autoTimer = window.setInterval(() => updateSlider(activeIndex + 1), 5200);
    };

    prevButton?.addEventListener('click', () => { updateSlider(activeIndex - 1); startAuto(); });
    nextButton?.addEventListener('click', () => { updateSlider(activeIndex + 1); startAuto(); });
    dotButtons.forEach((dot) => dot.addEventListener('click', () => { updateSlider(Number(dot.dataset.slotSlideDot)); startAuto(); }));
    hero.addEventListener('mouseenter', stopAuto);
    hero.addEventListener('mouseleave', startAuto);
    hero.addEventListener('focusin', stopAuto);
    hero.addEventListener('focusout', startAuto);
    updateSlider(0);
    startAuto();
  };

  const renderFeaturedSlots = (content) => {
    const grid = document.querySelector('[data-featured-grid]');
    if (!grid) return;
    const slots = normalizeFeaturedSlots(content?.home?.featuredSlots);
    latestFeaturedSlots = slots;
    if (!slots.length) return;
    grid.dataset.slotRendered = 'true';
    grid.innerHTML = slots.map((slot, index) => {
      const action = slot.url ? `<a class="mini-btn filled" href="${escapeHtml(slot.url)}" target="_blank" rel="noopener">${escapeHtml(slot.buttonLabel || 'Git')}</a>` : '';
      return `
        <article class="art-card reveal visible is-home-slot">
          <button class="art-image-button" type="button" data-slot-detail="${index}" aria-label="${escapeHtml(slot.title)} detayını aç">
            <img src="${escapeHtml(slot.image)}" alt="${escapeHtml(slot.alt)}" loading="lazy" />
            ${slot.status ? `<span class="art-status">${escapeHtml(slot.status)}</span>` : ''}
          </button>
          <div class="art-content">
            <div>
              <p class="art-meta">${escapeHtml(slot.meta)}</p>
              <h3>${escapeHtml(slot.title)}</h3>
              <p>${escapeHtml(slot.text)}</p>
            </div>
            <div class="art-bottom">
              <strong>${escapeHtml(slot.price)}</strong>
              <div class="mini-actions">
                <button class="mini-btn" type="button" data-slot-detail="${index}">Detay</button>
                ${action}
              </div>
            </div>
          </div>
        </article>`;
    }).join('');
  };

  const setupSlotDialog = () => {
    if (window.NESS_SLOT_DIALOG_READY) return;
    window.NESS_SLOT_DIALOG_READY = true;
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-slot-detail]');
      if (!button) return;
      const slot = latestFeaturedSlots[Number(button.dataset.slotDetail)];
      const dialog = document.querySelector('[data-art-dialog]');
      const body = document.querySelector('[data-dialog-body]');
      if (!slot || !dialog || !body) return;
      const action = slot.url ? `<a class="btn primary" href="${escapeHtml(slot.url)}" target="_blank" rel="noopener">${escapeHtml(slot.buttonLabel || 'Git')}</a>` : '';
      body.innerHTML = `
        <img src="${escapeHtml(slot.image)}" alt="${escapeHtml(slot.alt)}" />
        <div class="dialog-copy">
          <p class="eyebrow dark">${escapeHtml(slot.meta)}</p>
          <h2>${escapeHtml(slot.title)}</h2>
          <p>${escapeHtml(slot.detail || slot.text)}</p>
          <dl>
            ${slot.price ? `<div><dt>Fiyat</dt><dd>${escapeHtml(slot.price)}</dd></div>` : ''}
            ${slot.status ? `<div><dt>Durum</dt><dd>${escapeHtml(slot.status)}</dd></div>` : ''}
          </dl>
          ${action}
        </div>`;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    });
  };

  const renderSlots = (content) => {
    latestContent = content || latestContent || getDefaults();
    renderHeroSlots(latestContent);
    renderFeaturedSlots(latestContent);
    setupSlotDialog();
  };

  const scheduleRender = (content) => {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => renderSlots(content || latestContent || getDefaults()), 80);
  };

  const init = async () => {
    if (!document.querySelector('[data-hero-slider]') && !document.querySelector('[data-featured-grid]')) return;
    const defaults = getDefaults();
    latestContent = defaults;
    scheduleRender(defaults);

    const app = getFirebaseApp();
    if (!app || !firebase.firestore) {
      window.setTimeout(() => scheduleRender(defaults), 650);
      return;
    }

    try {
      const db = firebase.firestore();
      db.collection(FIREBASE_CONTENT_COLLECTION).doc(FIREBASE_CONTENT_DOC).onSnapshot((doc) => {
        const merged = deepMerge(defaults, doc.exists ? doc.data() : {});
        scheduleRender(merged);
      }, () => scheduleRender(defaults));

      db.collection(FIREBASE_ARTWORKS_COLLECTION).limit(1).onSnapshot(() => {
        window.setTimeout(() => scheduleRender(latestContent), 180);
      });
    } catch (_) {
      scheduleRender(defaults);
    }

    window.setTimeout(() => scheduleRender(latestContent), 900);
    window.setTimeout(() => scheduleRender(latestContent), 2200);
  };

  init();
})();
