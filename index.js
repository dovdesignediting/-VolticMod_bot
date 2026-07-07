const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function callTelegramAPI(method, payload) {
    try {
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
    if (!chatId || !userId) return false;
    const res = await callTelegramAPI('getChatMember', { chat_id: chatId, user_id: userId });
    if (res.ok && res.result) {
        const status = res.result.status;
        return status === 'administrator' || status === 'creator';
    }
    return false;
}
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(200).send('Voltic Mod Bot Server is Active.');
    }
    
    const update = req.body;
    if (!update || !update.message) {
        return res.status(200).send('OK');
    }
    
    const message = update.message;
    const text = message.text || '';
    const chatId = message.chat.id;
    const userId = message.from.id;
    const replyToMessage = message.reply_to_message;

    if (text.startsWith('/start')) {
        await callTelegramAPI('sendMessage', {
            chat_id: chatId,
            text: '🛡️ וולטיק מוד בוט פעיל ומוכן! תנו לי הרשאות ניהול בקבוצה ונתחיל לשמור על הסדר.',
            reply_to_message_id: message.message_id
        });
        return res.status(200).send('OK');
    }

    const isUserAdmin = await isAdmin(chatId, userId);

    if (text.startsWith('/del')) {
        if (!isUserAdmin) return res.status(200).send('OK');
        if (replyToMessage) {
            await callTelegramAPI('deleteMessage', {
                chat_id: chatId,
                message_id: replyToMessage.message_id
            });
            await callTelegramAPI('deleteMessage', {
                chat_id: chatId,
                message_id: message.message_id
            });
        }
        return res.status(200).send('OK');
    }
    if (text.startsWith('/ban')) {
        if (!isUserAdmin) return res.status(200).send('OK');
        if (!replyToMessage) {
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: '⚠️ נא להגיב להודעה של המשתמש כדי לחסום אותו.' });
            return res.status(200).send('OK');
        }
        const targetId = replyToMessage.from.id;
        const resBan = await callTelegramAPI('banChatMember', { chat_id: chatId, user_id: targetId });
        if (resBan.ok) {
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: `🔨 המשתמש נחסם והורחק מהקבוצה.` });
        }
        return res.status(200).send('OK');
    }

    if (text.startsWith('/unban')) {
        if (!isUserAdmin) return res.status(200).send('OK');
        if (!replyToMessage) {
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: '⚠️ נא להגיב להודעה של המשתמש כדי לבטל חסימה.' });
            return res.status(200).send('OK');
        }
        const targetId = replyToMessage.from.id;
        const resUnban = await callTelegramAPI('unbanChatMember', { chat_id: chatId, user_id: targetId, only_if_banned: true });
        if (resUnban.ok) {
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: `✅ חסימת המשתמש בוטלה בהצלחה.` });
        }
        return res.status(200).send('OK');
    }

    if (text.startsWith('/kick')) {
        if (!isUserAdmin) return res.status(200).send('OK');
        if (!replyToMessage) {
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: '⚠️ נא להגיב להודעה של המשתמש כדי לבעוט אותו.' });
            return res.status(200).send('OK');
        }
        const targetId = replyToMessage.from.id;
        await callTelegramAPI('banChatMember', { chat_id: chatId, user_id: targetId });
        const resKick = await callTelegramAPI('unbanChatMember', { chat_id: chatId, user_id: targetId, only_if_banned: true });
        if (resKick.ok) {
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: `👢 המשתמש נבעט מהקבוצה (הוא יוכל לחזור בעתיד עם קישור).` });
        }
        return res.status(200).send('OK');
    }
    if (text.startsWith('/mute')) {
        if (!isUserAdmin) return res.status(200).send('OK');
        if (!replyToMessage) {
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: '⚠️ נא להגיב להודעה של המשתמש כדי להשתיק אותו.' });
            return res.status(200).send('OK');
        }
        const targetId = replyToMessage.from.id;
        const permissions = {
            can_send_messages: false, can_send_audios: false, can_send_documents: false,
            can_send_photos: false, can_send_videos: false, can_send_video_notes: false,
            can_send_voice_notes: false, can_send_polls: false, can_send_other_messages: false,
            can_add_web_page_previews: false
        };
        const resMute = await callTelegramAPI('restrictChatMember', { chat_id: chatId, user_id: targetId, permissions });
        if (resMute.ok) {
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: `🔇 המשתמש הושתק ולא יכול לשלוח הודעות.` });
        }
        return res.status(200).send('OK');
    }

    if (text.startsWith('/unmute')) {
        if (!isUserAdmin) return res.status(200).send('OK');
        if (!replyToMessage) {
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: '⚠️ נא להגיב להודעה של המשתמש כדי לבטל השתקה.' });
            return res.status(200).send('OK');
        }
        const targetId = replyToMessage.from.id;
        const permissions = {
            can_send_messages: true, can_send_audios: true, can_send_documents: true,
            can_send_photos: true, can_send_videos: true, can_send_video_notes: true,
            can_send_voice_notes: true, can_send_polls: true, can_send_other_messages: true,
            can_add_web_page_previews: true
        };
        const resUnmute = await callTelegramAPI('restrictChatMember', { chat_id: chatId, user_id: targetId, permissions });
        if (resUnmute.ok) {
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: `🔊 המשתמש שוחרר מהשתקה ויכול לדבר.` });
        }
        return res.status(200).send('OK');
    }
    if (text.startsWith('/pin')) {
        if (!isUserAdmin) return res.status(200).send('OK');
        if (!replyToMessage) {
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: '⚠️ נא להגיב להודעה שברצונך לנעוץ.' });
            return res.status(200).send('OK');
        }
        const resPin = await callTelegramAPI('pinChatMessage', { 
            chat_id: chatId, 
            message_id: replyToMessage.message_id,
            disable_notification: false 
        });
        if (resPin.ok) {
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: `📌 ההודעה ננעצה בהצלחה.` });
        }
        return res.status(200).send('OK');
    }

    if (text.startsWith('/unpin')) {
        if (!isUserAdmin) return res.status(200).send('OK');
        if (replyToMessage) {
            await callTelegramAPI('unpinChatMessage', { chat_id: chatId, message_id: replyToMessage.message_id });
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: `📍 הנעיצה בוטלה להודעה שנבחרה.` });
        } else {
            await callTelegramAPI('unpinAllChatMessages', { chat_id: chatId });
            await callTelegramAPI('sendMessage', { chat_id: chatId, text: `📍 כל ההודעות הנעוצות בקבוצה בוטלו.` });
        }
        return res.status(200).send('OK');
    }

    return res.status(200).send('OK');
}
