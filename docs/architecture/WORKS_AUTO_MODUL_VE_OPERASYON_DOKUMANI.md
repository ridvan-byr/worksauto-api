# WorksAuto Oto Servis Yönetim Sistemi — 8 Temel Modül ve 144 Operasyon Rehberi

Bu rehber; WorksAuto mimari diyagramında yer alan **8 ana modülü**, **24 alt kategoriyi** ve **144 operasyonun tamamını** zengin, renkli ve net bir biçimlendirmeyle açıklar.

> **Not:** Mimari çizimler (`.drawio`, `.svg`, `.png`, `.html`) ile birebir aynı terminolojiye ve sıralamaya sahiptir.

---

## ⚡ 10 Adımlı Uçtan Uca İstek İşleme Hattı

Servis ekranında bir işlem yapıldığında (örneğin fatura kesildiğinde veya parça eklendiğinde), arka planda şu 10 adım sırasıyla çalışır:

1. **Web Arayüzü (`Next.js 16`):** Danışman veya ustanın ekranındaki formdan istek başlatılır.
2. **Güvenlik Kapısı (`Edge Middleware`):** Kullanıcının oturumunun geçerli olup olmadığı kontrol edilir.
3. **Ağ Koruması (`CORS & HSTS`):** Dışarıdan gelebilecek yetkisiz erişimler engellenir.
4. **Kimlik Teyidi (`JWT Guard`):** İsteği yapan personelin hangi servise (`tenantId`) ait olduğu belirlenir.
5. **Mükerrer İşlem Kilidi (`Redis Idempotency`):** Butona peş peşe basılsa bile çift işlem yapılması önlenir.
6. **Veri Doğrulama (`DTO Validator`):** Telefon, plaka, şasi no veya tutarların doğruluğu denetlenir.
7. **Yönlendirici (`Controller`):** İstek ilgili servis modülüne yönlendirilir.
8. **İş Mantığı (`Domain UseCase`):** Otomatik stok düşümü, borç hesaplama veya randevu çakışma kuralları çalıştırılır.
9. **Veritabanı İzolasyonu (`Postgres & Prisma`):** Sadece o servisin kendi veritabanı satırları güncellenir (`WHERE tenantId = ...`).
10. **Canlı Bildirim & SMS (`WebSocket / BullMQ`):** Ustanın ekranına anlık bildirim düşer, araç sahibine SMS gider.

---

## 📋 8 Ana Modül ve 24 Çalışma Alanına Genel Bakış

* **👥 1. Customers (Müşteri & Cari Yönetimi)** — *(18 Operasyon)*
  * 🔹 **Müşteri CRUD** *(6 Operasyon)*
  * 🔹 **Toplu & Hızlı Kayıt** *(6 Operasyon)*
  * 🔹 **Cari & İstatistik** *(6 Operasyon)*

* **🚗 2. Vehicles / Cars (Araç Yönetimi)** — *(18 Operasyon)*
  * 🔹 **Araç CRUD** *(6 Operasyon)*
  * 🔹 **Plaka & Doğrulama** *(6 Operasyon)*
  * 🔹 **Servis Geçmişi** *(6 Operasyon)*

* **🔧 3. Work Orders (Atölye İş Emirleri & Lift)** — *(18 Operasyon)*
  * 🔹 **İş Emri Yaşam Döngüsü** *(6 Operasyon)*
  * 🔹 **Parça & Stok Senkronu** *(6 Operasyon)*
  * 🔹 **Ekspertiz & Usta** *(6 Operasyon)*

* **📅 4. Appointments (Randevu & Kapasite)** — *(18 Operasyon)*
  * 🔹 **Randevu Takvimi** *(6 Operasyon)*
  * 🔹 **Online Web Randevu** *(6 Operasyon)*
  * 🔹 **Çakışma & Kapasite** *(6 Operasyon)*

* **📦 5. Inventory (Yedek Parça & Depo)** — *(18 Operasyon)*
  * 🔹 **Parça Kataloğu** *(6 Operasyon)*
  * 🔹 **Stok Hareketleri** *(6 Operasyon)*
  * 🔹 **Depo & Kritik Seviye** *(6 Operasyon)*

