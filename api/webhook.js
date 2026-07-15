// ============================================
// Voltic Mod Bot - בוט ניהול קבוצות טלגרם
// Node.js Serverless Function (Vercel) + Firebase Realtime Database
// ללא שימוש בספריות חיצוניות - fetch מובנה בלבד
// ============================================

const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const FIREBASE_URL = "https://volticmodbot-default-rtdb.firebaseio.com";

// ----------- פונקציות עזר לתקשורת עם Telegram -----------

async function telegramRequest(method, params) {
  try {
    const response = await fetch(`${TELEGRAM_API}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });
    const data = await response.json();
    if (!data.ok) {
      console.error(`שגיאה בקריאה ל-${method}:`, data.description);
    }
    return data;
  } catch (error) {
    console.error(`שגיאת רשת בקריאה ל-${method}:`, error.message);
    return null;
  }
}

// ----------- פונקציות עזר לתקשורת עם Firebase -----------

async function firebaseGet(path) {
  try {
    const response = await fetch(`${FIREBASE_URL}/${path}.json`);
    if (!response.ok) return null;
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`שגיאה בקריאה מ-Firebase (${path}):`, error.message);
    return null;
  }
}

async function firebaseSet(path, value) {
  try {
    const response = await fetch(`${FIREBASE_URL}/${path}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value)
    });
    if (!response.ok) return false;
    return true;
  } catch (error) {
    console.error(`שגיאה בכתיבה ל-Firebase (${path}):`, error.message);
    return false;
  }
}

// ----------- בדיקת הרשאות ניהול -----------

async function isAdmin(chatId, userId) {
  try {
    const result = await telegramRequest("getChatMember", {
      chat_id: chatId,
      user_id: userId
    });
    if (!result || !result.ok) return false;
    const status = result.result.status;
    return status === "administrator" || status === "creator";
  } catch (error) {
    console.error("שגיאה בבדיקת הרשאות ניהול:", error.message);
    return false;
  }
}
// ----------- פונקציית עיצוב וכפתורים שקופים -----------

function parseCustomFormatting(text) {
  if (!text) {
    return { text: "", replyMarkup: null };
  }

  const buttonRegex = /\{([^{}]+)\}-\{([^{}]+)\}/g;
  const buttons = [];
  let match;

  while ((match = buttonRegex.exec(text)) !== null) {
    const label = match[1].trim();
    let url = match[2].trim();
    // המרת + ל-%2B כדי למנוע שבירת קישורים
    url = url.split("+").join("%2B");
    buttons.push({ text: label, url: url });
  }

  const cleanText = text.replace(buttonRegex, "").trim();

  let replyMarkup = null;
  if (buttons.length > 0) {
    const inlineKeyboard = buttons.map((btn) => [{ text: btn.text, url: btn.url }]);
    replyMarkup = { inline_keyboard: inlineKeyboard };
  }

  return { text: cleanText, replyMarkup: replyMarkup };
}

// ----------- שליחת הודעה עם עיצוב אוטומטי -----------

async function sendFormattedMessage(chatId, rawText, replyToMessageId) {
  const { text, replyMarkup } = parseCustomFormatting(rawText);

  const params = {
    chat_id: chatId,
    text: text,
    parse_mode: "Markdown"
  };

  if (replyMarkup) {
    params.reply_markup = replyMarkup;
  }

  if (replyToMessageId) {
    params.reply_to_message_id = replyToMessageId;
  }

  return await telegramRequest("sendMessage", params);
}

// ----------- טקסטים קבועים -----------

const HELP_TEXT = `🛡️ *מדריך פקודות וולטיק מוד בוט:*
👤 *פקודות כלליות:*
/rules או /כללים - הצגת כללי הקבוצה
👮 *פקודות מנהלים (בתוך קבוצה בלבד):*
/kick או /בעט - בעיטת משתמש (בתגובה להודעה)
/ban או /העף - חסימת משתמש (בתגובה להודעה)
/unban או /בטל חסימה - ביטול חסימה
/mute או /השתק - השתקת משתמש
/unmute או /בטל השתקה - ביטול השתקה
/setrules [כללים] - הגדרת כללי הקבוצה ושמירה ב-Firebase
/guide או /מדריך - מדריך מפורט למנהלים לעיצוב הודעות`;

