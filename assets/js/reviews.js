(function () {
  const SUBMISSIONS_COLLECTION = 'reviewSubmissions';
  const PUBLIC_REVIEWS_COLLECTION = 'reviews';
  const ARTWORKS_COLLECTION = 'artworks';

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
  let featuredClickSuppressedUntil = 0;
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
      if (!firebase.apps.length) firebase.initializeApp(window.NESS_FIREBASE_CONFIG);
      return firebase.app();
    } catch (error) {
      console.warn('Değerlendirme sistemi başlatılamadı:', error);
      return null;
    }
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
    return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
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

  const loadArtworks = async () => {
    const app = getFirebaseApp();
    let items = [];
    if (app && firebase.firestore) {
      try {
        const snapshot = await firebase.firestore().collection(ARTWORKS_COLLECTION).orderBy('order', 'asc').get();
        items = snapshot.docs.map((doc) => normalizeArtwork(doc.data(), doc.id));
      } catch (error) {
        console.warn('Galerideki eserler okunamadı:', error);
      }
    }
    if (!items.length && typeof ARTWORKS !== 'undefined' && Array.isArray(ARTWORKS)) items = ARTWORKS.map((art) => normalizeArtwork(art, art.id));
    artworks = items.filter((art) => !art.hidden).sort((a, b) => a.order - b.order);

    const select = $('#reviewArtwork');
    if (!select) return;
    select.innerHTML = '<option value="">Galeriden eser seçin</option>' + artworks
      .map((art) => `<option value="${escapeHtml(art.id)}">${escapeHtml(art.title)}${art.size ? ` · ${escapeHtml(art.size)}` : ''}</option>`)
      .join('');
  };

  const renderArtworkPreview = () => {
    const box = $('[data-review-product-preview]');
    if (!box) return;
    const id = $('#reviewArtwork')?.value || '';
    selectedArtwork = artworks.find((art) => art.id === id) || null;
    if (!selectedArtwork) {
      box.setAttribute('hidden', '');
      box.innerHTML = '';
      return;
    }
    box.innerHTML = `
      <img src="${escapeHtml(selectedArtwork.image)}" alt="${escapeHtml(selectedArtwork.title)}">
      <div><span>Seçilen eser</span><strong>${escapeHtml(selectedArtwork.title)}</strong><small>${escapeHtml([selectedArtwork.technique, selectedArtwork.size].filter(Boolean).join(' · '))}</small></div>`;
    box.removeAttribute('hidden');
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
            <img src="${escapeHtml(review.artworkImage)}" alt="${escapeHtml(review.artworkTitle)}">
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

    list.innerHTML = items.map((review) => `
      <article class="public-review-card review-card-openable" data-review-detail-id="${escapeHtml(review.id)}" role="button" tabindex="0" aria-label="${escapeHtml(review.publicName)} tarafından yazılan yorumu ve eser detaylarını aç">
        <div class="public-review-top">
          <div class="review-author-mark" aria-hidden="true">${escapeHtml(review.publicName.charAt(0).toLocaleUpperCase('tr-TR') || 'S')}</div>
          <div class="review-author-copy">
            <strong>${escapeHtml(review.publicName)}</strong>
            <span>${escapeHtml(review.city)}${formatDate(review.publishedAt) ? ` · ${escapeHtml(formatDate(review.publishedAt))}` : ''}</span>
          </div>
          ${renderStars(review.rating)}
        </div>
        <div class="public-review-copy">
          <p class="public-review-comment${isLongComment(review.comment) ? ' is-collapsed' : ''}">“${escapeHtml(review.comment)}”</p>
          ${renderReviewDetailButton(review)}
        </div>
        <div class="review-artwork-chip">
          <img src="${escapeHtml(review.artworkImage)}" alt="${escapeHtml(review.artworkTitle)}">
          <span><small>Satın alınan eser</small><strong>${escapeHtml(review.artworkTitle)}</strong></span>
        </div>
      </article>`).join('');
  };

  const watchReviews = () => {
    const app = getFirebaseApp();
    if (!app || !firebase.firestore) {
      reviews = [];
      renderReviews();
      return;
    }
    firebase.firestore().collection(PUBLIC_REVIEWS_COLLECTION)
      .onSnapshot((snapshot) => {
        reviews = snapshot.docs.map((doc) => normalizeReview(doc.data(), doc.id));
        renderReviews();
      }, (error) => {
        console.warn('Değerlendirmeler okunamadı:', error);
        const list = $('[data-public-review-list]');
        if (list) list.innerHTML = '<div class="review-empty-state"><h3>Değerlendirmeler şu anda yüklenemiyor.</h3><p>Lütfen sayfayı daha sonra yeniden açın.</p></div>';
      });
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

  const bindEvents = () => {
    $('#reviewArtwork')?.addEventListener('change', renderArtworkPreview);
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

  const init = async () => {
    setupReviewDisclosure();
    setupFeaturedCarousel();
    setupReviewModal();
    fillCities();
    bindEvents();
    await loadArtworks();
    watchReviews();
  };

  init();
})();