* **💳 6. Billing & Invoices (Fatura & Kasa)** — *(18 Operasyon)*
  * 🔹 **Fatura İşlemleri** *(6 Operasyon)*
  * 🔹 **Tahsilat & POS** *(6 Operasyon)*
  * 🔹 **Finans & Alacaklar** *(6 Operasyon)*

* **🔐 7. Auth & Multi-Tenancy (Güvenlik)** — *(18 Operasyon)*
  * 🔹 **Oturum & Kimlik** *(6 Operasyon)*
  * 🔹 **Kiracı İzolasyonu** *(6 Operasyon)*
  * 🔹 **Personel & Yetki (RBAC)** *(6 Operasyon)*

* **🛡️ 8. Audit & Platform Admin (Yönetim)** — *(18 Operasyon)*
  * 🔹 **Denetim Günlüğü** *(6 Operasyon)*
  * 🔹 **Süper Yönetici** *(6 Operasyon)*
  * 🔹 **Platform Metrikleri** *(6 Operasyon)*

**Toplam Kapasite:** 8 Ana Modül • 24 Alt Kategori • 144 Profesyonel Operasyon

---

# 📚 Modüller ve 144 Operasyonun Detaylı Açıklamaları

## 👥 1. Customers (Müşteri & Cari Yönetimi)

### 🔹 Müşteri CRUD

* **`get_customer_list`** — **Müşteri Listeleme & Arama:** Servise kayıtlı tüm müşterileri isim, telefon, plaka veya vergi no ile arar ve sayfalı listeler.
* **`get_customer_info`** — **Müşteri Detay Kartı:** Müşterinin kimlik, iletişim, adına kayıtlı tüm araçlar ve açık iş emirlerini görüntüler.
* **`add_customer`** — **Yeni Müşteri Kaydı:** TC Kimlik No veya kurumsal Vergi No doğrulamasıyla sisteme yeni müşteri kartı açar.
* **`update_customer`** — **Müşteri Güncelleme:** Müşterinin adres, telefon, e-posta veya fatura unvanı bilgilerini günceller.
* **`del_customer`** — **Müşteri Silme:** Hatalı açılan müşteri kartını siler; ilişkili faturası varsa silinmesini engeller.
* **`anonymize_customer`** — **Müşteri Verisi Anonimleştirme (KVKK):** İlişkili faturası olan eski müşterilerin kişisel verilerini yasal KVKK mevzuatına uygun olarak gizler/anonimleştirir.

### 🔹 Toplu & Hızlı Kayıt

* **`add_quick_lead`** — **Hızlı Müşteri Girişi:** Kapıdan acil giren araçlar için yalnızca İsim ve Telefon alarak saniyeler içinde geçici müşteri oluşturur.
* **`batch_import_excel`** — **Excel ile Toplu Müşteri Yükleme:** Eski servis yazılımından dışa aktarılan binlerce müşteriyi tek seferde sisteme yükler.
* **`find_by_phone`** — **Arayan Numaradan Bulma (Caller-ID):** Telefon çaldığında arayan numaradan müşteriyi ve kayıtlı araçlarını ekrana yansıtır.
* **`validate_tax_number`** — **Vergi Kimlik Numarası Doğrulama:** Kurumsal firmaların 10 haneli VKN numarasını resmi doğrulama algoritmasıyla teyit eder.
* **`export_customers`** — **Müşteri Listesini Dışa Aktarma:** Müşteri veritabanını muhasebe veya SMS kampanyası için Excel/CSV olarak indirir.
* **`export_customer_statement`** — **Resmi Cari Hesap Ekstresi:** Müşterinin servis işlemlerini, ödemelerini ve borç-alacak bakiyesini gösteren resmi PDF ekstre üretir.

### 🔹 Cari & İstatistik

