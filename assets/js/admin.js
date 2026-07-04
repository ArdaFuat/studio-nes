(function () {
  const FIREBASE_ARTWORKS_COLLECTION = 'artworks';
  const FIREBASE_CONTENT_COLLECTION = 'siteContent';
  const FIREBASE_CONTENT_DOC = 'main';
  const FIREBASE_FAIRS_COLLECTION = 'fairs';
  const SESSION_KEY = 'studio-nes-admin-email';

  let artworks = [];
  let fairs = [];
  let siteContent = clone(typeof DEFAULT_SITE_CONTENT !== 'undefined' ? DEFAULT_SITE_CONTENT : {});
  let editingId = null;
  let editingSnapshot = null;
  let editingFairId = null;
  let currentUser = null;
  let unsubscribeArtworks = null;
  let unsubscribeContent = null;
  let unsubscribeFairs = null;
  let selectedImageDataUrl = '';

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

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

  const pathSet = (obj, path, value) => {
    const parts = String(path || '').split('.');
    let target = obj;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) target[part] = value;
      else {
        if (!target[part] || typeof target[part] !== 'object') target[part] = {};
        target = target[part];
      }
    });
  };

  const newlineToArray = (value) => String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

  const arrayToLines = (items) => (Array.isArray(items) ? items : []).join('\n');

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
      console.error(error);
      return null;
    }
  };

  const db = () => firebase.firestore();
  const auth = () => firebase.auth();

  const getAdminEmails = () => (Array.isArray(window.NESS_ADMIN_EMAILS) ? window.NESS_ADMIN_EMAILS : [])
    .map((email) => String(email).trim().toLowerCase())
    .filter(Boolean);

  const isAllowedEmail = (email) => getAdminEmails().includes(String(email || '').trim().toLowerCase());
  const getPlatform = (value) => (SALES_PLATFORMS || []).find((item) => item.value === value) || SALES_PLATFORMS[0];
  const normalizeCategoryOptions = (items = []) => {
    const seen = new Set();
    return (Array.isArray(items) ? items : [])
      .map((item) => ({
        value: String(typeof item === 'string' ? item : (item.value || '')).trim(),
        label: String(typeof item === 'string' ? item : (item.label || item.value || '')).trim()
      }))
      .filter((item) => item.value && item.value !== 'all')
      .filter((item) => {
        if (seen.has(item.value)) return false;
        seen.add(item.value);
        return true;
      });
  };
  const getGalleryCategoryOptions = (extraValue = '') => {
    const merged = [];
    const pushUnique = (item) => {
      if (!item?.value || item.value === 'all' || merged.some((entry) => entry.value === item.value)) return;
      merged.push(item);
    };
    normalizeCategoryOptions(siteContent?.gallery?.filters || []).forEach(pushUnique);
    normalizeCategoryOptions(typeof ARTWORK_CATEGORIES !== 'undefined' ? ARTWORK_CATEGORIES : []).forEach(pushUnique);
    const extra = String(extraValue || '').trim();
    if (extra && !merged.some((item) => item.value === extra)) merged.push({ value: extra, label: extra });
    return merged;
  };
  const refreshCategorySelect = (selected = '') => {
    const current = selected || $('#category')?.value || 'doga';
    fillSelect('#category', getGalleryCategoryOptions(current), current);
  };
  const getCategoryLabel = (value) => getGalleryCategoryOptions(value).find((item) => item.value === value)?.label || value;
  const getCollectionLabel = (value) => (ARTWORK_COLLECTIONS || []).find((item) => item.value === value)?.label || value;

  const normalizeArtwork = (art = {}, index = 0) => ({
    id: art.id || `${slugify(art.title)}-${Date.now()}`,
    title: art.title || 'İsimsiz ürün',
    category: art.category || 'doga',
    collection: art.collection || 'ready',
    technique: art.technique || 'Akrilik boya',
    width: art.width || '',
    height: art.height || '',
    size: art.size || ((art.width && art.height) ? `${art.width}×${art.height} cm` : ''),
    price: art.price || '',
    status: art.status || 'Satılık',
    image: art.image || 'assets/img/ness-logo.png',
    imagePath: art.imagePath || '',
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
    .sort((a, b) => a.order - b.order)
    .map((art, index) => ({ ...art, order: index }));

  const normalizeFair = (fair = {}, index = 0) => ({
    id: fair.id || `${slugify(fair.title || 'fuar')}-${Date.now()}`,
    title: fair.title || 'İsimsiz fuar',
    date: fair.date || '',
    location: fair.location || '',
    status: fair.status || '',
    description: fair.description || '',
    images: Array.isArray(fair.images) ? fair.images.filter(Boolean) : newlineToArray(fair.images),
    visible: fair.visible !== false,
    upcoming: Boolean(fair.upcoming),
    order: Number.isFinite(Number(fair.order)) ? Number(fair.order) : index,
    updatedAt: fair.updatedAt || ''
  });

  const normalizeFairs = (items) => (Array.isArray(items) ? items : [])
    .map(normalizeFair)
    .sort((a, b) => a.order - b.order)
    .map((fair, index) => ({ ...fair, order: index }));

  const setNotice = (message, type = 'info') => {
    const node = $('[data-admin-notice]');
    if (!node) return;
    node.textContent = message;
    node.className = `admin-notice ${type}`;
    if (message) node.removeAttribute('hidden');
    else node.setAttribute('hidden', '');
  };

  const setLoginStatus = (message, type = 'info') => {
    const node = $('[data-login-status]');
    if (!node) return;
    node.textContent = message;
    node.className = `login-status ${type}`;
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
    const targetBytes = options.targetBytes || 760 * 1024;
    let maxSide = options.maxSide || 1300;
    let quality = options.quality || 0.78;
    let blob = null;

    for (let attempt = 0; attempt < 10; attempt += 1) {
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
      if (quality > 0.48) quality -= 0.1;
      else maxSide = Math.max(760, Math.round(maxSide * 0.82));
    }

    const hardLimit = options.hardLimitBytes || Math.max(targetBytes + 190 * 1024, 350 * 1024);
    if (!blob || blob.size > hardLimit) {
      throw new Error('Görsel hâlâ çok büyük. Daha küçük bir görsel seç veya sıkıştırılmış JPG kullan.');
    }
    return blobToDataUrl(blob);
  };

  const friendlyAuthError = (error) => {
    const code = error?.code || '';
    const message = error?.message || String(error || 'Bilinmeyen hata');
    if (location.protocol === 'file:') return 'Site dosyadan çift tıklanarak açılmış. Firebase girişi için Netlify adresinden ya da VS Code Live Server gibi http:// adresinden açmalısın.';
    if (code.includes('operation-not-allowed')) return 'Firebase Authentication içinde Email/Password giriş yöntemi açık değil. Authentication > Sign-in method > Email/Password bölümünü aktif et.';
    if (code.includes('unauthorized-domain')) return `Bu alan adı Firebase Auth için yetkili değil. Firebase > Authentication > Settings > Authorized domains kısmına ${location.hostname} domainini ekle.`;
    if (code.includes('invalid-credential') || code.includes('user-not-found') || code.includes('wrong-password')) return 'E-posta veya şifre hatalı. Firebase > Authentication > Users içinde bu mail için kullanıcı oluşturduğundan ve şifreyi doğru yazdığından emin ol.';
    if (code.includes('invalid-email')) return 'E-posta formatı hatalı.';
    if (code.includes('too-many-requests')) return 'Çok fazla deneme yapıldı. Birkaç dakika bekleyip tekrar dene.';
    if (code.includes('network-request-failed')) return 'İnternet/Firebase bağlantısı kurulamadı. Bağlantını ve reklam engelleyici/koruma eklentilerini kontrol et.';
    return `Firebase giriş hatası: ${message}`;
  };

  const setBusy = (busy, label = 'Kaydediliyor...') => {
    const submit = $('[data-submit-label]');
    if (!submit) return;
    submit.disabled = Boolean(busy);
    submit.textContent = busy ? label : (editingId ? 'Değişiklikleri Kaydet' : 'Ürünü Kaydet');
  };

  const fillSelect = (selector, items, selected = '') => {
    const select = $(selector);
    if (!select) return;
    select.innerHTML = items.map((item) => {
      const value = typeof item === 'string' ? item : item.value;
      const label = typeof item === 'string' ? item : item.label;
      return `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');
  };

  const clearForm = () => {
    editingId = null;
    editingSnapshot = null;
    selectedImageDataUrl = '';
    const imageFileInput = $('#imageFile');
    if (imageFileInput) imageFileInput.value = '';
    $('[data-form-title]').textContent = 'Yeni ürün ekle';
    $('[data-submit-label]').textContent = 'Ürünü Kaydet';
    $('[data-art-form]').reset();
    $('#visible').checked = true;
    $('#collection').value = 'ready';
    $('#category').value = 'doga';
    $('#technique').value = 'Akrilik boya';
    $('#status').value = 'Satılık';
    $('#platform').value = '';
    $('#image-preview').src = 'assets/img/ness-logo.png';
    $('#image-preview').alt = 'Görsel önizleme';
  };

  const readForm = () => {
    const title = $('#title').value.trim();
    const width = $('#width').value.trim();
    const height = $('#height').value.trim();
    const customSize = $('#size').value.trim();
    const platform = getPlatform($('#platform').value);
    const current = artworks.find((item) => item.id === editingId) || editingSnapshot;
    const id = editingId || current?.id || `${slugify(title)}-${Date.now()}`;
    const imageUrl = $('#image').value.trim();
    const size = customSize || ((width && height) ? `${width}×${height} cm` : 'Ölçü girilmedi');

    return normalizeArtwork({
      id,
      title,
      category: $('#category').value,
      collection: $('#collection').value,
      technique: $('#technique').value === 'Diğer' ? ($('#techniqueCustom').value.trim() || 'Diğer') : $('#technique').value,
      width,
      height,
      size,
      price: $('#price').value.trim() || 'Fiyat sorunuz',
      status: $('#status').value,
      image: selectedImageDataUrl || imageUrl || current?.image || 'assets/img/ness-logo.png',
      imagePath: current?.imagePath || '',
      url: $('#url').value.trim(),
      sourceLabel: platform.sourceLabel,
      actionLabel: platform.actionLabel,
      short: $('#short').value.trim(),
      detail: $('#detail').value.trim() || $('#short').value.trim(),
      hidden: !$('#visible').checked,
      order: current?.order ?? artworks.length
    }, artworks.length);
  };

  const validateArtwork = (art) => {
    if (!art.title.trim()) return 'Ürün adı boş kalamaz.';
    if (!art.short.trim()) return 'Kart açıklaması boş kalamaz.';
    if (!art.detail.trim()) return 'Detay açıklaması boş kalamaz.';
    if (!safeUrl(art.image)) return 'Görsel URL/yol hatalı veya görsel seçilmedi.';
    return '';
  };

  const toFirestorePayload = (art) => ({
    id: art.id,
    title: art.title,
    category: art.category,
    collection: art.collection,
    technique: art.technique,
    width: art.width,
    height: art.height,
    size: art.size,
    price: art.price,
    status: art.status,
    image: art.image,
    imagePath: art.imagePath || '',
    url: art.url,
    sourceLabel: art.sourceLabel,
    actionLabel: art.actionLabel,
    short: art.short,
    detail: art.detail,
    hidden: art.hidden,
    order: art.order,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: currentUser?.email || ''
  });

  const saveArtworkToFirebase = async (art) => {
    await db().collection(FIREBASE_ARTWORKS_COLLECTION).doc(art.id).set(toFirestorePayload(art), { merge: true });
    return art;
  };

  const editArtwork = (id) => {
    const art = artworks.find((item) => item.id === id);
    if (!art) return;
    editingId = id;
    editingSnapshot = clone(art);
    selectedImageDataUrl = '';
    const imageFileInput = $('#imageFile');
    if (imageFileInput) imageFileInput.value = '';
    $('[data-form-title]').textContent = 'Ürünü düzenle';
    $('[data-submit-label]').textContent = 'Değişiklikleri Kaydet';
    $('#title').value = art.title || '';
    refreshCategorySelect(art.category || 'doga');
    $('#category').value = art.category || 'doga';
    $('#collection').value = art.collection || 'ready';
    if ((ARTWORK_TECHNIQUES || []).includes(art.technique)) {
      $('#technique').value = art.technique;
      $('#techniqueCustom').value = '';
    } else {
      $('#technique').value = 'Diğer';
      $('#techniqueCustom').value = art.technique || '';
    }
    $('#width').value = art.width || '';
    $('#height').value = art.height || '';
    $('#size').value = art.size || '';
    $('#price').value = art.price || '';
    $('#status').value = art.status || 'Satılık';
    $('#image').value = art.image?.startsWith('data:image/') ? '' : (art.image || '');
    $('#url').value = art.url || '';
    $('#platform').value = art.sourceLabel || '';
    $('#short').value = art.short || '';
    $('#detail').value = art.detail || '';
    $('#visible').checked = !art.hidden;
    $('#image-preview').src = art.image || 'assets/img/ness-logo.png';
    $('#image-preview').alt = `${art.title} önizleme`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteArtwork = async (id) => {
    const art = artworks.find((item) => item.id === id);
    if (!art) return;
    const confirmed = window.confirm(`"${art.title}" galeriden tamamen silinsin mi?`);
    if (!confirmed) return;
    try {
      await db().collection(FIREBASE_ARTWORKS_COLLECTION).doc(id).delete();
      if (editingId === id) clearForm();
      setNotice('Ürün silindi.', 'success');
    } catch (error) {
      setNotice(`Silinemedi: ${error.message}`, 'error');
    }
  };

  const duplicateArtwork = async (id) => {
    const art = artworks.find((item) => item.id === id);
    if (!art) return;
    const copy = normalizeArtwork({ ...art, id: `${slugify(art.title)}-kopya-${Date.now()}`, title: `${art.title} Kopya`, order: artworks.length, updatedAt: '' }, artworks.length);
    try {
      await db().collection(FIREBASE_ARTWORKS_COLLECTION).doc(copy.id).set(toFirestorePayload(copy));
      setNotice('Ürün kopyalandı ve kaydedildi.', 'success');
    } catch (error) {
      setNotice(`Kopyalanamadı: ${error.message}`, 'error');
    }
  };

  const saveArtworkOrder = async (items) => {
    const batch = db().batch();
    items.forEach((item, order) => {
      batch.update(db().collection(FIREBASE_ARTWORKS_COLLECTION).doc(item.id), {
        order,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: currentUser?.email || ''
      });
    });
    await batch.commit();
  };

  const moveArtwork = async (id, direction) => {
    const index = artworks.findIndex((item) => item.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= artworks.length) return;
    const copy = [...artworks];
    [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
    try {
      await saveArtworkOrder(copy);
      setNotice('Sıralama güncellendi.', 'success');
    } catch (error) {
      setNotice(`Sıralama kaydedilemedi: ${error.message}`, 'error');
    }
  };

  const renderList = () => {
    const list = $('[data-product-list]');
    const count = $('[data-product-count]');
    if (!list) return;
    if (count) count.textContent = `${artworks.length} ürün`;
    if (!artworks.length) {
      list.innerHTML = '<p class="muted-box">Henüz ürün yok. “İlk Ürünleri Aktar” butonuna basabilir veya soldaki formdan ürün ekleyebilirsin.</p>';
      return;
    }
    list.innerHTML = artworks.map((art, index) => `
      <article class="admin-product-card ${art.hidden ? 'is-hidden' : ''}">
        <img src="${escapeHtml(art.image || 'assets/img/ness-logo.png')}" alt="${escapeHtml(art.title)}" loading="lazy">
        <div>
          <div class="admin-product-head">
            <strong>${escapeHtml(art.title)}</strong>
            <span>${escapeHtml(art.status)}</span>
          </div>
          <p>${escapeHtml(art.price || 'Fiyat yok')} · ${escapeHtml(art.technique)} · ${escapeHtml(art.size)}</p>
          <small>${escapeHtml(getCategoryLabel(art.category))} / ${escapeHtml(getCollectionLabel(art.collection))}${art.hidden ? ' / gizli' : ''}</small>
          <small class="id-hint">ID: ${escapeHtml(art.id)}</small>
          <div class="admin-card-actions">
            <button type="button" data-action="edit" data-id="${escapeHtml(art.id)}">Düzenle</button>
            <button type="button" data-action="duplicate" data-id="${escapeHtml(art.id)}">Kopyala</button>
            <button type="button" data-action="up" data-id="${escapeHtml(art.id)}" ${index === 0 ? 'disabled' : ''}>Yukarı</button>
            <button type="button" data-action="down" data-id="${escapeHtml(art.id)}" ${index === artworks.length - 1 ? 'disabled' : ''}>Aşağı</button>
            <button class="danger" type="button" data-action="delete" data-id="${escapeHtml(art.id)}">Sil</button>
          </div>
        </div>
      </article>
    `).join('');
  };

  const watchArtworks = () => {
    if (unsubscribeArtworks) unsubscribeArtworks();
    unsubscribeArtworks = db().collection(FIREBASE_ARTWORKS_COLLECTION).orderBy('order', 'asc')
      .onSnapshot((snapshot) => {
        artworks = snapshot.docs.map((doc, index) => normalizeArtwork({ id: doc.id, ...doc.data() }, index));
        renderList();
      }, (error) => setNotice(`Ürünler okunamadı: ${error.message}`, 'error'));
  };

  const exportJson = () => {
    const payload = JSON.stringify({ updatedAt: new Date().toISOString(), artworks: normalizeArtworks(artworks), siteContent, fairs: normalizeFairs(fairs) }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'studio-nes-backup.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    setNotice('Yedek indirildi.', 'success');
  };

  const writeManyToFirebase = async (items, mode = 'merge') => {
    const normalized = normalizeArtworks(items);
    if (!normalized.length) throw new Error('Aktarılacak ürün bulunamadı.');
    const batch = db().batch();
    normalized.forEach((item, order) => {
      const art = { ...item, order };
      batch.set(db().collection(FIREBASE_ARTWORKS_COLLECTION).doc(art.id), toFirestorePayload(art), { merge: mode === 'merge' });
    });
    await batch.commit();
  };

  const importJson = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : parsed.artworks;
      if (Array.isArray(items)) await writeManyToFirebase(items, 'merge');
      if (parsed.siteContent) await saveContent(parsed.siteContent);
      if (Array.isArray(parsed.fairs)) await writeManyFairs(parsed.fairs, 'merge');
      clearForm();
      setNotice('Yedek içe aktarıldı. İçerikler canlı sitede görünür.', 'success');
    } catch (error) {
      setNotice(`JSON aktarılamadı: ${error.message}`, 'error');
    }
  };

  const seedDefaults = async () => {
    const confirmed = window.confirm('Mevcut hazır ürünler içeri aktarılsın mı? Aynı ürün varsa üzerine yazar.');
    if (!confirmed) return;
    try {
      await writeManyToFirebase(typeof ARTWORKS !== 'undefined' ? ARTWORKS : [], 'merge');
      setNotice('Hazır ürünler aktarıldı. Galeri güncellendi.', 'success');
    } catch (error) {
      setNotice(`Aktarım yapılamadı: ${error.message}`, 'error');
    }
  };

  const CONTENT_FIELDS = [
    { title: 'Menü & alt bilgi', fields: [
      ['nav.home', 'Menü: Ana sayfa'], ['nav.gallery', 'Menü: Galeri'], ['nav.fairs', 'Menü: Fuarlar'], ['nav.custom', 'Menü: Özel Sipariş'], ['nav.about', 'Menü: Hakkında'], ['nav.contact', 'Menü: İletişim'], ['footer.tagline', 'Footer kısa yazı'], ['footer.copyrightSuffix', 'Telif yazısı']
    ]},
    { title: 'Ana sayfa', fields: [
      ['home.heroEyebrow', 'Hero küçük başlık'], ['home.heroTitle', 'Hero büyük başlık', 'textarea'], ['home.heroLead', 'Hero açıklama', 'textarea'], ['home.heroPrimaryButton', 'Birinci buton'], ['home.heroSecondaryButton', 'İkinci buton'], ['home.heroSlideArtworkIds', 'Slider ürün ID’leri', 'text', 'Virgülle ayır: white-lilies, orman, kirlar'], ['home.approachEyebrow', 'Yaklaşım küçük başlık'], ['home.approachTitle', 'Yaklaşım başlık', 'textarea'], ['home.approachText', 'Yaklaşım metni', 'textarea'], ['home.featuredEyebrow', 'Öne çıkanlar küçük başlık'], ['home.featuredTitle', 'Öne çıkanlar başlık'], ['home.featuredLink', 'Öne çıkanlar link yazısı'], ['home.featuredArtworkIds', 'Öne çıkan ürün ID’leri', 'text', 'Virgülle ayır'], ['home.customPanelEyebrow', 'Özel sipariş panel küçük başlık'], ['home.customPanelTitle', 'Özel sipariş panel başlık', 'textarea'], ['home.customPanelText', 'Özel sipariş panel metni', 'textarea'], ['home.customPanelButton', 'Özel sipariş panel buton'], ['home.linksEyebrow', 'Bağlantılar küçük başlık'], ['home.linksTitle', 'Bağlantılar başlık']
    ]},
    { title: 'Galeri', fields: [
      ['gallery.eyebrow', 'Galeri küçük başlık'], ['gallery.title', 'Galeri başlık'], ['gallery.intro', 'Galeri açıklama', 'textarea'], ['gallery.note', 'Galeri notu', 'textarea']
    ]},
    { title: 'Fuarlar sayfası', fields: [
      ['fairs.eyebrow', 'Fuar küçük başlık'], ['fairs.title', 'Fuar başlık'], ['fairs.intro', 'Fuar açıklama', 'textarea'], ['fairs.emptyDate', 'Fuar yokken rozet'], ['fairs.emptyTitle', 'Fuar yokken başlık'], ['fairs.emptyText', 'Fuar yokken metin', 'textarea'], ['fairs.emptyItems', 'Fuar yokken liste', 'textarea', 'Her satıra bir madde']
    ]},
    { title: 'Özel sipariş', fields: [
      ['custom.eyebrow', 'Özel sipariş küçük başlık'], ['custom.title', 'Özel sipariş başlık', 'textarea'], ['custom.intro', 'Özel sipariş açıklama', 'textarea'], ['custom.examplesEyebrow', 'Örnekler küçük başlık'], ['custom.examplesTitle', 'Örnekler başlık', 'textarea'], ['custom.examplesLink', 'Örnekler link yazısı'], ['custom.customArtworkIds', 'Özel siparişte gösterilecek ürün ID’leri', 'text', 'Virgülle ayır veya boş bırakınca custom ürünler gelir'], ['custom.examplesNote', 'Örnekler notu', 'textarea'], ['custom.orderEyebrow', 'Sipariş notu küçük başlık'], ['custom.orderTitle', 'Sipariş notu başlık', 'textarea'], ['custom.orderText', 'Sipariş notu metni', 'textarea'], ['custom.orderButton', 'Sipariş notu buton']
    ]},
    { title: 'Hakkında', fields: [
      ['about.eyebrow', 'Hakkında küçük başlık'], ['about.title', 'Hakkında başlık', 'textarea'], ['about.image', 'Hakkında görsel URL / yol'], ['about.imageAlt', 'Hakkında görsel alt yazı'], ['about.paragraph1', 'Hakkında paragraf 1', 'textarea'], ['about.paragraph2', 'Hakkında paragraf 2', 'textarea']
    ]},
    { title: 'İletişim', fields: [
      ['contact.eyebrow', 'İletişim küçük başlık'], ['contact.title', 'İletişim başlık', 'textarea'], ['contact.intro', 'İletişim açıklama', 'textarea'], ['contact.faqEyebrow', 'SSS küçük başlık'], ['contact.faqTitle', 'SSS başlık']
    ]}
  ];

  const renderPrimitiveContentFields = () => {
    const box = $('[data-content-fields]');
    if (!box) return;
    const primitiveHtml = CONTENT_FIELDS.map((section) => `
      <details class="content-fieldset" open>
        <summary>${escapeHtml(section.title)}</summary>
        <div class="content-field-grid">
          ${section.fields.map(([path, label, type = 'text', hint = '']) => `
            <label>
              ${escapeHtml(label)}
              ${type === 'textarea'
                ? `<textarea rows="${path.includes('Title') ? 3 : 4}" data-content-input="${escapeHtml(path)}">${escapeHtml(pathGet(siteContent, path, ''))}</textarea>`
                : `<input type="text" data-content-input="${escapeHtml(path)}" value="${escapeHtml(pathGet(siteContent, path, ''))}">`}
              ${hint ? `<small class="field-hint">${escapeHtml(hint)}</small>` : ''}
            </label>`).join('')}
        </div>
      </details>`).join('');

    box.innerHTML = primitiveHtml + `
      <details class="content-fieldset" open>
        <summary>Galeri kategorileri</summary>
        <div class="repeat-list" data-content-repeat="gallery.filters"></div>
        <button class="btn ghost small-btn" type="button" data-add-repeat="gallery.filters">Kategori Ekle</button>
      </details>
      <details class="content-fieldset">
        <summary>Özel sipariş süreç kartları</summary>
        <div class="repeat-list" data-content-repeat="custom.process"></div>
        <button class="btn ghost small-btn" type="button" data-add-repeat="custom.process">Süreç Kartı Ekle</button>
      </details>
      <details class="content-fieldset">
        <summary>Hakkında değer kartları</summary>
        <div class="repeat-list" data-content-repeat="about.values"></div>
        <button class="btn ghost small-btn" type="button" data-add-repeat="about.values">Değer Kartı Ekle</button>
      </details>
      <details class="content-fieldset">
        <summary>İletişim SSS</summary>
        <div class="repeat-list" data-content-repeat="contact.faqs"></div>
        <button class="btn ghost small-btn" type="button" data-add-repeat="contact.faqs">Soru Ekle</button>
      </details>`;
    renderRepeatManagers();
    refreshCategorySelect();
  };

  const repeatConfig = {
    'gallery.filters': { fields: [['value', 'Kategori kodu'], ['label', 'Görünen yazı']], blank: { value: 'diger', label: 'Yeni kategori' } },
    'custom.process': { fields: [['no', 'Numara'], ['title', 'Başlık'], ['text', 'Metin', 'textarea']], blank: { no: '05', title: 'Yeni adım', text: '' } },
    'about.values': { fields: [['title', 'Başlık'], ['text', 'Metin', 'textarea']], blank: { title: 'Yeni değer', text: '' } },
    'contact.faqs': { fields: [['question', 'Soru'], ['answer', 'Cevap', 'textarea']], blank: { question: 'Yeni soru', answer: '' } }
  };

  const renderRepeatManagers = () => {
    Object.entries(repeatConfig).forEach(([path, config]) => {
      const box = $(`[data-content-repeat="${path}"]`);
      if (!box) return;
      const items = Array.isArray(pathGet(siteContent, path, [])) ? pathGet(siteContent, path, []) : [];
      box.innerHTML = items.map((item, index) => `
        <article class="repeat-card" data-repeat-path="${escapeHtml(path)}" data-repeat-index="${index}">
          <div class="repeat-head"><strong>${escapeHtml(item.title || item.label || item.question || `Satır ${index + 1}`)}</strong><button class="danger" type="button" data-remove-repeat="${escapeHtml(path)}" data-index="${index}">Sil</button></div>
          <div class="content-field-grid">
            ${config.fields.map(([key, label, type = 'text']) => `
              <label>${escapeHtml(label)}
                ${type === 'textarea'
                  ? `<textarea rows="3" data-repeat-field="${escapeHtml(key)}">${escapeHtml(item[key] || '')}</textarea>`
                  : `<input type="text" data-repeat-field="${escapeHtml(key)}" value="${escapeHtml(item[key] || '')}">`}
              </label>`).join('')}
          </div>
        </article>`).join('');
    });
  };

  const readContentForm = () => {
    const next = clone(siteContent);
    $$('[data-content-input]').forEach((input) => pathSet(next, input.dataset.contentInput, input.value));
    Object.keys(repeatConfig).forEach((path) => {
      const items = $$(`[data-repeat-path="${path}"]`).map((card) => {
        const item = {};
        card.querySelectorAll('[data-repeat-field]').forEach((input) => { item[input.dataset.repeatField] = input.value.trim(); });
        return item;
      }).filter((item) => Object.values(item).some(Boolean));
      pathSet(next, path, items);
    });
    return next;
  };

  const saveContent = async (content) => {
    const payload = {
      ...content,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: currentUser?.email || ''
    };
    await db().collection(FIREBASE_CONTENT_COLLECTION).doc(FIREBASE_CONTENT_DOC).set(payload, { merge: true });
  };

  const seedContent = async () => {
    const confirmed = window.confirm('Varsayılan site yazıları ve bağlantılar canlı siteye aktarılsın mı? Mevcut site yazılarının üzerine yazar.');
    if (!confirmed) return;
    try {
      await saveContent(clone(DEFAULT_SITE_CONTENT || {}));
      setNotice('Varsayılan site yazıları aktarıldı.', 'success');
    } catch (error) {
      setNotice(`Site yazıları aktarılamadı: ${error.message}`, 'error');
    }
  };

  const renderLinks = () => {
    const list = $('[data-links-list]');
    if (!list) return;
    const links = Array.isArray(siteContent.links) ? siteContent.links : [];
    list.innerHTML = links.map((link, index) => `
      <article class="repeat-card" data-link-index="${index}">
        <div class="repeat-head"><strong>${escapeHtml(link.name || `Bağlantı ${index + 1}`)}</strong><button class="danger" type="button" data-remove-link="${index}">Sil</button></div>
        <div class="content-field-grid">
          <label>Ad<input type="text" data-link-field="name" value="${escapeHtml(link.name || '')}"></label>
          <label>Kullanıcı adı / kısa yazı<input type="text" data-link-field="handle" value="${escapeHtml(link.handle || '')}"></label>
          <label>Tür<input type="text" data-link-field="type" value="${escapeHtml(link.type || '')}"></label>
          <label>URL<input type="url" data-link-field="url" value="${escapeHtml(link.url || '')}"></label>
          <label class="full-field">Açıklama<textarea rows="3" data-link-field="description">${escapeHtml(link.description || '')}</textarea></label>
        </div>
      </article>`).join('');
  };

  const readLinks = () => $$('[data-link-index]').map((card) => {
    const link = {};
    card.querySelectorAll('[data-link-field]').forEach((input) => { link[input.dataset.linkField] = input.value.trim(); });
    return link;
  }).filter((link) => link.name || link.url);

  const saveLinks = async () => {
    try {
      const next = readContentForm();
      next.links = readLinks();
      siteContent = next;
      await saveContent(next);
      setNotice('Bağlantılar kaydedildi.', 'success');
    } catch (error) {
      setNotice(`Bağlantılar kaydedilemedi: ${error.message}`, 'error');
    }
  };

  const clearFairForm = () => {
    editingFairId = null;
    $('[data-fair-form]')?.reset();
    $('#fairImages').value = '';
    $('#fairVisible').checked = true;
    $('#fairUpcoming').checked = false;
    $('[data-fair-submit]').textContent = 'Fuarı Kaydet';
  };

  const readFairForm = () => {
    const title = $('#fairTitle').value.trim();
    const current = fairs.find((item) => item.id === editingFairId);
    return normalizeFair({
      id: current?.id || `${slugify(title || 'fuar')}-${Date.now()}`,
      title,
      date: $('#fairDate').value.trim(),
      location: $('#fairLocation').value.trim(),
      status: $('#fairStatus').value.trim(),
      description: $('#fairDescription').value.trim(),
      images: newlineToArray($('#fairImages').value).map(safeUrl).filter(Boolean),
      visible: $('#fairVisible').checked,
      upcoming: $('#fairUpcoming').checked,
      order: current?.order ?? fairs.length
    }, fairs.length);
  };

  const toFairPayload = (fair) => ({
    title: fair.title,
    date: fair.date,
    location: fair.location,
    status: fair.status,
    description: fair.description,
    images: fair.images,
    visible: fair.visible,
    upcoming: fair.upcoming,
    order: fair.order,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: currentUser?.email || ''
  });

  const saveFair = async (fair) => {
    if (!fair.title.trim()) throw new Error('Fuar adı boş kalamaz.');
    await db().collection(FIREBASE_FAIRS_COLLECTION).doc(fair.id).set(toFairPayload(fair), { merge: true });
  };

  const editFair = (id) => {
    const fair = fairs.find((item) => item.id === id);
    if (!fair) return;
    editingFairId = id;
    $('#fairTitle').value = fair.title || '';
    $('#fairDate').value = fair.date || '';
    $('#fairLocation').value = fair.location || '';
    $('#fairStatus').value = fair.status || '';
    $('#fairDescription').value = fair.description || '';
    $('#fairImages').value = arrayToLines(fair.images);
    $('#fairVisible').checked = fair.visible !== false;
    $('#fairUpcoming').checked = Boolean(fair.upcoming);
    $('[data-fair-submit]').textContent = 'Fuarı Güncelle';
    $('.fair-manager')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const deleteFair = async (id) => {
    const fair = fairs.find((item) => item.id === id);
    if (!fair) return;
    const confirmed = window.confirm(`"${fair.title}" fuarı silinsin mi?`);
    if (!confirmed) return;
    try {
      await db().collection(FIREBASE_FAIRS_COLLECTION).doc(id).delete();
      if (editingFairId === id) clearFairForm();
      setNotice('Fuar silindi.', 'success');
    } catch (error) {
      setNotice(`Fuar silinemedi: ${error.message}`, 'error');
    }
  };

  const duplicateFair = async (id) => {
    const fair = fairs.find((item) => item.id === id);
    if (!fair) return;
    const copy = normalizeFair({ ...fair, id: `${slugify(fair.title)}-kopya-${Date.now()}`, title: `${fair.title} Kopya`, order: fairs.length }, fairs.length);
    try {
      await saveFair(copy);
      setNotice('Fuar kopyalandı.', 'success');
    } catch (error) {
      setNotice(`Fuar kopyalanamadı: ${error.message}`, 'error');
    }
  };

  const saveFairOrder = async (items) => {
    const batch = db().batch();
    items.forEach((item, order) => {
      batch.update(db().collection(FIREBASE_FAIRS_COLLECTION).doc(item.id), {
        order,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: currentUser?.email || ''
      });
    });
    await batch.commit();
  };

  const moveFair = async (id, direction) => {
    const index = fairs.findIndex((item) => item.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= fairs.length) return;
    const copy = [...fairs];
    [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
    try {
      await saveFairOrder(copy);
      setNotice('Fuar sıralaması güncellendi.', 'success');
    } catch (error) {
      setNotice(`Fuar sıralaması kaydedilemedi: ${error.message}`, 'error');
    }
  };

  const writeManyFairs = async (items, mode = 'merge') => {
    const normalized = normalizeFairs(items);
    const batch = db().batch();
    normalized.forEach((item, order) => {
      const fair = { ...item, order };
      batch.set(db().collection(FIREBASE_FAIRS_COLLECTION).doc(fair.id), toFairPayload(fair), { merge: mode === 'merge' });
    });
    await batch.commit();
  };

  const renderFairList = () => {
    const list = $('[data-fair-list]');
    const count = $('[data-fair-count]');
    if (!list) return;
    if (count) count.textContent = `${fairs.length} fuar`;
    if (!fairs.length) {
      list.innerHTML = '<p class="muted-box">Henüz fuar yok. Formdan fuar ekleyebilirsin.</p>';
      return;
    }
    list.innerHTML = fairs.map((fair, index) => `
      <article class="admin-product-card ${fair.visible ? '' : 'is-hidden'}">
        <img src="${escapeHtml(fair.images[0] || 'assets/img/ness-logo.png')}" alt="${escapeHtml(fair.title)}" loading="lazy">
        <div>
          <div class="admin-product-head">
            <strong>${escapeHtml(fair.title)}</strong>
            <span>${escapeHtml(fair.status || (fair.upcoming ? 'Yakında' : 'Fuar'))}</span>
          </div>
          <p>${escapeHtml([fair.date, fair.location].filter(Boolean).join(' · ') || 'Tarih/konum yok')}</p>
          <small>${fair.images.length} fotoğraf${fair.visible ? '' : ' / gizli'}</small>
          <div class="admin-card-actions">
            <button type="button" data-fair-action="edit" data-id="${escapeHtml(fair.id)}">Düzenle</button>
            <button type="button" data-fair-action="duplicate" data-id="${escapeHtml(fair.id)}">Kopyala</button>
            <button type="button" data-fair-action="up" data-id="${escapeHtml(fair.id)}" ${index === 0 ? 'disabled' : ''}>Yukarı</button>
            <button type="button" data-fair-action="down" data-id="${escapeHtml(fair.id)}" ${index === fairs.length - 1 ? 'disabled' : ''}>Aşağı</button>
            <button class="danger" type="button" data-fair-action="delete" data-id="${escapeHtml(fair.id)}">Sil</button>
          </div>
        </div>
      </article>`).join('');
  };

  const watchContent = () => {
    if (unsubscribeContent) unsubscribeContent();
    unsubscribeContent = db().collection(FIREBASE_CONTENT_COLLECTION).doc(FIREBASE_CONTENT_DOC)
      .onSnapshot((doc) => {
        const selectedCategory = $('#category')?.value || editingSnapshot?.category || 'doga';
        siteContent = deepMerge(DEFAULT_SITE_CONTENT || {}, doc.exists ? doc.data() : {});
        renderPrimitiveContentFields();
        refreshCategorySelect(selectedCategory);
        renderLinks();
        renderList();
      }, (error) => setNotice(`Site yazıları okunamadı: ${error.message}`, 'error'));
  };

  const watchFairs = () => {
    if (unsubscribeFairs) unsubscribeFairs();
    unsubscribeFairs = db().collection(FIREBASE_FAIRS_COLLECTION).orderBy('order', 'asc')
      .onSnapshot((snapshot) => {
        fairs = snapshot.docs.map((doc, index) => normalizeFair({ id: doc.id, ...doc.data() }, index));
        renderFairList();
      }, (error) => setNotice(`Fuarlar okunamadı: ${error.message}`, 'error'));
  };

  const setLoggedInUi = (user) => {
    currentUser = user;
    sessionStorage.setItem(SESSION_KEY, user?.email || '');
    $('[data-login-panel]')?.setAttribute('hidden', '');
    $('[data-admin-panel]')?.removeAttribute('hidden');
    const emailNode = $('[data-admin-email]');
    if (emailNode) emailNode.textContent = user?.email || '-';
    setNotice('Giriş yapıldı. Kaydettiğin değişiklikler siteye yansır.', 'success');
    watchArtworks();
    watchContent();
    watchFairs();
  };

  const logout = async () => {
    try {
      await auth().signOut();
    } finally {
      currentUser = null;
      sessionStorage.removeItem(SESSION_KEY);
      if (unsubscribeArtworks) unsubscribeArtworks();
      if (unsubscribeContent) unsubscribeContent();
      if (unsubscribeFairs) unsubscribeFairs();
      $('[data-admin-panel]')?.setAttribute('hidden', '');
      $('[data-login-panel]')?.removeAttribute('hidden');
      setNotice('Çıkış yapıldı.', 'info');
      setLoginStatus('', 'info');
    }
  };

  const setupAuth = () => {
    auth().onAuthStateChanged(async (user) => {
      if (!user) {
        currentUser = null;
        $('[data-admin-panel]')?.setAttribute('hidden', '');
        $('[data-login-panel]')?.removeAttribute('hidden');
        return;
      }
      if (!isAllowedEmail(user.email)) {
        await auth().signOut();
        setNotice('Bu e-posta için giriş yetkisi yok.', 'error');
        return;
      }
      setLoggedInUi(user);
    });
  };

  const init = () => {
    refreshCategorySelect('doga');
    fillSelect('#collection', ARTWORK_COLLECTIONS, 'ready');
    fillSelect('#technique', ARTWORK_TECHNIQUES, 'Akrilik boya');
    fillSelect('#status', ARTWORK_STATUSES, 'Satılık');
    fillSelect('#platform', SALES_PLATFORMS, '');
    renderList();
    renderPrimitiveContentFields();
    renderLinks();
    renderFairList();
    clearForm();
    clearFairForm();

    const app = getFirebaseApp();
    if (location.protocol === 'file:') {
      const msg = 'Admin paneli dosyayı çift tıklayınca çalışmaz. Siteyi Netlify’a yükleyip oradan aç veya VS Code Live Server kullan.';
      setNotice(msg, 'error');
      setLoginStatus(msg, 'error');
    }
    if (!app || !firebase.auth || !firebase.firestore) {
      const msg = 'Giriş sistemi henüz bağlanmadı. Firebase config bilgileri veya Firebase scriptleri yüklenemedi.';
      setNotice(msg, 'error');
      setLoginStatus(msg, 'error');
      $('[data-login-panel]')?.removeAttribute('hidden');
      $('[data-admin-panel]')?.setAttribute('hidden', '');
      return;
    }

    setupAuth();

    $('[data-login-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = $('#adminEmail').value.trim().toLowerCase();
      const password = $('#adminPassword').value;
      const loginButton = $('[data-login-submit]');
      if (!isAllowedEmail(email)) {
        const msg = 'Bu e-posta admin listesinde yok. assets/js/firebase-config.js içindeki NESS_ADMIN_EMAILS listesine eklenmiş maille giriş yapmalısın.';
        setNotice(msg, 'error');
        setLoginStatus(msg, 'error');
        return;
      }
      try {
        if (loginButton) {
          loginButton.disabled = true;
          loginButton.textContent = 'Giriş yapılıyor...';
        }
        setNotice('Giriş yapılıyor...', 'info');
        setLoginStatus('Giriş yapılıyor...', 'info');
        await auth().signInWithEmailAndPassword(email, password);
      } catch (error) {
        const msg = friendlyAuthError(error);
        setNotice(msg, 'error');
        setLoginStatus(msg, 'error');
      } finally {
        if (loginButton) {
          loginButton.disabled = false;
          loginButton.textContent = 'Giriş Yap';
        }
      }
    });

    $('[data-logout]')?.addEventListener('click', logout);
    $('[data-new-product]')?.addEventListener('click', clearForm);
    $('[data-seed-defaults]')?.addEventListener('click', seedDefaults);
    $('[data-seed-content]')?.addEventListener('click', seedContent);

    $('#image')?.addEventListener('input', (event) => {
      selectedImageDataUrl = '';
      const imageFileInput = $('#imageFile');
      if (imageFileInput) imageFileInput.value = '';
      const value = event.target.value.trim();
      $('#image-preview').src = value || 'assets/img/ness-logo.png';
    });

    $('#imageFile')?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        setNotice('Görsel hazırlanıyor...', 'info');
        selectedImageDataUrl = await compressImageFile(file);
        $('#image').value = '';
        $('#image-preview').src = selectedImageDataUrl;
        setNotice('Görsel hazır. Ürünü kaydedince canlı siteye yansır.', 'success');
      } catch (error) {
        selectedImageDataUrl = '';
        event.target.value = '';
        setNotice(error.message || 'Görsel hazırlanamadı.', 'error');
      }
    });

    $('[data-art-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const wasEditing = Boolean(editingId);
      const originalId = editingId;
      const art = readForm();
      const error = validateArtwork(art);
      if (error) {
        setNotice(error, 'error');
        return;
      }
      try {
        setBusy(true, wasEditing ? 'Değişiklikler kaydediliyor...' : 'Kaydediliyor...');
        await saveArtworkToFirebase(art);
        const nextItems = artworks.filter((item) => item.id !== art.id && item.id !== originalId);
        artworks = normalizeArtworks([...nextItems, art]);
        renderList();
        clearForm();
        setNotice(wasEditing ? `“${art.title}” güncellendi. Değişiklik canlı siteye yansır.` : 'Kaydedildi. Değişiklik canlı siteye yansır.', 'success');
      } catch (error) {
        setNotice(`Kaydedilemedi: ${error.message}`, 'error');
      } finally {
        setBusy(false);
      }
    });

    $('[data-product-list]')?.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const { action, id } = button.dataset;
      if (action === 'edit') editArtwork(id);
      if (action === 'delete') deleteArtwork(id);
      if (action === 'duplicate') duplicateArtwork(id);
      if (action === 'up') moveArtwork(id, -1);
      if (action === 'down') moveArtwork(id, 1);
    });

    $('[data-content-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const next = readContentForm();
        next.links = readLinks();
        siteContent = next;
        refreshCategorySelect();
        renderList();
        await saveContent(next);
        setNotice('Site yazıları kaydedildi. Yeni kategoriler ürün formuna da aktarıldı.', 'success');
      } catch (error) {
        setNotice(`Site yazıları kaydedilemedi: ${error.message}`, 'error');
      }
    });

    $('[data-content-fields]')?.addEventListener('click', (event) => {
      const addButton = event.target.closest('[data-add-repeat]');
      if (addButton) {
        siteContent = readContentForm();
        const path = addButton.dataset.addRepeat;
        const current = Array.isArray(pathGet(siteContent, path, [])) ? pathGet(siteContent, path, []) : [];
        pathSet(siteContent, path, [...current, clone(repeatConfig[path].blank)]);
        renderPrimitiveContentFields();
        return;
      }
      const removeButton = event.target.closest('[data-remove-repeat]');
      if (removeButton) {
        siteContent = readContentForm();
        const path = removeButton.dataset.removeRepeat;
        const index = Number(removeButton.dataset.index);
        const current = Array.isArray(pathGet(siteContent, path, [])) ? [...pathGet(siteContent, path, [])] : [];
        current.splice(index, 1);
        pathSet(siteContent, path, current);
        renderPrimitiveContentFields();
      }
    });

    $('[data-content-fields]')?.addEventListener('input', (event) => {
      const changedCategoryField = event.target.closest('[data-content-repeat="gallery.filters"]');
      if (!changedCategoryField) return;
      siteContent = readContentForm();
      refreshCategorySelect();
      renderList();
    });

    $('[data-links-list]')?.addEventListener('input', () => {
      siteContent.links = readLinks();
    });

    $('[data-links-list]')?.addEventListener('click', (event) => {
      const removeButton = event.target.closest('[data-remove-link]');
      if (!removeButton) return;
      const links = readLinks();
      links.splice(Number(removeButton.dataset.removeLink), 1);
      siteContent.links = links;
      renderLinks();
    });

    $('[data-add-link]')?.addEventListener('click', () => {
      siteContent.links = [...readLinks(), { name: 'Yeni bağlantı', handle: '', type: 'Sosyal medya', url: '', description: '' }];
      renderLinks();
    });

    $('[data-save-links]')?.addEventListener('click', saveLinks);

    $('#fairImageFiles')?.addEventListener('change', async (event) => {
      const files = Array.from(event.target.files || []);
      if (!files.length) return;
      try {
        setNotice('Fuar fotoğrafları hazırlanıyor...', 'info');
        const prepared = [];
        for (const file of files) prepared.push(await compressImageFile(file, { targetBytes: 210 * 1024, hardLimitBytes: 260 * 1024, maxSide: 950, quality: 0.72 }));
        const existing = newlineToArray($('#fairImages').value);
        $('#fairImages').value = [...existing, ...prepared].join('\n');
        event.target.value = '';
        setNotice('Fuar fotoğrafları hazır. Fuarı kaydedince canlı siteye yansır.', 'success');
      } catch (error) {
        setNotice(error.message || 'Fuar fotoğrafı hazırlanamadı.', 'error');
      }
    });

    $('[data-fair-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const fair = readFairForm();
        await saveFair(fair);
        clearFairForm();
        setNotice('Fuar kaydedildi. Değişiklik canlı siteye yansır.', 'success');
      } catch (error) {
        setNotice(`Fuar kaydedilemedi: ${error.message}`, 'error');
      }
    });

    $('[data-new-fair]')?.addEventListener('click', clearFairForm);

    $('[data-fair-list]')?.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-fair-action]');
      if (!button) return;
      const { fairAction, id } = button.dataset;
      if (fairAction === 'edit') editFair(id);
      if (fairAction === 'delete') deleteFair(id);
      if (fairAction === 'duplicate') duplicateFair(id);
      if (fairAction === 'up') moveFair(id, -1);
      if (fairAction === 'down') moveFair(id, 1);
    });

    $('[data-export-json]')?.addEventListener('click', exportJson);
    $('[data-import-json]')?.addEventListener('change', (event) => importJson(event.target.files?.[0]));
  };

  init();
})();
