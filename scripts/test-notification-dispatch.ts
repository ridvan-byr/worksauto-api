import * as fs from 'fs';
import * as path from 'path';
import * as nodemailer from 'nodemailer';
import { NotificationTemplateService } from '../src/modules/notifications/services/notification-template.service';

// Load environment from .env manually without external package
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const templateService = new NotificationTemplateService();


async function main() {
  const targetEmail = process.argv[2] || process.env.TEST_EMAIL || 'test@example.com';
  const targetPhone = process.argv[3] || process.env.TEST_PHONE || '905550001122';

  console.log('\n=============================================================');
  console.log('🚀 WorksAuto Bildirim ve Mesajlaşma Canlı Doğrulama Testi');
  console.log('=============================================================');
  console.log(`🎯 Hedef E-Posta : ${targetEmail}`);
  console.log(`📱 Hedef Telefon : ${targetPhone}`);
  console.log('-------------------------------------------------------------\n');

  // --- 1. E-POSTA DOĞRULAMASI ---
  console.log('📧 [1/3] E-Posta Gönderim Testi Başlatılıyor...');

  const sampleTrackingUrl = templateService.getTrackingUrl('demo-wo-12345');
  const htmlEmail = templateService.generateBrandedHtmlEmail({
    title: 'Servis Kabul Bildirimi (Canlı Doğrulama Testi)',
    customerName: 'Ahmet Yılmaz',
    message: 'Aracınızın 10.000 km periyodik bakım kabulü yapılmıştır. Yapılan işlemleri, değiştirilen parçaları ve kabul fotoğraflarını aşağıdaki canlı takip butonuna tıklayarak anlık izleyebilirsiniz.',
    buttonText: 'Canlı Takip Sayfasını Aç',
    buttonUrl: sampleTrackingUrl,
    tenantTitle: 'Yıldız Oto Bosch Car Service',
    extraDetails: {
      'İş Emri No': 'WO-2026-0089',
      'Plaka': '34ABC123',
      'Kabul Kilometresi': '45.200 km',
      'Servis Danışmanı': 'Mustafa Usta',
    },
  });

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    console.log(`   ⚙️ Gerçek SMTP Yapılandırması Bulundu: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}`);
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || 'WorksAuto Servis <bildirim@worksauto.com>',
        to: targetEmail,
        subject: 'WorksAuto Canlı Bildirim Testi (34ABC123)',
        html: htmlEmail,
      });

      console.log(`   ✅ [GERÇEK E-POSTA İLETİLDİ]`);
      console.log(`   📬 Mesaj ID: ${info.messageId}`);
      console.log(`   👉 Lütfen ${targetEmail} gelen kutunuzu (Spam dahil) kontrol ediniz!`);
    } catch (err: any) {
      console.error(`   ❌ Gerçek SMTP Hatası: ${err.message}`);
    }
  } else {
    console.log('   ℹ️ .env içinde gerçek SMTP_HOST bulunamadı.');
    console.log('   🧪 Ethereal Test Servisi üzerinde anlık gerçek bir gelen kutusu oluşturuluyor...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      const testTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      const info = await testTransporter.sendMail({
        from: 'WorksAuto Servis <bildirim@worksauto.com>',
        to: targetEmail,
        subject: 'WorksAuto Canlı Takip Bildirimi (34ABC123)',
        html: htmlEmail,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log('   ✅ [E-POSTA BAŞARIYLA ÜRETİLDİ VE GÖNDERİLDİ]');
      console.log(`   🔗 E-Postayı tarayıcınızda canlı görmek için aşağıdaki linke tıklayın:`);
      console.log(`   👉 \x1b[36m${previewUrl}\x1b[0m`);
    } catch (err: any) {
      console.error(`   ❌ Test e-postası üretilirken hata: ${err.message}`);
    }
  }

  // --- 2. WHATSAPP (GOWA) DOĞRULAMASI ---
  console.log('\n💬 [2/3] WhatsApp (GOWA Gateway) Testi Başlatılıyor...');
  const gowaUrl = process.env.WHATSAPP_API_URL || 'http://localhost:8080';

  const waMessage = templateService.formatWorkOrderCreatedCustomerMessage({
    customerName: 'Ahmet Yılmaz',
    plate: '34ABC123',
    workOrderNumber: 'WO-2026-0089',
    trackingUrl: sampleTrackingUrl,
    tenantTitle: 'Yıldız Oto Bosch Car Service',
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const checkRes = await fetch(`${gowaUrl}/app/devices`, {
      headers: { 'X-Device-Id': 'default' },
      signal: controller.signal,
    })
      .catch(() => null)
      .finally(() => clearTimeout(timeout));

    if (!checkRes) {
      console.log(
        `   ⚠️ GOWA WhatsApp servisine (${gowaUrl}) şu an ulaşılamıyor.`,
      );
      console.log('   💡 Başlatmak için:');
      console.log('      docker-compose up -d whatsapp');
      console.log(
        '      ve ardından tarayıcıdan http://localhost:8080 adresine girip QR kod okutunuz.',
      );
    } else {
      console.log(`   ✅ GOWA Servisi Çalışıyor (${gowaUrl})`);
      const devices = await checkRes.json().catch(() => []);
      console.log(`   📱 Bağlı Cihaz Durumu:`, devices);

      console.log(`   📤 Mesaj İletilmeye Çalışılıyor -> ${targetPhone}...`);
      const sendRes = await fetch(`${gowaUrl}/send/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': 'default',
        },
        body: JSON.stringify({
          phone: targetPhone.replace(/\D/g, ''),
          message: waMessage,
        }),
      });

      if (sendRes.ok) {
        const sendData = await sendRes.json();
        console.log(`   ✅ [WHATSAPP MESAJI GÖNDERİLDİ] Mesaj ID: ${sendData.id || 'ok'}`);
        console.log(`   👉 ${targetPhone} numaralı WhatsApp uygulamanızı kontrol ediniz!`);
      } else {
        const errText = await sendRes.text();
        console.log(`   ⚠️ WhatsApp gönderimi başarısız (${sendRes.status}): ${errText}`);
        console.log('   👉 Cihaz eşleştirmesi için http://localhost:8080 adresini açıp telefonunuzla QR kodu taratınız.');
      }
    }
  } catch (err: any) {
    console.log(`   ⚠️ WhatsApp test hatası: ${err.message}`);
  }

  // --- 3. SMS (NETGSM / MOCK) DOĞRULAMASI ---
  console.log('\n📱 [3/3] SMS (Netgsm) Testi Başlatılıyor...');
  const smsMessage = templateService.formatConsentSmsMessage({
    customerName: 'Ahmet Yılmaz',
    consentUrl: templateService.getConsentUrl('demo-token-9988'),
    tenantTitle: 'Yıldız Oto',
  });

  if (process.env.NETGSM_USERCODE && process.env.NETGSM_PASSWORD) {
    console.log('   ⚙️ Gerçek Netgsm kullanıcı bilgileri tanımlı.');
    console.log(`   📤 Netgsm API üzerinden ${targetPhone} numarasına SMS iletiliyor...`);
    const params = new URLSearchParams({
      usercode: process.env.NETGSM_USERCODE,
      password: process.env.NETGSM_PASSWORD,
      gsmno: targetPhone.replace(/\D/g, ''),
      message: smsMessage,
      msgheader: process.env.NETGSM_HEADER || 'WORKSAUTO',
    });
    try {
      const netgsmRes = await fetch(`https://api.netgsm.com.tr/sms/send/get?${params.toString()}`);
      const text = await netgsmRes.text();
      console.log(`   Yanıt Kodu: ${text}`);
      if (text.startsWith('00') || text.startsWith('01') || text.startsWith('02')) {
        console.log('   ✅ [NETGSM SMS BAŞARIYLA İLETİLDİ]');
      } else {
        console.log(`   ❌ Netgsm Hata Döndürdü: ${text}`);
      }
    } catch (err: any) {
      console.error(`   ❌ Netgsm Bağlantı Hatası: ${err.message}`);
    }
  } else {
    console.log('   ℹ️ Netgsm hesabı tanımlı değil. Hazırlanan SMS metni (Canlı Takip / Onay Linkli):');
    console.log(`   💬 "${smsMessage}"`);
  }

  console.log('\n=============================================================');
  console.log('✨ Test Tamamlandı.');
  console.log('=============================================================\n');
}

main().catch(console.error);