* **`get_customer_stats`** — **Müşteri Ciro & Sadakat Analizi:** Müşterinin servise toplam kaç kez geldiğini, toplam harcamasını ve ortalama sepet değerini hesaplar.
* **`get_current_account`** — **Cari Cüzdan & Bakiye:** Müşterinin güncel borç, alacak ve açık hesap (veresiye) bakiyesini gösterir.
* **`add_cari_movement`** — **Manuel Borç / Alacak İşleme:** Fatura dışı özel ödemeleri (senet, çek, elden nakit avans) cari hesaba kaydeder.
* **`get_cari_movements`** — **Cari Hesap Hareket Dökümü:** Müşterinin geçmiş tüm fatura, tahsilat ve alacak kayıtlarını tarih sırasıyla listeler.
* **`calc_customer_debt`** — **Vadesi Geçmiş Borç Hesaplama:** Müşterinin vadesi geçmiş borçları ile henüz vadesi gelmemiş açık faturalarını ayrıştırıp risk analizi yapar.
* **`check_credit_limit`** — **Veresiye Kredi Limiti Denetimi:** Kurumsal veya daimi müşterinin açık hesap limitini (örn: 50.000 TL) denetler; aşımda uyarı verir.

---

## 🚗 2. Vehicles / Cars (Araç Yönetimi)

### 🔹 Araç CRUD

* **`get_car_list`** — **Araç Listeleme & Filtreleme:** Servisteki tüm araçları plaka, marka, model veya şasi numarasına göre listeler.
* **`get_car_info`** — **Araç Detay Kartı:** Aracın sahibini, motor kodunu, şasi numarasını, rengini ve güncel kilometresini gösterir.
* **`add_car`** — **Yeni Araç Kaydı:** Plakası girilen yeni bir aracı sahibinin müşteri kartına bağlayarak kaydeder.
* **`update_car`** — **Araç Kartı Güncelleme:** Plaka değişikliği, renk değişimi veya ruhsat bilgisi güncellemelerini işler.
* **`del_car`** — **Araç Silme:** Hatalı veya mükerrer girilen araç kartını sistemden kaldırır.
* **`get_customer_cars`** — **Müşteriye Ait Araçları Getirme:** Seçilen bir müşterinin adına kayıtlı olan tüm araçların listesini verir.

### 🔹 Plaka & Doğrulama

* **`find_by_plate`** — **Plakadan Hızlı Araç Bulma:** Servise giren aracın plakası yazıldığı anda araç profilini 1 saniyede ekrana açar.
* **`validate_plate_format`** — **Plaka Standart Doğrulama:** Girilen plakanın resmi harf-sayı-boşluk standartlarına uygunluğunu teyit eder.
* **`update_odometer_km`** — **Kilometre Güncelleme:** Araç her servise girdiğinde güncel gösterge saatini sisteme işler.
* **`validate_vin_format`** — **ISO 3779 Şasi (VIN) Doğrulama:** Ruhsattaki 17 haneli şasi numarasının kontrol basamağını matematiksel olarak doğrular; yanlış parça siparişini önler.
* **`check_fuel_type`** — **Yakıt & Motor Tipi Tespiti:** Benzin, dizel, hibrit veya elektrikli motor tipini teyit ederek iş güvenliği protokollerini başlatır.
* **`export_vehicles`** — **Araç Veritabanını Dışa Aktarma:** Servise kayıtlı araçların künyesini Excel formatında dışa aktarır.

### 🔹 Servis Geçmişi

* **`get_service_history`** — **Dijital Servis Karnesi:** Aracın ilk günden bu yana hangi tarihte hangi ustanın elinden geçtiğini ve değişen tüm parçaları listeler.
* **`get_car_work_orders`** — **Aracın Tüm İş Emirleri:** Araca bugüne kadar açılmış açık ve kapalı tüm iş emirlerini kronolojik sıralar.
* **`get_car_appointments`** — **Aracın Randevu Geçmişi:** Araca ait geçmiş ve planlanan gelecek randevuların listesini sunar.
* **`link_to_work_order`** — **İş Emrine Araç Bağlama:** Aracı serviste başlatılan yeni bir tamir sürecine resmen bağlar.
* **`get_last_service_date`** — **Son Servis Zamanı & Hatırlatıcı:** Aracın en son hangi tarihte periyodik bakıma girdiğini tespit eder; 1 yıl dolunca bakım hatırlatması tetikler.
* **`get_odometer_history`** — **Kilometre Düşürülme Alarmı:** Aracın geçmiş kilometrelerini inceler; yeni girilen km eskiden düşükse sisteme sahtecilik uyarısı düşürür.

---

## 🔧 3. Work Orders (Atölye İş Emirleri & Lift)

### 🔹 İş Emri Yaşam Döngüsü