const GUIDE_TEXT = `📚 *מדריך מפורט לשימוש בבוט:*
*1. פקודות ניהול משתמשים:*
כדי להשתמש בפקודות כמו בעט/חסום/השתק, חובה לעשות *השב (Reply)* להודעה של המשתמש עליו תרצה להפעיל את הפקודה, ואז לשלוח את הפקודה.
*2. הוספת כפתורים לכללים / ברוך הבא:*
בתוך פקודת ה- /setrules, תוכל להוסיף כפתור שקוף על ידי כתיבת שם הכפתור בתוך סוגריים מסולסלים, מקף, והקישור בסוגריים מסולסלים. לדוגמה:
{לאתר שלי}-{https://example.com}
*3. עיצוב טקסט:*
הדגשה: שים * בתחילת ובסוף המילה (*דוגמה*).
נטוי: שים _ בתחילת ובסוף המילה (_דוגמה_).
אם תרצה לכתוב שם משתמש עם קו תחתון מבלי שזה יהפוך לנטוי, שים לוכסן הפוך לפניו (\\_).`;

const DEFAULT_WELCOME = "👋 ברוך הבא לקבוצה, {first_name}!";
const DEFAULT_RULES = "טרם הוגדרו כללים לקבוצה זו.";

// ----------- קבוצות פקודות (עברית + אנגלית) -----------

const COMMANDS = {
  start: ["/start"],
  help: ["/help", "/עזרה"],
  guide: ["/guide", "/מדריך"],
  kick: ["/kick", "/בעט"],
  ban: ["/ban", "/העף"],
  unban: ["/unban", "/בטל חסימה"],
  mute: ["/mute", "/השתק"],
  unmute: ["/unmute", "/בטל השתקה"],
  setrules: ["/setrules", "/הכנס כללים"],
  rules: ["/rules", "/כללים"]
};

function matchCommand(text) {
  if (!text) return null;
  const trimmed = text.trim();

  for (const [key, aliases] of Object.entries(COMMANDS)) {
    for (const alias of aliases) {
      if (trimmed === alias || trimmed.startsWith(alias + " ") || trimmed.startsWith(alias + "\n")) {
        return { command: key, alias: alias, args: trimmed.slice(alias.length).trim() };
      }
    }
  }
  return null;
}
// ----------- טיפול בהצטרפות חברים חדשים -----------

async function handleNewChatMembers(message) {
  const chatId = message.chat.id;
  const newMembers = message.new_chat_members;

  for (const user of newMembers) {
    if (user.is_bot) continue; // אין צורך לברך בוטים אחרים

    let welcomeTemplate = await firebaseGet(`groups/${chatId}/welcome`);
    if (!welcomeTemplate) {
      welcomeTemplate = DEFAULT_WELCOME;
    }

    const firstName = user.first_name || "חבר חדש";
    const finalText = welcomeTemplate
      .split("${user.first_name}").join(firstName)
      .split("{first_name}").join(firstName);

    await sendFormattedMessage(chatId, finalText);
  }
}

// ----------- פקודות ענישה (דורשות מנהל + Reply) -----------

async function handlePunishmentCommand(command, message) {
  const chatId = message.chat.id;
  const fromId = message.from.id;

  const adminCheck = await isAdmin(chatId, fromId);
  if (!adminCheck) {
    await sendFormattedMessage(chatId, "🚫 פקודה זו מיועדת למנהלים בלבד.", message.message_id);
    return;
  }

  if (!message.reply_to_message) {
    await sendFormattedMessage(chatId, "⚠️ יש להשיב (Reply) להודעה של המשתמש הרצוי כדי להשתמש בפקודה זו.", message.message_id);
    return;
  }

  const targetUserId = message.reply_to_message.from.id;

  try {
    switch (command) {
      case "kick": {
        await telegramRequest("banChatMember", { chat_id: chatId, user_id: targetUserId });
        await telegramRequest("unbanChatMember", { chat_id: chatId, user_id: targetUserId, only_if_banned: true });
        await sendFormattedMessage(chatId, "👢 המשתמש נבעט מהקבוצה.");
        break;
      }
      case "ban": {
        await telegramRequest("banChatMember", { chat_id: chatId, user_id: targetUserId });
        await sendFormattedMessage(chatId, "🔨 המשתמש נחסם לצמיתות מהקבוצה.");
        break;
      }
      case "unban": {
        await telegramRequest("unbanChatMember", { chat_id: chatId, user_id: targetUserId, only_if_banned: true });
        await sendFormattedMessage(chatId, "✅ החסימה בוטלה.");
        break;
      }
      case "mute": {
        await telegramRequest("restrictChatMember", {
          chat_id: chatId,
          user_id: targetUserId,
          permissions: {
            can_send_messages: false,
            can_send_audios: false,
            can_send_documents: false,
            can_send_photos: false,
            can_send_videos: false,
            can_send_video_notes: false,
            can_send_voice_notes: false,
            can_send_polls: false,
            can_send_other_messages: false,
            can_add_web_page_previews: false
          }
        });
        await sendFormattedMessage(chatId, "🔇 המשתמש הושתק.");
        break;
      }
      case "unmute": {
        await telegramRequest("restrictChatMember", {
          chat_id: chatId,
          user_id: targetUserId,
          permissions: {
            can_send_messages: true,
            can_send_audios: true,
            can_send_documents: true,
            can_send_photos: true,
            can_send_videos: true,
            can_send_video_notes: true,
            can_send_voice_notes: true,
            can_send_polls: true,
            can_send_other_messages: true,
            can_add_web_page_previews: true
          }
        });
        await sendFormattedMessage(chatId, "🔊 המשתמש יכול לדבר.");
        break;
      }
    }
  } catch (error) {
    console.error(`שגיאה בביצוע פקודת ${command}:`, error.message);
    await sendFormattedMessage(chatId, "❌ אירעה שגיאה בביצוע הפעולה. ודא שלבוט יש הרשאות ניהול מתאימות.");
  }
}
// ----------- פקודות כללים -----------

