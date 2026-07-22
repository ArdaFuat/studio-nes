NESS ART - CANLI ADMIN PANELLI SURUM
====================================

Bu paket Netlify gibi statik hostinglerde çalışır; ürün, site yazıları, bağlantılar, fuarlar ve ulaşılan şehir seçimleri Firebase üzerinden canlıya yansır.

Dosyalar
--------
- index.html: Ana sayfa
- galeri.html: Galeri sayfası
- yolculuk.html: Ulaşılan illeri koyu renkle gösteren 81 illi interaktif Türkiye haritası
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
5. Ulaşılan şehirler Firestore'daki "journeys" koleksiyonundan okunur.
6. Admin panelinde haritada renklenecek şehirler seçilir; eser, görsel veya açıklama eklenmez.
7. Admin panel ürün/site yazısı/bağlantı/fuar/şehir seçimi kaydedince Firestore'a yazar.
8. Görsel için bilgisayardan seçim yapabilir, assets/img/dosya.jpg yazabilir veya direkt https://... görsel linki kullanabilirsin.
9. Firestore boşsa site geçici olarak dosyadaki varsayılan ürün ve site yazılarını gösterir.

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


Görsel slotları notu
--------------------
- Ana sayfanın üst slider görselleri galeriden bağımsızdır; admin panelde Görsel slotları > Ana slider 3 görsel alanından çerçevesiz/özel görsel seçilebilir.
- Ana sayfadaki "Galeriden seçilen tablolar" bölümü tekrar galerideki ürün kartlarından gelir. Bu yüzden ürün görseli, fiyatı ve Shopier/Shopify bağlantısı galerideki ürün kaydından otomatik korunur.
- Bu bölümde hangi 3 ürünün görüneceğini admin panelde Görsel slotları > Galeriden seçilen tablolar sekmesinden seçebilirsin.


2026-07-04 düzeltmesi:
- Sayfa açılırken HTML içindeki eski sabit yazı/görsel artık görünmez.
- Site önce admin/Firebase içeriğini hazırlar, sonra tek seferde görünür hale gelir.
- Ana sayfa üst slider çerçevesiz görsel slotlarından gelir; “Galeriden seçilen tablolar” ise tekrar galeri ürünlerinden ve satış linklerinden gelir.


2026-07-22 Rotamız güncellemesi:
- Sekme adı “Rotamız” olarak değiştirildi.
- Harita, gerçek il sınırlarını kullanan doğru Türkiye silüetiyle 81 ili ayrı ayrı gösterir. Seçilen iller koyu renkle görünür.
- Şehre tıklanınca yalnızca şehir adı açılır.
- Sayaç seçili şehir / 81 biçimindedir.
- Eser kartları, hikâye, ilçe, tarih, görsel, son durak ve “Yeni Durak” alanları kaldırıldı.
- Admin panelinde yalnızca şehir seçimi yapılır.

2026-07-22 Gerçek harita geometrisi düzeltmesi:
- Kullanıcının gönderdiği MIT lisanslı SVG Türkiye Haritası kullanıldı.
- Önceki yaklaşık il şekilleri kaldırıldı; gerçek il sınırları ve doğru Türkiye silüeti yerel olarak pakete gömüldü.


ROTAMIZ FIRESTORE NOTU
----------------------
Rota ve şehir-tablo eşleştirmeleri siteContent/journeys belgesinde tutulur. Mevcut siteContent Firestore izni yeterlidir; journeys adında ayrı koleksiyon kuralı gerekmez.
