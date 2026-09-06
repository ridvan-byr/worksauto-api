#!/usr/bin/env bash
# ==============================================================================
# WorksAuto MVP: Şifreli PostgreSQL Yedeğini Geri Yükleme Betiği
# Standard: AES-256-CBC PBKDF2 Çözme + Gzip Açma + PostgreSQL Geri Yükleme
# ==============================================================================
set -euo pipefail

if [ "$#" -lt 1 ]; then
    echo "❌ Kullanım: BACKUP_ENCRYPTION_KEY=\"...\" ./restore.sh <yedek_dosyasi.sql.gz.enc>" >&2
    exit 1
fi

ENC_FILE="$1"

if [ ! -f "${ENC_FILE}" ]; then
    echo "❌ HATA: Belirtilen yedek dosyası bulunamadı: ${ENC_FILE}" >&2
    exit 1
fi

# 1. Güvenlik Denetimi: Şifre Çözme Anahtarı Zorunluluğu
if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    echo "❌ HATA: BACKUP_ENCRYPTION_KEY ortam değişkeni tanımlanmamış!" >&2
    echo "Şifreli yedeği açmak için anahtar zorunludur." >&2
    exit 1
fi

# 2. Checksum Bütünlük Denetimi
SHA_FILE="${ENC_FILE}.sha256"
if [ -f "${SHA_FILE}" ]; then
    echo "🔍 SHA-256 Checksum doğrulanıyor..."
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum -c "${SHA_FILE}"
    elif command -v shasum >/dev/null 2>&1; then
        shasum -a 256 -c "${SHA_FILE}"
    fi
    echo "✅ Checksum doğrulandı. Dosya bozulmamış."
else
    echo "⚠️ UYARI: ${SHA_FILE} bulunamadı, checksum atlanıyor."
fi

# 3. Yapılandırma Parametreleri
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-worksauto}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
CONTAINER_NAME="${CONTAINER_NAME:-worksauto_postgres}"

echo "🔄 [WorksAuto Restore] Geri yükleme başlatılıyor..."
echo "📂 Yedek Dosyası: ${ENC_FILE}"
echo "🗄️ Hedef Veritabanı: ${DB_NAME}"

# 4. Şifre Çözme ve Geri Yükleme Akışı (Streaming Pipeline)
export PGPASSWORD="${DB_PASSWORD}"

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "🐳 Docker konteyneri (${CONTAINER_NAME}) içine aktarılıyor..."
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -pass env:BACKUP_ENCRYPTION_KEY -in "${ENC_FILE}" \
        | gzip -d \
        | docker exec -i -e PGPASSWORD="${DB_PASSWORD}" "${CONTAINER_NAME}" \
          psql -h localhost -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}"
elif command -v psql >/dev/null 2>&1; then
    echo "🖥️ Yerel psql ile geri yükleniyor..."
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -pass env:BACKUP_ENCRYPTION_KEY -in "${ENC_FILE}" \
        | gzip -d \
        | psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}"
else
    echo "❌ HATA: Ne Docker ne de yerel psql aracı bulunamadı!" >&2
    exit 1
fi

echo "✅ Veritabanı başarıyla geri yüklendi!"

# 5. Temel Bütünlük Doğrulama Sorgusu
echo "📊 Tablo kayıt sayıları kontrol ediliyor..."
VERIFY_QUERY="
SELECT 'tenants' AS entity, count(*) FROM tenants
UNION ALL SELECT 'users', count(*) FROM users
UNION ALL SELECT 'customers', count(*) FROM customers
UNION ALL SELECT 'work_orders', count(*) FROM work_orders
UNION ALL SELECT 'invoices', count(*) FROM invoices;
"

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    docker exec -e PGPASSWORD="${DB_PASSWORD}" "${CONTAINER_NAME}" psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -c "${VERIFY_QUERY}" || true
elif command -v psql >/dev/null 2>&1; then
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "${VERIFY_QUERY}" || true
fi

echo "🎉 Geri yükleme ve doğrulama tamamlandı."
