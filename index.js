const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const FIREBASE_DB_URL = "https://volticmodbot-default-rtdb.firebaseio.com";

async function callTelegramAPI(method, payload) {
    try {
        if (!BOT_TOKEN) return { ok: false, error: "Missing token" };
        const response = await fetch(`${TELEGRAM_API}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return await response.json();
    } catch (error) {
        console.error(`Error in ${method}:`, error);
        return { ok: false, error };
    }
}
async function isAdmin(chatId, userId) {
    try {
        if (!chatId || !userId) return false;
        const res = await callTelegramAPI('getChatMember', { chat_id: chatId, user_id: userId });
        if (res.ok && res.result) {
            const status = res.result.status;
            return status === 'administrator' || status === 'creator';
        }
        return false;
    } catch (e) {
        return false;
    }
}

function parseCustomFormatting(rawText) {
    const btnRegex = /\{([^}]+)\}-\{([^}]+)\}/g;
    let match;
    let inline_keyboard = [];
    let cleanText = rawText;
    while ((match = btnRegex.exec(rawText)) !== null) {
        const btnText = match[1].trim();
        const btnUrl = match[2].replace(/\+/g, '%2B').trim();
        inline_keyboard.push([{ text: btnText, url: btnUrl }]);
        cleanText = cleanText.replace(match[0], '');
    }
    return { 
        text: cleanText.trim(), 
        reply_markup: inline_keyboard.length > 0 ? { inline_keyboard } : undefined 
    };
}
export default async function handler(req, res) {
    try {
        if (req.method !== 'POST') return res.status(200).send('Voltic Mod Bot is active via REST.');
        const update = req.body;
        if (!update) return res.status(200).send('OK');

        if (update.message && update.message.new_chat_members) {
            const chatId = update.message.chat.id;
            for (const user of update.message.new_chat_members) {
                if (user.id !== update.message.from.id) continue;
                const fbRes = await fetch(`${FIREBASE_DB_URL}/groups/${chatId}/welcome.json`);
                const welcomeText = fbRes.ok ? await fbRes.json() : null;
                const rawString = welcomeText || `👋 ברוך הבא לקבוצה, ${user.first_name}!`;
                const parsed = parseCustomFormatting(rawString);
                await callTelegramAPI('sendMessage', { chat_id: chatId, text: parsed.text, reply_markup: parsed.reply_markup, parse_mode: 'Markdown' });
            }
            return res.status(200).send('OK');
        }

        if (!update.message || !update.message.text) return res.status(200).send('OK');
        const message = update.message; const text = message.text; const chatId = message.chat.id;
        const userId = message.from.id; const replyTo = message.reply_to_message;
        const isUserAdmin = message.chat.type === 'private' ? false : await isAdmin(chatId, userId);
        const lowerText = text.toLowerCase();
        if (lowerText.startsWith('/start')) {
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: '🛡️ וולטיק מוד בוט מוכן לפעולה!' });
            return res.status(200).send('OK');
        }
        if (lowerText.startsWith('/help') || lowerText.startsWith('/עזרה')) {
            const helpMsg = `🛡️ *הוראות:*\n/rules - כללים\n/kick - בעט\n/ban - חסום\n/unban - בטל חסימה\n/mute - השתק\n/unmute - בטל השתקה\n/setrules [טקסט] - קבע כללים\n/guide - מדריך מפורט למנהלים`;
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: helpMsg, parse_mode: 'Markdown' });
            return res.status(200).send('OK');
        }
        if (lowerText.startsWith('/guide') || lowerText.startsWith('/מדריך')) {
            const guideMsg = `📚 *מדריך מפורט לשימוש בבוט:*\n\n` +
                             `*1. פקודות ניהול משתמשים:*\n` +
                             `כדי להשתמש בפקודות כמו בעט/חסום/השתק, חובה לעשות *השב (Reply)* להודעה של המשתמש עליו תרצה להפעיל את הפקודה, ואז לשלוח את הפקודה.\n\n` +
                             `*2. הוספת כפתורים לכללים / ברוך הבא:*\n` +
                             `בתוך פקודת ה- /setrules, תוכל להוסיף כפתור שקוף על ידי כתיבת שם הכפתור בתוך סוגריים מסולסלים, מקף, והקישור בסוגריים מסולסלים. לדוגמה:\n` +
                             `{לאתר שלי}-{https://example.com}\n\n` +
                             `*3. עיצוב טקסט:*\n` +
                             `הדגשה: שים * בתחילת ובסוף המילה (*דוגמה*).\n` +
                             `נטוי: שים _ בתחילת ובסוף המילה (_דוגמה_).\n` +
                             `אם תרצה לכתוב שם משתמש עם קו תחתון מבלי שזה יהפוך לנטוי, שים לוכסן הפוך לפניו (\\_).`;
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: guideMsg, parse_mode: 'Markdown' });
            return res.status(200).send('OK');
        }
        if (lowerText.startsWith('/kick') || lowerText.startsWith('/בעט')) {
            if (!isUserAdmin || !replyTo) return res.status(200).send('OK');
            await callTelegramAPI('banChatMember', { chat_id: chatId, user_id: replyTo.from.id });
            await callTelegramAPI('unbanChatMember', { chat_id: chatId, user_id: replyTo.from.id, only_if_banned: true });
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: `👢 נבעט.` });
            return res.status(200).send('OK');
        }
        if (lowerText.startsWith('/ban') || lowerText.startsWith('/העף')) {
            if (!isUserAdmin || !replyTo) return res.status(200).send('OK');
            await callTelegramAPI('banChatMember', { chat_id: chatId, user_id: replyTo.from.id });
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: `🔨 נחסם לצמיתות.` });
            return res.status(200).send('OK');
        }
        if (lowerText.startsWith('/unban') || lowerText.startsWith('/בטל חסימה')) {
            if (!isUserAdmin || !replyTo) return res.status(200).send('OK');
            await callTelegramAPI('unbanChatMember', { chat_id: chatId, user_id: replyTo.from.id, only_if_banned: true });
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: `✅ חסימה בוטלה.` });
            return res.status(200).send('OK');
        }
        if (lowerText.startsWith('/mute') || lowerText.startsWith('/השתק')) {
            if (!isUserAdmin || !replyTo) return res.status(200).send('OK');
            await callTelegramAPI('restrictChatMember', { chat_id: chatId, user_id: replyTo.from.id, permissions: { can_send_messages: false } });
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: `🔇 הושתק.` });
            return res.status(200).send('OK');
        }
        if (lowerText.startsWith('/unmute') || lowerText.startsWith('/בטל השתקה')) {
            if (!isUserAdmin || !replyTo) return res.status(200).send('OK');
            const perm = { can_send_messages: true, can_send_audios: true, can_send_documents: true, can_send_photos: true, can_send_videos: true, can_send_other_messages: true, can_add_web_page_previews: true };
            await callTelegramAPI('restrictChatMember', { chat_id: chatId, user_id: replyTo.from.id, permissions: perm });
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: `🔊 הוסרה השתקה.` });
            return res.status(200).send('OK');
        }
        if (lowerText.startsWith('/setrules') || lowerText.startsWith('/הכנס כללים')) {
            if (!isUserAdmin) return res.status(200).send('OK');
            let newRules = lowerText.startsWith('/setrules') ? text.substring(9).trim() : text.substring(11).trim();
            if (newRules) {
                await fetch(`${FIREBASE_DB_URL}/groups/${chatId}/rules.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newRules) });
                await callTelegramAPI('sendMessage', { chat_id: chatId, text: `✅ כללים עודכנו.` });
            }
            return res.status(200).send('OK');
        }
        if (lowerText.startsWith('/rules') || lowerText.startsWith('/כללים')) {
            const fbRes = await fetch(`${FIREBASE_DB_URL}/groups/${chatId}/rules.json`);
            const rulesText = fbRes.ok ? await fbRes.json() : null;
            const parsed = parseCustomFormatting(rulesText || "טרם הוגדרו כללים.");
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: `📜 *כללים:*\n${parsed.text}`, reply_markup: parsed.reply_markup, parse_mode: 'Markdown' });
            return res.status(200).send('OK');
        }

        return res.status(200).send('OK');
    } catch (e) {
        console.error("Crash:", e);
        return res.status(200).send('Error handled');
    }
}
