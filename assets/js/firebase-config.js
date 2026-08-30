// Ness Art canlı admin sistemi ayarları
// Firebase Console > Project settings > Your apps > Web app kısmındaki firebaseConfig objesini buraya yapıştır.
// Bu değerler gizli şifre değildir; asıl güvenlik Firestore kurallarındadır.
window.NESS_FIREBASE_CONFIG = {
  apiKey: "AIzaSyB_Ng62Wyvmpj9VtfnypslG-1tw5c8TasQ",
  authDomain: "ness-art.firebaseapp.com",
  projectId: "ness-art",
  storageBucket: "ness-art.firebasestorage.app",
  messagingSenderId: "788143330555",
  appId: "1:788143330555:web:d027d682e6cb35d7dd8c5e",
  measurementId: "G-5G95KT6Y99"
};

// Admin paneline girebilecek mailler.
// Firebase Authentication içinde bu mailler için Email/Password kullanıcı hesabı açmalısın.
window.NESS_ADMIN_EMAILS = [
  "ardamevk12@gmail.com",
  "ardabesiktasarda@gmail.com",
  "nesibeyakann@gmail.com"
];

window.NESS_FIREBASE_IS_CONFIGURED = function () {
  const cfg = window.NESS_FIREBASE_CONFIG || {};
  return Boolean(
    cfg.apiKey &&
    cfg.projectId &&
    cfg.appId &&
    !String(cfg.apiKey).includes("BURAYA") &&
    !String(cfg.projectId).includes("BURAYA") &&
    !String(cfg.appId).includes("BURAYA")
  );
};

// Firebase'i sayfadaki diger kodlardan once tek noktadan baslat.
// Firestore'un varsayilan streaming tasimasi bazi mobil Safari / operator
// kombinasyonlarinda ilk acilista kopabiliyor. Auto-detect gerekli oldugunda
// long-polling'e gecerek ayni verinin yenileme gerektirmeden gelmesini saglar.
window.NESS_GET_FIRESTORE = function () {
  try {
    if (typeof firebase === 'undefined' || !window.NESS_FIREBASE_IS_CONFIGURED()) return null;
    if (!firebase.apps.length) firebase.initializeApp(window.NESS_FIREBASE_CONFIG);
    const db = firebase.firestore();

    if (!window.__NESS_FIRESTORE_TRANSPORT_CONFIGURED) {
      try {
        const mobileTransport = Boolean(
          (window.matchMedia && window.matchMedia('(max-width: 820px)').matches) ||
          /Android|iPhone|iPod/i.test(navigator.userAgent || '')
        );
        db.settings(mobileTransport ? {
          // Mobil operator/proxy katmanlarinda streaming baglantisinin ilk acilista
          // dusmesini engellemek icin telefonda long-polling'i dogrudan kullan.
          experimentalForceLongPolling: true,
          experimentalLongPollingOptions: { timeoutSeconds: 25 },
          ignoreUndefinedProperties: true
        } : {
          experimentalAutoDetectLongPolling: true,
          ignoreUndefinedProperties: true
        });
      } catch (error) {
        // Firestore baska bir kod tarafindan coktan kullanilmaya basladiysa settings
        // yeniden verilemez. Bu durumda mevcut instance ile devam etmek guvenlidir.
        if (!/already|started|settings/i.test(String(error && error.message || error))) {
          console.warn('Firestore mobil baglanti ayari uygulanamadi:', error);
        }
      }
      window.__NESS_FIRESTORE_TRANSPORT_CONFIGURED = true;
    }

    return db;
  } catch (error) {
    console.warn('Firebase baglantisi hazirlanamadi:', error);
    return null;
  }
};

// SDK bu dosyadan once yukleniyor; init burada senkron yapilir. Sonraki tick'te
// tum sayfa modullerine hazir sinyali verilir.
window.NESS_GET_FIRESTORE();
window.setTimeout(function () {
  window.dispatchEvent(new Event('ness:firebase-ready'));
}, 0);