* **`get_work_order_list`** — **İş Emirleri Listesi & Pano:** Açık, onarımda, parça bekleyen ve biten işleri Kanban panosu veya liste olarak sunar.
* **`get_work_order_detail`** — **İş Emri Detay Fişi:** İş emrinde yapılan işçilikleri, takılan parçaları, müşteri şikayetlerini ve maliyetleri görüntüler.
* **`create_work_order`** — **Yeni İş Emri Açma:** Müşteri şikayeti ve araç ön kabul bilgileriyle yeni bir atölye iş emri başlatır.
* **`update_order_status`** — **Aşama İlerlemesi (Statü):** İş emrini Kabul ➔ Teşhis ➔ Parça Bekliyor ➔ Onarımda ➔ Test ➔ Tamamlandı aşamalarında ilerletir.
* **`complete_work_order`** — **İş Emrini Tamamlama:** Tüm işlemler bittiğinde iş emrini kapatır ve kalite kontrol onayına sunar.
* **`rollback_work_order`** — **İş Emrini Geri Alma / Yeniden Açma:** Hatalı kapatılan iş emrini geri açarak eksik parça veya işçilik eklenmesine izin verir.

### 🔹 Parça & Stok Senkronu

* **`add_work_order_item`** — **Parça / İşçilik Kalemi Ekleme:** İş emrine depodan bir yedek parça veya ustanın işçilik emeğini ekler.
* **`remove_work_order_item`** — **Parça / İşçilik Çıkarma:** Müşterinin onay vermediği veya vazgeçilen parçayı listeden çıkarır.
* **`reserve_stock_parts`** — **Depo Parça Rezervasyonu:** İş emrine eklenen parçayı depoda kilitler; başka müşteriye satılmasını önler.
* **`deduct_stock_on_complete`** — **Otomatik Stok Düşümü:** İş emri tamamlandığında takılan parçaları ana depodan otomatik düşer.
* **`return_stock_on_cancel`** — **İptal Edilen Parçayı Depoya İade:** İptal edilen iş emrindeki takılmayan parçaları depoya geri sokarak stok sayısını artırır.
* **`calculate_order_totals`** — **İş Emri Fiyat & KDV Hesaplama:** Takılan parça, işçilik, iskonto ve KDV toplamlarını anlık olarak hesaplar.

### 🔹 Ekspertiz & Usta

* **`add_checkin_photo`** — **Giriş Ekspertiz Hasar Fotoğrafı:** Araç servise ilk girdiğinde kaportadaki mevcut hasarları fotoğraflayıp buluta kaydeder.
* **`add_damage_photo`** — **Sökülen Hasarlı Parça Fotoğrafı:** Ustanın söktüğü arızalı parçayı fotoğraflar; müşteriye WhatsApp onayı için gönderilmesini sağlar.
* **`add_completed_photo`** — **Onarım Sonu Kontrol Fotoğrafı:** Tamamlanan işin ve takılan yeni parçanın montaj sonu fotoğrafını arşive ekler.
* **`add_mechanic_note`** — **Usta Teknik Notu Ekleme:** İşi yapan teknisyenin tespit ettiği ek kusurları ve teknik önerileri iş emrine not eder.
* **`assign_lift_and_tech`** — **Lift & Teknisyen Ataması:** İşi yapacak ustayı ve aracın kaldırılacağı boş atölye liftini (örn: Lift 2) belirler.
* **`generate_wo_invoice`** — **İş Emrinden Fatura Oluşturma:** Tamamlanan iş emrindeki tüm onaylı kalemleri tek tıkla resmi faturaya dönüştürür.

---

## 📅 4. Appointments (Randevu & Kapasite)

### 🔹 Randevu Takvimi

* **`get_appointment_list`** — **Randevu Takvimi & Ajanda:** Günlük, haftalık ve aylık randevu ajandasını renkli takvimde listeler.
* **`get_appointment_detail`** — **Randevu Detayları:** Randevu saatini, gelecek aracı, talep edilen işlemleri ve müşteri notunu gösterir.
* **`create_appointment`** — **Manuel Randevu Oluşturma:** Servis danışmanının telefonla gelen müşteri için ajandaya randevu kaydetmesini sağlar.
* **`approve_appointment`** — **Randevu Onaylama:** İnternetten gelen müşteri randevu talebini inceler ve atölye durumuna göre onaylar.
* **`reschedule_appointment`** — **Randevu Tarihini Güncelleme / Erteleme:** Müşterinin talebiyle randevu gün ve saatini başka bir tarihe taşır.
* **`cancel_appointment`** — **Randevu İptali:** Randevuyu gerekçesiyle iptal eder ve müşteriye bilgilendirme SMS'i gönderir.

