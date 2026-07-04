NESS ART - CANLI ADMIN PANELLI SURUM
====================================

Bu paket Netlify gibi statik hostinglerde çalışır; ürün, site yazıları, bağlantılar ve fuar ekleme/silme/düzenleme işlemleri Firebase üzerinden canlıya yansır.

Dosyalar
--------
- index.html: Ana sayfa
- galeri.html: Galeri sayfası
- admin.html: Canlı ürün + site içeriği + bağlantı + fuar yönetim paneli
- assets/js/firebase-config.js: Firebase proje ayarları ve admin mail listesi
- assets/js/admin.js: Admin panel mantığı
- assets/js/main.js: Site ön yüzü, Firebase/JSON ürün + site içeriği + fuar okuma sistemi
- assets/data/artworks.json: Firebase boşken kullanılan yedek ilk ürün verisi

Nasıl çalışır?
--------------
1. Netlify sadece siteyi yayınlar.
2. Galeri ürünleri Firestore'daki "artworks" koleksiyonundan okunur.
3. Site metinleri ve bağlantılar Firestore'daki "siteContent/main" dokümanından okunur.
4. Fuarlar Firestore'daki "fairs" koleksiyonundan okunur.
5. Admin panel ürün/site yazısı/bağlantı/fuar kaydedince Firestore'a yazar.
6. Görsel için bilgisayardan seçim yapabilir, assets/img/dosya.jpg yazabilir veya direkt https://... görsel linki kullanabilirsin.
7. Firestore boşsa site geçici olarak dosyadaki varsayılan ürün ve site yazılarını gösterir.

Kurulum için FIREBASE_KURULUM.txt dosyasındaki adımları takip et.

Admin adresi
------------
Netlify'a yükledikten sonra:
site-adresin.netlify.app/admin.html

Önemli
------
- assets/js/firebase-config.js içine Firebase config bilgilerini yapıştırmadan canlı admin açılmaz.
- Admin mailleri firebase-config.js içinde hazırdır; aynı mailler Firebase Authentication kullanıcılarında ve Firestore kurallarında da bulunmalıdır.
- Admin şifresi dosyada tutulmaz; Firebase Authentication içinden oluşturulur/değiştirilir.
- "İlk Ürünleri Aktar" butonuna ilk kurulumda bir kere basman yeterli.
- "Site yazıları" alanındaki "Varsayılanı Aktar" butonuna da bir kere basarsan tüm metinler Firestore'a alınır ve admin panelden değiştirilebilir olur.


GÜNCEL NOT:
Bu sürüm Firebase Storage kullanmaz. Admin panelde bilgisayardan görsel seçebilirsin; görsel tarayıcıda küçültülüp Firestore kaydına eklenir. Çok büyük görselde hata verirse daha küçük JPG seç. Çok fazla fuar fotoğrafı için direkt .jpg/.png/.webp URL kullanmak daha sağlıklıdır.
