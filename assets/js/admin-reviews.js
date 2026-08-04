(function () {
  const SUBMISSIONS_COLLECTION = 'reviewSubmissions';
  const PUBLIC_REVIEWS_COLLECTION = 'reviews';
  const ARTWORKS_COLLECTION = 'artworks';
  const ADMIN_EMAILS = (Array.isArray(window.NESS_ADMIN_EMAILS) ? window.NESS_ADMIN_EMAILS : []).map((email) => String(email).toLowerCase());

  let submissions = [];
  let activeFilter = 'all';
  let unsubscribe = null;
  let unsubscribeArtworks = null;
  let artworkRecords = new Map();

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
    return date ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(date) : 'Tarih bilgisi yok';
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

  const artworkFor = (item) => artworkRecords.get(item.artworkId) || { title: item.artworkTitle, image: item.artworkImage || 'assets/img/ness-logo.png' };
  const artworkImageFor = (item) => artworkFor(item).image;
  const artworkTitleFor = (item) => artworkFor(item).title || item.artworkTitle;

  const watchArtworks = () => {
    if (unsubscribeArtworks) unsubscribeArtworks();
    unsubscribeArtworks = firebase.firestore().collection(ARTWORKS_COLLECTION)
      .onSnapshot((snapshot) => {
        artworkRecords = new Map(snapshot.docs.map((doc) => [doc.id, { title: String(doc.data().title || 'Studio Nes eseri'), image: safeUrl(doc.data().image) || 'assets/img/ness-logo.png' }]));
        render();
      }, (error) => console.warn('Yorum eser görselleri okunamadı:', error));
  };

  const updateStats = () => {
    const pending = submissions.filter((item) => !item.approved).length;
    const approved = submissions.filter((item) => item.approved);
    const average = approved.length ? approved.reduce((sum, item) => sum + item.rating, 0) / approved.length : 0;

    if ($('[data-review-admin-count]')) $('[data-review-admin-count]').textContent = `${submissions.length} yorum`;
    if ($('[data-review-pending-count]')) $('[data-review-pending-count]').textContent = String(pending);
    if ($('[data-review-approved-count]')) $('[data-review-approved-count]').textContent = String(approved.length);
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
    return [...pending, ...approved];
  };

  const render = () => {
    const list = $('[data-review-admin-list]');
    if (!list) return;
    updateStats();
    const items = sortedForAdmin();
    const approved = approvedItems();

    if (!items.length) {
      list.innerHTML = '<p class="muted-box">Bu filtrede gösterilecek değerlendirme yok.</p>';
      return;
    }

    list.innerHTML = items.map((item) => {
      const approvedIndex = approved.findIndex((approvedItem) => approvedItem.id === item.id);
      return `
        <article class="admin-review-card ${item.approved ? 'is-approved' : 'is-pending'}">
          <img class="admin-review-art" src="${escapeHtml(artworkImageFor(item))}" alt="${escapeHtml(artworkTitleFor(item))}">
          <div class="admin-review-body">
            <div class="admin-review-head">
              <div>
                <strong>${escapeHtml(fullName(item))}</strong>
                <span>${escapeHtml(item.city)} · ${escapeHtml(formatDate(item.createdAt || item.submittedAt))}</span>
              </div>
              <span class="admin-review-status">${item.approved ? 'Yayında' : 'Onay bekliyor'}</span>
            </div>
            <div class="admin-review-rating" aria-label="${item.rating} yıldız">${'★'.repeat(item.rating)}${'☆'.repeat(5 - item.rating)}</div>
            <p class="admin-review-comment">${escapeHtml(item.comment)}</p>
            <div class="admin-review-meta">
              <span><b>Eser:</b> ${escapeHtml(artworkTitleFor(item))}</span>
              <span><b>Sitede görünecek ad:</b> ${escapeHtml(publicName(item))}</span>
              ${item.hideName ? '<span class="privacy-chip">İsim gizli</span>' : ''}
            </div>
            <div class="admin-review-actions">
              <label class="review-approval-toggle">
                <input type="checkbox" data-review-approval="${escapeHtml(item.id)}" ${item.approved ? 'checked' : ''}>
                <span>Doğrulandı ve yayımlansın</span>
              </label>
              <div>
                <button type="button" data-review-action="up" data-id="${escapeHtml(item.id)}" ${!item.approved || approvedIndex <= 0 ? 'disabled' : ''}>Yukarı</button>
                <button type="button" data-review-action="down" data-id="${escapeHtml(item.id)}" ${!item.approved || approvedIndex < 0 || approvedIndex >= approved.length - 1 ? 'disabled' : ''}>Aşağı</button>
                <button class="danger" type="button" data-review-action="delete" data-id="${escapeHtml(item.id)}">Sil</button>
              </div>
            </div>
          </div>
        </article>`;
    }).join('');
  };

  const publicPayload = (item, order) => ({
    publicName: publicName(item),
    city: item.city,
    artworkId: item.artworkId,
    artworkTitle: artworkTitleFor(item),
    artworkImage: artworkImageFor(item),
    rating: item.rating,
    comment: item.comment,
    order,
    publishedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

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
        approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
        approvedBy: firebase.auth().currentUser?.email || ''
      });
      batch.set(publicRef, publicPayload(item, existingOrder), { merge: false });
    } else {
      batch.update(submissionRef, { approved: false, approvedAt: null, approvedBy: '' });
      batch.delete(publicRef);
    }

    await batch.commit();
    setNotice(approved ? 'Yorum doğrulandı ve değerlendirmeler sayfasında yayımlandı.' : 'Yorum yayından kaldırıldı.', 'success');
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
      if (action.dataset.reviewAction === 'delete') await remove(action.dataset.id);
    } catch (error) {
      console.error(error);
      setNotice(`Yorum işlemi tamamlanamadı: ${error.message}`, 'error');
    } finally {
      action.disabled = false;
    }
  });

  document.addEventListener('change', async (event) => {
    const toggle = event.target.closest('[data-review-approval]');
    if (!toggle) return;
    toggle.disabled = true;
    try {
      await setApproval(toggle.dataset.reviewApproval, toggle.checked);
    } catch (error) {
      console.error(error);
      toggle.checked = !toggle.checked;
      setNotice(`Yorum güncellenemedi: ${error.message}`, 'error');
    } finally {
      toggle.disabled = false;
    }
  });

  const app = getApp();
  if (!app || !firebase.auth || !firebase.firestore) return;
  firebase.auth().onAuthStateChanged((user) => {
    if (isAdmin(user)) { watchArtworks(); watch(); }
    else {
      if (unsubscribe) unsubscribe();
      if (unsubscribeArtworks) unsubscribeArtworks();
      submissions = [];
      render();
    }
  });
})();