### 🔹 Online Web Randevu

* **`create_public_booking`** — **Online Müşteri Rezervasyonu:** Araç sahibinin web portalı (/book/servis-adi) üzerinden kendi randevusunu almasını sağlar.
* **`get_tenant_public_info`** — **Servis Halka Açık Bilgileri:** Randevu alacak müşteriye servisin açık adresini, telefonunu ve çalışma günlerini gösterir.
* **`get_public_services`** — **Hizmet & Bakım Paketleri:** Müşterinin seçebileceği servis paketlerini (Yağ Bakımı, Fren Kontrolü vb.) listeler.
* **`validate_booking_slot`** — **Randevu Saati Uygunluk Kontrolü:** Seçilen saat diliminin servisin çalışma takvimine denk gelip gelmediğini teyit eder.
* **`send_sms_confirmation`** — **Randevu Onay & Hatırlatma SMS'i:** Randevu alındığında ve randevu saatinden 2 saat önce müşteriye konum ve saat SMS'i yollar.
* **`mark_as_no_show`** — **Gelmedi (No-Show) Olarak İşaretleme:** Randevu saatinde gelmeyen müşteriyi sisteme işleyerek takvimi boşaltır.

### 🔹 Çakışma & Kapasite

* **`check_slot_available`** — **Müsait Lift & Kapasite Denetimi:** Seçilen saat diliminde o servis için boş lift ve teknisyen olup olmadığını saniyesinde denetler.
* **`auto_exclude_conflict`** — **Çifte Randevu Engelleme Kalkanı:** Aynı lifte aynı anda iki randevu verilmesini sistem düzeyinde engeller.
* **`get_lift_calendar`** — **Lift Doluluk Matrisi:** Servisteki liftlerin (Lift 1, Lift 2 vb.) saat saat hangi araçlarla dolu olduğunu gösterir.
* **`get_tech_calendar`** — **Usta İş Yükü Takvimi:** Her teknisyenin o günkü iş yoğunluğunu ve boş saatlerini gösterir.
* **`calculate_service_time`** — **Tahmini Servis Süresi Hesaplama:** Seçilen bakım paketlerine göre işin kaç saat süreceğini (örn: 2.5 saat) otomatik hesaplar.
* **`convert_to_work_order`** — **Randevuyu İş Emrine Dönüştürme:** Müşteri servise geldiğinde tek tuşla randevuyu resmi İş Emri'ne çevirir.

---

## 📦 5. Inventory (Yedek Parça & Depo)

### 🔹 Parça Kataloğu

* **`get_product_list`** — **Depo Parça Listesi:** Depodaki tüm ürünleri parça kodu, adı, raf adresi ve mevcut adetlerine göre listeler.
* **`get_product_detail`** — **Parça Detay Kartı:** Parçanın uyumlu olduğu araç modellerini, alternatif OEM kodlarını ve maliyetlerini gösterir.
* **`create_product`** — **Yeni Parça Kartı Tanımlama:** Sisteme yeni yedek parça tanımlar (OEM Kodu, Barkod, Alış/Satış Fiyatı, Kritik Stok).
* **`update_product`** — **Parça Bilgisi & Fiyat Güncelleme:** Toptancı fiyat artışlarını, satış fiyatını veya iskonto oranlarını günceller.
* **`find_by_oem_code`** — **OEM Orijinal Kodu ile Arama:** Parçayı araba üreticisinin orijinal koduyla (örn: 04E115561H) saniyeler içinde bulur.
* **`find_by_barcode`** — **Barkod Okuyucu ile Hızlı Arama:** El terminali veya barkod okuyucu ile okutulan parçayı anında ekrana düşürür.

### 🔹 Stok Hareketleri

