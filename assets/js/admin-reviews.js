(function () {
  const SUBMISSIONS_COLLECTION = 'reviewSubmissions';
  const PUBLIC_REVIEWS_COLLECTION = 'reviews';
  const ARTWORKS_COLLECTION = 'artworks';
  const ADMIN_EMAILS = (Array.isArray(window.NESS_ADMIN_EMAILS) ? window.NESS_ADMIN_EMAILS : []).map((email) => String(email).toLowerCase());

  let submissions = [];
  let activeFilter = 'all';
  let unsubscribe = null;
  let artworkBridgeBound = false;
  let artworkRecords = new Map();
  let artworkList = [];
  let artworkPickerReviewId = '';
  let artworkPickerReturnFocus = null;

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

  const getApp = () => {
    try {
      if (typeof firebase === 'undefined' || typeof window.NESS_FIREBASE_IS_CONFIGURED !== 'function' || !window.NESS_FIREBASE_IS_CONFIGURED()) return null;
      if (!firebase.apps.length) firebase.initializeApp(window.NESS_FIREBASE_CONFIG);
      return firebase.app();
    } catch (_) { return null; }
  };

  const adminReviewDateFormatter = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });

  const isAdmin = (user) => Boolean(user && ADMIN_EMAILS.includes(String(user.email || '').toLowerCase()));
  const toDate = (value) => {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const timestamp = (item) => toDate(item.createdAt)?.getTime() || toDate(item.submittedAt)?.getTime() || 0;
  const formatDate = (value) => {
    const date = toDate(value);
    return date ? adminReviewDateFormatter.format(date) : 'Tarih bilgisi yok';
  };

  const normalize = (data = {}, id = '') => ({
    id,
    firstName: String(data.firstName || '').trim(),
    lastName: String(data.lastName || '').trim(),
    hideName: Boolean(data.hideName),
    city: String(data.city || ''),
    artworkId: String(data.artworkId || ''),
    artworkTitle: String(data.artworkTitle || 'Studio Nes eseri'),
    artworkImage: safeUrl(data.artworkImage) || '',
    rating: Math.max(1, Math.min(5, Number(data.rating) || 5)),
    comment: String(data.comment || ''),
    approved: Boolean(data.approved),
    order: Number.isFinite(Number(data.order)) ? Number(data.order) : 999999,
    featured: Boolean(data.featured),
    featuredOrder: Number.isFinite(Number(data.featuredOrder)) ? Number(data.featuredOrder) : 999999,
    createdAt: data.createdAt || '',
    submittedAt: data.submittedAt || '',
    approvedAt: data.approvedAt || ''
  });

  const maskPart = (part) => {
    const clean = String(part || '').trim();
    if (!clean) return '';
    return `${clean.charAt(0).toLocaleUpperCase('tr-TR')}${'*'.repeat(Math.max(3, clean.length - 1))}`;
  };
  const fullName = (item) => [item.firstName, item.lastName].filter(Boolean).join(' ') || 'İsimsiz müşteri';
  const publicName = (item) => item.hideName
    ? [maskPart(item.firstName), maskPart(item.lastName)].filter(Boolean).join(' ')
    : fullName(item);

  const setNotice = (message, type = 'info') => {
    const node = $('[data-admin-notice]');
    if (!node) return;
    node.textContent = message;
    node.className = `admin-notice ${type}`;
    if (message) node.removeAttribute('hidden');
    else node.setAttribute('hidden', '');
  };

  const approvedItems = () => submissions.filter((item) => item.approved).sort((a, b) => a.order - b.order || timestamp(b) - timestamp(a));
  const featuredItems = () => approvedItems().filter((item) => item.featured).sort((a, b) => a.featuredOrder - b.featuredOrder || a.order - b.order);

  const artworkFor = (item) => artworkRecords.get(item.artworkId) || { title: item.artworkTitle, image: item.artworkImage || 'assets/img/ness-logo.png' };
  const artworkImageFor = (item) => artworkFor(item).image;
  const artworkTitleFor = (item) => artworkFor(item).title || item.artworkTitle;

  const applyArtworkRecords = (items) => {
    const records = (Array.isArray(items) ? items : []).map((data, index) => ({
      id: String(data.id || ''),
      title: String(data.title || 'Studio Nes eseri'),
      image: safeUrl(data.image) || 'assets/img/ness-logo.png',
      size: String(data.size || ''),
      technique: String(data.technique || ''),
      category: String(data.category || ''),
      hidden: Boolean(data.hidden),
      order: Number.isFinite(Number(data.order)) ? Number(data.order) : index
    }));
    artworkRecords = new Map(records.map((art) => [art.id, art]));
    artworkList = records.filter((art) => !art.hidden).sort((a, b) => a.order - b.order);
    render();
    if (artworkPickerReviewId) renderAdminArtworkPicker($('[data-admin-review-artwork-search]')?.value || '');
  };

  const watchArtworks = () => {
    if (!artworkBridgeBound) {
      artworkBridgeBound = true;
      window.addEventListener('ness:admin-artworks', (event) => applyArtworkRecords(event.detail));
    }
    if (Array.isArray(window.NESS_ADMIN_ARTWORKS)) applyArtworkRecords(window.NESS_ADMIN_ARTWORKS);
  };

  const updateStats = () => {
    const pending = submissions.filter((item) => !item.approved).length;
    const approved = submissions.filter((item) => item.approved);
    const featured = approved.filter((item) => item.featured);
    const average = approved.length ? approved.reduce((sum, item) => sum + item.rating, 0) / approved.length : 0;

    if ($('[data-review-admin-count]')) $('[data-review-admin-count]').textContent = `${submissions.length} yorum`;
    if ($('[data-review-pending-count]')) $('[data-review-pending-count]').textContent = String(pending);
    if ($('[data-review-approved-count]')) $('[data-review-approved-count]').textContent = String(approved.length);
    if ($('[data-review-featured-count]')) $('[data-review-featured-count]').textContent = `${featured.length} / 4`;
    if ($('[data-review-admin-average]')) $('[data-review-admin-average]').textContent = approved.length ? average.toFixed(1).replace('.', ',') : '—';

    const badge = $('[data-review-pending-badge]');
    if (badge) {
      badge.textContent = String(pending);
      if (pending) badge.removeAttribute('hidden');
      else badge.setAttribute('hidden', '');
    }
  };

  const sortedForAdmin = () => {
    const pending = submissions.filter((item) => !item.approved).sort((a, b) => timestamp(b) - timestamp(a));
    const approved = approvedItems();
    if (activeFilter === 'pending') return pending;
    if (activeFilter === 'approved') return approved;
    if (activeFilter === 'featured') return featuredItems();
    return [...pending, ...approved];
  };

  const render = () => {
    const list = $('[data-review-admin-list]');
    if (!list) return;
    updateStats();
    const items = sortedForAdmin();
    const approved = approvedItems();
    const featured = featuredItems();

    if (!items.length) {
      list.innerHTML = '<p class="muted-box">Bu filtrede gösterilecek değerlendirme yok.</p>';
      return;
    }

    list.innerHTML = items.map((item) => {
      const approvedIndex = approved.findIndex((approvedItem) => approvedItem.id === item.id);
      const featuredIndex = featured.findIndex((featuredItem) => featuredItem.id === item.id);
      return `
        <article class="admin-review-card ${item.approved ? 'is-approved' : 'is-pending'} ${item.featured ? 'is-featured' : ''}">
          <div class="admin-review-art-wrap">
            <img class="admin-review-art" src="${escapeHtml(artworkImageFor(item))}" alt="${escapeHtml(artworkTitleFor(item))}" decoding="async">
            <button class="admin-review-art-edit" type="button" data-review-action="edit-artwork" data-id="${escapeHtml(item.id)}" aria-label="Yorumdaki eseri değiştir" title="Eseri değiştir">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16.5V20h3.5L18.8 8.7l-3.5-3.5L4 16.5Zm17-10.6a.95.95 0 0 0 0-1.35l-1.55-1.55a.95.95 0 0 0-1.35 0l-1.55 1.55 3.5 3.5L21 5.9Z"/></svg>
            </button>
          </div>
          <div class="admin-review-body">
            <div class="admin-review-head">
              <div>
                <strong>${escapeHtml(fullName(item))}</strong>
                <span>${escapeHtml(item.city)} · ${escapeHtml(formatDate(item.createdAt || item.submittedAt))}</span>
              </div>
              <div class="admin-review-statuses">
                ${item.featured ? `<span class="admin-review-featured-status">Vitrin ${featuredIndex + 1}/4</span>` : ''}
                <span class="admin-review-status">${item.approved ? 'Yayında' : 'Onay bekliyor'}</span>
              </div>
            </div>
            <div class="admin-review-rating" aria-label="${item.rating} yıldız">${'★'.repeat(item.rating)}${'☆'.repeat(5 - item.rating)}</div>
            <p class="admin-review-comment">${escapeHtml(item.comment)}</p>
            <div class="admin-review-meta">
              <span><b>Eser:</b> ${escapeHtml(artworkTitleFor(item))}</span>
              <span><b>Sitede görünecek ad:</b> ${escapeHtml(publicName(item))}</span>
              ${item.hideName ? '<span class="privacy-chip">İsim gizli</span>' : ''}
            </div>
            <div class="admin-review-actions">
              <div class="admin-review-toggles">
                <label class="review-approval-toggle">
                  <input type="checkbox" data-review-approval="${escapeHtml(item.id)}" ${item.approved ? 'checked' : ''}>
                  <span>Doğrulandı ve yayımlansın</span>
                </label>
                <label class="review-feature-toggle ${item.approved ? '' : 'is-disabled'}">
                  <input type="checkbox" data-review-featured="${escapeHtml(item.id)}" ${item.featured ? 'checked' : ''} ${item.approved ? '' : 'disabled'}>
                  <span><strong>Başlığın altındaki yorum vitrininde göster</strong><small>En fazla dört yorum seçilebilir.</small></span>
                </label>
              </div>
              <div class="admin-review-order-groups">
                ${item.featured ? `
                  <div class="admin-review-order-group is-featured-order">
                    <span>Vitrin sırası</span>
                    <button type="button" data-review-action="featured-up" data-id="${escapeHtml(item.id)}" ${featuredIndex <= 0 ? 'disabled' : ''}>Önceki</button>
                    <button type="button" data-review-action="featured-down" data-id="${escapeHtml(item.id)}" ${featuredIndex < 0 || featuredIndex >= featured.length - 1 ? 'disabled' : ''}>Sonraki</button>
                  </div>` : ''}
                <div class="admin-review-order-group">
                  <span>Yorumlar sırası</span>
                  <button type="button" data-review-action="up" data-id="${escapeHtml(item.id)}" ${!item.approved || approvedIndex <= 0 ? 'disabled' : ''}>Yukarı</button>
                  <button type="button" data-review-action="down" data-id="${escapeHtml(item.id)}" ${!item.approved || approvedIndex < 0 || approvedIndex >= approved.length - 1 ? 'disabled' : ''}>Aşağı</button>
                </div>
                <button class="danger" type="button" data-review-action="delete" data-id="${escapeHtml(item.id)}">Sil</button>
              </div>
            </div>
          </div>
        </article>`;
    }).join('');
  };

  const normalizeSearchText = (value = '') => String(value || '').toLocaleLowerCase('tr-TR').trim();

  const renderAdminArtworkPicker = (query = '') => {
    const grid = $('[data-admin-review-artwork-grid]');
    const count = $('[data-admin-review-artwork-count]');
    if (!grid) return;

    const current = submissions.find((item) => item.id === artworkPickerReviewId);
    const selectedId = current?.artworkId || '';
    const normalizedQuery = normalizeSearchText(query);
    const visible = normalizedQuery
      ? artworkList.filter((art) => normalizeSearchText([art.title, art.technique, art.size, art.category].join(' ')).includes(normalizedQuery))
      : artworkList;

    if (count) count.textContent = `${visible.length} eser`;
    if (!visible.length) {
      grid.innerHTML = `
        <div class="review-artwork-picker-empty">
          <span aria-hidden="true">✦</span>
          <strong>${artworkList.length ? 'Aramanızla eşleşen eser bulunamadı.' : 'Galeride gösterilecek eser bulunamadı.'}</strong>
          <small>${artworkList.length ? 'Başka bir eser adıyla aramayı deneyin.' : 'Galerideki ürünler burada görünecek.'}</small>
        </div>`;
      return;
    }

    grid.innerHTML = visible.map((art) => {
      const isSelected = selectedId === art.id;
      const meta = [art.technique, art.size].filter(Boolean).join(' · ');
      return `
        <button class="review-artwork-picker-card${isSelected ? ' is-selected' : ''}" type="button" data-admin-review-artwork-pick="${escapeHtml(art.id)}" aria-pressed="${isSelected ? 'true' : 'false'}">
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

  const openAdminArtworkPicker = (reviewId, trigger) => {
    const item = submissions.find((entry) => entry.id === reviewId);
    const modal = $('[data-admin-review-artwork-modal]');
    if (!item || !modal) return;

    artworkPickerReviewId = reviewId;
    artworkPickerReturnFocus = trigger || document.activeElement;
    const search = $('[data-admin-review-artwork-search]');
    if (search) search.value = '';
    const currentTitle = $('[data-admin-review-artwork-current]');
    if (currentTitle) currentTitle.textContent = `Şu an: ${artworkTitleFor(item)}`;
    renderAdminArtworkPicker('');

    modal.removeAttribute('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('review-artwork-picker-open');
    requestAnimationFrame(() => modal.classList.add('is-open'));
    window.setTimeout(() => search?.focus(), 80);
  };

  const closeAdminArtworkPicker = () => {
    const modal = $('[data-admin-review-artwork-modal]');
    if (!modal || modal.hasAttribute('hidden')) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('review-artwork-picker-open');
    const focusTarget = artworkPickerReturnFocus;
    artworkPickerReviewId = '';
    artworkPickerReturnFocus = null;
    window.setTimeout(() => {
      modal.setAttribute('hidden', '');
      focusTarget?.focus?.();
    }, 190);
  };

  const updateReviewArtwork = async (reviewId, artworkId) => {
    const item = submissions.find((entry) => entry.id === reviewId);
    const artwork = artworkRecords.get(artworkId);
    if (!item || !artwork || artwork.hidden) throw new Error('Seçilen eser galeride bulunamadı.');
    if (item.artworkId === artwork.id) {
      setNotice('Bu eser zaten yorumda seçili.', 'info');
      return;
    }

    const firestore = firebase.firestore();
    const batch = firestore.batch();
    const payload = {
      artworkId: artwork.id,
      artworkTitle: artwork.title,
      artworkImage: artwork.image,
      artworkUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      artworkUpdatedBy: firebase.auth().currentUser?.email || ''
    };
    batch.update(firestore.collection(SUBMISSIONS_COLLECTION).doc(reviewId), payload);
    if (item.approved) {
      batch.update(firestore.collection(PUBLIC_REVIEWS_COLLECTION).doc(reviewId), {
        artworkId: artwork.id,
        artworkTitle: artwork.title,
        artworkImage: artwork.image
      });
    }
    await batch.commit();
    setNotice(`Yorumdaki eser “${artwork.title}” olarak değiştirildi.`, 'success');
  };

  const publicPayload = (item, order, options = {}) => {
    const featured = options.featured !== undefined ? Boolean(options.featured) : Boolean(item.featured);
    const featuredOrder = featured
      ? (Number.isFinite(Number(options.featuredOrder)) ? Number(options.featuredOrder) : Number(item.featuredOrder) || 0)
      : 999999;
    return {
      publicName: publicName(item),
      city: item.city,
      artworkId: item.artworkId,
      artworkTitle: artworkTitleFor(item),
      artworkImage: artworkImageFor(item),
      rating: item.rating,
      comment: item.comment,
      order,
      featured,
      featuredOrder,
      publishedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
  };

  const writeFeaturedOrder = (batch, orderedItems) => {
    const firestore = firebase.firestore();
    orderedItems.forEach((entry, order) => {
      batch.update(firestore.collection(SUBMISSIONS_COLLECTION).doc(entry.id), { featured: true, featuredOrder: order });
      batch.update(firestore.collection(PUBLIC_REVIEWS_COLLECTION).doc(entry.id), { featured: true, featuredOrder: order });
    });
  };

  const setApproval = async (id, approved) => {
    const item = submissions.find((entry) => entry.id === id);
    if (!item) return;
    const firestore = firebase.firestore();
    const batch = firestore.batch();
    const submissionRef = firestore.collection(SUBMISSIONS_COLLECTION).doc(id);
    const publicRef = firestore.collection(PUBLIC_REVIEWS_COLLECTION).doc(id);

    if (approved) {
      const currentApproved = approvedItems().filter((entry) => entry.id !== id);
      const existingOrder = currentApproved.reduce((max, entry) => Math.max(max, Number(entry.order) || 0), -1) + 1;
      batch.update(submissionRef, {
        approved: true,
        order: existingOrder,
        featured: false,
        featuredOrder: 999999,
        approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
        approvedBy: firebase.auth().currentUser?.email || ''
      });
      batch.set(publicRef, publicPayload(item, existingOrder, { featured: false }), { merge: false });
    } else {
      const remainingFeatured = featuredItems().filter((entry) => entry.id !== id);
      batch.update(submissionRef, {
        approved: false,
        featured: false,
        featuredOrder: 999999,
        approvedAt: null,
        approvedBy: ''
      });
      batch.delete(publicRef);
      writeFeaturedOrder(batch, remainingFeatured);
    }

    await batch.commit();
    setNotice(approved ? 'Yorum doğrulandı ve değerlendirmeler sayfasında yayımlandı.' : 'Yorum yayından kaldırıldı.', 'success');
  };

  const setFeatured = async (id, shouldFeature) => {
    const item = submissions.find((entry) => entry.id === id);
    if (!item || !item.approved) throw new Error('Önce yorumu doğrulayıp yayımlamalısınız.');
    if (Boolean(item.featured) === Boolean(shouldFeature)) return;

    const ordered = featuredItems().filter((entry) => entry.id !== id);
    if (shouldFeature && ordered.length >= 4) {
      throw new Error('Yorum vitrininde en fazla dört değerlendirme gösterilebilir. Önce seçili yorumlardan birini kaldırın.');
    }

    const firestore = firebase.firestore();
    const batch = firestore.batch();
    const submissionRef = firestore.collection(SUBMISSIONS_COLLECTION).doc(id);
    const publicRef = firestore.collection(PUBLIC_REVIEWS_COLLECTION).doc(id);

    if (shouldFeature) {
      const nextOrder = ordered.length;
      batch.update(submissionRef, { featured: true, featuredOrder: nextOrder });
      batch.update(publicRef, { featured: true, featuredOrder: nextOrder });
    } else {
      batch.update(submissionRef, { featured: false, featuredOrder: 999999 });
      batch.update(publicRef, { featured: false, featuredOrder: 999999 });
      writeFeaturedOrder(batch, ordered);
    }

    await batch.commit();
    setNotice(shouldFeature ? 'Yorum başlığın altındaki vitrine eklendi.' : 'Yorum vitrinden kaldırıldı.', 'success');
  };

  const moveFeatured = async (id, direction) => {
    const ordered = featuredItems();
    const index = ordered.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];

    const batch = firebase.firestore().batch();
    writeFeaturedOrder(batch, ordered);
    await batch.commit();
    setNotice('Başlığın altındaki yorum vitrini sırası güncellendi.', 'success');
  };

  const move = async (id, direction) => {
    const ordered = approvedItems();
    const index = ordered.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];

    const firestore = firebase.firestore();
    const batch = firestore.batch();
    ordered.forEach((item, order) => {
      batch.update(firestore.collection(SUBMISSIONS_COLLECTION).doc(item.id), { order });
      batch.update(firestore.collection(PUBLIC_REVIEWS_COLLECTION).doc(item.id), { order });
    });
    await batch.commit();
    setNotice('Yorumların sitedeki sırası güncellendi.', 'success');
  };

  const remove = async (id) => {
    const item = submissions.find((entry) => entry.id === id);
    if (!item || !window.confirm(`${fullName(item)} tarafından gönderilen yorum tamamen silinsin mi?`)) return;
    const firestore = firebase.firestore();
    const batch = firestore.batch();
    batch.delete(firestore.collection(SUBMISSIONS_COLLECTION).doc(id));
    batch.delete(firestore.collection(PUBLIC_REVIEWS_COLLECTION).doc(id));
    writeFeaturedOrder(batch, featuredItems().filter((entry) => entry.id !== id));
    await batch.commit();
    setNotice('Yorum silindi.', 'success');
  };

  const watch = () => {
    if (unsubscribe) unsubscribe();
    unsubscribe = firebase.firestore().collection(SUBMISSIONS_COLLECTION)
      .onSnapshot((snapshot) => {
        submissions = snapshot.docs.map((doc) => normalize(doc.data(), doc.id));
        render();
      }, (error) => {
        console.error(error);
        const list = $('[data-review-admin-list]');
        if (list) list.innerHTML = '<p class="muted-box">Yorumlar okunamadı. Firebase kurallarındaki reviewSubmissions iznini kontrol edin.</p>';
      });
  };

  document.addEventListener('click', async (event) => {
    const pickerClose = event.target.closest('[data-admin-review-artwork-close]');
    if (pickerClose) {
      closeAdminArtworkPicker();
      return;
    }

    const pickerChoice = event.target.closest('[data-admin-review-artwork-pick]');
    if (pickerChoice) {
      pickerChoice.disabled = true;
      try {
        await updateReviewArtwork(artworkPickerReviewId, pickerChoice.dataset.adminReviewArtworkPick);
        closeAdminArtworkPicker();
      } catch (error) {
        console.error(error);
        setNotice(`Eser değiştirilemedi: ${error.message}`, 'error');
        pickerChoice.disabled = false;
      }
      return;
    }

    const artworkEdit = event.target.closest('[data-review-action="edit-artwork"]');
    if (artworkEdit) {
      openAdminArtworkPicker(artworkEdit.dataset.id, artworkEdit);
      return;
    }

    const filter = event.target.closest('[data-review-filter]');
    if (filter) {
      activeFilter = filter.dataset.reviewFilter;
      document.querySelectorAll('[data-review-filter]').forEach((button) => button.classList.toggle('active', button === filter));
      render();
      return;
    }

    const action = event.target.closest('[data-review-action]');
    if (!action) return;
    action.disabled = true;
    try {
      if (action.dataset.reviewAction === 'up') await move(action.dataset.id, -1);
      if (action.dataset.reviewAction === 'down') await move(action.dataset.id, 1);
      if (action.dataset.reviewAction === 'featured-up') await moveFeatured(action.dataset.id, -1);
      if (action.dataset.reviewAction === 'featured-down') await moveFeatured(action.dataset.id, 1);
      if (action.dataset.reviewAction === 'delete') await remove(action.dataset.id);
    } catch (error) {
      console.error(error);
      setNotice(`Yorum işlemi tamamlanamadı: ${error.message}`, 'error');
    } finally {
      action.disabled = false;
    }
  });

  document.addEventListener('change', async (event) => {
    const approvalToggle = event.target.closest('[data-review-approval]');
    if (approvalToggle) {
      approvalToggle.disabled = true;
      try {
        await setApproval(approvalToggle.dataset.reviewApproval, approvalToggle.checked);
      } catch (error) {
        console.error(error);
        approvalToggle.checked = !approvalToggle.checked;
        setNotice(`Yorum güncellenemedi: ${error.message}`, 'error');
      } finally {
        approvalToggle.disabled = false;
      }
      return;
    }

    const featuredToggle = event.target.closest('[data-review-featured]');
    if (!featuredToggle) return;
    featuredToggle.disabled = true;
    try {
      await setFeatured(featuredToggle.dataset.reviewFeatured, featuredToggle.checked);
    } catch (error) {
      console.error(error);
      featuredToggle.checked = !featuredToggle.checked;
      setNotice(error.message || 'Yorum vitrini güncellenemedi.', 'error');
    } finally {
      featuredToggle.disabled = false;
    }
  });

  $('[data-admin-review-artwork-search]')?.addEventListener('input', (event) => {
    renderAdminArtworkPicker(event.target.value || '');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && artworkPickerReviewId) closeAdminArtworkPicker();
  });

  const app = getApp();
  if (!app || !firebase.auth || !firebase.firestore) return;
  firebase.auth().onAuthStateChanged((user) => {
    if (isAdmin(user)) { watchArtworks(); watch(); }
    else {
      if (unsubscribe) unsubscribe();
      submissions = [];
      render();
    }
  });
})();
