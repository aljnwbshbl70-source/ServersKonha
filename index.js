const express = require('express');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 1. إعداد قاعدة بياناتك المركزية
// ==========================================
const centralFirebaseConfig = {
  "type": "service_account",
  "project_id": "servers-41539",
  "private_key_id": "2ed39c24a393883494e2d04df648106bf6bb3e36",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDt0UJnHwiv3F4J\nL9G1D0qxGeMKU9o0MbJjhhdDO+gt+Fvkxpesl9nEc2XMHUBAupkYezmcVaR39LiN\n3I7GO24wNUabDCLyyRBm/bKLJkSVTAgQQKE52UMEuG4im4K7EBx9h+BFJ5HnXpzr\ntBAktUxzYeINqk2d8KQ/PnF+47jF/0dHEyhCunxzUqMuY5IbSNf6zgnpnoZMOijS\ngG5FN2BhBVjJBf470U+oLqLoRV/bAMhPn8Na1rGnMYC9sRLsgpCVnuZnhAcKv7eM\nQss3677hJXeCpGedrenvMroeXdnc9l3T/PvDX0xVznpBJ/Jx1ZzeD0SgeHXgvKpI\nAp1cmpD7AgMBAAECggEAEpP3VlZJTRuvnj4bFBmMDIZo2G9b1hn6b+XovqWDv3Dt\nv33NbtE0qjEYRw1omJCQfHtxMQehCodBPOvO8ijFtIRk7fXRFnBN6g3FkIiTxlSj\nM0nT49CszfCZF0uuDG5MxiMC38QglMItC14MqMwfmx/kEzc2SwaifhejBsuZV/Yx\nDd6PPJtLm2KWGXQMwoNO964mW86YmiXvOIWYEK+/ewrCGU2aIeDkfalZvVnss/oO\nxDvW1Y0thW8OjevdThMqoygSU1/Cq8OkCDo/9bOZXqO2ab+TOwnZJbhuOTcK/hZ5\noIJivQhqavlxKK3diTA9ZoCdmmf1MdL24vUbCJN3iQKBgQD5v1If30DJGH0H1qpu\nCZyvjVLZ8dScU63z5XGotYLSRGabsxyhzfINdTrv+K8QPPtLwJuf2oG6qgu3qDsB\nJpUIKWQLpKnRTKAPpOt7jhBfO2jQ6tKHceAp26KENCphJSiFCZT8BOiF8hNvA1vf\nTh7LZey9M4micpFOT/ZDuyUiNwKBgQDzxXo0yH0bWB/jLb8QX3lhbpNNvRqVAvAt\nmkt/DzTOHBusTFA6s/VxCoHa1jPJA3Cjw2fs1AUjqUNjVAtZ5cXlC8WBkP6tPaqX\nfhY22P+sI/UrIO3pcOd+IITDPeSn8qa1Y52XEPYtaPzsxEV4z2LzM3aDNR4uqfLa\nduPl31Z1XQKBgQDR2i0LkvBBCU6l836pj3IVIM7pSwa3hKi6M6VZeYs/WzJMyifY\n3c/x9vtbAL85CcSuVl1t6JDxZEkMPVO3F9BKV101W1tF/vjPrGgiHbEsFCNyyJ22\nKb2N7nuUUrD5h9uQTgjd6tHnGw2xTkU4UdAWYMKYCGIyGcp230Gyj+IX6QKBgQCl\nCePM7JfW9XjRQ92BZkI1drl//jGLBSw6k6XdZhwoFtudcSU4OTJI0AZOdIsm4o9W\nMCuiKYE5PZWEIBh3SpsKkUesitAB1igy3IiJpayjjMyl4GtyiqAPwlBgJv0xv5Si\nZckBx9gDsnraiZ9HRZEGeqcX+dRvX1wuECQHM4fDeQKBgQCDHKcCAMv19pEdNbck\ndXdruHXZQsLovf/cwpiM7LLKalDs25DbTX1AQJb9PJjiVmdYs0y4dj7wFdZOONEk\nf8mSjMaxUlFA4lX37Ff8pJ0OxFHdYmj2MaGxnFfCZRrECdA3d7Dz4ETdiZzb5DP+\nqeRbS88/+CQTd3OMY4dw3spUNw==\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@servers-41539.iam.gserviceaccount.com",
  "client_id": "111488255338308493525",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40servers-41539.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

// تم تعديل هذا السطر ليعالج النزول لسطر جديد تلقائياً لمنع توقف السيرفر على ريندر
centralFirebaseConfig.private_key = centralFirebaseConfig.private_key.replace(/\\n/g, '\n');

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(centralFirebaseConfig)
    });
}
const dbCentral = admin.firestore();