* **`add_stock_in_purchase`** — **Depoya Satın Alma Girişi:** Toptancıdan gelen parçaları fatura/irsaliye numarasıyla depoya ekler.
* **`add_stock_out_service`** — **Servis İçi Parça Çıkışı:** Tamirde kullanılan veya doğrudan tezgahtan satılan parçaların stoktan çıkışını yapar.
* **`add_stock_adjustment`** — **Manuel Stok Sayım Düzeltmesi:** Depo sayımında fazla veya eksik çıkan adetleri tutanakla sisteme eşitler.
* **`add_stock_return`** — **Tedarikçiye Parça İadesi:** Hatalı veya kusurlu gelen parçanın toptancıya iade çıkışını gerçekleştirir.
* **`get_stock_movements`** — **Parça Hareket Dökümü:** Bir parçanın geçmişe dönük tüm hareketlerini (giriş, çıkış, takıldığı araç) listeler.
* **`rollback_movement`** — **Hatalı Hareketi Geri Alma:** Yanlış girilen bir stok hareketini iptal ederek stok miktarını eski haline getirir.

### 🔹 Depo & Kritik Seviye

* **`check_critical_stocks`** — **Kritik Stok Uyarısı:** Belirlenen emniyet seviyesinin (örn: 3 adet) altına düşen parçaları kırmızı alarm listesine alır.
* **`update_shelf_location`** — **Raf Adresi Güncelleme:** Parçanın depodaki fiziksel raf adresini (örn: Raf A-12-3) günceller.
* **`get_category_summary`** — **Kategori Bazlı Stok Dağılımı:** Filtreler, fren grubu, madeni yağlar gibi kategorilerin depodaki adet ve maliyet özetini verir.
* **`calc_stock_valuation`** — **Toplam Depo Değeri:** Depodaki tüm ürünlerin toplam alış maliyetini ve potansiyel satış cirosunu hesaplar.
* **`export_inventory_excel`** — **Stok Listesini Excel'e Aktarma:** Depo sayım listesini ve güncel stokları Excel formatında dışa aktarır.
* **`batch_import_products`** — **Excel ile Toplu Parça Yükleme:** Tedarikçiden gelen 10.000 satırlık parça ve fiyat listesini tek tıkla depoya aktarır.

---

## 💳 6. Billing & Invoices (Fatura & Kasa)

### 🔹 Fatura İşlemleri

* **`get_invoice_list`** — **Fatura Listesi:** Kesilen tüm faturaları, tahsilat durumlarını (Ödendi, Kısmi, Açık) listeler.
* **`get_invoice_detail`** — **Fatura Detayı:** Faturadaki parça kalemlerini, işçilik ücretlerini, KDV ve tevkifat dökümünü gösterir.
* **`create_invoice_from_wo`** — **İş Emrinden Fatura Kesme:** İş emrindeki kalemleri kuruşu kuruşuna hatasız olarak resmi faturaya dönüştürür.
* **`create_manual_invoice`** — **Serbest Manuel Fatura Kesme:** İş emri olmadan doğrudan tezgâh satışı veya harici işçilik faturası düzenler.
* **`cancel_invoice`** — **Fatura İptali:** Hatalı kesilen faturayı iptal eder; ilgili iş emrini tekrar düzenlenebilir yapar.
* **`generate_pdf_invoice`** — **Resmi Fatura PDF Çıktısı:** Müşteriye teslim edilecek servis logolu, barkodlu şık Fatura PDF dokümanını üretir.

### 🔹 Tahsilat & POS

* **`record_payment`** — **Tahsilat Kaydetme:** Müşteriden alınan parayı sisteme işler (Nakit, Kredi Kartı, Banka Transferi/EFT).
* **`process_partial_payment`** — **Parçalı Tahsilat:** Faturanın bir kısmının nakit, bir kısmının kart, bir kısmının veresiye ödenmesini sağlar.
* **`reconcile_daily_closing`** — **Gün Sonu Kasa Mutabakatı:** Akşam kasadaki nakit para ve POS slipleri ile sistem kayıtlarını karşılaştırıp kasa kapanışı yapar.
* **`reconcile_bank_statement`** — **Banka Hesap Mutabakatı:** Gelen havale/EFT kayıtlarını sistemdeki faturalarla eşleştirir.
* **`refund_payment`** — **Tahsilat İadesi:** İptal edilen işlemler için müşteriye yapılan nakit veya kart iadelerini muhasebeleştirir.
* **`get_payment_receipt`** — **Tahsilat Makbuzu Üretme:** Ödeme yapan müşteriye anında resmi Tahsilat Makbuzu PDF belgesi çıkarır.

