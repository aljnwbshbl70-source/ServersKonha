const admin = require('firebase-admin');

// Railway سيقوم بتزويدنا بهذا المتغير (سنتعلمه في الخطوة 3)
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const dbCentral = admin.firestore();

// ... باقي كود البوت كما هو ...

// ==========================================
// 2. إعداد بوت التلجرام ولوحة التحكم الذكية
// ==========================================
const BOT_TOKEN = '8928251813:AAHHCgMXA-YJ8CXcWgLELVPsspOe-qsRgWc'; 
const bot = new Telegraf(BOT_TOKEN);

const userSessions = {};

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

bot.start((ctx) => {
    ctx.reply('🌋 أهلاً بك في لوحة تحكم ماغما المتقدمة لإدارة البنوك والحماية سحابياً.',
        Markup.keyboard([
            ['📋 عرض البنوك والسيرفرات', '➕ إضافة بنك جديد']
        ]).resize()
    );
});

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
            [Markup.button.callback(`🔄 تبديل إلى: ${data.mode === 'official' ? 'وضع الاختبار' : 'الوضع الرسمي'}`, `toggle_mode:${bankId}`)],
            [Markup.button.callback('➕ إضافة دومين (رابط)', `add_domain_prompt:${bankId}`), Markup.button.callback('🗑️ حذف البنك', `delete_bank:${bankId}`)]
        ];

        ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(inlineKeyboard) });
    } catch (e) { ctx.reply('❌ خطأ في معالجة الطلب.'); }
});

bot.action(/^toggle_mode:(.+)$/, async (ctx) => {
    const bankId = ctx.match[1];
    const doc = await dbCentral.collection('registered_banks').doc(bankId).get();
    if (!doc.exists) return;

    const currentMode = doc.data().mode || 'test';
    const newMode = currentMode === 'official' ? 'test' : 'official';

    await dbCentral.collection('registered_banks').doc(bankId).update({ mode: newMode });
    ctx.answerCbQuery(`تم التغيير إلى ${newMode === 'official' ? 'الوضع الرسمي 🔴' : 'وضع الاختبار 🟡'}`);
    ctx.reply(`✅ تم تحديث وضع تشغيل البنك بنجاح.`);
});

bot.action(/^add_domain_prompt:(.+)$/, (ctx) => {
    const bankId = ctx.match[1];
    userSessions[ctx.from.id] = { step: 'awaiting_domain', bankId: bankId };
    ctx.reply('🌐 من فضلك أرسل الرابط الرسمي للبنك الآن (مثال: https://magma-bank.com) لمنع التكرار والسبام:');
});

bot.hears('➕ إضافة بنك جديد', (ctx) => {
    userSessions[ctx.from.id] = { step: 'awaiting_bank_name' };
    ctx.reply('📝 حسناً، أرسل لي اسم البنك الجديد أولاً:');
});

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

    if (session.step === 'awaiting_bank_name') {
        const dupCheck = await dbCentral.collection('registered_banks').where('bankName', '==', text).get();
        if (!dupCheck.empty) {
            return ctx.reply('❌ هذا البنك مسجل مسبقاً في النظام! الرجاء اختيار اسم آخر أو إدارة البنك الحالي.');
        }

        session.bankName = text;
        session.step = 'awaiting_html_script';
        return ctx.reply(`👍 تم اعتماد الاسم: *${text}*\nالآن أرسل كود الـ HTML البرمجي كاملاً (الذي يحتوي على الفايربيس الرسمي غير المستخرج المفاتيح):`, { parse_mode: 'Markdown' });
    }

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
                return res.status(403).json({ success: false, message: "⚠️ رفض تفتيش أمني: هذا النطاق غير مصرح له!" });
            }
        } 

        if (clientData.actionType === 'request_visit') {
            const currentDay = new Date().getUTCDay(); 
            if (![4, 5, 6].includes(currentDay)) {
                return res.status(403).json({ success: false, message: "🚫 النظام مغلق اليوم." });
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
                
