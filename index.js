const TOKEN = process.env.BOT_TOKEN;
const LOG_CHANNEL = process.env.LOG_CHANNEL_ID;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(200).send('Bot server is active.');
    }
    try {
        const update = req.body;
        
        // בדיקה אם יש הודעה חדשה
        if (!update || !update.message) {
            return res.status(200).send('No message found.');
        }

        const message = update.message;
        const chatId = message.chat.id;
        const text = message.text || '';
        const messageId = message.message_id;
        // פונקציית עזר לשליחת הודעות לטלגרם
        const sendMessage = async (chat_id, text_to_send, reply_to) => {
            const url = `${TELEGRAM_API}/sendMessage`;
            const payload = {
                chat_id: chat_id,
                text: text_to_send
            };
            if (reply_to) {
                payload.reply_to_message_id = reply_to;
            }
            
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        };
        // זיהוי פקודות ותגובה בהתאם
        if (text === '/start') {
            await sendMessage(chatId, 'שלום! אני בוט הניהול שלך. אני פעיל ומקשיב לפקודות.', messageId);
        } 
        else if (text.startsWith('/warn')) {
            await sendMessage(chatId, '⚠️ אזהרה נרשמה למשתמש זה!', messageId);
        }
        else if (text.startsWith('/mute')) {
            await sendMessage(chatId, '🔇 המשתמש הושתק.', messageId);
        }
        else if (text.startsWith('/ban')) {
            await sendMessage(chatId, '⛔ המשתמש נחסם והורחק.', messageId);
        }
    } catch (error) {
        console.error('Error handling message:', error);
    }

    // חובה להחזיר 200 לטלגרם כדי שלא ישלחו את ההודעה שוב
    return res.status(200).send('OK');
};