### 🔹 Finans & Alacaklar

* **`get_tenant_receivables`** — **Piyasa Alacak Raporu:** Servisin dışarıda kalan, henüz tahsil etmediği toplam açık hesap alacaklarını listeler.
* **`get_daily_cash_report`** — **Günlük Kasa Nakit Akışı:** Gün içinde kasaya giren ve çıkan net nakit ve kredi kartı akışını gösterir.
* **`sync_current_accounts`** — **Cari Hesap Senkronu:** Kesilen faturayı ve yapılan ödemeyi anında müşterinin borç/alacak bakiyesine yansıtır.
* **`calc_kdv_tax_totals`** — **KDV & Tevkifat Matrahı Hesaplama:** %20 KDV, %10 KDV ve tevkifatları yasal mevzuata göre otomatik hesaplar.
* **`export_invoices_excel`** — **Faturaları Excel'e Aktarma:** Aylık fatura dökümünü serbest muhasebeciye iletilmek üzere Excel formatında indirir.
* **`get_debtor_customers`** — **Gecikmiş Borçlular Listesi:** Ödeme vadesi geçmiş ve borcunu geciktiren müşterileri kırmızı alarm listesinde raporlar.

---

## 🔐 7. Auth & Multi-Tenancy (Güvenlik)

### 🔹 Oturum & Kimlik

* **`login_with_password`** — **Güvenli Personel Girişi:** Servis personelinin e-posta ve şifresiyle şifreli JWT oturumu açmasını sağlar.
* **`send_otp_sms`** — **SMS ile Güvenlik Doğrulama (2FA):** Kritik silme işlemlerinde veya şifre sıfırlamada personele SMS onay kodu gönderir.
* **`verify_otp_code`** — **SMS Kodu Doğrulama:** Kullanıcının girdiği 6 haneli SMS onay kodunun doğruluğunu kontrol eder.
* **`refresh_access_token`** — **Sessiz Oturum Yenileme:** Süresi dolan oturum anahtarını kullanıcının ekranını kapatmadan arkada yeniler (jti korumalı).
* **`logout_session`** — **Güvenli Çıkış:** Tarayıcıdaki oturumu ve sunucudaki yenileme anahtarını kalıcı olarak sonlandırır.
* **`change_password`** — **Şifre Değiştirme:** Personelin kendi erişim şifresini güvenle güncellemesini sağlar.

### 🔹 Kiracı İzolasyonu

* **`get_tenant_profile`** — **Servis Kurumsal Profili:** Servisin ticari unvanı, vergi no, logo ve iletişim ayarlarını getirir.
* **`update_tenant_profile`** — **Servis Bilgilerini Güncelleme:** Servisin resmi iletişim bilgilerini veya fatura altı notlarını değiştirir.
* **`set_working_hours`** — **Çalışma Saatleri & Tatiller:** Servisin açılış-kapanış saatlerini tanımlar; randevu motoru buna göre çalışır.
* **`resolve_tenant_by_slug`** — **Alt Alan Adı / Slug Çözümleme:** Müşterinin girdiği web adresinden (örn: kadikoy-garaj) ilgili servisi tespit eder.
* **`extract_tenant_from_jwt`** — **Token'dan Servis Kimliği Çıkarma:** Her gelen istekte kullanıcının hangi servise ait olduğunu JWT içinden çözer.
* **`enforce_tenant_isolation`** — **Çoklu Kiracı İzolasyon Kalkanı:** Her SQL sorgusuna otomatik filtre koyarak servis verilerinin birbirine karışmasını kesin olarak engeller.

### 🔹 Personel & Yetki (RBAC)

