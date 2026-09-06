#!/usr/bin/env bash
# ==============================================================================
# WorksAuto MVP: Şifreli ve Sıkıştırılmış PostgreSQL Yedekleme Betiği
# Standard: AES-256-CBC PBKDF2 (100,000 iterasyon) + Gzip + SHA-256 Checksum
# Retention Policy: 30 Günlük Otomatik Temizlik
# ==============================================================================
set -euo pipefail

# 1. Güvenlik Denetimi: Şifreleme Anahtarı Zorunluluğu (Fail-Fast)
if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    echo "❌ HATA: BACKUP_ENCRYPTION_KEY ortam değişkeni tanımlanmamış!" >&2
    echo "Güvenlik gereği veritabanı yedeği şifrelenmeden diske yazılamaz." >&2
    echo "Kullanım: BACKUP_ENCRYPTION_KEY=\"guclu-parola-en-az-16-karakter\" ./backup.sh" >&2
    exit 1
fi

if [ "${#BACKUP_ENCRYPTION_KEY}" -lt 16 ]; then
    echo "❌ HATA: BACKUP_ENCRYPTION_KEY en az 16 karakter uzunluğunda olmalıdır!" >&2
    exit 1
fi

# 2. Yapılandırma Parametreleri
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-worksauto}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
CONTAINER_NAME="${CONTAINER_NAME:-worksauto_postgres}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_BASE="${BACKUP_DIR}/backup_${TIMESTAMP}"
ENC_FILE="${BACKUP_BASE}.sql.gz.enc"
SHA_FILE="${ENC_FILE}.sha256"

mkdir -p "${BACKUP_DIR}"

echo "📦 [WorksAuto Backup] PostgreSQL yedeği başlatılıyor..."
echo "📅 Zaman Damgası: ${TIMESTAMP}"
echo "🗄️ Veritabanı: ${DB_NAME}"

# 3. Yedek Alma, Sıkıştırma ve AES-256 Şifreleme Boru Hattı (Streaming Pipeline)
# Disk üzerinde şifresiz geçici dosya bırakılmadan doğrudan RAM üzerinden stream edilir
export PGPASSWORD="${DB_PASSWORD}"

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "🐳 Docker konteyneri üzerinden pg_dump alınıyor (${CONTAINER_NAME})..."
    docker exec -e PGPASSWORD="${DB_PASSWORD}" "${CONTAINER_NAME}" \
        pg_dump -h localhost -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists --no-owner --no-privileges \
        | gzip -9 \
        | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 -pass env:BACKUP_ENCRYPTION_KEY \
        > "${ENC_FILE}"
elif command -v pg_dump >/dev/null 2>&1; then
    echo "🖥️ Yerel pg_dump komutu ile yedek alınıyor..."
    pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists --no-owner --no-privileges \
        | gzip -9 \
        | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 -pass env:BACKUP_ENCRYPTION_KEY \
        > "${ENC_FILE}"
else
    echo "❌ HATA: Ne Docker ne de yerel pg_dump aracı bulunamadı!" >&2
    exit 1
fi

# 4. SHA-256 Checksum Oluşturma (Bütünlük Doğrulaması)
if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${ENC_FILE}" > "${SHA_FILE}"
elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "${ENC_FILE}" > "${SHA_FILE}"
fi

BACKUP_SIZE="$(du -h "${ENC_FILE}" | cut -f1)"
echo "✅ Şifreli yedek başarıyla oluşturuldu: ${ENC_FILE} (${BACKUP_SIZE})"
echo "🔒 Checksum dosyası: ${SHA_FILE}"

# 5. 30 Günlük Saklama Politikası (Retention Policy - Otomatik Temizlik)
echo "🧹 30 günden eski yedekler temizleniyor..."
find "${BACKUP_DIR}" -type f -name "backup_*.sql.gz.enc*" -mtime +30 -exec rm -f {} + 2>/dev/null || true
echo "✨ Yedekleme işlemi başarıyla tamamlandı."
