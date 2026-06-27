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
