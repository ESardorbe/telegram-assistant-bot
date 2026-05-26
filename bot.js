require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const TELEGRAM_TOKEN = '8959432093:AAH-5RXawqhC4AGXavYUtXgMRkZTmENrrq8';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OWNER_CHAT_ID = process.env.OWNER_CHAT_ID;
const PORT = process.env.PORT || 10000;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://telegram-assistant-bot-egtj.onrender.com';

console.log('🔑 OpenRouter Key:', OPENROUTER_API_KEY ? OPENROUTER_API_KEY.substring(0, 20) + '...' : 'YOQ!');
console.log('👤 Owner ID:', OWNER_CHAT_ID);

const bot = new TelegramBot(TELEGRAM_TOKEN, { webHook: { port: PORT } });
bot.setWebHook(`${RENDER_URL}/bot${TELEGRAM_TOKEN}`)
  .then(() => console.log('✅ Webhook oʻrnatildi'))
  .catch(e => console.error('❌ Webhook xato:', e.message));

const conversationHistory = {};

const SYSTEM_PROMPT = `Siz Sardorbekning shaxsiy AI assistentidasiz. Sardorbek — backend developer (Node.js, NestJS), Urganch davlat universitetining 941-23 guruh talabasi.
- O'zingizni "Sardorbekning AI assistenti" sifatida tanishtiring
- Foydali, qisqa va aniq javob bering
- Agar savol Sardorbek bilan shaxsan bog'liq bo'lsa — "Sardorbek bilan to'g'ridan-to'g'ri bog'lanishingizni tavsiya qilaman" deng
- O'zbek, rus yoki ingliz tilida javob bering (foydalanuvchi qaysi tilda yozsa, shunda)
- Doim xushmuomala va professional bo'ling`;

async function askAI(userMessage, chatId) {
  if (!conversationHistory[chatId]) conversationHistory[chatId] = [];

  conversationHistory[chatId].push({ role: 'user', content: userMessage });
  if (conversationHistory[chatId].length > 20) {
    conversationHistory[chatId] = conversationHistory[chatId].slice(-20);
  }

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: 'meta-llama/llama-3.1-8b-instruct:free',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...conversationHistory[chatId]
      ]
    },
    {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': RENDER_URL,
        'X-Title': 'Sardorbek Assistant Bot'
      }
    }
  );

  const assistantMessage = response.data.choices[0].message.content;
  conversationHistory[chatId].push({ role: 'assistant', content: assistantMessage });
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

  console.log(`📨 [${userName}]: ${userText}`);

  try {
    bot.sendChatAction(chatId, 'typing');
    const reply = await askAI(userText, chatId);
    console.log(`✅ Javob: ${reply.substring(0, 60)}...`);
    await bot.sendMessage(chatId, reply);

    if (OWNER_CHAT_ID && chatId.toString() !== OWNER_CHAT_ID) {
      await bot.sendMessage(OWNER_CHAT_ID,
        `📩 *Yangi xabar*\n👤 ${userName}\n💬 ${userText}`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (error) {
    console.error('❌ XATO:', error.response?.status, JSON.stringify(error.response?.data) || error.message);
    bot.sendMessage(chatId, 'Kechirasiz, hozir texnik muammo bor. Keyinroq urinib ko\'ring.');
  }
});

console.log('✅ Bot ishga tushdi! Port:', PORT);
