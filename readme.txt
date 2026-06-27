NESS ART - CANLI ADMIN PANELLI SURUM
====================================

Bu paket Netlify gibi statik hostinglerde çalışır; ürün ekleme/silme/düzenleme işlemleri Firebase üzerinden canlıya yansır.

Dosyalar
--------
- index.html: Ana sayfa
- galeri.html: Galeri sayfası
- admin.html: Canlı ürün yönetim paneli
- assets/js/firebase-config.js: Firebase proje ayarları ve admin mail listesi
- assets/js/admin.js: Admin panel mantığı
- assets/js/main.js: Site ön yüzü, Firebase/JSON ürün okuma sistemi
- assets/data/artworks.json: Firebase boşken kullanılan yedek ilk ürün verisi

Nasıl çalışır?
--------------
1. Netlify sadece siteyi yayınlar.
2. Galeri ürünleri Firestore'daki "artworks" koleksiyonundan okunur.
3. Admin panel ürün kaydedince Firestore'a yazar.
4. Görsel için assets/img/dosya.jpg veya direkt https://... görsel linki yazılır. Firebase Firestore kullanılmaz.
5. Firestore boşsa site geçici olarak assets/data/artworks.json dosyasındaki ürünleri gösterir.

Kurulum için FIREBASE_KURULUM.txt dosyasındaki adımları takip et.

Admin adresi
------------
Netlify'a yükledikten sonra:
site-adresin.netlify.app/admin.html

Önemli
------
- assets/js/firebase-config.js içine Firebase config bilgilerini yapıştırmadan canlı admin açılmaz.
- Nesibe'nin gerçek mailini hem firebase-config.js içinde hem Firebase kurallarında "nesibe@example.com" yerine yazmalısın. Arda için ardamevk12@gmail.com admin listesine eklendi.
- Admin şifresi dosyada tutulmaz; Firebase Authentication içinden oluşturulur/değiştirilir.
- "İlk Ürünleri Firebase’e Aktar" butonuna ilk kurulumda bir kere basman yeterli.


GÜNCEL NOT:
Bu sürüm Firebase Storage kullanmaz. Admin panelde bilgisayardan görsel seçebilirsin; görsel tarayıcıda küçültülüp Firestore ürün kaydına eklenir. Çok büyük görselde hata verirse daha küçük JPG seç. İstersen yine direkt .jpg/.png/.webp URL de yazabilirsin.
