const { Telegraf } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN is missing in environment variables');
}

const bot = new Telegraf(BOT_TOKEN);

const userWarnings = {};
bot.on('new_chat_members', async (ctx) => {
  const newMembers = ctx.message.new_chat_members;
  for (const member of newMembers) {
    const firstName = member.first_name;
    const username = member.username ? `@${member.username}` : firstName;
    
    const welcomeMessage = `👋 *ברוך הבא לבוט הקהילה שלנו!*\n\n` +
      `👤 משתמש: ${username}\n` +
      `📅 נא לשמור על חוקי הקבוצה ולהימנע מספאם.`;
      
    await ctx.replyWithMarkdown(welcomeMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📜 חוקי הקבוצה', callback_data: 'group_rules' }]
        ]
      }
    });
  }
});

bot.action('group_rules', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('חוקי הקבוצה:\n1. אין לפרסם קישורים ללא אישור מנהל.\n2. נא לשמור על שפה מכבדת.\n3. אין להציף את הצ\'אט בהודעות חוזרות.');
});
bot.on('message', async (ctx, next) => {
  if (!ctx.message || !ctx.message.text) return next();
  
  const text = ctx.message.text;
  const hasLink = /(https?:\/\/[^\s]+)/g.test(text) || /t\.me\/[^\s]+/g.test(text);
  
  const memberInfo = await ctx.getChatMember(ctx.from.id);
  const isAdmin = ['creator', 'administrator'].includes(memberInfo.status);
  
  if (hasLink && !isAdmin) {
    try {
      await ctx.deleteMessage();
      await ctx.reply(`⚠️ ${ctx.from.first_name}, שליחת קישורים אסורה בקבוצה זו ומוסרת מיידית!`);
      
      if (LOG_CHANNEL_ID) {
        await ctx.telegram.sendMessage(LOG_CHANNEL_ID, `🚨 *אנטי-ספאם:* נמחק קישור פרסומי שנשלח על ידי ${ctx.from.first_name} (ID: ${ctx.from.id})\n💬 תוכן ההודעה המקורית: ${text}`);
      }
    } catch (error) {
      console.error('Failed to handle spam link:', error);
    }
    return;
  }
  return next();
});
bot.command('warn', async (ctx) => {
  const memberInfo = await ctx.getChatMember(ctx.from.id);
  if (!['creator', 'administrator'].includes(memberInfo.status)) {
    return ctx.reply('❌ פקודה זו מיועדת למנהלי הקבוצה בלבד.');
  }

  if (!ctx.message.reply_to_message) {
    return ctx.reply('❌ יש להשתמש בפקודה זו כתגובה (Reply) להודעה של המשתמש שברצונך להזהיר.');
  }

  const targetUser = ctx.message.reply_to_message.from;
  const targetId = targetUser.id;

  if (!userWarnings[targetId]) {
    userWarnings[targetId] = 0;
  }

  userWarnings[targetId] += 1;
  const currentWarns = userWarnings[targetId];

  if (currentWarns >= 3) {
    try {
      await ctx.banChatMember(targetId);
      userWarnings[targetId] = 0;
      await ctx.reply(`🚫 ${targetUser.first_name} צבר 3 אזהרות ונחסם מהקבוצה לצמיתות.`);
      if (LOG_CHANNEL_ID) {
        await ctx.telegram.sendMessage(LOG_CHANNEL_ID, `🚫 *חסימה אוטומטית:* המשתמש ${targetUser.first_name} נחסם לאחר שהגיע לרף המקסימלי של 3 אזהרות.`);
      }
    } catch (e) {
      await ctx.reply('❌ לא הצלחתי לחסום את המשתמש. ודא שהבוט הוגדר כמנהל עם הרשאות מחיקה וחסימה.');
    }
  } else {
    await ctx.reply(`⚠️ ל-${targetUser.first_name} ניתנה אזהרה רשמית על ידי מנהל. (${currentWarns}/3)`);
    if (LOG_CHANNEL_ID) {
      await ctx.telegram.sendMessage(LOG_CHANNEL_ID, `⚠️ *אזהרה מנהלתית:* ניתנה אזהרה ל-${targetUser.first_name}. מצב הנוכחי שלו בקבוצה: ${currentWarns}/3`);
    }
  }
});

bot.command('ban', async (ctx) => {
  const memberInfo = await ctx.getChatMember(ctx.from.id);
  if (!['creator', 'administrator'].includes(memberInfo.status)) {
    return ctx.reply('❌ פקודה זו מיועדת למנהלי הקבוצה בלבד.');
  }

  if (!ctx.message.reply_to_message) {
    return ctx.reply('❌ יש להשתמש בפקודה זו כתגובה (Reply) להודעה של המשתמש שברצונך לחסום.');
  }

  const targetUser = ctx.message.reply_to_message.from;
  try {
    await ctx.banChatMember(targetUser.id);
    await ctx.reply(`🚫 המשתמש ${targetUser.first_name} נחסם מהקבוצה בהצלחה.`);
    if (LOG_CHANNEL_ID) {
      await ctx.telegram.sendMessage(LOG_CHANNEL_ID, `🚫 *חסימה ידנית:* ${targetUser.first_name} נחסם מהקבוצה על ידי המנהל ${ctx.from.first_name}.`);
    }
  } catch (e) {
    await ctx.reply('❌ שגיאה בביצוע החסימה. ודא שהבוט מוגדר כמנהל עם הרשאות מלאות בצ\'אט.');
  }
});
bot.on('edited_message', async (ctx) => {
  if (!ctx.editedMessage || !ctx.editedMessage.text) return;

  const user = ctx.editedMessage.from;
  const currentText = ctx.editedMessage.text;
  
  if (LOG_CHANNEL_ID) {
    const logMsg = `📝 *הודעה נערכה בקבוצה*\n` +
      `👤 משתמש: ${user.first_name} (${user.username ? '@' + user.username : 'ללא שם משתמש'})\n` +
      `🆔 מזהה משתמש: ${user.id}\n` +
      `💬 תוכן עדכני לאחר עריכה: ${currentText}`;
    try {
      await ctx.telegram.sendMessage(LOG_CHANNEL_ID, logMsg);
    } catch (err) {
      console.error('Failed to send update to log channel:', err);
    }
  }
});

bot.on('left_chat_member', async (ctx) => {
  const user = ctx.message.left_chat_member;
  if (LOG_CHANNEL_ID) {
    const logMsg = `🏃‍♂️ *משתמש עזב או הוסר מהקבוצה*\n` +
      `👤 שם המשתמש: ${user.first_name}\n` +
      `🆔 מזהה ייחודי: ${user.id}`;
    try {
      await ctx.telegram.sendMessage(LOG_CHANNEL_ID, logMsg);
    } catch (err) {
      console.error('Failed to send leave log to monitor channel:', err);
    }
  }
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    await bot.handleUpdate(req.body);
    res.status(200).send('OK');
  } catch (err) {
    console.error('Error handling Telegram update:', err);
    res.status(500).send('Internal Server Error');
  }
};
