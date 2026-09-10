import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function getArg(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (arg) return arg.split('=')[1].replace(/^["']|["']$/g, '').trim();
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1].replace(/^["']|["']$/g, '').trim();
  }
  return undefined;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('5')) return '+90' + digits;
  if (digits.length === 11 && digits.startsWith('05')) return '+9' + digits;
  if (digits.length === 12 && digits.startsWith('905')) return '+' + digits;
  return phone.startsWith('+') ? phone : '+' + phone;
}

async function main() {
  const email = getArg('email') || process.env.ADMIN_EMAIL;
  const password = getArg('password') || process.env.ADMIN_PASSWORD;
  const name = getArg('name') || process.env.ADMIN_NAME || 'Platform';
  const surname = getArg('surname') || process.env.ADMIN_SURNAME || 'Yöneticisi';
  const phoneRaw = getArg('phone') || process.env.ADMIN_PHONE || '+905000000000';

  if (!email || !password) {
    console.error(`
❌ HATA: E-posta ve şifre zorunludur!
Kullanım:
  npx ts-node scripts/create-superadmin.ts --email=patron@worksauto.com --password="GucluSifre2026!*" --name="Rıdvan" --phone="+905551112233"
    `);
    process.exit(1);
  }

  const phone = normalizePhone(phoneRaw);
  const emailNorm = email.toLowerCase().trim();

  console.log(`🔐 Super Admin hesabı hazırlanıyor: ${emailNorm}...`);

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { phone },
    update: {
      email: emailNorm,
      name,
      surname,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      tenantId: null,
      isActive: true,
    },
    create: {
      email: emailNorm,
      phone,
      name,
      surname,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      tenantId: null,
      isActive: true,
    },
  });

  console.log(`
🎉 TEBRİKLER! Super Admin başarıyla oluşturuldu:
  ID:       ${admin.id}
  E-Posta:  ${admin.email}
  Ad Soyad: ${admin.name} ${admin.surname || ''}
  Rol:      ${admin.role}
  Durum:    ${admin.isActive ? 'Aktif' : 'Pasif'}
  Panel:    http://localhost:3000/admin/login
  `);
}

main()
  .catch((e) => {
    console.error('❌ İşlem başarısız:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