// ==========================================
// 2. إعداد بوت التلجرام ولوحة التحكم الذكية
// ==========================================
const BOT_TOKEN = '8928251813:AAHHCgMXA-YJ8CXcWgLELVPsspOe-qsRgWc'; 
const bot = new Telegraf(BOT_TOKEN);

// جلسة مؤقتة لتخزين خطوات الإدخال في البوت لكل مستخدم
const userSessions = {};

// دالة تفكيك كود الفايربيس المستخرج تلقائياً من النص
function extractFirebaseConfig(htmlContent) {
    const configRegex = /const\s+firebaseConfig\s*=\s*\{([\s\S]*?)\};/;
    const match = htmlContent.match(configRegex);
    if (!match) return null;
    try {
        const jsonString = `{${match[1]}}`
            .replace(/([a-zA-Z0-9_]+)\s*:/g, '"$1":')
            .replace(/'/g, '"')
            .replace(/,\s*}/g, '}');
        return JSON.parse(jsonString);
    } catch (e) { return null; }
}

// قائمة التحكم الرئيسية
bot.start((ctx) => {
    ctx.reply('🌋 أهلاً بك في لوحة تحكم ماغما المتقدمة لإدارة البنوك والحماية سحابياً.',
        Markup.keyboard([
            ['📋 عرض البنوك والسيرفرات', '➕ إضافة بنك جديد']
        ]).resize()
    );
});

// عرض البنوك الحالية مع إيموجي الحالة (🔗 آمن / ⛓️‍💥 مكشوف)
bot.hears('📋 عرض البنوك والسيرفرات', async (ctx) => {
    try {
        const snapshot = await dbCentral.collection('registered_banks').get();
        if (snapshot.empty) {
            return ctx.reply('📭 لا توجد أي بنوك مسجلة حالياً، اضغط على زر إضافة بنك جديد.');
        }

        const buttons = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const statusEmoji = (data.mode === 'official' && data.allowedDomains && data.allowedDomains.length > 0) ? '🔗' : '⛓️‍💥';
            buttons.push([Markup.button.callback(`${statusEmoji} ${data.bankName}`, `manage_bank:${doc.id}`)]);
        });

        ctx.reply('🗂️ اختر البنك الذي ترغب في استعراض بياناته وإدارته:', Markup.inlineKeyboard(buttons));
    } catch (e) {
        ctx.reply('❌ حدث خطأ أثناء جلب البيانات من القاعدة المركزية.');
    }
});

// نافذة إدارة البنك عند الضغط على زر البنك
bot.action(/^manage_bank:(.+)$/, async (ctx) => {
    const bankId = ctx.match[1];
    try {
        const doc = await dbCentral.collection('registered_banks').doc(bankId).get();
        if (!doc.exists) return ctx.reply('❌ البنك غير موجود!');

        const data = doc.data();
        const domainsList = (data.allowedDomains && data.allowedDomains.length > 0) ? data.allowedDomains.join('\n') : 'لا توجد روابط محددة بعد';
        
        const text = `🏦 *إدارة بنك: ${data.bankName}*\n\n` +
                     `⚙️ *وضع التشغيل الحالي:* ${data.mode === 'official' ? '🔴 رسمي (محمي)' : '🟡 وضع الاختبار (مفتوح)'}\n\n` +
                     `🔗 *الروابط المحددة المسموحة (الدومينات):*\n\`\`\`\n${domainsList}\n\`\`\`\n` +
                     `🔥 *قاعدة فايربيس المرفوعة منك:* \`${data.firebaseConfig.projectId}\`\n` +
                     `🚀 *رابط سيرفر ريندر المولد لك:*\n\`https://${ctx.host || 'magma-api.onrender.com'}/api/${bankId}/secure-action\``;

        const inlineKeyboard = [
            [
                Markup.button.callback(`🔄 تبديل إلى: ${data.mode === 'official' ? 'وضع الاختبار' : 'الوضع الرسمي'}`, `toggle_mode:${bankId}`),
            ],
            [
                Markup.button.callback('➕ إضافة دومين (رابط)', `add_domain_prompt:${bankId}`),
                Markup.button.callback('🗑️ حذف البنك', `delete_bank:${bankId}`)
            ]
        ];

        ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(inlineKeyboard) });
    } catch (e) { ctx.reply('❌ خطأ في معالجة الطلب.'); }
});

