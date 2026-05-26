require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const TELEGRAM_TOKEN = '8959432093:AAH-5RXawqhC4AGXavYUtXgMRkZTmENrrq8';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OWNER_CHAT_ID = process.env.OWNER_CHAT_ID;

// Key tekshiruvi
console.log('🔑 API Key mavjud:', !!ANTHROPIC_API_KEY);
console.log('🔑 API Key boshi:', ANTHROPIC_API_KEY ? ANTHROPIC_API_KEY.substring(0, 20) + '...' : 'YO\'Q!');
console.log('👤 Owner Chat ID:', OWNER_CHAT_ID);

const conversationHistory = {};

const bot = new TelegramBot(TELEGRAM_TOKEN, {
  polling: {
    interval: 2000,
    autoStart: false,
    params: { timeout: 10 }
  }
});

bot.deleteWebHook().then(() => {
  console.log('✅ Webhook tozalandi, polling boshlandi');
  bot.startPolling();
});

const SYSTEM_PROMPT = `Siz Sardorbekning shaxsiy AI assistentidasiz. Sardorbek — backend developer (Node.js, NestJS), Urganch davlat universitetining 941-23 guruh talabasi.

Qoidalar:
- O'zingizni "Sardorbekning AI assistenti" sifatida tanishtiring
- Foydali, qisqa va aniq javob bering
- Agar savol Sardorbek bilan shaxsan bog'liq bo'lsa — "Sardorbek bilan to'g'ridan-to'g'ri bog'lanishingizni tavsiya qilaman" deng
- O'zbek, rus yoki ingliz tilida javob bering (foydalanuvchi qaysi tilda yozsa, shunda)
- Doim xushmuomala va professional bo'ling`;

async function askClaude(userMessage, chatId) {
  if (!conversationHistory[chatId]) {
    conversationHistory[chatId] = [];
  }

  conversationHistory[chatId].push({ role: 'user', content: userMessage });

  if (conversationHistory[chatId].length > 20) {
    conversationHistory[chatId] = conversationHistory[chatId].slice(-20);
  }

  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: conversationHistory[chatId]
    },
    {
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      }
    }
  );

  const assistantMessage = response.data.content[0].text;
  conversationHistory[chatId].push({ role: 'assistant', content: assistantMessage });
  return assistantMessage;
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'Salom';
  bot.sendMessage(chatId,
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
      const reply = await askClaude(userText, chatId);
      await bot.sendMessage(chatId, reply);

      if (OWNER_CHAT_ID && chatId.toString() !== OWNER_CHAT_ID) {
        await bot.sendMessage(
          OWNER_CHAT_ID,
          `📩 *Yangi xabar*\n👤 ${userName} (ID: ${chatId})\n💬 ${userText}`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (error) {
      console.error('❌ Xato turi:', error.response?.status);
      console.error('❌ Xato:', error.response?.data || error.message);
      bot.sendMessage(chatId, 'Kechirasiz, hozir texnik muammo bor. Keyinroq urinib ko\'ring.');
    }
  }
});

// Render uchun HTTP server
const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Sardorbek Assistant Bot is running! 🤖');
}).listen(PORT);

console.log('✅ Bot ishga tushdi!');
console.log(`🌐 HTTP server: port ${PORT}`);
