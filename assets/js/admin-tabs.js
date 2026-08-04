(function () {
  const STORAGE_KEY = 'studio-nes-admin-section';
  const VALID_TABS = ['products', 'visuals', 'reviews', 'content', 'links', 'fairs', 'journey'];

  const activate = (name, options = {}) => {
    const target = VALID_TABS.includes(name) ? name : 'products';
    document.querySelectorAll('[data-admin-tab]').forEach((button) => {
      const active = button.dataset.adminTab === target;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('[data-admin-section]').forEach((section) => {
      section.classList.toggle('is-active', section.dataset.adminSection === target);
    });
    sessionStorage.setItem(STORAGE_KEY, target);
    if (options.updateHash !== false) history.replaceState(null, '', `#${target}`);
    if (options.scroll) {
      document.querySelector('[data-admin-tabs]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  document.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-admin-tab]');
    if (tab) activate(tab.dataset.adminTab, { scroll: true });

    if (event.target.closest('[data-new-product]')) {
      activate('products', { scroll: true });
      window.setTimeout(() => document.querySelector('#title')?.focus(), 250);
    }
  });

  const hashTab = String(location.hash || '').replace('#', '');
  const savedTab = sessionStorage.getItem(STORAGE_KEY);
  activate(VALID_TABS.includes(hashTab) ? hashTab : (VALID_TABS.includes(savedTab) ? savedTab : 'products'), { updateHash: false });
})();
