(function () {
  const JOURNEY_COLLECTION = 'journeys';
  const ARTWORK_COLLECTION = 'artworks';
  const TOTAL_CITIES = 81;
  let journeyByCity = new Map();
  let artworks = [];
  let currentUser = null;
  let unsubscribeItems = null;
  let unsubscribeArtworks = null;
  let isSaving = false;

  const $ = (selector) => document.querySelector(selector);
  const fold = (value = '') => String(value)
    .trim().toLocaleLowerCase('tr-TR')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c');

  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const cities = () => [...(window.TURKEY_CITIES || [])]
    .filter((city, index, list) => list.findIndex((item) => item.id === city.id) === index)
    .sort((a, b) => a.id - b.id);

  const resolveCity = (value = '') => {
    const key = fold(value);
    const aliases = { afyon: 'Afyonkarahisar', icel: 'Mersin', maras: 'Kahramanmaraş', 'k maras': 'Kahramanmaraş', hakkari: 'Hakkâri' };
    if (aliases[key]) return aliases[key];
    return cities().find((city) => fold(city.name) === key)?.name || '';
  };

  const normalizeArtwork = (art = {}, index = 0) => ({
    id: String(art.id || '').trim(),
    title: String(art.title || 'İsimsiz tablo').trim(),
    image: String(art.image || 'assets/img/ness-logo.png').trim(),
    hidden: Boolean(art.hidden),
    order: Number.isFinite(Number(art.order)) ? Number(art.order) : index
  });

  const normalizeArtworks = (items) => (Array.isArray(items) ? items : [])
    .map(normalizeArtwork)
    .filter((art) => art.id)
    .sort((a, b) => a.order - b.order);

  const normalizeJourneyItems = (items) => {
    const next = new Map();
    (Array.isArray(items) ? items : []).forEach((item, index) => {
      if (item?.visible === false) return;
      const city = resolveCity(typeof item === 'string' ? item : item?.city);
      if (!city) return;
      next.set(city, {
        city,
        visible: true,
        order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index,
        disclosure: item?.disclosure === 'private' ? 'private' : 'public',
        artworkIds: Array.isArray(item?.artworkIds)
          ? [...new Set(item.artworkIds.map((id) => String(id || '').trim()).filter(Boolean))]
          : []
      });
    });
    return next;
  };

  const allowed = (email) => (window.NESS_ADMIN_EMAILS || [])
    .map((item) => String(item).toLowerCase())
    .includes(String(email || '').toLowerCase());

  const db = () => firebase.firestore();

  const notice = (message, type = 'info') => {
    const node = $('[data-admin-notice]');
    if (!node) return;
    node.textContent = message;
    node.className = `admin-notice ${type}`;
    if (message) node.removeAttribute('hidden'); else node.setAttribute('hidden', '');
  };

  const getSortedRecords = () => cities()
    .filter((city) => journeyByCity.has(city.name))
    .map((city) => journeyByCity.get(city.name));

  const renderCitySelector = () => {
    const target = $('[data-journey-city-selector]');
    const count = $('[data-journey-admin-count]');
    if (count) count.textContent = `${journeyByCity.size} / ${TOTAL_CITIES}`;
    if (!target) return;

    target.innerHTML = cities().map((city) => {
      const checked = journeyByCity.has(city.name);
      return `<label class="journey-city-choice${checked ? ' is-selected' : ''}" data-city-search="${fold(city.name)}">
        <input type="checkbox" value="${escapeHtml(city.name)}" ${checked ? 'checked' : ''}>
        <span class="journey-city-plate">${String(city.id).padStart(2, '0')}</span>
        <span class="journey-city-name">${escapeHtml(city.name)}</span>
      </label>`;
    }).join('');
    filterCities($('#journeyCitySearch')?.value || '');
  };

  const artworkChoiceHtml = (art, selectedIds, disabled) => {
    const checked = selectedIds.includes(art.id);
    return `<label class="journey-artwork-choice${checked ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}">
      <input type="checkbox" value="${escapeHtml(art.id)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
      <img src="${escapeHtml(art.image)}" alt="" loading="lazy">
      <span><strong>${escapeHtml(art.title)}</strong>${art.hidden ? '<small>Galeride gizli</small>' : ''}</span>
    </label>`;
  };

  const renderCityDetails = () => {
    const target = $('[data-journey-city-configs]');
    if (!target) return;
    const records = getSortedRecords();
    if (!records.length) {
      target.innerHTML = '<div class="journey-city-config-empty">Önce yukarıdan haritada gösterilecek bir şehir seç.</div>';
      return;
    }

    target.innerHTML = records.map((record) => {
      const cityMeta = cities().find((city) => city.name === record.city);
      const isPrivate = record.disclosure === 'private';
      const choices = artworks.length
        ? artworks.map((art) => artworkChoiceHtml(art, record.artworkIds, isPrivate)).join('')
        : '<p class="journey-artwork-empty">Galeride henüz seçilebilecek tablo bulunmuyor.</p>';
      return `<section class="journey-city-config" data-journey-city-config="${escapeHtml(record.city)}">
        <div class="journey-city-config-head">
          <div><span>${String(cityMeta?.id || '').padStart(2, '0')}</span><div><small>Şehir</small><h3>${escapeHtml(record.city)}</h3></div></div>
          <button type="button" class="btn ghost small-btn" data-remove-journey-city="${escapeHtml(record.city)}">Haritadan Kaldır</button>
        </div>
        <div class="journey-disclosure-options" role="radiogroup" aria-label="${escapeHtml(record.city)} eser görünürlüğü">
          <label class="${isPrivate ? '' : 'is-selected'}">
            <input type="radio" name="journey-disclosure-${cityMeta?.id}" value="public" ${isPrivate ? '' : 'checked'}>
            <span><strong>Seçtiğim tabloları göster</strong><small>Haritada küçük görseli ve tablo adı görünür.</small></span>
          </label>
          <label class="${isPrivate ? 'is-selected' : ''}">
            <input type="radio" name="journey-disclosure-${cityMeta?.id}" value="private" ${isPrivate ? 'checked' : ''}>
            <span><strong>Belirtmek istemiyoruz</strong><small>Yalnızca bu şehirde bir tablo olduğu anlaşılır.</small></span>
          </label>
        </div>
        <div class="journey-artwork-picker${isPrivate ? ' is-disabled' : ''}">
          <div class="journey-artwork-picker-title"><strong>Bu şehirdeki tablolar</strong><span>${record.artworkIds.length} seçili</span></div>
          <div class="journey-artwork-grid">${choices}</div>
          <p class="field-hint">Hiç tablo seçmeden de kaydedebilirsin. Bu durumda haritada yalnızca şehir adı ve “Tablo bilgisi belirtilmedi” yazısı görünür.</p>
        </div>
      </section>`;
    }).join('');
  };

  const render = () => {
    renderCitySelector();
    renderCityDetails();
  };

  const filterCities = (query) => {
    const key = fold(query);
    document.querySelectorAll('.journey-city-choice').forEach((label) => {
      label.hidden = Boolean(key && !label.dataset.citySearch.includes(key));
    });
  };

  const setSaving = (saving) => {
    isSaving = saving;
    const submit = $('[data-journey-submit]');
    if (submit) {
      submit.disabled = saving;
      submit.textContent = saving ? 'Kaydediliyor…' : 'Rotayı Kaydet';
    }
  };

  const commitDeletes = async (docs) => {
    for (let start = 0; start < docs.length; start += 400) {
      const batch = db().batch();
      docs.slice(start, start + 400).forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  };

  const commitRecords = async (records) => {
    for (let start = 0; start < records.length; start += 400) {
      const batch = db().batch();
      records.slice(start, start + 400).forEach((record) => {
        const city = cities().find((item) => item.name === record.city);
        if (!city) return;
        const ref = db().collection(JOURNEY_COLLECTION).doc(`city-${String(city.id).padStart(2, '0')}`);
        batch.set(ref, {
          city: city.name,
          visible: true,
          order: city.id,
          disclosure: record.disclosure === 'private' ? 'private' : 'public',
          artworkIds: [...new Set(record.artworkIds || [])],
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: currentUser?.email || ''
        });
      });
      await batch.commit();
    }
  };

  const saveRecords = async (records, successMessage = 'Rotamız kaydedildi. Harita canlı olarak güncellenecek.') => {
    if (!currentUser) throw new Error('Bu işlem için admin girişi gerekli.');
    if (isSaving) return;
    setSaving(true);
    try {
      const normalized = normalizeJourneyItems(records);
      const next = cities()
        .filter((city) => normalized.has(city.name))
        .map((city) => ({ ...normalized.get(city.name), order: city.id }));
      const snapshot = await db().collection(JOURNEY_COLLECTION).get();
      await commitDeletes(snapshot.docs);
      await commitRecords(next);
      journeyByCity = new Map(next.map((item) => [item.city, item]));
      render();
      notice(successMessage, 'success');
    } finally {
      setSaving(false);
    }
  };

  const watch = () => {
    unsubscribeItems?.();
    unsubscribeArtworks?.();
    unsubscribeItems = db().collection(JOURNEY_COLLECTION).onSnapshot((snapshot) => {
      journeyByCity = normalizeJourneyItems(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      render();
    }, (error) => notice(`Şehirler okunamadı: ${error.message}`, 'error'));
    unsubscribeArtworks = db().collection(ARTWORK_COLLECTION).orderBy('order', 'asc').onSnapshot((snapshot) => {
      artworks = normalizeArtworks(snapshot.docs.map((doc, index) => ({ id: doc.id, ...doc.data(), order: doc.data().order ?? index })));
      renderCityDetails();
    }, (error) => notice(`Galerideki tablolar okunamadı: ${error.message}`, 'error'));
  };

  const importItems = async (incoming) => {
    await saveRecords(incoming, 'Yedekteki rota ve tablo seçimleri aktarıldı.');
  };

  window.NESS_JOURNEY_MANAGER = {
    getItems: () => getSortedRecords().map((record) => ({
      id: `city-${String(cities().find((city) => city.name === record.city)?.id || '').padStart(2, '0')}`,
      city: record.city,
      visible: true,
      order: cities().find((city) => city.name === record.city)?.id || 0,
      disclosure: record.disclosure,
      artworkIds: [...record.artworkIds]
    })),
    importItems
  };

  const updateRecordFromConfig = (config) => {
    const city = config?.dataset.journeyCityConfig;
    const record = journeyByCity.get(city);
    if (!city || !record) return null;
    return record;
  };

  const init = () => {
    artworks = normalizeArtworks(typeof ARTWORKS !== 'undefined' ? ARTWORKS : []);
    journeyByCity = normalizeJourneyItems(typeof DEFAULT_JOURNEYS !== 'undefined' ? DEFAULT_JOURNEYS : []);
    render();

    $('[data-journey-city-selector]')?.addEventListener('change', (event) => {
      const input = event.target.closest('input[type="checkbox"]');
      if (!input) return;
      const city = resolveCity(input.value);
      if (!city) return;
      if (input.checked) {
        const cityMeta = cities().find((item) => item.name === city);
        journeyByCity.set(city, { city, visible: true, order: cityMeta?.id || 0, disclosure: 'public', artworkIds: [] });
      } else {
        journeyByCity.delete(city);
      }
      input.closest('.journey-city-choice')?.classList.toggle('is-selected', input.checked);
      const count = $('[data-journey-admin-count]');
      if (count) count.textContent = `${journeyByCity.size} / ${TOTAL_CITIES}`;
      renderCityDetails();
    });

    $('#journeyCitySearch')?.addEventListener('input', (event) => filterCities(event.target.value));

    $('[data-journey-city-configs]')?.addEventListener('change', (event) => {
      const config = event.target.closest('[data-journey-city-config]');
      const record = updateRecordFromConfig(config);
      if (!record) return;

      if (event.target.matches('input[type="radio"]')) {
        record.disclosure = event.target.value === 'private' ? 'private' : 'public';
        renderCityDetails();
        return;
      }

      if (event.target.matches('.journey-artwork-choice input[type="checkbox"]')) {
        const id = event.target.value;
        const next = new Set(record.artworkIds);
        if (event.target.checked) next.add(id); else next.delete(id);
        record.artworkIds = [...next];
        event.target.closest('.journey-artwork-choice')?.classList.toggle('is-selected', event.target.checked);
        const label = config.querySelector('.journey-artwork-picker-title span');
        if (label) label.textContent = `${record.artworkIds.length} seçili`;
      }
    });

    $('[data-journey-city-configs]')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove-journey-city]');
      if (!button) return;
      journeyByCity.delete(button.dataset.removeJourneyCity);
      render();
    });

    $('[data-journey-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await saveRecords(getSortedRecords());
      } catch (error) {
        notice(`Kaydedilemedi: ${error.message}`, 'error');
      }
    });

    $('[data-clear-journeys]')?.addEventListener('click', () => {
      if (!window.confirm('Rotadaki şehirlerin tamamı temizlensin mi?')) return;
      journeyByCity = new Map();
      render();
    });

    try {
      if (!firebase.apps.length) firebase.initializeApp(window.NESS_FIREBASE_CONFIG);
      firebase.auth().onAuthStateChanged((user) => {
        currentUser = user && allowed(user.email) ? user : null;
        if (currentUser) watch();
        else {
          unsubscribeItems?.();
          unsubscribeArtworks?.();
        }
      });
    } catch (error) {
      console.warn('Rotamız admin modülü başlatılamadı:', error);
    }
  };

  init();
})();
