const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const FIREBASE_DB_URL = "https://volticmodbot-default-rtdb.firebaseio.com";

async function callTelegramAPI(method, payload) {
    try {
        if (!BOT_TOKEN) {
            console.error("ERROR: BOT_TOKEN is missing!");
            return { ok: false, error: "Missing token" };
        }
        const response = await fetch(`${TELEGRAM_API}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return await response.json();
    } catch (error) {
        console.error(`Error in callTelegramAPI for ${method}:`, error);
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
        console.error("Error checking admin status:", e);
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
        if (req.method !== 'POST') {
            return res.status(200).send('Voltic Mod Bot is active and running via REST.');
        }
        const update = req.body;
        if (!update) return res.status(200).send('No update body');

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
        
        const message = update.message;
        const text = message.text;
        const chatId = message.chat.id;
        const userId = message.from.id;
        const replyTo = message.reply_to_message;
        
        const isPrivate = message.chat.type === 'private';
        const isUserAdmin = isPrivate ? false : await isAdmin(chatId, userId);
        const lowerText = text.toLowerCase();
        if (lowerText.startsWith('/start')) {
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: '🛡️ וולטיק מוד בוט מחובר ל-Firebase ומוכן לפעולה קשוחה!' });
            return res.status(200).send('OK');
        }

        if (lowerText.startsWith('/help') || lowerText.startsWith('/עזרה')) {
            const helpMessage = `🛡️ *מדריך פקודות וולטיק מוד בוט:*\n\n` +
                                `👤 *פקודות כלליות:*\n` +
                                `/rules או /כללים - הצגת כללי הקבוצה\n\n` +
                                `👮 *פקודות מנהלים (בתוך קבוצה בלבד):*\n` +
                                `/kick או /בעט - בעיטת משתמש (בתגובה להודעה)\n` +
                                `/ban או /העף - חסימת משתמש (בתגובה להודעה)\n` +
                                `/unban או /בטל חסימה - ביטול חסימה\n` +
                                `/mute או /השתק - השתקת משתמש\n` +
                                `/unmute או /בטל השתקה - ביטול השתקה\n` +
                                `/setrules [כללים] - הגדרת כללי הקבוצה ושמירה ב-Firebase\n` +
                                `/guide או /מדריך - מדריך מפורט למנהלים לעיצוב הודעות`;
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: helpMessage, parse_mode: 'Markdown' });
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
            const unbanRes = await callTelegramAPI('unbanChatMember', { chat_id: chatId, user_id: replyTo.from.id, only_if_banned: true });
            if (unbanRes.ok) await callTelegramAPI('sendMessage', { chat_id: chatId, text: `👢 המשתמש נבעט מהקבוצה.` });
            return res.status(200).send('OK');
        }
        if (lowerText.startsWith('/ban') || lowerText.startsWith('/העף')) {
            if (!isUserAdmin || !replyTo) return res.status(200).send('OK');
            const banRes = await callTelegramAPI('banChatMember', { chat_id: chatId, user_id: replyTo.from.id });
            if (banRes.ok) await callTelegramAPI('sendMessage', { chat_id: chatId, text: `🔨 המשתמש נחסם לצמיתות מהקבוצה.` });
            return res.status(200).send('OK');
        }

        if (lowerText.startsWith('/unban') || lowerText.startsWith('/בטל חסימה')) {
            if (!isUserAdmin || !replyTo) return res.status(200).send('OK');
            const unbanRes = await callTelegramAPI('unbanChatMember', { chat_id: chatId, user_id: replyTo.from.id, only_if_banned: true });
            if (unbanRes.ok) await callTelegramAPI('sendMessage', { chat_id: chatId, text: `✅ החסימה בוטלה.` });
            return res.status(200).send('OK');
        }

        if (lowerText.startsWith('/mute') || lowerText.startsWith('/השתק')) {
            if (!isUserAdmin || !replyTo) return res.status(200).send('OK');
            await callTelegramAPI('restrictChatMember', { chat_id: chatId, user_id: replyTo.from.id, permissions: { can_send_messages: false } });
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: `🔇 המשתמש הושתק.` });
            return res.status(200).send('OK');
        }

        if (lowerText.startsWith('/unmute') || lowerText.startsWith('/בטל השתקה')) {
            if (!isUserAdmin || !replyTo) return res.status(200).send('OK');
            const permissions = { can_send_messages: true, can_send_audios: true, can_send_documents: true, can_send_photos: true, can_send_videos: true, can_send_other_messages: true, can_add_web_page_previews: true };
            await callTelegramAPI('restrictChatMember', { chat_id: chatId, user_id: replyTo.from.id, permissions });
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: `🔊 המשתמש יכול לדבר.` });
            return res.status(200).send('OK');
        }

        if (lowerText.startsWith('/setrules') || lowerText.startsWith('/הכנס כללים')) {
            if (!isUserAdmin) return res.status(200).send('OK');
            let newRules = text;
            if (lowerText.startsWith('/setrules')) newRules = text.substring(9).trim();
            else if (lowerText.startsWith('/הכנס כללים')) newRules = text.substring(11).trim();
            
            if (newRules) {
                await fetch(`${FIREBASE_DB_URL}/groups/${chatId}/rules.json`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newRules)
                });
                await callTelegramAPI('sendMessage', { chat_id: chatId, text: `✅ הכללים נשמרו בבטחה ב-Firebase.` });
            }
            return res.status(200).send('OK');
        }

        if (lowerText.startsWith('/rules') || lowerText.startsWith('/כללים')) {
            const fbRes = await fetch(`${FIREBASE_DB_URL}/groups/${chatId}/rules.json`);
            const rulesText = fbRes.ok ? await fbRes.json() : null;
            const rawString = rulesText || "טרם הוגדרו כללים לקבוצה זו.";
            const parsed = parseCustomFormatting(rawString);
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: `📜 *כללי הקבוצה:*\n${parsed.text}`, reply_markup: parsed.reply_markup, parse_mode: 'Markdown' });
            return res.status(200).send('OK');
        }

        return res.status(200).send('OK');
    } catch (globalError) {
        console.error("Global crash caught:", globalError);
        return res.status(200).send(`Error handled: ${globalError.message}`);
    }
}
