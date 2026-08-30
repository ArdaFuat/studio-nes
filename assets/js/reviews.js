(function () {
  const SUBMISSIONS_COLLECTION = 'reviewSubmissions';
  const PUBLIC_REVIEWS_COLLECTION = 'reviews';
  const ARTWORKS_COLLECTION = 'artworks';
  const REVIEWS_CACHE_KEY = 'studio-nes-reviews-cache-v3-mobile-stable';
  const LEGACY_REVIEWS_CACHE_KEYS = ['studio-nes-reviews-cache-v2-server-complete', 'studio-nes-reviews-cache-v1'];
  const PUBLIC_CACHE_KEY = 'studio-nes-public-cache-v6-cat-dedupe';

  const CITIES = [
    'İstanbul', 'Ankara',
    'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Antalya', 'Ardahan', 'Artvin', 'Aydın',
    'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa',
    'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir',
    'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkâri', 'Hatay', 'Iğdır', 'Isparta', 'İzmir', 'Kahramanmaraş', 'Karabük',
    'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kilis', 'Kırıkkale', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya',
    'Kütahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye',
    'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Şanlıurfa', 'Şırnak', 'Tekirdağ', 'Tokat', 'Trabzon',
    'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak'
  ];

  let artworks = [];
  let reviews = [];
  let selectedArtwork = null;
  let featuredIndex = 0;
  let featuredTimer = null;
  let reviewModalReturnFocus = null;
  let artworkPickerReturnFocus = null;
  let featuredClickSuppressedUntil = 0;
  let reviewsUnsubscribe = null;
  let artworksLoadPromise = null;
  let artworksFirebaseLoaded = false;
  let artworksUnsubscribe = null;
  let reviewsCacheWriteScheduled = false;
  const reviewDateFormatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const featuredMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const $ = (selector) => document.querySelector(selector);
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
    } catch (_) { return ''; }
  };

  const getFirebaseApp = () => {
    try {
      if (typeof firebase === 'undefined' || typeof window.NESS_FIREBASE_IS_CONFIGURED !== 'function' || !window.NESS_FIREBASE_IS_CONFIGURED()) return null;
      if (typeof window.NESS_GET_FIRESTORE === 'function') window.NESS_GET_FIRESTORE();
      else if (!firebase.apps.length) firebase.initializeApp(window.NESS_FIREBASE_CONFIG);
      return firebase.app();
    } catch (error) {
      console.warn('Değerlendirme sistemi başlatılamadı:', error);
      return null;
    }
  };

  const getFirestore = () => {
    const app = getFirebaseApp();
    if (!app || typeof firebase === 'undefined' || !firebase.firestore) return null;
    try {
      return typeof window.NESS_GET_FIRESTORE === 'function' ? window.NESS_GET_FIRESTORE() : firebase.firestore();
    } catch (_) {
      return null;
    }
  };


  const readJsonCache = (key) => {
    try {
      const raw = window.localStorage?.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  };

  const readReviewsCache = () => {
    const keys = [REVIEWS_CACHE_KEY, ...LEGACY_REVIEWS_CACHE_KEYS];
    let best = [];
    keys.forEach((key) => {
      const cached = readJsonCache(key);
      const items = Array.isArray(cached?.reviews)
        ? cached.reviews.map((item) => normalizeReview(item, item.id))
        : [];
      // Eski surumlerden biri tam listeyi daha once aldiysa ilk acilista onu koru.
      // Canli sunucu snapshot'i geldiginde guncel koleksiyon bunun yerini alir.
      if (items.length > best.length) best = items;
    });
    return best;
  };

  const writeReviewsCache = () => {
    try {
      const payload = {
        cachedAt: new Date().toISOString(),
        reviews: reviews.map((review) => ({
          ...review,
          publishedAt: toDate(review.publishedAt)?.toISOString() || review.publishedAt || ''
        }))
      };
      window.localStorage?.setItem(REVIEWS_CACHE_KEY, JSON.stringify(payload));
    } catch (_) {
      // Cache doluysa canlı Firebase akışı normal şekilde devam eder.
    }
  };

  const scheduleReviewsCacheWrite = () => {
    if (reviewsCacheWriteScheduled) return;
    reviewsCacheWriteScheduled = true;
    const commit = () => {
      reviewsCacheWriteScheduled = false;
      writeReviewsCache();
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(commit, { timeout: 1200 });
    else window.setTimeout(commit, 80);
  };

  const readCachedArtworks = () => {
    const cached = readJsonCache(PUBLIC_CACHE_KEY);
    return Array.isArray(cached?.artworks) ? cached.artworks.map((art) => normalizeArtwork(art, art.id)) : [];
  };

  const toDate = (value) => {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const formatDate = (value) => {
    const date = toDate(value);
    if (!date) return '';
    return reviewDateFormatter.format(date);
  };

  const normalizeArtwork = (art = {}, id = '') => ({
    id: id || art.id || '',
    title: String(art.title || 'İsimsiz eser'),
    image: safeUrl(art.image) || 'assets/img/ness-logo.png',
    size: String(art.size || ''),
    technique: String(art.technique || ''),
    price: String(art.price || ''),
    status: String(art.status || ''),
    category: String(art.category || ''),
    url: safeUrl(art.url),
    sourceLabel: String(art.sourceLabel || ''),
    actionLabel: String(art.actionLabel || ''),
    hidden: Boolean(art.hidden),
    order: Number.isFinite(Number(art.order)) ? Number(art.order) : 9999
  });

  const normalizeReview = (review = {}, id = '') => ({
    id: id || review.id || '',
    publicName: String(review.publicName || 'Studio Nes müşterisi'),
    city: String(review.city || ''),
    artworkId: String(review.artworkId || ''),
    artworkTitle: String(review.artworkTitle || 'Studio Nes eseri'),
    artworkImage: safeUrl(review.artworkImage) || 'assets/img/ness-logo.png',
    rating: Math.max(1, Math.min(5, Number(review.rating) || 5)),
    comment: String(review.comment || ''),
    order: Number.isFinite(Number(review.order)) ? Number(review.order) : 999999,
    featured: Boolean(review.featured),
    featuredOrder: Number.isFinite(Number(review.featuredOrder)) ? Number(review.featuredOrder) : 999999,
    publishedAt: review.publishedAt || review.createdAt || ''
  });

  const fillCities = () => {
    const select = $('#reviewCity');
    if (!select) return;
    select.insertAdjacentHTML('beforeend', CITIES.map((city) => `<option value="${escapeHtml(city)}">${escapeHtml(city)}</option>`).join(''));
  };

  const normalizeSearchText = (value = '') => String(value || '').toLocaleLowerCase('tr-TR').trim();

  const renderArtworkOptions = () => {
    const select = $('#reviewArtwork');
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">Galeriden eser seçin</option>' + artworks
      .map((art) => `<option value="${escapeHtml(art.id)}">${escapeHtml(art.title)}${art.size ? ` · ${escapeHtml(art.size)}` : ''}</option>`)
      .join('');
    if (artworks.some((art) => art.id === currentValue)) select.value = currentValue;
  };

  const renderArtworkPickerGrid = (query = '') => {
    const grid = $('[data-artwork-picker-grid]');
    const count = $('[data-artwork-picker-count]');
    if (!grid) return;

    const normalizedQuery = normalizeSearchText(query);
    const visible = normalizedQuery
      ? artworks.filter((art) => normalizeSearchText([art.title, art.technique, art.size, art.category].join(' ')).includes(normalizedQuery))
      : artworks;

    if (count) count.textContent = `${visible.length} eser`;
    if (!visible.length) {
      grid.innerHTML = `
        <div class="review-artwork-picker-empty">
          <span aria-hidden="true">✦</span>
          <strong>${artworks.length ? 'Aramanızla eşleşen eser bulunamadı.' : 'Galeride gösterilecek eser bulunamadı.'}</strong>
          <small>${artworks.length ? 'Başka bir eser adıyla aramayı deneyin.' : 'Ürünler yüklendiğinde burada görünecek.'}</small>
        </div>`;
      return;
    }

    const selectedId = selectedArtwork?.id || $('#reviewArtwork')?.value || '';
    grid.innerHTML = visible.map((art) => {
      const isSelected = selectedId === art.id;
      const meta = [art.technique, art.size].filter(Boolean).join(' · ');
      return `
        <button class="review-artwork-picker-card${isSelected ? ' is-selected' : ''}" type="button" data-artwork-pick="${escapeHtml(art.id)}" aria-pressed="${isSelected ? 'true' : 'false'}">
          <span class="review-artwork-picker-card-image">
            <img src="${escapeHtml(art.image)}" alt="${escapeHtml(art.title)}" loading="lazy" decoding="async">
            <span class="review-artwork-picker-card-check" aria-hidden="true">✓</span>
          </span>
          <span class="review-artwork-picker-card-copy">
            <strong>${escapeHtml(art.title)}</strong>
            <small>${escapeHtml(meta || 'Studio Nes eseri')}</small>
          </span>
        </button>`;
    }).join('');
  };

  const setArtworks = (items) => {
    artworks = (Array.isArray(items) ? items : [])
      .map((art) => normalizeArtwork(art, art.id))
      .filter((art) => !art.hidden)
      .sort((a, b) => a.order - b.order);
    renderArtworkOptions();
    renderArtworkPreview();
    renderArtworkPickerGrid($('[data-artwork-picker-search]')?.value || '');
  };

  let artworksRemoteConfirmed = false;
  let artworksRetryTimer = null;
  let artworksFetchPromise = null;
  let artworksRetryAttempt = 0;
  const ARTWORK_PROBE_DELAYS = [1600, 4000, 9000, 18000, 30000];

  const applyArtworkSnapshot = (snapshot) => {
    const items = snapshot.docs.map((doc) => normalizeArtwork(doc.data(), doc.id));
    const visibleCount = items.filter((art) => !art.hidden).length;
    const remote = !(snapshot && snapshot.metadata && snapshot.metadata.fromCache);

    if (remote || !artworks.length || visibleCount >= artworks.length) setArtworks(items);
    artworksFirebaseLoaded = true;
    if (remote) {
      artworksRemoteConfirmed = true;
      artworksRetryAttempt = 0;
      if (artworksRetryTimer) {
        window.clearTimeout(artworksRetryTimer);
        artworksRetryTimer = null;
      }
    }
    return remote;
  };

  const fetchArtworksOnce = () => {
    if (artworksRemoteConfirmed) return Promise.resolve(true);
    if (artworksFetchPromise) return artworksFetchPromise;
    const db = getFirestore();
    if (!db) return Promise.resolve(false);
    artworksFetchPromise = db.collection(ARTWORKS_COLLECTION).get({ source: 'server' })
      .then((snapshot) => {
        return applyArtworkSnapshot(snapshot);
      })
      .catch((error) => {
        console.warn('Galeri tek seferlik okunamadı:', error);
        return false;
      })
      .finally(() => { artworksFetchPromise = null; });
    return artworksFetchPromise;
  };

  const scheduleArtworkRetry = (delay = null) => {
    if (artworksRemoteConfirmed || artworksRetryTimer) return;
    if ('onLine' in navigator && !navigator.onLine) return;
    const index = Math.min(artworksRetryAttempt, ARTWORK_PROBE_DELAYS.length - 1);
    const wait = delay === null ? ARTWORK_PROBE_DELAYS[index] : Math.max(0, delay);
    artworksRetryTimer = window.setTimeout(() => {
      artworksRetryTimer = null;
      artworksRetryAttempt += 1;
      fetchArtworksOnce().then((remote) => {
        if (!remote && !artworksRemoteConfirmed) scheduleArtworkRetry();
      });
    }, wait);
  };

  const loadArtworks = async () => {
    const cachedItems = readCachedArtworks();
    const fallbackItems = typeof ARTWORKS !== 'undefined' && Array.isArray(ARTWORKS) ? ARTWORKS : [];
    if (!artworks.length) setArtworks(cachedItems.length ? cachedItems : fallbackItems);
    if (artworksFirebaseLoaded && artworksUnsubscribe) {
      scheduleArtworkRetry();
      return true;
    }
    if (artworksLoadPromise) return artworksLoadPromise;

    const db = getFirestore();
    if (!db) {
      scheduleArtworkRetry(900);
      return false;
    }

    artworksLoadPromise = new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        artworksLoadPromise = null;
        resolve(result);
      };

      try {
        // orderBy yok: order alani olmayan tum galeri eserleri de gelir.
        artworksUnsubscribe = db.collection(ARTWORKS_COLLECTION)
          .onSnapshot({ includeMetadataChanges: true }, (snapshot) => {
            applyArtworkSnapshot(snapshot);
            finish(true);
            scheduleArtworkRetry();
          }, (error) => {
            console.warn('Galerideki eserler okunamadı:', error);
            artworksUnsubscribe = null;
            artworksFirebaseLoaded = false;
            artworksRemoteConfirmed = false;
            finish(false);
            fetchArtworksOnce();
            scheduleArtworkRetry(1000);
          });
        scheduleArtworkRetry();
      } catch (error) {
        console.warn('Galerideki eserler okunamadı:', error);
        artworksUnsubscribe = null;
        artworksFirebaseLoaded = false;
        artworksRemoteConfirmed = false;
        finish(false);
        fetchArtworksOnce();
        scheduleArtworkRetry(1000);
      }
    });

    return artworksLoadPromise;
  };

  const renderArtworkPreview = () => {
    const select = $('#reviewArtwork');
    const trigger = $('[data-artwork-picker-open]');
    if (!select || !trigger) return;

    const id = select.value || '';
    selectedArtwork = artworks.find((art) => art.id === id) || null;

    const image = $('[data-artwork-picker-thumb-image]');
    const icon = $('[data-artwork-picker-thumb-icon]');
    const eyebrow = $('[data-artwork-picker-eyebrow]');
    const title = $('[data-artwork-picker-title]');
    const meta = $('[data-artwork-picker-meta]');
    const action = $('[data-artwork-picker-action]');

    trigger.classList.toggle('is-selected', Boolean(selectedArtwork));
    if (!selectedArtwork) {
      if (image) { image.setAttribute('hidden', ''); image.src = 'assets/img/ness-logo.png'; }
      if (icon) icon.removeAttribute('hidden');
      if (eyebrow) eyebrow.textContent = 'Studio Nes Galerisi';
      if (title) title.textContent = 'Galeriden eser seç';
      if (meta) meta.textContent = 'Görselleri ve eser adlarını birlikte görüntüleyin';
      if (action) action.textContent = 'Seç';
      trigger.setAttribute('aria-label', 'Galeriden satın aldığınız eseri seçin');
      return;
    }

    if (image) {
      image.src = selectedArtwork.image;
      image.alt = '';
      image.removeAttribute('hidden');
    }
    if (icon) icon.setAttribute('hidden', '');
    if (eyebrow) eyebrow.textContent = 'Seçilen eser';
    if (title) title.textContent = selectedArtwork.title;
    if (meta) meta.textContent = [selectedArtwork.technique, selectedArtwork.size].filter(Boolean).join(' · ') || 'Studio Nes eseri';
    if (action) action.textContent = 'Değiştir';
    trigger.setAttribute('aria-label', `${selectedArtwork.title} seçildi. Eseri değiştirmek için galeriyi açın.`);
  };

  const renderStars = (rating) => `<span class="review-card-stars" aria-label="5 üzerinden ${rating} yıldız">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</span>`;


  const isLongComment = (comment, context = 'feed') => {
    const limit = context === 'featured' ? 170 : 250;
    return String(comment || '').trim().length > limit;
  };

  const renderReviewDetailButton = (review, context = 'feed') => {
    if (!isLongComment(review.comment, context)) return '';
    return '<span class="review-read-more" aria-hidden="true">Devamını oku</span>';
  };

  const getFeaturedReviews = () => reviews
    .filter((review) => review.featured)
    .sort((a, b) => a.featuredOrder - b.featuredOrder || a.order - b.order)
    .slice(0, 4);

  const stopFeaturedAutoplay = () => {
    if (featuredTimer) window.clearInterval(featuredTimer);
    featuredTimer = null;
  };

  const showFeaturedReview = (nextIndex, options = {}) => {
    const items = getFeaturedReviews();
    const track = $('[data-featured-track]');
    if (!track || !items.length) return;
    featuredIndex = (nextIndex + items.length) % items.length;
    track.style.transform = `translate3d(-${featuredIndex * 100}%, 0, 0)`;
    track.querySelectorAll('.featured-review-slide').forEach((slide, index) => {
      const isActive = index === featuredIndex;
      slide.setAttribute('aria-hidden', String(!isActive));
      slide.setAttribute('tabindex', isActive ? '0' : '-1');
    });
    document.querySelectorAll('[data-featured-dot]').forEach((dot, index) => {
      const active = index === featuredIndex;
      dot.classList.toggle('active', active);
      dot.setAttribute('aria-current', active ? 'true' : 'false');
    });
    if (options.restart) startFeaturedAutoplay();
  };

  const startFeaturedAutoplay = () => {
    stopFeaturedAutoplay();
    const items = getFeaturedReviews();
    if (items.length < 2 || featuredMotionQuery.matches || document.hidden) return;
    featuredTimer = window.setInterval(() => showFeaturedReview(featuredIndex + 1), 7800);
  };

  const renderFeaturedReviews = () => {
    const showcase = $('[data-featured-showcase]');
    const track = $('[data-featured-track]');
    const nav = $('[data-featured-nav]');
    const dots = $('[data-featured-dots]');
    if (!showcase || !track || !nav || !dots) return;

    const items = getFeaturedReviews();
    stopFeaturedAutoplay();
    if (!items.length) {
      showcase.setAttribute('hidden', '');
      track.innerHTML = '';
      dots.innerHTML = '';
      return;
    }

    showcase.removeAttribute('hidden');
    track.innerHTML = items.map((review, index) => `
      <article class="featured-review-slide review-card-openable" data-review-detail-id="${escapeHtml(review.id)}" role="button" tabindex="${index === 0 ? '0' : '-1'}" aria-label="${escapeHtml(review.publicName)} tarafından yazılan yorumu ve eser detaylarını aç" aria-hidden="${index === 0 ? 'false' : 'true'}">
        <div class="featured-review-topline">
          ${renderStars(review.rating).replace('review-card-stars', 'review-card-stars featured-review-stars')}
          <span class="featured-review-quote-mark" aria-hidden="true">“</span>
        </div>
        <div class="featured-review-copy">
          <p class="featured-review-comment${isLongComment(review.comment, 'featured') ? ' is-collapsed' : ''}">“${escapeHtml(review.comment)}”</p>
          ${renderReviewDetailButton(review, 'featured')}
        </div>
        <div class="featured-review-footer">
          <div class="featured-review-author">
            <span class="featured-review-initial" aria-hidden="true">${escapeHtml(review.publicName.charAt(0).toLocaleUpperCase('tr-TR') || 'S')}</span>
            <span><strong>${escapeHtml(review.publicName)}</strong><small>${escapeHtml(review.city)}</small></span>
          </div>
          <div class="featured-review-artwork">
            <img src="${escapeHtml(review.artworkImage)}" alt="${escapeHtml(review.artworkTitle)}" decoding="async">
            <span><small>Satın alınan eser</small><strong>${escapeHtml(review.artworkTitle)}</strong></span>
          </div>
        </div>
      </article>`).join('');

    dots.innerHTML = items.map((_, index) => `
      <button type="button" data-featured-dot="${index}" aria-label="${index + 1}. yorumu göster" aria-current="${index === 0 ? 'true' : 'false'}"></button>`).join('');
    if (items.length > 1) nav.removeAttribute('hidden');
    else nav.setAttribute('hidden', '');
    featuredIndex = Math.min(featuredIndex, items.length - 1);
    showFeaturedReview(featuredIndex);
    startFeaturedAutoplay();
  };

  const getSortedReviews = () => {
    const mode = $('[data-review-sort]')?.value || 'featured';
    const items = [...reviews];
    if (mode === 'newest') return items.sort((a, b) => (toDate(b.publishedAt)?.getTime() || 0) - (toDate(a.publishedAt)?.getTime() || 0));
    if (mode === 'highest') return items.sort((a, b) => b.rating - a.rating || a.order - b.order);
    return items.sort((a, b) => a.order - b.order || (toDate(b.publishedAt)?.getTime() || 0) - (toDate(a.publishedAt)?.getTime() || 0));
  };

  const updateSummary = () => {
    const count = reviews.length;
    const average = count ? reviews.reduce((sum, review) => sum + review.rating, 0) / count : 0;
    const rounded = Math.round(average);
    const averageNode = $('[data-review-average]');
    const countNode = $('[data-review-count]');
    const starsNode = $('[data-review-summary-stars]');
    if (averageNode) averageNode.textContent = count ? average.toFixed(1).replace('.', ',') : '—';
    if (countNode) countNode.textContent = String(count);
    if (starsNode) {
      starsNode.textContent = count ? `${'★'.repeat(rounded)}${'☆'.repeat(5 - rounded)}` : '☆☆☆☆☆';
      starsNode.setAttribute('aria-label', count ? `Ortalama ${average.toFixed(1)} yıldız` : 'Henüz değerlendirme yok');
    }
  };

  const renderReviews = () => {
    const list = $('[data-public-review-list]');
    if (!list) return;
    const items = getSortedReviews();
    updateSummary();
    renderFeaturedReviews();
    if (!items.length) {
      list.innerHTML = `
        <div class="review-empty-state">
          <span>✦</span>
          <h3>İlk değerlendirme yakında burada.</h3>
          <p>Studio Nes’ten bir eser satın aldıysanız deneyiminizi paylaşarak bu sayfanın ilk notunu bırakabilirsiniz.</p>
          <a class="btn ghost" href="#yorum-ekle">Değerlendirme Yaz</a>
        </div>`;
      return;
    }

    list.innerHTML = items.map((review) => {
      const publishedDate = formatDate(review.publishedAt);
      return `
      <article class="public-review-card review-card-openable" data-review-detail-id="${escapeHtml(review.id)}" role="button" tabindex="0" aria-label="${escapeHtml(review.publicName)} tarafından yazılan yorumu ve eser detaylarını aç">
        <div class="public-review-top">
          <div class="review-author-mark" aria-hidden="true">${escapeHtml(review.publicName.charAt(0).toLocaleUpperCase('tr-TR') || 'S')}</div>
          <div class="review-author-copy">
            <strong>${escapeHtml(review.publicName)}</strong>
            <span>${escapeHtml(review.city)}${publishedDate ? ` · ${escapeHtml(publishedDate)}` : ''}</span>
          </div>
          ${renderStars(review.rating)}
        </div>
        <div class="public-review-copy">
          <p class="public-review-comment${isLongComment(review.comment) ? ' is-collapsed' : ''}">“${escapeHtml(review.comment)}”</p>
          ${renderReviewDetailButton(review)}
        </div>
        <div class="review-artwork-chip">
          <img src="${escapeHtml(review.artworkImage)}" alt="${escapeHtml(review.artworkTitle)}" loading="lazy" decoding="async">
          <span><small>Satın alınan eser</small><strong>${escapeHtml(review.artworkTitle)}</strong></span>
        </div>
      </article>`;
    }).join('');
  };

  let reviewsReconnectTimer = null;
  let reviewsOneShotTimer = null;
  let reviewsReconnectAttempt = 0;
  let reviewsFetchPromise = null;
  let reviewsRemoteConfirmed = false;
  let reviewsProbeAttempt = 0;
  const REVIEWS_RECONNECT_DELAYS = [900, 2200, 5000, 10000, 15000];
  const REVIEWS_PROBE_DELAYS = [1400, 3500, 8000, 15000, 25000];

  const isRemoteSnapshot = (snapshot) => !(snapshot && snapshot.metadata && snapshot.metadata.fromCache);

  const applyReviewsSnapshot = (snapshot) => {
    const incoming = snapshot.docs.map((doc) => normalizeReview(doc.data(), doc.id));
    const remote = isRemoteSnapshot(snapshot);

    // Telefonda ilk callback bazen eski/eksik yerel Firestore cache'i olabilir.
    // Daha buyuk bir listeyi eksik cache ile kucultme; sunucu cevabi geldiginde
    // ise silinmeler dahil gercek koleksiyonu aynen uygula.
    if (remote || !reviews.length || incoming.length >= reviews.length) {
      reviews = incoming;
      renderReviews();
    }

    if (remote) {
      reviewsRemoteConfirmed = true;
      reviewsReconnectAttempt = 0;
      reviewsProbeAttempt = 0;
      if (reviewsReconnectTimer) {
        window.clearTimeout(reviewsReconnectTimer);
        reviewsReconnectTimer = null;
      }
      if (reviewsOneShotTimer) {
        window.clearTimeout(reviewsOneShotTimer);
        reviewsOneShotTimer = null;
      }
      // Sadece sunucu tarafindan dogrulanan listeyi yeni cache'e yaz.
      scheduleReviewsCacheWrite();
    }
    return remote;
  };

  const fetchReviewsOnce = () => {
    if (reviewsRemoteConfirmed) return Promise.resolve(true);
    if (reviewsFetchPromise) return reviewsFetchPromise;
    const db = getFirestore();
    if (!db) return Promise.resolve(false);

    reviewsFetchPromise = db.collection(PUBLIC_REVIEWS_COLLECTION).get({ source: 'server' })
      .then((snapshot) => {
        return applyReviewsSnapshot(snapshot);
      })
      .catch((error) => {
        console.warn('Değerlendirmeler tek seferlik okunamadı:', error);
        return false;
      })
      .finally(() => {
        reviewsFetchPromise = null;
      });
    return reviewsFetchPromise;
  };

  const scheduleReviewsReconnect = (immediate = false) => {
    if (reviewsUnsubscribe || reviewsReconnectTimer || document.hidden) return;
    if ('onLine' in navigator && !navigator.onLine) return;
    const index = Math.min(reviewsReconnectAttempt, REVIEWS_RECONNECT_DELAYS.length - 1);
    const wait = immediate ? 0 : REVIEWS_RECONNECT_DELAYS[index];
    reviewsReconnectTimer = window.setTimeout(() => {
      reviewsReconnectTimer = null;
      reviewsReconnectAttempt += 1;
      watchReviews();
    }, wait);
  };

  const scheduleReviewsOneShot = (delay = null) => {
    if (reviewsRemoteConfirmed || reviewsOneShotTimer || reviewsFetchPromise) return;
    const index = Math.min(reviewsProbeAttempt, REVIEWS_PROBE_DELAYS.length - 1);
    const wait = delay === null ? REVIEWS_PROBE_DELAYS[index] : Math.max(0, delay);
    reviewsOneShotTimer = window.setTimeout(() => {
      reviewsOneShotTimer = null;
      reviewsProbeAttempt += 1;
      fetchReviewsOnce().then((remote) => {
        if (!remote && !reviewsRemoteConfirmed) {
          // Listener calisiyor olsa bile sunucu dogrulamasi gelene kadar seyrek
          // araliklarla tekrar dene. Kullanici yenilemek zorunda kalmaz.
          scheduleReviewsOneShot();
          if (!reviewsUnsubscribe) scheduleReviewsReconnect();
        }
      });
    }, wait);
  };

  const watchReviews = () => {
    if (reviewsUnsubscribe) {
      scheduleReviewsOneShot();
      return true;
    }
    const db = getFirestore();
    if (!db) {
      scheduleReviewsReconnect();
      return false;
    }

    try {
      reviewsUnsubscribe = db.collection(PUBLIC_REVIEWS_COLLECTION)
        .onSnapshot({ includeMetadataChanges: true }, (snapshot) => {
          applyReviewsSnapshot(snapshot);
          // Cache callback'i geldiyse canli listener'a zaman ver; 1.4 sn sonra
          // hala sunucu cevabi yoksa tek seferlik get() sessizce destek olur.
          scheduleReviewsOneShot();
        }, (error) => {
          reviewsUnsubscribe = null;
          reviewsRemoteConfirmed = false;
          console.warn('Değerlendirmeler canlı bağlantısı kesildi:', error);

          // Kullaniciya hata karti basma. Daha once gelen yorumlar ekranda kalir;
          // hic veri yoksa HTML'deki "hazırlanıyor" durumu korunur. Sistem kendi
          // kendine yeniden baglanir ve kullanicinin sayfayi yenilemesi gerekmez.
          fetchReviewsOnce();
          scheduleReviewsReconnect();
        });
      scheduleReviewsOneShot();
      return true;
    } catch (error) {
      reviewsUnsubscribe = null;
      reviewsRemoteConfirmed = false;
      console.warn('Değerlendirme canlı takibi başlatılamadı:', error);
      fetchReviewsOnce();
      scheduleReviewsReconnect();
      return false;
    }
  };

  const setFormStatus = (message, type = 'info') => {
    const node = $('[data-review-form-status]');
    if (!node) return;
    node.textContent = message;
    node.className = `review-form-status ${type}`;
    if (message) node.removeAttribute('hidden');
    else node.setAttribute('hidden', '');
  };

  const submitReview = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = $('[data-review-submit]');
    if (!form.reportValidity()) return;
    if ($('#reviewWebsite')?.value) return;

    const app = getFirebaseApp();
    if (!app || !firebase.firestore) {
      setFormStatus('Değerlendirme sistemi şu anda bağlantı kuramıyor. Lütfen daha sonra yeniden deneyin.', 'error');
      return;
    }

    renderArtworkPreview();
    if (!selectedArtwork) {
      setFormStatus('Lütfen galeriden satın aldığınız eseri seçin.', 'error');
      return;
    }

    const rating = Number(form.elements.rating.value);
    const firstName = form.elements.firstName.value.trim().replace(/\s+/g, ' ');
    const lastName = form.elements.lastName.value.trim().replace(/\s+/g, ' ');
    const city = form.elements.city.value;
    const comment = form.elements.comment.value.trim().replace(/\s+/g, ' ');
    const hideName = Boolean(form.elements.hideName.checked);

    if (!firstName || !lastName || !CITIES.includes(city) || rating < 1 || rating > 5 || comment.length < 10) {
      setFormStatus('Lütfen şehir, puan ve yorum alanlarını kontrol edin.', 'error');
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Gönderiliyor…';
    setFormStatus('', 'info');
    try {
      await firebase.firestore().collection(SUBMISSIONS_COLLECTION).add({
        firstName,
        lastName,
        hideName,
        city,
        artworkId: selectedArtwork.id,
        artworkTitle: selectedArtwork.title,
        rating,
        comment,
        approved: false,
        order: 999999,
        submittedAt: new Date().toISOString(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      form.reset();
      selectedArtwork = null;
      renderArtworkPreview();
      $('[data-comment-count]').textContent = '0';
      $('[data-rating-label]').textContent = 'Henüz puan seçilmedi';
      setFormStatus('Teşekkür ederiz. Değerlendirmeniz alındı ve kontrol edildikten sonra yayımlanacak.', 'success');
    } catch (error) {
      console.error(error);
      setFormStatus('Değerlendirmeniz gönderilemedi. Firebase kurallarındaki değerlendirme iznini kontrol edip yeniden deneyin.', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Değerlendirmeyi Gönder';
    }
  };

  const reviewMobileQuery = window.matchMedia('(max-width: 760px)');

  const setReviewFormOpen = (open, options = {}) => {
    const disclosure = $('[data-review-disclosure]');
    const toggle = $('[data-review-toggle]');
    const panel = $('[data-review-panel]');
    const state = $('[data-review-toggle-state]');
    if (!disclosure || !toggle || !panel) return;

    const shouldOpen = reviewMobileQuery.matches ? Boolean(open) : true;
    disclosure.classList.toggle('is-open', shouldOpen);
    toggle.setAttribute('aria-expanded', String(shouldOpen));
    panel.setAttribute('aria-hidden', String(!shouldOpen));
    if (shouldOpen) panel.removeAttribute('inert');
    else panel.setAttribute('inert', '');
    if (state) state.textContent = shouldOpen ? 'Yorum formunu kapatın' : 'Yorum formunu açın';

    if (options.scroll) {
      window.setTimeout(() => disclosure.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
    }
  };

  const setupReviewDisclosure = () => {
    const toggle = $('[data-review-toggle]');
    if (!toggle) return;

    setReviewFormOpen(!reviewMobileQuery.matches || window.location.hash === '#yorum-ekle');
    toggle.addEventListener('click', () => {
      setReviewFormOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-review-open], a[href="#yorum-ekle"]');
      if (!trigger || !reviewMobileQuery.matches) return;
      event.preventDefault();
      setReviewFormOpen(true, { scroll: true });
    });

    const syncDisclosure = () => setReviewFormOpen(!reviewMobileQuery.matches);
    if (typeof reviewMobileQuery.addEventListener === 'function') reviewMobileQuery.addEventListener('change', syncDisclosure);
    else if (typeof reviewMobileQuery.addListener === 'function') reviewMobileQuery.addListener(syncDisclosure);
  };

  const setupFeaturedCarousel = () => {
    const showcase = $('[data-featured-showcase]');
    if (!showcase) return;

    showcase.addEventListener('click', (event) => {
      const previous = event.target.closest('[data-featured-prev]');
      const next = event.target.closest('[data-featured-next]');
      const dot = event.target.closest('[data-featured-dot]');
      if (previous) showFeaturedReview(featuredIndex - 1, { restart: true });
      if (next) showFeaturedReview(featuredIndex + 1, { restart: true });
      if (dot) showFeaturedReview(Number(dot.dataset.featuredDot) || 0, { restart: true });
    });

    showcase.addEventListener('mouseenter', stopFeaturedAutoplay);
    showcase.addEventListener('mouseleave', startFeaturedAutoplay);
    showcase.addEventListener('focusin', stopFeaturedAutoplay);
    showcase.addEventListener('focusout', (event) => {
      if (!showcase.contains(event.relatedTarget)) startFeaturedAutoplay();
    });

    let touchStartX = 0;
    showcase.addEventListener('touchstart', (event) => {
      touchStartX = event.changedTouches[0]?.clientX || 0;
      stopFeaturedAutoplay();
    }, { passive: true });
    showcase.addEventListener('touchend', (event) => {
      const touchEndX = event.changedTouches[0]?.clientX || 0;
      const distance = touchEndX - touchStartX;
      if (Math.abs(distance) > 45) {
        featuredClickSuppressedUntil = window.performance.now() + 500;
        showFeaturedReview(featuredIndex + (distance < 0 ? 1 : -1));
      }
      startFeaturedAutoplay();
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopFeaturedAutoplay();
      else startFeaturedAutoplay();
    });
    const syncMotion = () => startFeaturedAutoplay();
    if (typeof featuredMotionQuery.addEventListener === 'function') featuredMotionQuery.addEventListener('change', syncMotion);
    else if (typeof featuredMotionQuery.addListener === 'function') featuredMotionQuery.addListener(syncMotion);
  };


  const getReviewById = (id) => reviews.find((review) => review.id === String(id || ''));

  const categoryLabels = {
    doga: 'Doğa',
    deniz: 'Deniz',
    cicek: 'Çiçek',
    ozel: 'Özel sipariş',
    portre: 'Portre'
  };

  const getArtworkForReview = (review) => {
    const current = artworks.find((artwork) => artwork.id === review.artworkId);
    if (current) return current;
    return normalizeArtwork({
      id: review.artworkId,
      title: review.artworkTitle,
      image: review.artworkImage
    }, review.artworkId);
  };

  const platformAction = (artwork) => {
    if (artwork.actionLabel) return artwork.actionLabel;
    if (artwork.sourceLabel) return `${artwork.sourceLabel} sayfasında gör`;
    return 'Satış sayfasında gör';
  };

  const setModalFact = (rowSelector, valueSelector, value) => {
    const row = $(rowSelector);
    const target = $(valueSelector);
    if (!row || !target) return false;
    const hasValue = Boolean(String(value || '').trim());
    row.toggleAttribute('hidden', !hasValue);
    target.textContent = hasValue ? String(value) : '';
    return hasValue;
  };

  const openReviewModal = (review, trigger) => {
    const modal = $('[data-review-modal]');
    if (!modal || !review) return;
    reviewModalReturnFocus = trigger instanceof HTMLElement ? trigger : document.activeElement;

    const artwork = getArtworkForReview(review);
    const image = $('[data-review-modal-image]');
    const title = $('[data-review-modal-title]');
    const artworkMeta = $('[data-review-modal-artwork-meta]');
    const facts = $('[data-review-modal-facts]');
    const link = $('[data-review-modal-link]');
    const stars = $('[data-review-modal-stars]');
    const comment = $('[data-review-modal-comment]');
    const author = $('[data-review-modal-author]');
    const meta = $('[data-review-modal-meta]');
    const initial = $('[data-review-modal-initial]');

    if (image) {
      image.src = artwork.image || review.artworkImage;
      image.alt = artwork.title || review.artworkTitle;
    }
    if (title) title.textContent = artwork.title || review.artworkTitle;

    const metaText = [artwork.technique, artwork.size].filter(Boolean).join(' · ');
    if (artworkMeta) {
      artworkMeta.textContent = metaText;
      artworkMeta.toggleAttribute('hidden', !metaText);
    }

    const hasPrice = setModalFact('[data-review-modal-price-row]', '[data-review-modal-price]', artwork.price);
    const hasStatus = setModalFact('[data-review-modal-status-row]', '[data-review-modal-status]', artwork.status);
    const category = categoryLabels[artwork.category] || artwork.category;
    const hasCategory = setModalFact('[data-review-modal-category-row]', '[data-review-modal-category]', category);
    if (facts) facts.toggleAttribute('hidden', !(hasPrice || hasStatus || hasCategory));

    if (link) {
      if (artwork.url) {
        link.href = artwork.url;
        link.textContent = platformAction(artwork);
        link.removeAttribute('hidden');
      } else {
        link.setAttribute('hidden', '');
        link.removeAttribute('href');
      }
    }

    if (stars) {
      stars.innerHTML = renderStars(review.rating);
      stars.setAttribute('aria-label', `5 üzerinden ${review.rating} yıldız`);
    }
    if (comment) comment.textContent = `“${review.comment}”`;
    if (author) author.textContent = review.publicName;
    if (meta) meta.textContent = [review.city, formatDate(review.publishedAt)].filter(Boolean).join(' · ');
    if (initial) initial.textContent = review.publicName.charAt(0).toLocaleUpperCase('tr-TR') || 'S';

    stopFeaturedAutoplay();
    modal.removeAttribute('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('review-modal-open');
    window.requestAnimationFrame(() => {
      modal.classList.add('is-open');
      $('[data-review-modal-close]:not(.review-detail-backdrop)')?.focus();
    });
  };

  const closeReviewModal = () => {
    const modal = $('[data-review-modal]');
    if (!modal || modal.hasAttribute('hidden')) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('review-modal-open');
    window.setTimeout(() => {
      modal.setAttribute('hidden', '');
      if (reviewModalReturnFocus && typeof reviewModalReturnFocus.focus === 'function') reviewModalReturnFocus.focus();
      reviewModalReturnFocus = null;
      startFeaturedAutoplay();
    }, 260);
  };

  const setupReviewModal = () => {
    const modal = $('[data-review-modal]');
    if (!modal) return;

    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-review-modal-close]')) {
        closeReviewModal();
        return;
      }

      const detailTrigger = event.target.closest('[data-review-detail-id]');
      if (!detailTrigger) return;
      if (detailTrigger.classList.contains('featured-review-slide') && window.performance.now() < featuredClickSuppressedUntil) return;
      const review = getReviewById(detailTrigger.dataset.reviewDetailId);
      if (review) openReviewModal(review, detailTrigger);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.hasAttribute('hidden')) {
        closeReviewModal();
        return;
      }
      if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-review-detail-id]')) {
        event.preventDefault();
        const review = getReviewById(event.target.dataset.reviewDetailId);
        if (review) openReviewModal(review, event.target);
      }
    });
  };

  const openArtworkPicker = (trigger) => {
    const modal = $('[data-artwork-picker-modal]');
    if (!modal) return;
    artworkPickerReturnFocus = trigger instanceof HTMLElement ? trigger : document.activeElement;
    const search = $('[data-artwork-picker-search]');
    if (search) search.value = '';
    renderArtworkPickerGrid('');
    modal.removeAttribute('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('review-artwork-picker-open');
    window.requestAnimationFrame(() => {
      modal.classList.add('is-open');
      window.setTimeout(() => search?.focus(), 80);
    });
  };

  const closeArtworkPicker = () => {
    const modal = $('[data-artwork-picker-modal]');
    if (!modal || modal.hasAttribute('hidden')) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('review-artwork-picker-open');
    window.setTimeout(() => {
      modal.setAttribute('hidden', '');
      if (artworkPickerReturnFocus && typeof artworkPickerReturnFocus.focus === 'function') artworkPickerReturnFocus.focus();
      artworkPickerReturnFocus = null;
    }, 240);
  };

  const selectArtworkFromPicker = (id) => {
    const select = $('#reviewArtwork');
    const artwork = artworks.find((art) => art.id === String(id || ''));
    if (!select || !artwork) return;
    select.value = artwork.id;
    renderArtworkPreview();
    renderArtworkPickerGrid($('[data-artwork-picker-search]')?.value || '');
    setFormStatus('', 'info');
    closeArtworkPicker();
  };

  const setupArtworkPicker = () => {
    const modal = $('[data-artwork-picker-modal]');
    if (!modal) return;

    document.addEventListener('click', (event) => {
      const open = event.target.closest('[data-artwork-picker-open]');
      if (open) {
        openArtworkPicker(open);
        return;
      }
      if (event.target.closest('[data-artwork-picker-close]')) {
        closeArtworkPicker();
        return;
      }
      const card = event.target.closest('[data-artwork-pick]');
      if (card) selectArtworkFromPicker(card.dataset.artworkPick);
    });

    $('[data-artwork-picker-search]')?.addEventListener('input', (event) => {
      renderArtworkPickerGrid(event.target.value);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.hasAttribute('hidden')) {
        event.preventDefault();
        closeArtworkPicker();
      }
    });
  };

  const bindEvents = () => {
    $('#reviewArtwork')?.addEventListener('change', () => {
      renderArtworkPreview();
      renderArtworkPickerGrid($('[data-artwork-picker-search]')?.value || '');
    });
    $('[data-review-sort]')?.addEventListener('change', renderReviews);
    $('[data-review-form]')?.addEventListener('submit', submitReview);
    $('#reviewComment')?.addEventListener('input', (event) => {
      const node = $('[data-comment-count]');
      if (node) node.textContent = String(event.target.value.length);
    });
    document.querySelectorAll('input[name="rating"]').forEach((input) => input.addEventListener('change', () => {
      const labels = { 1: '1 yıldız · Beklentimin altında', 2: '2 yıldız · Geliştirilebilir', 3: '3 yıldız · Memnun kaldım', 4: '4 yıldız · Çok memnun kaldım', 5: '5 yıldız · Bayıldım' };
      const node = $('[data-rating-label]');
      if (node) node.textContent = labels[Number(input.value)] || '';
    }));
  };

  const init = () => {
    setupReviewDisclosure();
    setupFeaturedCarousel();
    setupReviewModal();
    setupArtworkPicker();
    fillCities();
    bindEvents();

    const cachedReviews = readReviewsCache();
    if (cachedReviews.length) {
      reviews = cachedReviews;
      renderReviews();
    }

    // Yorumları eser listesinden bağımsız başlatıyoruz. Önceden yorumlar,
    // galeri sorgusu bitene kadar gereksiz yere bekliyordu.
    loadArtworks();
    watchReviews();
  };

  const recoverFirebaseData = () => {
    loadArtworks();
    if (!reviewsUnsubscribe) watchReviews();
    if (!reviewsRemoteConfirmed) fetchReviewsOnce();
    if (!artworksRemoteConfirmed) fetchArtworksOnce();
  };

  window.addEventListener('ness:firebase-ready', recoverFirebaseData);
  window.addEventListener('online', recoverFirebaseData);
  window.addEventListener('pageshow', recoverFirebaseData);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') recoverFirebaseData();
  });

  init();
})();
