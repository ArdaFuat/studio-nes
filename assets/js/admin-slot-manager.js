(function () {
  const FIREBASE_CONTENT_COLLECTION = 'siteContent';
  const FIREBASE_CONTENT_DOC = 'main';
  const FIREBASE_ARTWORKS_COLLECTION = 'artworks';
  let siteContent = null;
  let artworks = [];
  let contentUnsub = null;
  let artworksUnsub = null;
  let mounted = false;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

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

  const defaults = () => clone(typeof DEFAULT_SITE_CONTENT !== 'undefined' ? DEFAULT_SITE_CONTENT : { home: {}, custom: {}, about: {} });

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

  const allowed = (user) => {
    const emails = Array.isArray(window.NESS_ADMIN_EMAILS) ? window.NESS_ADMIN_EMAILS : [];
    return emails.map((mail) => String(mail).trim().toLowerCase()).includes(String(user?.email || '').trim().toLowerCase());
  };

  const setNotice = (message, type = 'info') => {
    const node = $('[data-admin-notice]');
    if (!node) return;
    node.textContent = message;
    node.className = `admin-notice ${type}`;
    if (message) node.removeAttribute('hidden');
    else node.setAttribute('hidden', '');
  };

  const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Görsel okunamadı.'));
    reader.readAsDataURL(blob);
  });

  const loadImageFromFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Bu görsel açılamadı. Farklı bir JPG/PNG dene.'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Görsel dosyası okunamadı.'));
    reader.readAsDataURL(file);
  });

  const compressImageFile = async (file, options = {}) => {
    if (!file || !file.type?.startsWith('image/')) throw new Error('Lütfen JPG, PNG veya WEBP görsel seç.');
    const img = await loadImageFromFile(file);
    const targetBytes = options.targetBytes || 82 * 1024;
    const hardLimitBytes = options.hardLimitBytes || 118 * 1024;
    let maxSide = options.maxSide || 1050;
    let quality = options.quality || 0.72;
    let blob = null;

    for (let attempt = 0; attempt < 11; attempt += 1) {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
      const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
      const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fffaf0';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (!blob) throw new Error('Görsel sıkıştırılamadı.');
      if (blob.size <= targetBytes) break;
      if (quality > 0.42) quality -= 0.08;
      else maxSide = Math.max(620, Math.round(maxSide * 0.82));
    }

    if (!blob || blob.size > hardLimitBytes) throw new Error('Görsel hâlâ çok büyük. Daha küçük veya sıkıştırılmış bir görsel seç.');
    return blobToDataUrl(blob);
  };

  const injectStyles = () => {
    if ($('#slot-manager-styles')) return;
    const style = document.createElement('style');
    style.id = 'slot-manager-styles';
    style.textContent = `
      .slot-manager-card { grid-column: 1 / -1; }
      .slot-tabs { display: flex; flex-wrap: wrap; gap: .55rem; margin: 1rem 0; }
      .slot-tabs button { border: 1px solid rgba(34, 66, 46, .18); background: #fffaf0; border-radius: 999px; padding: .65rem 1rem; cursor: pointer; font-weight: 700; color: #24422e; }
      .slot-tabs button.active { background: #24422e; color: #fffaf0; }
      .slot-panel[hidden] { display: none; }
      .slot-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; }
      .slot-card { border: 1px solid rgba(34, 66, 46, .12); border-radius: 20px; background: rgba(255, 250, 240, .72); padding: 1rem; display: grid; gap: .75rem; }
      .slot-card h3 { margin: 0; font-family: inherit; font-size: 1rem; }
      .slot-card img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 16px; background: #f3eadb; }
      .slot-actions { display: flex; flex-wrap: wrap; gap: .55rem; align-items: center; }
      .slot-manager-card .full-field { grid-column: 1 / -1; }
      .slot-artwork-picker { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: .65rem; }
      .slot-artwork-picker label { display: grid; grid-template-columns: auto 1fr; gap: .55rem; align-items: center; border: 1px solid rgba(34, 66, 46, .12); border-radius: 14px; padding: .65rem; background: #fffaf0; }
      .slot-artwork-picker small { color: rgba(34, 66, 46, .65); }
    `;
    document.head.appendChild(style);
  };

  const getHeroSlots = () => {
    const slots = siteContent?.home?.heroSlots;
    const fallback = window.NESS_DEFAULT_HERO_SLOTS || [];
    return (Array.isArray(slots) && slots.length ? slots : fallback).slice(0, 3);
  };

  const getFeaturedSlots = () => {
    const slots = siteContent?.home?.featuredSlots;
    const fallback = window.NESS_DEFAULT_FEATURED_SLOTS || [];
    return (Array.isArray(slots) && slots.length ? slots : fallback).slice(0, 3);
  };

  const input = (label, attr, value = '', type = 'text', hint = '') => `
    <label>${escapeHtml(label)}
      ${type === 'textarea'
        ? `<textarea rows="3" ${attr}>${escapeHtml(value)}</textarea>`
        : `<input type="${type}" ${attr} value="${escapeHtml(value)}">`}
      ${hint ? `<small class="field-hint">${escapeHtml(hint)}</small>` : ''}
    </label>`;

  const renderHeroPanel = () => {
    const slots = getHeroSlots();
    return `<div class="slot-grid">${[0, 1, 2].map((index) => {
      const slot = slots[index] || {};
      return `<article class="slot-card" data-hero-slot="${index}">
        <h3>Ana slider görsel ${index + 1}</h3>
        <img data-hero-preview="${index}" src="${escapeHtml(safeUrl(slot.image) || 'assets/img/ness-logo.png')}" alt="Önizleme">
        ${input('Başlık', 'data-hero-field="title"', slot.title || '')}
        ${input('Küçük bilgi / teknik', 'data-hero-field="subtitle"', slot.subtitle || slot.meta || '')}
        ${input('Açıklama', 'data-hero-field="text"', slot.text || '', 'textarea')}
        ${input('Görsel URL / yol', 'data-hero-field="image"', slot.image || '', 'text', 'İstersen URL yaz, istersen aşağıdan bilgisayardan seç.')}
        ${input('Alt yazı', 'data-hero-field="alt"', slot.alt || '')}
        <div class="two-col">
          ${input('Üst rozet küçük yazı', 'data-hero-field="badgeLabel"', slot.badgeLabel || 'öne çıkan tablo')}
          ${input('Üst rozet büyük yazı', 'data-hero-field="badgeText"', slot.badgeText || slot.title || '')}
        </div>
        <div class="two-col">
          ${input('Alt rozet küçük yazı', 'data-hero-field="metaLabel"', slot.metaLabel || 'koleksiyon')}
          ${input('Alt rozet büyük yazı', 'data-hero-field="metaText"', slot.metaText || slot.subtitle || '')}
        </div>
        <label class="upload-box">Bilgisayardan görsel seç<input type="file" accept="image/*" data-hero-file="${index}"></label>
      </article>`;
    }).join('')}</div>`;
  };

  const renderFeaturedPanel = () => {
    const slots = getFeaturedSlots();
    return `<div class="slot-grid">${[0, 1, 2].map((index) => {
      const slot = slots[index] || {};
      return `<article class="slot-card" data-featured-slot="${index}">
        <h3>Öne çıkan kart ${index + 1}</h3>
        <img data-featured-preview="${index}" src="${escapeHtml(safeUrl(slot.image) || 'assets/img/ness-logo.png')}" alt="Önizleme">
        ${input('Başlık', 'data-featured-field="title"', slot.title || '')}
        ${input('Meta / teknik / ölçü', 'data-featured-field="meta"', slot.meta || slot.subtitle || '')}
        ${input('Kart açıklaması', 'data-featured-field="text"', slot.text || '', 'textarea')}
        ${input('Detay açıklaması', 'data-featured-field="detail"', slot.detail || '', 'textarea')}
        ${input('Görsel URL / yol', 'data-featured-field="image"', slot.image || '')}
        ${input('Alt yazı', 'data-featured-field="alt"', slot.alt || '')}
        <div class="two-col">
          ${input('Durum rozeti', 'data-featured-field="status"', slot.status || '')}
          ${input('Fiyat / kısa bilgi', 'data-featured-field="price"', slot.price || '')}
        </div>
        <div class="two-col">
          ${input('Buton yazısı', 'data-featured-field="buttonLabel"', slot.buttonLabel || 'Detay')}
          ${input('Buton linki', 'data-featured-field="url"', slot.url || '')}
        </div>
        <label class="upload-box">Bilgisayardan görsel seç<input type="file" accept="image/*" data-featured-file="${index}"></label>
      </article>`;
    }).join('')}</div>`;
  };

  const renderCustomPicker = () => {
    const selected = String(siteContent?.custom?.customArtworkIds || '').split(',').map((item) => item.trim()).filter(Boolean);
    const publicArtworks = artworks.filter((art) => !art.hidden);
    const items = publicArtworks.length ? publicArtworks : artworks;
    if (!items.length) return '<p class="muted-box">Ürün listesi henüz gelmedi. Önce galeri ürünlerini aktar veya ekle.</p>';
    return `<div class="slot-artwork-picker">${items.map((art) => `
      <label>
        <input type="checkbox" data-custom-art-id="${escapeHtml(art.id)}" ${selected.includes(art.id) ? 'checked' : ''}>
        <span><strong>${escapeHtml(art.title)}</strong><br><small>ID: ${escapeHtml(art.id)} · ${escapeHtml(art.collection || '')}</small></span>
      </label>`).join('')}</div>`;
  };

  const renderAboutPanel = () => {
    const about = siteContent?.about || {};
    return `<div class="slot-grid">
      <article class="slot-card about-image-slot">
        <h3>Hakkında sayfası görseli</h3>
        <img data-about-preview src="${escapeHtml(safeUrl(about.image) || 'assets/img/ness-logo.png')}" alt="Önizleme">
        ${input('Görsel URL / yol', 'data-about-image', about.image || '')}
        ${input('Alt yazı', 'data-about-alt', about.imageAlt || '')}
        <label class="upload-box">Bilgisayardan görsel seç<input type="file" accept="image/*" data-about-file></label>
      </article>
    </div>`;
  };

  const renderManager = () => {
    const host = $('[data-slot-manager-body]');
    if (!host || !siteContent) return;
    host.innerHTML = `
      <div class="slot-tabs" role="tablist">
        <button type="button" class="active" data-slot-tab="hero">Ana slider 3 görsel</button>
        <button type="button" data-slot-tab="featured">Ana sayfa 3 kart</button>
        <button type="button" data-slot-tab="custom">Özel sipariş seçimleri</button>
        <button type="button" data-slot-tab="about">Hakkında görseli</button>
      </div>
      <div class="slot-panel" data-slot-panel="hero">${renderHeroPanel()}</div>
      <div class="slot-panel" data-slot-panel="featured" hidden>${renderFeaturedPanel()}</div>
      <div class="slot-panel" data-slot-panel="custom" hidden>${renderCustomPicker()}</div>
      <div class="slot-panel" data-slot-panel="about" hidden>${renderAboutPanel()}</div>
      <div class="slot-actions"><button class="btn primary" type="button" data-save-slots>Görsel Slotlarını Kaydet</button></div>`;
  };

  const mount = () => {
    if (mounted || !$('.admin-extra-grid')) return;
    injectStyles();
    const section = document.createElement('section');
    section.className = 'admin-card slot-manager-card';
    section.innerHTML = `
      <div class="admin-section-title row-title">
        <div>
          <h2>Görsel slotları</h2>
          <p>Ana sayfadaki slider ve üç kart galeriden bağımsızdır. Özel sipariş kısmı ise galeriden seçilir.</p>
        </div>
      </div>
      <div data-slot-manager-body><p class="muted-box">Yükleniyor...</p></div>`;
    $('.admin-extra-grid').prepend(section);
    mounted = true;
    renderManager();
  };

  const readHeroSlots = () => $$('[data-hero-slot]').map((card) => {
    const slot = {};
    card.querySelectorAll('[data-hero-field]').forEach((field) => { slot[field.dataset.heroField] = field.value.trim(); });
    slot.image = safeUrl(slot.image) || '';
    return slot;
  }).filter((slot) => slot.title || slot.image);

  const readFeaturedSlots = () => $$('[data-featured-slot]').map((card) => {
    const slot = {};
    card.querySelectorAll('[data-featured-field]').forEach((field) => { slot[field.dataset.featuredField] = field.value.trim(); });
    slot.image = safeUrl(slot.image) || '';
    slot.url = safeUrl(slot.url) || '';
    return slot;
  }).filter((slot) => slot.title || slot.image);

  const readCustomArtworkIds = () => $$('[data-custom-art-id]:checked').map((input) => input.dataset.customArtId).join(', ');

  const readAbout = () => ({
    image: safeUrl($('[data-about-image]')?.value || '') || '',
    imageAlt: $('[data-about-alt]')?.value.trim() || ''
  });

  const saveSlots = async () => {
    try {
      const next = deepMerge(siteContent || defaults(), {});
      next.home = next.home || {};
      next.custom = next.custom || {};
      next.about = next.about || {};
      next.home.heroSlots = readHeroSlots();
      next.home.featuredSlots = readFeaturedSlots();
      next.custom.customArtworkIds = readCustomArtworkIds();
      const about = readAbout();
      if (about.image) next.about.image = about.image;
      if (about.imageAlt) next.about.imageAlt = about.imageAlt;
      next.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      next.updatedBy = firebase.auth().currentUser?.email || '';
      await firebase.firestore().collection(FIREBASE_CONTENT_COLLECTION).doc(FIREBASE_CONTENT_DOC).set(next, { merge: true });
      setNotice('Görsel slotları kaydedildi. Ana sayfa canlı olarak güncellenir.', 'success');
    } catch (error) {
      setNotice(`Görsel slotları kaydedilemedi: ${error.message}`, 'error');
    }
  };

  const setFileResult = async (file, selector, previewSelector, options = {}) => {
    if (!file) return;
    setNotice('Görsel hazırlanıyor...', 'info');
    const dataUrl = await compressImageFile(file, options);
    const inputNode = $(selector);
    const preview = $(previewSelector);
    if (inputNode) inputNode.value = dataUrl;
    if (preview) preview.src = dataUrl;
    setNotice('Görsel hazır. Kaydet butonuna basınca canlı siteye yansır.', 'success');
  };

  const setupEvents = () => {
    document.addEventListener('click', (event) => {
      const tab = event.target.closest('[data-slot-tab]');
      if (tab) {
        $$('[data-slot-tab]').forEach((btn) => btn.classList.toggle('active', btn === tab));
        $$('[data-slot-panel]').forEach((panel) => { panel.hidden = panel.dataset.slotPanel !== tab.dataset.slotTab; });
      }
      if (event.target.closest('[data-save-slots]')) saveSlots();
    });

    document.addEventListener('change', async (event) => {
      const heroFile = event.target.closest('[data-hero-file]');
      const featuredFile = event.target.closest('[data-featured-file]');
      const aboutFile = event.target.closest('[data-about-file]');
      try {
        if (heroFile) {
          const index = heroFile.dataset.heroFile;
          await setFileResult(heroFile.files?.[0], `[data-hero-slot="${index}"] [data-hero-field="image"]`, `[data-hero-preview="${index}"]`);
          heroFile.value = '';
        }
        if (featuredFile) {
          const index = featuredFile.dataset.featuredFile;
          await setFileResult(featuredFile.files?.[0], `[data-featured-slot="${index}"] [data-featured-field="image"]`, `[data-featured-preview="${index}"]`);
          featuredFile.value = '';
        }
        if (aboutFile) {
          await setFileResult(aboutFile.files?.[0], '[data-about-image]', '[data-about-preview]', { targetBytes: 130 * 1024, hardLimitBytes: 170 * 1024, maxSide: 1200, quality: 0.74 });
          aboutFile.value = '';
        }
      } catch (error) {
        setNotice(error.message || 'Görsel hazırlanamadı.', 'error');
        event.target.value = '';
      }
    });

    document.addEventListener('input', (event) => {
      const heroImage = event.target.closest('[data-hero-field="image"]');
      const featuredImage = event.target.closest('[data-featured-field="image"]');
      const aboutImage = event.target.closest('[data-about-image]');
      if (heroImage) {
        const index = heroImage.closest('[data-hero-slot]')?.dataset.heroSlot;
        const preview = $(`[data-hero-preview="${index}"]`);
        if (preview) preview.src = safeUrl(heroImage.value) || 'assets/img/ness-logo.png';
      }
      if (featuredImage) {
        const index = featuredImage.closest('[data-featured-slot]')?.dataset.featuredSlot;
        const preview = $(`[data-featured-preview="${index}"]`);
        if (preview) preview.src = safeUrl(featuredImage.value) || 'assets/img/ness-logo.png';
      }
      if (aboutImage) {
        const preview = $('[data-about-preview]');
        if (preview) preview.src = safeUrl(aboutImage.value) || 'assets/img/ness-logo.png';
      }
    });
  };

  const watchData = () => {
    const db = firebase.firestore();
    if (contentUnsub) contentUnsub();
    if (artworksUnsub) artworksUnsub();
    contentUnsub = db.collection(FIREBASE_CONTENT_COLLECTION).doc(FIREBASE_CONTENT_DOC).onSnapshot((doc) => {
      siteContent = deepMerge(defaults(), doc.exists ? doc.data() : {});
      mount();
      renderManager();
    }, (error) => setNotice(`Görsel slotları okunamadı: ${error.message}`, 'error'));
    artworksUnsub = db.collection(FIREBASE_ARTWORKS_COLLECTION).orderBy('order', 'asc').onSnapshot((snapshot) => {
      artworks = snapshot.docs.map((doc, index) => ({ id: doc.id, order: index, ...doc.data() }));
      if (mounted) renderManager();
    }, (error) => setNotice(`Ürün seçim listesi okunamadı: ${error.message}`, 'error'));
  };

  const init = () => {
    const app = getFirebaseApp();
    if (!app || !firebase.auth || !firebase.firestore) return;
    setupEvents();
    firebase.auth().onAuthStateChanged((user) => {
      if (user && allowed(user)) {
        watchData();
      } else {
        if (contentUnsub) contentUnsub();
        if (artworksUnsub) artworksUnsub();
      }
    });
  };

  init();
})();
