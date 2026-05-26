require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const TELEGRAM_TOKEN = '8959432093:AAH-5RXawqhC4AGXavYUtXgMRkZTmENrrq8';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OWNER_CHAT_ID = process.env.OWNER_CHAT_ID;
const PORT = process.env.PORT || 3000;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://telegram-assistant-bot-egtj.onrender.com';

console.log('🔑 Gemini API Key mavjud:', !!GEMINI_API_KEY);
console.log('👤 Owner Chat ID:', OWNER_CHAT_ID);

const bot = new TelegramBot(TELEGRAM_TOKEN, { webHook: { port: PORT } });
bot.setWebHook(`${RENDER_URL}/bot${TELEGRAM_TOKEN}`);

const conversationHistory = {};

const SYSTEM_PROMPT = `Siz Sardorbekning shaxsiy AI assistentidasiz. Sardorbek — backend developer (Node.js, NestJS), Urganch davlat universitetining 941-23 guruh talabasi.

Qoidalar:
- O'zingizni "Sardorbekning AI assistenti" sifatida tanishtiring
- Foydali, qisqa va aniq javob bering
- Agar savol Sardorbek bilan shaxsan bog'liq bo'lsa — "Sardorbek bilan to'g'ridan-to'g'ri bog'lanishingizni tavsiya qilaman" deng
- O'zbek, rus yoki ingliz tilida javob bering (foydalanuvchi qaysi tilda yozsa, shunda)
- Doim xushmuomala va professional bo'ling`;

async function askGemini(userMessage, chatId) {
  if (!conversationHistory[chatId]) conversationHistory[chatId] = [];

  conversationHistory[chatId].push({ role: 'user', parts: [{ text: userMessage }] });
  if (conversationHistory[chatId].length > 20) {
    conversationHistory[chatId] = conversationHistory[chatId].slice(-20);
  }

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: conversationHistory[chatId]
    }
  );

  const assistantMessage = response.data.candidates[0].content.parts[0].text;
  conversationHistory[chatId].push({ role: 'model', parts: [{ text: assistantMessage }] });
  return assistantMessage;
}

bot.onText(/\/start/, (msg) => {
  const name = msg.from.first_name || 'Salom';
  bot.sendMessage(msg.chat.id,
    `👋 Salom, ${name}!\n\nMen Sardorbekning shaxsiy AI assistentiman. Savollaringizga javob berishga harakat qilaman.\n\nNima yordam kerak? 😊`
  );
});

bot.on('message', async (msg) => {
  if (msg.text && !msg.text.startsWith('/')) {
    const chatId = msg.chat.id;
    const userText = msg.text;
    const userName = msg.from.first_name || 'Foydalanuvchi';

    try {
      bot.sendChatAction(chatId, 'typing');
      const reply = await askGemini(userText, chatId);
      await bot.sendMessage(chatId, reply);

      if (OWNER_CHAT_ID && chatId.toString() !== OWNER_CHAT_ID) {
        await bot.sendMessage(
          OWNER_CHAT_ID,
          `📩 *Yangi xabar*\n👤 ${userName} (ID: \`${chatId}\`)\n💬 ${userText}`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (error) {
      console.error('❌ Xato:', error.response?.status, JSON.stringify(error.response?.data) || error.message);
      bot.sendMessage(chatId, 'Kechirasiz, hozir texnik muammo bor. Keyinroq urinib ko\'ring.');
    }
  }
});


console.log('✅ Bot (Gemini) webhook rejimida ishga tushdi!');
console.log(`🌐 Port: ${PORT}`);
