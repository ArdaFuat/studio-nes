(function () {
  if (!window.matchMedia || !window.matchMedia('(max-width: 760px)').matches) return;

  const CACHE_KEY = 'studio-nes-public-cache-v6-cat-dedupe';
  const pathGet = (obj, path) => String(path || '').split('.').reduce((acc, part) => (
    acc && acc[part] !== undefined ? acc[part] : undefined
  ), obj);

  try {
    const raw = window.localStorage && window.localStorage.getItem(CACHE_KEY);
    const cached = raw ? JSON.parse(raw) : null;
    const content = cached && cached.siteContent;
    if (content) {
      document.querySelectorAll('[data-content]').forEach((node) => {
        const value = pathGet(content, node.dataset.content);
        if (value !== undefined && value !== null && typeof value !== 'object') {
          node.textContent = String(value);
        }
      });
    }
  } catch (_) {
    // Cache okunamazsa HTML içindeki mevcut içerik anında görünür.
  }

  document.querySelectorAll('[data-year]').forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });

  const body = document.body;
  if (body) {
    body.classList.remove('content-pending');
    body.classList.add('content-settled');
  }

  const nodes = Array.from(document.querySelectorAll('.reveal'));
  if (!('IntersectionObserver' in window)) {
    nodes.forEach((node) => node.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  nodes.forEach((node) => observer.observe(node));
})();
