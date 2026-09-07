# ADR-002: Modül Göç Stratejisi (God Service -> Clean Architecture)

## Durum: Kabul Edildi

## Karar Kriteri
Bir modül şu ikisinden EN AZ BİRİNİ karşılıyorsa TAM DDD (domain/application/infrastructure/presentation) alır; aksi halde "hafif bölme" (God Service'i odaklı use-case/servis gruplarına ayırma, ayrı domain katmanı olmadan) yeterlidir:

  (a) Finansal tutarlılık riski taşıyor mu? (para, stok miktarı, fatura durumu gibi tutarsızlığı pahalıya mal olan veri)
  (b) İçinde triviyal olmayan bir iş kuralı/algoritma var mı? (durum geçiş kuralları, çakışma kontrolü, çok formatlı eşleştirme, checksum/doğrulama algoritması — basit CRUD validasyonu SAYILMAZ)

## Modül Sınıflandırması ve Gerekçe

| Modül | (a) Finansal risk | (b) Karmaşık kural | Karar | Öncelik Sırası |
|---|---|---|---|---|
| work-orders | ✅ | ✅ | Tam DDD (TAMAMLANDI — pilot) | 0 |
| inventory | ✅ (stok tutarlılığı) | ✅ (atomik rezervasyon/rollback) | Tam DDD | 1 |
| invoices & billing | ✅ | ✅ (KDV/cari hesaplama) | Tam DDD | 2 |
| appointments | ❌ | ✅ (çakışma/kapasite kontrolü) | Tam DDD | 3 |
| customers | ❌ | ✅ (VKN/TCKN doğrulama algoritması, çok formatlı telefon eşleştirme — batch import'ta gerçek bir eşleştirme algoritması çalışıyor, salt CRUD değil) | Tam DDD | 4 |
| admin | ❌ | ❌ (auth + CRUD + raporlama, karmaşık iş kuralı yok) | Hafif bölme (odaklı use-case grupları, ayrı domain/infrastructure katmanı YOK) | 5 |
| diğer tüm modüller (staff, services, media, notifications, vb.) | ❌ | ❌ | Dokunulmuyor — Boy Scout Rule: bir sonraki değişiklik sırasında hafif bölme uygulanır | — |

## inventory'nin invoices'tan ÖNCE Sıraya Alınma Gerekçesi
`work-orders` (temiz) hâlihazırda `inventory.service.ts`'i (kirli) çağırıyor. `invoices`, `work-orders`'a bağımlı. `inventory` temizlenmeden `invoices`'a geçilirse, "temiz katman kirli katmana bağımlı" zinciri büyümeye devam eder. Bu yüzden bağımlılık grafiğinde en altta olan `inventory` önce temizlenir.

## Sıralı Uygulama Kuralı
Modüller PARALEL değil, SIRAYLA dönüştürülür. Her modül tamamlandıktan sonra:
1. `npm run test` + `npm run test:e2e` + `node scripts/verify-architecture.js` yeşil olmalı.
2. Manuel onay kapısından geçip production'a alınır.
3. En az bir iş günü canlıda gözlemlenir (hata oranı, response time regresyonu yok).
4. Ancak bundan sonra bir sonraki modüle başlanır.

## Yeni Modül Kuralı (Geleceğe Dönük)
Bu tarihten sonra açılan HER YENİ modül, yukarıdaki (a)/(b) kriterine göre baştan sınıflandırılır ve doğrudan o standartla yazılır. God Service olarak başlayıp "sonra düzeltiriz" denemez.