// التبديل بين وضع الاختبار والوضع الرسمي
bot.action(/^toggle_mode:(.+)$/, async (ctx) => {
    const bankId = ctx.match[1];
    const doc = await dbCentral.collection('registered_banks').doc(bankId).get();
    if (!doc.exists) return;

    const currentMode = doc.data().mode || 'test';
    const newMode = currentMode === 'official' ? 'test' : 'official';

    await dbCentral.collection('registered_banks').doc(bankId).update({ mode: newMode });
    ctx.answerCbQuery(`تم التغيير إلى ${newMode === 'official' ? 'الوضع الرسمي 🔴' : 'وضع الاختبار 🟡'}`);
    
    // إعادة تحديث الواجهة
    ctx.reply(`✅ تم تحديث وضع تشغيل البنك بنجاح.`);
});

// طلب إضافة رابط (دومين) جديد
bot.action(/^add_domain_prompt:(.+)$/, (ctx) => {
    const bankId = ctx.match[1];
    userSessions[ctx.from.id] = { step: 'awaiting_domain', bankId: bankId };
    ctx.reply('🌐 من فضلك أرسل الرابط الرسمي للبنك الآن (مثال: https://magma-bank.com) لمنع التكرار والسبام:');
});

// استقبال طلب إضافة بنك جديد
bot.hears('➕ إضافة بنك جديد', (ctx) => {
    userSessions[ctx.from.id] = { step: 'awaiting_bank_name' };
    ctx.reply('📝 حسناً، أرسل لي اسم البنك الجديد أولاً:');
});

// معالج النصوص والمدخلات التسلسلية (منع السبام والتكرار والتحقق)
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const session = userSessions[userId];
    const text = ctx.message.text.trim();

    if (!session) {
        if (text.includes('firebaseConfig')) {
            ctx.reply('❌ يرجى استخدام زر "➕ إضافة بنك جديد" لاتباع نظام الحماية ومنع تكرار البيانات المرفوعة.');
        }
        return;
    }

    // الخطوة 1: استقبال اسم البنك
    if (session.step === 'awaiting_bank_name') {
        const dupCheck = await dbCentral.collection('registered_banks').where('bankName', '==', text).get();
        if (!dupCheck.empty) {
            return ctx.reply('❌ هذا البنك مسجل مسبقاً في النظام! الرجاء اختيار اسم آخر أو إدارة البنك الحالي.');
        }

        session.bankName = text;
        session.step = 'awaiting_html_script';
        return ctx.reply(`👍 تم اعتماد الاسم: *${text}*\nالآن أرسل كود الـ HTML البرمجي كاملاً (الذي يحتوي على الفايربيس الرسمي غير المستخرج المفاتيح):`, { parse_mode: 'Markdown' });
    }

    // الخطوة 2: استقبال الكود واستخراج البيانات وتأسيس البنك
    if (session.step === 'awaiting_html_script') {
        const config = extractFirebaseConfig(text);
        if (!config || !config.projectId) {
            return ctx.reply('❌ فشل استخراج مفاتيح الفايربيس! تأكد من أن الكود يحتوي على كود التأسيس الصحيح `const firebaseConfig = { ... }`.');
        }

        const bankId = config.projectId;

        const idCheck = await dbCentral.collection('registered_banks').doc(bankId).get();
        if (idCheck.exists) {
            delete userSessions[userId];
            return ctx.reply('⚠️ هذه القاعدة تابعة لبنك مسجل ومحمي مسبقاً في السيرفر! تم حظر عملية التكرار.');
        }

        // إدخال ومعالجة مفتاح البنك المستهدف بشكل آمن قبل التأسيس
        if (config.privateKey) {
             config.privateKey = config.privateKey.replace(/\\n/g, '\n');
        }

        await dbCentral.collection('registered_banks').doc(bankId).set({
            bankName: session.bankName,
            firebaseConfig: config,
            mode: 'test', 
            allowedDomains: [],
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        delete userSessions[userId];
        ctx.reply(`🎉 تم إنشاء البنك بنجاح!\n\n📌 *اسم البنك:* ${session.bankName}\n🆔 *معرف القاعدة:* ${bankId}\n🟡 *الوضع الحالي:* وضع الاختبار (مسموح من كل المواقع للتجربة).\n\nاضغط على عرض البنوك لإدارته وإضافة الدومينات الرسمية وتحويله لوضع رسمي.`, { parse_mode: 'Markdown' });
    }

    // خطوة إضافة دومين (رابط معتمد) للبنك
    if (session.step === 'awaiting_domain') {
        const bankId = session.bankId;
        let formattedDomain = text.toLowerCase().replace(/\/$/, ""); 

        const docRef = dbCentral.collection('registered_banks').doc(bankId);
        const doc = await docRef.get();
        
        if (doc.exists) {
            const data = doc.data();
            const domains = data.allowedDomains || [];

            if (domains.includes(formattedDomain)) {
                delete userSessions[userId];
                return ctx.reply('⚠️ هذا الرابط (الدومين) مضاف ومسجل مسبقاً لهذا البنك المالي!');
            }

            domains.push(formattedDomain);
            await docRef.update({ allowedDomains: domains });
            delete userSessions[userId];
            ctx.reply(`✅ تم بنجاح إضافة الرابط المعتمد: \`${formattedDomain}\` للبنك ونشط حمايته حصرياً.`, { parse_mode: 'Markdown' });
        }
    }
});

