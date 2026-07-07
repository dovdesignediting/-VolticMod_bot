const TOKEN = process.env.BOT_TOKEN;
const LOG_CHANNEL = process.env.LOG_CHANNEL_ID;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(200).send('Bot server is active.');
    }
    try {
        const update = req.body;
        if (!update || !update.message) {
            return res.status(200).send('No message found.');
        }

        const message = update.message;
        const chatId = message.chat.id;
        const text = message.text || '';
        const messageId = message.message_id;
        
        // בדיקה אם ההודעה הנוכחית היא תגובה (Reply) למשתמש אחר
        const replyToMessage = message.reply_to_message;
        const repliedUserId = replyToMessage ? replyToMessage.from.id : null;
        const repliedFirstName = replyToMessage ? replyToMessage.from.first_name : 'המשתמש';
        // פונקציית עזר לשליחת הודעות טקסט רגילות
        const sendMessage = async (chat_id, text_to_send, reply_to) => {
            await fetch(`${TELEGRAM_API}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chat_id,
                    text: text_to_send,
                    reply_to_message_id: reply_to
                })
            });
        };

        // פונקציית עזר לביצוע פקודות ניהול מול ה-API של טלגרם
        const callBotAction = async (method, payload) => {
            await fetch(`${TELEGRAM_API}/${method}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        };
        // טיפול בפקודת סטארט
        if (text === '/start') {
            await sendMessage(chatId, 'שלום! אני בוט הניהול שלך. אני פעיל ומקשיב לפקודות.', messageId);
        } 
        // טיפול בפקודת חסימה והרחקה מהקבוצה
        else if (text.startsWith('/ban')) {
            if (!repliedUserId) {
                await sendMessage(chatId, '❌ שגיאה: יש לשלוח פקודה זו בתגובה (Reply) להודעה של המשתמש שברצונך לחסום.', messageId);
            } else {
                // ביצוע החסימה האמיתית בשרתי טלגרם
                await callBotAction('banChatMember', { chat_id: chatId, user_id: repliedUserId });
                await sendMessage(chatId, `⛔ המשתמש ${repliedFirstName} נחסם והורחק מהקבוצה לצמיתות.`, messageId);
            }
        }
        // טיפול בפקודת השתקה (Mute)
        else if (text.startsWith('/mute')) {
            if (!repliedUserId) {
                await sendMessage(chatId, '❌ שגיאה: יש לשלוח פקודה זו בתגובה (Reply) להודעה של המשתמש שברצונך להשתיק.', messageId);
            } else {
                // ביצוע ההשתקה האמיתית על ידי שלילת הרשאות כתיבה
                await callBotAction('restrictChatMember', { 
                    chat_id: chatId, 
                    user_id: repliedUserId, 
                    permissions: { can_send_messages: false } 
                });
                await sendMessage(chatId, `🔇 המשתמש ${repliedFirstName} הושתק ולא יוכל לשלוח הודעות.`, messageId);
            }
        }
    } catch (error) {
        console.error('Error handling message:', error);
    }

    return res.status(200).send('OK');
};
