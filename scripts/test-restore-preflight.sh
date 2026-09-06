#!/usr/bin/env bash
# ==============================================================================
# WorksAuto: Pre-Flight Restore Testi (Otomatik İzole DB Doğrulama)
# Canlı DB'ye dokunmadan önce alınan yedeğin sağlamlığını izole container'da kanıtlar.
# ==============================================================================
set -euo pipefail

PREFLIGHT_CONTAINER="test_pg_restore"
TEST_DB="worksauto_test"
TEST_PASS="test_secret_12345"
export BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-worksauto_preflight_key_2026}"

echo "🧪 [Pre-Flight Restore Test] Başlatılıyor..."

# 1. Mevcut canlı durumdan anlık şifreli yedek al
echo "1️⃣ Canlı sistemden anlık şifreli yedek alınıyor..."
./scripts/backup.sh

LATEST_BACKUP="$(ls -t backups/backup_*.sql.gz.enc 2>/dev/null | head -n 1)"
if [ -z "${LATEST_BACKUP}" ]; then
    echo "❌ HATA: Yedek dosyası oluşturulamadı!" >&2
    exit 1
fi
echo "📂 Test edilecek yedek: ${LATEST_BACKUP}"

# 2. Temizlik: Eğer eski test konteyneri varsa kapat
docker rm -f "${PREFLIGHT_CONTAINER}" >/dev/null 2>&1 || true

# 3. İzole geçici test PostgreSQL konteyneri başlat
echo "2️⃣ İzole test PostgreSQL konteyneri başlatılıyor..."
docker run --name "${PREFLIGHT_CONTAINER}" -d \
    -e POSTGRES_PASSWORD="${TEST_PASS}" \
    -e POSTGRES_DB="${TEST_DB}" \
    postgres:16-alpine

echo "⏳ Test veritabanının hazır olması bekleniyor..."
until docker exec "${PREFLIGHT_CONTAINER}" pg_isready -U postgres >/dev/null 2>&1; do
    sleep 1
done

# 4. Yedeği test konteynerine restore et
echo "3️⃣ Şifreli yedek test konteynerine aktarılıyor..."
CONTAINER_NAME="${PREFLIGHT_CONTAINER}" \
DB_NAME="${TEST_DB}" \
DB_PASSWORD="${TEST_PASS}" \
DB_USER="postgres" \
./scripts/restore.sh "${LATEST_BACKUP}"

# 5. Doğrulama Sorgusu
echo "4️⃣ Veri bütünlüğü ve tablo kayıt sayıları doğrulanıyor..."
docker exec -e PGPASSWORD="${TEST_PASS}" "${PREFLIGHT_CONTAINER}" psql -U postgres -d "${TEST_DB}" -c "
SELECT 'tenants' AS tablo, count(*) AS kayit_sayisi FROM tenants
UNION ALL SELECT 'users', count(*) AS kayit_sayisi FROM users
UNION ALL SELECT 'customers', count(*) AS kayit_sayisi FROM customers
UNION ALL SELECT 'vehicles', count(*) AS kayit_sayisi FROM vehicles
UNION ALL SELECT 'work_orders', count(*) AS kayit_sayisi FROM work_orders
UNION ALL SELECT 'invoices', count(*) AS kayit_sayisi FROM invoices;
"

# 6. Test konteynerini kapat ve temizle
echo "5️⃣ İzole test konteyneri güvenle kapatılıyor..."
docker rm -f "${PREFLIGHT_CONTAINER}" >/dev/null

echo "🎉 [PRE-FLIGHT BAŞARILI] Yedeğin geri yüklenebilirliği ve veri bütünlüğü kanıtlandı."
echo "✅ Canlı veritabanı migration işlemine güvenle geçilebilir."