async function handleSetRules(message, args) {
  const chatId = message.chat.id;
  const fromId = message.from.id;

  const adminCheck = await isAdmin(chatId, fromId);
  if (!adminCheck) {
    await sendFormattedMessage(chatId, "🚫 פקודה זו מיועדת למנהלים בלבד.", message.message_id);
    return;
  }

  if (!args) {
    await sendFormattedMessage(chatId, "⚠️ יש לכתוב את הכללים אחרי הפקודה, לדוגמה:\n/setrules אין לפרסם קישורים זרים בקבוצה.");
    return;
  }

  const success = await firebaseSet(`groups/${chatId}/rules`, args);

  if (success) {
    await sendFormattedMessage(chatId, "✅ הכללים נשמרו בבטחה ב-Firebase.");
  } else {
    await sendFormattedMessage(chatId, "❌ אירעה שגיאה בשמירת הכללים. נסה שוב מאוחר יותר.");
  }
}

async function handleGetRules(message) {
  const chatId = message.chat.id;

  let rules = await firebaseGet(`groups/${chatId}/rules`);
  if (!rules) {
    rules = DEFAULT_RULES;
  }

  const finalText = `📜 *כללי הקבוצה:* \n${rules}`;
  await sendFormattedMessage(chatId, finalText);
}

// ----------- דיספצ'ר פקודות ראשי -----------

async function dispatchCommand(matched, message) {
  const chatId = message.chat.id;

  switch (matched.command) {
    case "start":
      await telegramRequest("sendMessage", {
        chat_id: chatId,
        text: "🛡️ וולטיק מוד בוט מחובר ל-Firebase ומוכן לפעולה קשוחה!"
      });
      break;

    case "help":
      await sendFormattedMessage(chatId, HELP_TEXT);
      break;

    case "guide":
      await sendFormattedMessage(chatId, GUIDE_TEXT);
      break;

    case "kick":
    case "ban":
    case "unban":
    case "mute":
    case "unmute":
      await handlePunishmentCommand(matched.command, message);
      break;

    case "setrules":
      await handleSetRules(message, matched.args);
      break;

    case "rules":
      await handleGetRules(message);
      break;
  }
}
// ----------- נקודת הכניסה הראשית (Vercel Serverless Function) -----------

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(200).json({ ok: true, message: "Voltic Mod Bot is running." });
      return;
    }

    const update = req.body;
    
    // שורת הדיבוג - תציג לנו בדיוק מה טלגרם שלחה!
    console.log("📥 התקבל עדכון חדש מטלגרם:", JSON.stringify(update, null, 2));

    if (!update || !update.message) {
      console.log("⚠️ העדכון לא מכיל הודעת טקסט (אולי זו עריכה או פעולה אחרת).");
      res.status(200).json({ ok: true });
      return;
    }

    const message = update.message;

    // טיפול בהצטרפות חברים חדשים
    if (message.new_chat_members && message.new_chat_members.length > 0) {
      console.log("👋 זוהתה הצטרפות של חבר חדש!");
      await handleNewChatMembers(message);
      res.status(200).json({ ok: true });
      return;
    }

    // טיפול בפקודות טקסט
    if (message.text) {
      console.log("💬 הבוט קרא את הטקסט:", message.text);
      const matched = matchCommand(message.text);
      if (matched) {
        console.log("✅ זוהתה הפקודה:", matched.command);
        await dispatchCommand(matched, message);
      } else {
        console.log("❌ לא זוהתה פקודה מוכרת בטקסט הזה.");
      }
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("🚨 שגיאה כללית בטיפול בעדכון:", error.message);
    // תמיד להחזיר 200 כדי שטלגרם לא ינסה לשלוח שוב ושוב
    res.status(200).json({ ok: true });
  }
}
.