// حذف بنك نهائياً
bot.action(/^delete_bank:(.+)$/, async (ctx) => {
    const bankId = ctx.match[1];
    await dbCentral.collection('registered_banks').doc(bankId).delete();
    ctx.answerCbQuery('تم حذف البنك بنجاح 🗑️');
    ctx.reply('🗑️ تم إزالة البنك وإلغاء توجيه سيرفر ريندر الخاص به بنجاح.');
});


// ==========================================
// 3. مسارات الحماية والبث عبر السيرفر (Express)
// ==========================================

app.get('/ping', (req, res) => {
    res.status(200).send('ok');
});

app.post('/api/:bankId/secure-action', async (req, res) => {
    const { bankId } = req.params;
    const clientData = req.body;
    
    const clientOrigin = req.headers.origin || req.headers.referer || "";
    const cleanOrigin = clientOrigin.toLowerCase().replace(/\/$/, "");

    try {
        const bankDoc = await dbCentral.collection('registered_banks').doc(bankId).get();
        if (!bankDoc.exists) {
            return res.status(404).json({ success: false, message: "البوابة غير مسجلة!" });
        }

        const bankData = bankDoc.data();

        if (bankData.mode === 'official') {
            const allowed = bankData.allowedDomains || [];
            const isMatch = allowed.some(domain => cleanOrigin.startsWith(domain));
            
            if (!isMatch) {
                return res.status(403).json({ 
                    success: false, 
                    message: "⚠️ رفض تفتيش أمني: هذا النطاق أو الموقع غير مصرح له باستخدام سيرفر الحماية المالي هذا!" 
                });
            }
        } 

        if (clientData.actionType === 'request_visit') {
            const currentDay = new Date().getUTCDay(); 
            if (![4, 5, 6].includes(currentDay)) {
                return res.status(403).json({ 
                    success: false, 
                    message: "🚫 النظام مغلق اليوم، خيار طلب الزيارة متاح فقط أيام الخميس والجمعة والسبت." 
                });
            }
        }

        let targetApp;
        if (admin.apps.some(app => app.name === bankId)) {
            targetApp = admin.app(bankId);
        } else {
            targetApp = admin.initializeApp({
                credential: admin.credential.cert(bankData.firebaseConfig)
            }, bankId);
        }

        const dbTarget = targetApp.firestore();
        await dbTarget.collection('visits').add({
            ...clientData,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(200).json({ success: true, message: "تمت المعاملة وتأمين نقل البيانات." });

    } catch (error) {
        console.error("Central Guard Error:", error);
        res.status(500).json({ success: false, message: "خطأ في معالجة البيانات السحابية." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`System running on port ${PORT}`);
    bot.launch().then(() => console.log('Advanced Admin Protection Bot Linked!'));
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
                                                       