* **`get_staff_list`** — **Çalışan Listesi:** Servisteki ustaları, danışmanları ve muhasebecileri listeler.
* **`create_staff_user`** — **Yeni Personel Tanımlama:** Servise yeni başlayan bir çalışan için kullanıcı hesabı açar.
* **`update_staff_role`** — **Yetki Belirleme (RBAC):** Personelin yetki sınırlarını tayin eder (Admin, Danışman, Usta, Muhasebe).
* **`check_permission_guard`** — **İşlem İzin Kontrolü:** Yapılmak istenen işlem için kullanıcının yetkisinin yetip yetmediğini denetler.
* **`toggle_staff_active`** — **Personel Dondurma:** İşten ayrılan bir personelin sisteme girişini tek tıkla engeller.
* **`delete_staff_user`** — **Personel Kaydı Silme:** Hatalı açılan veya ayrılan personel kaydını sistemden kaldırır.

---

## 🛡️ 8. Audit & Platform Admin (Yönetim)

### 🔹 Denetim Günlüğü

* **`get_tenant_audit_logs`** — **Kim Ne Yaptı? Günlüğü:** Serviste kimin ne zaman hangi faturayı sildiğini veya değiştirdiğini gösterir.
* **`get_audit_log_detail`** — **Eski / Yeni Veri Farkı (Diff):** Değiştirilen bir kaydın eski hali ile yeni halini yan yana gösterir.
* **`record_audit_event`** — **Otomatik Güvenlik Kaydı:** Fatura iptali veya personel silinmesi gibi kritik hareketleri arka planda otomatik kaydeder.
* **`format_audit_payload`** — **Denetim Verisi Formatlama:** Değişiklik kayıtlarını insan tarafından okunabilir sade bir özet haline getirir.
* **`mask_client_ip`** — **KVKK Uyumlu IP Maskeleme:** Kullanıcı IP adreslerini veri gizliliği yasaları gereği maskeleyerek saklar (192.168.***.***).
* **`export_audit_logs`** — **Denetim Raporunu Dışa Aktarma:** Güvenlik ve denetim loglarını resmi incelemeler için Excel/CSV olarak indirir.

### 🔹 Süper Yönetici

* **`admin_login`** — **Süper Yönetici Girişi:** WorksAuto platform sahiplerinin merkezi /admin yönetim konsoluna güvenli girişini sağlar.
* **`get_all_tenants_list`** — **Tüm Servislerin Listesi:** Platforma kayıtlı tüm oto servisleri, aktifliklerini ve üyelik planlarını listeler.
* **`create_new_tenant`** — **Yeni Servis Kurulumu:** Sisteme yeni kaydolan bir oto servis için tamamen izole bir çalışma alanı açar.
* **`toggle_tenant_license`** — **Lisans Dondurma / Açma:** Abonelik ücretini ödemeyen servisin erişimini askıya alır veya ödeme gelince açar.
* **`delete_tenant_data`** — **Servis Verilerini Temizleme:** Platformdan kalıcı olarak ayrılan bir servisin tüm verilerini yasal olarak imha eder.
* **`get_system_health`** — **Sistem Canlılık Denetimi:** Veritabanı, Redis ve dosya depolama sunucularının sağlıklı çalışıp çalışmadığını kontrol eder.

### 🔹 Platform Metrikleri

* **`get_platform_kpis`** — **Platform Büyüme Göstergeleri:** Toplam aktif servis sayısı, aylık kesilen toplam fatura hacmi ve sistem büyüme metriklerini raporlar.
* **`get_db_latency_metric`** — **Veritabanı Yanıt Hızı Ölçümü:** Sistem sorgularının kaç milisaniyede yanıt verdiğini ölçerek performans darboğazlarını izler.
* **`get_total_volume_stats`** — **Platform Genel Ciro Hacmi:** Platform üzerinden geçen toplam ticari işlem hacmini istatistiki olarak sunar.
* **`monitor_redis_queues`** — **Kuyruk İzleme (BullMQ):** Arka planda SMS, e-posta ve bildirim gönderen kuyrukların hatasız çalıştığını denetler.
* **`clear_expired_sessions`** — **Süresi Dolan Oturumları Temizleme:** Kullanılmayan eski oturum artıklarını temizleyerek veritabanını optimize eder.
* **`inspect_failed_logins`** — **Şüpheli Giriş ve Saldırı İzleme:** Platforma yönelik şüpheli şifre denemelerini izleyerek olası siber saldırıları erkenden tespit eder.

---

