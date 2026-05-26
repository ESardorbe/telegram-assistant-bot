require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const TELEGRAM_TOKEN = '8959432093:AAH-5RXawqhC4AGXavYUtXgMRkZTmENrrq8';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OWNER_CHAT_ID = process.env.OWNER_CHAT_ID;
const PORT = process.env.PORT || 10000;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://telegram-assistant-bot-egtj.onrender.com';

console.log('🔑 Gemini Key:', GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 15) + '...' : 'YOQ!');
console.log('👤 Owner ID:', OWNER_CHAT_ID);
console.log('🌐 Render URL:', RENDER_URL);

const bot = new TelegramBot(TELEGRAM_TOKEN, { webHook: { port: PORT } });

bot.setWebHook(`${RENDER_URL}/bot${TELEGRAM_TOKEN}`)
  .then(() => console.log('✅ Webhook oʻrnatildi'))
  .catch(e => console.error('❌ Webhook xato:', e.message));

const conversationHistory = {};

const SYSTEM_PROMPT = `Siz Sardorbekning shaxsiy AI assistentidasiz. Sardorbek — backend developer (Node.js, NestJS), Urganch davlat universitetining 941-23 guruh talabasi.
- O'zingizni "Sardorbekning AI assistenti" sifatida tanishtiring
- O'zbek, rus yoki ingliz tilida javob bering (foydalanuvchi qaysi tilda yozsa, shunda)
- Doim xushmuomala va professional bo'ling`;

async function askGemini(userMessage, chatId) {
  if (!conversationHistory[chatId]) conversationHistory[chatId] = [];

  conversationHistory[chatId].push({ role: 'user', parts: [{ text: userMessage }] });
  if (conversationHistory[chatId].length > 20) {
    conversationHistory[chatId] = conversationHistory[chatId].slice(-20);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const response = await axios.post(url, {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: conversationHistory[chatId]
  }, {
    headers: { 'Content-Type': 'application/json' }
  });

  const assistantMessage = response.data.candidates[0].content.parts[0].text;
  conversationHistory[chatId].push({ role: 'model', parts: [{ text: assistantMessage }] });
  return assistantMessage;
}

bot.onText(/\/start/, (msg) => {
  const name = msg.from.first_name || 'Salom';
  bot.sendMessage(msg.chat.id,
    `👋 Salom, ${name}!\n\nMen Sardorbekning shaxsiy AI assistentiman.\n\nNima yordam kerak? 😊`
  );
});

bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const userText = msg.text;
  const userName = msg.from.first_name || 'Foydalanuvchi';

  console.log(`📨 Xabar: [${userName}] ${userText}`);

  try {
    bot.sendChatAction(chatId, 'typing');
    const reply = await askGemini(userText, chatId);
    console.log(`✅ Javob yuborildi: ${reply.substring(0, 50)}...`);
    await bot.sendMessage(chatId, reply);

    if (OWNER_CHAT_ID && chatId.toString() !== OWNER_CHAT_ID) {
      await bot.sendMessage(OWNER_CHAT_ID,
        `📩 *Yangi xabar*\n👤 ${userName}\n💬 ${userText}`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (error) {
    const errStatus = error.response?.status;
    const errData = JSON.stringify(error.response?.data);
    console.error(`❌ XATO [${errStatus}]:`, errData || error.message);
    bot.sendMessage(chatId, 'Kechirasiz, hozir texnik muammo bor. Keyinroq urinib ko\'ring.');
  }
});

console.log('✅ Bot ishga tushdi! Port:', PORT);
