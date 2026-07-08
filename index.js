import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, child } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDyPFBNAKeH3ubyhkdvlfNvjNFal5aG4EM",
  authDomain: "volticmodbot.firebaseapp.com",
  databaseURL: "https://volticmodbot-default-rtdb.firebaseio.com",
  projectId: "volticmodbot",
  storageBucket: "volticmodbot.firebasestorage.app",
  messagingSenderId: "904461831147",
  appId: "1:904461831147:web:f86fa606f9fb996B05a7ae"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
async function callTelegramAPI(method, payload) {
    try {
        if (!BOT_TOKEN) {
            console.error("ERROR: BOT_TOKEN is missing in Vercel environment variables!");
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
export default async function handler(req, res) {
    try {
        if (req.method !== 'POST') {
            return res.status(200).send('Voltic Mod Bot is active and running.');
        }
        const update = req.body;
        if (!update) return res.status(200).send('No update body');

        if (update.message && update.message.new_chat_members) {
            const chatId = update.message.chat.id;
            for (const user of update.message.new_chat_members) {
                if (user.id !== update.message.from.id) continue;
                const dbRef = ref(db);
                const snapshot = await get(child(dbRef, `groups/${chatId}/welcome`));
                const welcomeText = snapshot.exists() ? snapshot.val() : `👋 ברוך הבא לקבוצה, ${user.first_name}!`;
                await callTelegramAPI('sendMessage', { chat_id: chatId, text: welcomeText });
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
                                `/setrules [כללים] - הגדרת כללי הקבוצה ושמירה ב-Firebase`;
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: helpMessage, parse_mode: 'Markdown' });
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
                await set(ref(db, `groups/${chatId}/rules`), newRules);
                await callTelegramAPI('sendMessage', { chat_id: chatId, text: `✅ הכללים נשמרו בבטחה ב-Firebase.` });
            }
            return res.status(200).send('OK');
        }

        if (lowerText.startsWith('/rules') || lowerText.startsWith('/כללים')) {
            const dbRef = ref(db);
            const snapshot = await get(child(dbRef, `groups/${chatId}/rules`));
            const rulesText = snapshot.exists() ? snapshot.val() : "טרם הוגדרו כללים לקבוצה זו.";
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: `📜 *כללי הקבוצה:*\n${rulesText}`, parse_mode: 'Markdown' });
            return res.status(200).send('OK');
        }

        return res.status(200).send('OK');
    } catch (globalError) {
        console.error("Global crash caught:", globalError);
        return res.status(200).send(`Error handled: ${globalError.message}`);
    }
}
