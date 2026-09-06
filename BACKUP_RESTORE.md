# WorksAuto: Doğrulanmış ve Şifreli Veritabanı Yedekleme & Geri Yükleme Kılavuzu

> **Standart:** AES-256-CBC PBKDF2 (100.000 İterasyon) + Gzip + SHA-256 Checksum  
> **Saklama Politikası (Retention):** 30 Günlük Otomatik Temizlik  
> **Şartname Maddesi:** Madde 47 (Otomatik ve Doğrulanmış Yedekleme Altyapısı)

---

## 🔒 1. Güvenlik ve Şifreleme Mimarisi

WorksAuto veritabanı yedekleme boru hattı (`scripts/backup.sh`), veriyi diske **asla şifresiz (plain-text) yazmaz**. Veri akışı (streaming pipeline) doğrudan RAM üzerinde gerçekleşir:

```text
PostgreSQL pg_dump 
  ──> (RAM Stream) 
  ──> Gzip Sıkıştırma (-9) 
  ──> (RAM Stream) 
  ──> OpenSSL AES-256-CBC (PBKDF2 Salted, 100k iterasyon) 
  ──> Diske Yazım: backups/backup_YYYYMMDD_HHMMSS.sql.gz.enc
```

### ⚠️ Kritik Anahtar Yönetim Kuralı (KMS / Off-Site)
* `BACKUP_ENCRYPTION_KEY`, **asla Git reposuna commit edilmemeli** ve sunucu üzerinde açık metin dosyalarda saklanmamalıdır.
* Bu anahtar, platform yöneticisinin güvenli parola yöneticisinde (1Password, Bitwarden) veya kurumsal KMS (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault) üzerinde tutulmalıdır.
* Şifreleme anahtarı en az **16 karakter** olmalıdır; aksi halde betik *fail-fast* ilkesiyle işlemi durdurur.

---

## 🚀 2. Manuel Yedek Alma ve Geri Yükleme

### A. Yedek Alma (`backup.sh`)
```bash
# Güvenli anahtarı belirterek yedeği başlatın
export BACKUP_ENCRYPTION_KEY="guclu-ve-rastgele-en-az-16-karakter-anahtar"

# Betiği çalıştırın
./scripts/backup.sh
```

**Oluşan Çıktılar:**
* `backups/backup_20260906_143000.sql.gz.enc` (AES-256 şifreli veri paketi)
* `backups/backup_20260906_143000.sql.gz.enc.sha256` (Bütünlük checksum dosyası)

### B. Geri Yükleme (`restore.sh`)
```bash
export BACKUP_ENCRYPTION_KEY="guclu-ve-rastgele-en-az-16-karakter-anahtar"

# Hedef dosyayı belirterek geri yükleyin
./scripts/restore.sh backups/backup_20260906_143000.sql.gz.enc
```
Betik önce SHA-256 checksum doğrulaması yapar, ardından şifreyi çözerek veriyi yükler ve işlem sonunda tablo kayıt sayılarını (tenants, users, work_orders, invoices vb.) konsola raporlar.

---

## ⏰ 3. Otomatik Günlük Yedekleme (Cronjob Kurulumu)

Linux sunucuda her gece saat **03:00**'te otomatik yedek almak için crontab kaydı:

```bash
crontab -e
```

Aşağıdaki satırı ekleyin:
```cron
# Her gece 03:00'te şifreli yedek al ve logla
0 3 * * * BACKUP_ENCRYPTION_KEY="sizin-kms-anahtariniz" /home/ubuntu/AutoWorks/scripts/backup.sh >> /var/log/worksauto_backup.log 2>&1
```

*Not: `backup.sh` içinde yer alan `find -mtime +30` kuralı sayesinde 30 günden eski yedekler otomatik olarak temizlenir, disk dolması engellenir.*

---

## 🧪 4. Pre-Flight Restore Testi (Canlı DB Öncesi Kanıtlama)

Herhangi bir büyük şema göçü (migration) veya versiyon yükseltmesinden önce alınan yedeğin sağlamlığı **izole bir test konteynerinde** kanıtlanmalıdır:

```bash
# 1. Anlık snapshot al
export BACKUP_ENCRYPTION_KEY="test-preflight-key-2026"
./scripts/backup.sh

# 2. İzole test konteyneri başlat
docker run --name test_pg_restore --rm -d \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=worksauto_test \
  postgres:16-alpine

# 3. Yedeği test konteynerine yükle
CONTAINER_NAME="test_pg_restore" DB_NAME="worksauto_test" DB_PASSWORD="test" \
  ./scripts/restore.sh backups/en_son_yedek.sql.gz.enc

# 4. Doğrulama sorgusu çalıştır
docker exec test_pg_restore psql -U postgres -d worksauto_test -c \
  "SELECT 'tenants', count(*) FROM tenants UNION ALL SELECT 'work_orders', count(*) FROM work_orders;"

# 5. Test konteynerini kapat
docker stop test_pg_restore
```
Bu adımlar başarıyla tamamlandığında, canlı veritabanında göç işlemine güvenle geçilebilir.
