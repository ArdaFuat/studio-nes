(function () {
  const FIREBASE_COLLECTION = 'artworks';
  const SESSION_KEY = 'nessArtAdminEmail';

  let artworks = [];
  let editingId = null;
  let pendingImagePreviewUrl = '';
  let selectedImageDataUrl = '';
  let unsubscribeArtworks = null;
  let currentUser = null;

  const $ = (selector) => document.querySelector(selector);

  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

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
  const getCategoryLabel = (value) => (ARTWORK_CATEGORIES || []).find((item) => item.value === value)?.label || value;
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

  const compressImageFile = async (file) => {
    if (!file || !file.type?.startsWith('image/')) throw new Error('Lütfen JPG, PNG veya WEBP görsel seç.');
    const img = await loadImageFromFile(file);
    const targetBytes = 760 * 1024;
    let maxSide = 1300;
    let quality = 0.78;
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

    if (!blob || blob.size > 950 * 1024) {
      throw new Error('Görsel hâlâ çok büyük. Daha küçük bir görsel seç veya ekran görüntüsü yerine sıkıştırılmış JPG kullan.');
    }
    return blobToDataUrl(blob);
  };

  const friendlyAuthError = (error) => {
    const code = error?.code || '';
    const message = error?.message || String(error || 'Bilinmeyen hata');
    if (location.protocol === 'file:') {
      return 'Site dosyadan çift tıklanarak açılmış. Firebase girişi için Netlify adresinden ya da VS Code Live Server gibi http:// adresinden açmalısın.';
    }
    if (code.includes('operation-not-allowed')) {
      return 'Firebase Authentication içinde Email/Password giriş yöntemi açık değil. Authentication > Sign-in method > Email/Password bölümünü aktif et.';
    }
    if (code.includes('unauthorized-domain')) {
      return `Bu alan adı Firebase Auth için yetkili değil. Firebase > Authentication > Settings > Authorized domains kısmına ${location.hostname} domainini ekle.`;
    }
    if (code.includes('invalid-credential') || code.includes('user-not-found') || code.includes('wrong-password')) {
      return 'E-posta veya şifre hatalı. Firebase > Authentication > Users içinde bu mail için kullanıcı oluşturduğundan ve şifreyi doğru yazdığından emin ol.';
    }
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
    if (pendingImagePreviewUrl) URL.revokeObjectURL(pendingImagePreviewUrl);
    pendingImagePreviewUrl = '';
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
    const current = artworks.find((item) => item.id === editingId);
    const id = current?.id || `${slugify(title)}-${Date.now()}`;
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
    if (!art.short.trim()) return 'Kısa açıklama boş kalamaz.';
    if (!art.detail.trim()) return 'Detay açıklaması boş kalamaz.';
    return '';
  };

  const toFirestorePayload = (art) => {
    const { id, ...payload } = art;
    return {
      ...payload,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: currentUser?.email || ''
    };
  };

  const saveArtworkToFirebase = async (art) => {
    await db().collection(FIREBASE_COLLECTION).doc(art.id).set(toFirestorePayload(art), { merge: true });
    return art;
  };

  const editArtwork = (id) => {
    const art = artworks.find((item) => item.id === id);
    if (!art) return;
    editingId = id;
    if (pendingImagePreviewUrl) URL.revokeObjectURL(pendingImagePreviewUrl);
    pendingImagePreviewUrl = '';
    selectedImageDataUrl = '';
    const imageFileInput = $('#imageFile');
    if (imageFileInput) imageFileInput.value = '';
    $('[data-form-title]').textContent = 'Ürünü düzenle';
    $('[data-submit-label]').textContent = 'Değişiklikleri Kaydet';
    $('#title').value = art.title || '';
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
      await db().collection(FIREBASE_COLLECTION).doc(id).delete();
      if (editingId === id) clearForm();
      setNotice('Ürün silindi.', 'success');
    } catch (error) {
      setNotice(`Silinemedi: ${error.message}`, 'error');
    }
  };

  const duplicateArtwork = async (id) => {
    const art = artworks.find((item) => item.id === id);
    if (!art) return;
    const copy = normalizeArtwork({
      ...art,
      id: `${slugify(art.title)}-kopya-${Date.now()}`,
      title: `${art.title} Kopya`,
      order: artworks.length,
      updatedAt: ''
    }, artworks.length);
    try {
      await db().collection(FIREBASE_COLLECTION).doc(copy.id).set(toFirestorePayload(copy));
      setNotice('Ürün kopyalandı ve kaydedildi.', 'success');
    } catch (error) {
      setNotice(`Kopyalanamadı: ${error.message}`, 'error');
    }
  };

  const saveOrder = async (items) => {
    const batch = db().batch();
    items.forEach((item, order) => {
      batch.update(db().collection(FIREBASE_COLLECTION).doc(item.id), {
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
      await saveOrder(copy);
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
    unsubscribeArtworks = db().collection(FIREBASE_COLLECTION).orderBy('order', 'asc')
      .onSnapshot((snapshot) => {
        artworks = snapshot.docs.map((doc, index) => normalizeArtwork({ id: doc.id, ...doc.data() }, index));
        renderList();
      }, (error) => {
        setNotice(`Ürünler okunamadı: ${error.message}`, 'error');
      });
  };

  const exportJson = () => {
    const payload = JSON.stringify({ updatedAt: new Date().toISOString(), artworks: normalizeArtworks(artworks) }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'artworks-backup.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    setNotice('Yedek indirildi. Bu artık canlı sistem için sadece yedek amaçlıdır.', 'success');
  };

  const writeManyToFirebase = async (items, mode = 'merge') => {
    const normalized = normalizeArtworks(items);
    if (!normalized.length) throw new Error('Aktarılacak ürün bulunamadı.');
    const batch = db().batch();
    normalized.forEach((item, order) => {
      const art = { ...item, order };
      batch.set(db().collection(FIREBASE_COLLECTION).doc(art.id), toFirestorePayload(art), { merge: mode === 'merge' });
    });
    await batch.commit();
  };

  const importJson = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : parsed.artworks;
      if (!Array.isArray(items)) throw new Error('Geçersiz JSON');
      await writeManyToFirebase(items, 'merge');
      clearForm();
      setNotice('Yedek içe aktarıldı. Ürünler canlı sitede görünür.', 'success');
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

  const setLoggedInUi = (user) => {
    currentUser = user;
    sessionStorage.setItem(SESSION_KEY, user?.email || '');
    $('[data-login-panel]')?.setAttribute('hidden', '');
    $('[data-admin-panel]')?.removeAttribute('hidden');
    const emailNode = $('[data-admin-email]');
    if (emailNode) emailNode.textContent = user?.email || '-';
    setNotice('Giriş yapıldı. Kaydettiğin değişiklikler siteye yansır.', 'success');
    watchArtworks();
  };

  const logout = async () => {
    try {
      await auth().signOut();
    } finally {
      currentUser = null;
      sessionStorage.removeItem(SESSION_KEY);
      if (unsubscribeArtworks) unsubscribeArtworks();
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
    fillSelect('#category', ARTWORK_CATEGORIES, 'doga');
    fillSelect('#collection', ARTWORK_COLLECTIONS, 'ready');
    fillSelect('#technique', ARTWORK_TECHNIQUES, 'Akrilik boya');
    fillSelect('#status', ARTWORK_STATUSES, 'Satılık');
    fillSelect('#platform', SALES_PLATFORMS, '');
    renderList();
    clearForm();

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
        const msg = 'Bu e-posta admin listesinde yok. assets/js/firebase-config.js içindeki NESS_ADMIN_EMAILS listesine eklenmiş maille giriş yapmalısın; ruya@example.com sadece örnek placeholder.';
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

    $('#image')?.addEventListener('input', (event) => {
      if (pendingImagePreviewUrl) URL.revokeObjectURL(pendingImagePreviewUrl);
      pendingImagePreviewUrl = '';
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
      const art = readForm();
      const error = validateArtwork(art);
      if (error) {
        setNotice(error, 'error');
        return;
      }
      try {
        setBusy(true, 'Kaydediliyor...');
        await saveArtworkToFirebase(art);
        clearForm();
        setNotice('Kaydedildi. Değişiklik canlı siteye yansır.', 'success');
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

    $('[data-export-json]')?.addEventListener('click', exportJson);
    $('[data-import-json]')?.addEventListener('change', (event) => importJson(event.target.files?.[0]));
  };

  init();
})();
