const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const { Api } = require('telegram');
const readlineSync = require('readline-sync');
const fs = require('fs');
const express = require('express');
const WebSocket = require('ws');
const fileUpload = require('express-fileupload');
const app = express();
const wss = new WebSocket.Server({ port: 8080 });

console.log("By Shuvee!")
console.log("⚠️ Юзайте VPN для этой программы!\n");

const API_ID = ''; // Ваш АПИ айди (my.telegram.org)
const API_HASH = ''; // Ваш АПИ ХЕШ 
const SESSION_FILE = 'sessions.json';
let client = null;
let currentUser = null;
const activeChats = new Map();

app.use(express.static('public'));
app.use(express.json());
app.use(fileUpload());
app.use('/uploads', express.static('uploads'));


app.get('/chats', (req, res) => {
  res.json([...activeChats.values()].map(chat => ({
    id: chat.id,
    title: chat.title,
    avatar: `/avatar/${chat.id}`,
    unread: chat.unread,
    lastMessage: chat.messages[0]?.text || ''
  })));
});

app.get('/messages/:chatId', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 200;
    const offsetId = parseInt(req.query.offsetId) || 0;
    
    const result = await client.getMessages(parseInt(req.params.chatId), {
      limit,
      offsetId,
      reverse: true
    });

    const messages = result.map(msg => formatMessage(msg));
    res.json({ messages, hasMore: result.length >= limit });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/send', async (req, res) => {
  try {
    await client.sendMessage(req.body.chatId, { message: req.body.text });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/delete/:chatId/:messageId', async (req, res) => {
  try {
    await client.deleteMessages(req.params.chatId, [parseInt(req.params.messageId)]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/upload/:chatId', async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
app.post('/export-active-chat', async (req, res) => {
  try {
    const { chatId, sessionName } = req.body;
    if (!chatId || !sessionName) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    const messages = await client.getMessages(chatId, { limit: 0 });

    const chatContent = messages.map(msg => {
      const senderName = msg.sender ? msg.sender.firstName || msg.sender.username : 'Unknown';
      return `${senderName} (${new Date(msg.date * 1000).toLocaleString()}): ${msg.text}`;
    }).join('\n');

    const exportDir = `exports/${sessionName}`;
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const chatTitle = activeChats.get(parseInt(chatId)).title;
    const fileName = `${exportDir}/${chatTitle.replace(/[^a-z0-9]/gi, '_')}.txt`;
    fs.writeFileSync(fileName, chatContent);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/delete-session', (req, res) => {
  const { sessionName } = req.body;
  if (!sessionName) {
    return res.status(400).json({ error: 'Session name is required' });
  }

  const sessions = loadSessions();
  if (sessions[sessionName]) {
    delete sessions[sessionName];
    saveSessions(sessions);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

    const file = req.files.file;
    const filePath = `uploads/${file.name}`;
    file.mv(filePath, async (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      await client.sendFile(req.params.chatId, { file: filePath });
      res.json({ success: true });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/delete-session', (req, res) => {
  const sessionName = req.body.sessionName;
  const sessions = loadSessions();
  if (sessions[sessionName]) {
    delete sessions[sessionName];
    saveSessions(sessions);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

app.post('/export-active-chat', async (req, res) => {
  try {
    const chatId = req.body.chatId;
    const sessionName = req.body.sessionName;
    const messages = await client.getMessages(chatId, { limit: 0 });

    const chatContent = messages.map(msg => {
      const senderName = msg.sender ? msg.sender.firstName || msg.sender.username : 'Unknown';
      return `${senderName} (${new Date(msg.date * 1000).toLocaleString()}): ${msg.text}`;
    }).join('\n');

    const exportDir = `exports/${sessionName}`;
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const chatTitle = activeChats.get(chatId).title;
    const fileName = `${exportDir}/${chatTitle.replace(/[^a-z0-9]/gi, '_')}.txt`;
    fs.writeFileSync(fileName, chatContent);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function initClient() {
  const sessions = loadSessions();
  const sessionNames = Object.keys(sessions);

  if (sessionNames.length > 0) {
    console.log('😇Доступні сесії:');
    sessionNames.forEach((name, i) => console.log(`${i + 1}. ${name}`));
    
    const choice = readlineSync.question('🕵🏼Номер сесії (Enter для нової): ');
    if (choice) {
      const sessionKey = sessionNames[choice - 1];
      client = new TelegramClient(new StringSession(sessions[sessionKey]), API_ID, API_HASH);
      await client.connect();
      return;
    }
  }

  const newSessionName = readlineSync.question('⌨️Назва нової сесії: ');
  client = new TelegramClient(new StringSession(), API_ID, API_HASH);
  
  await client.start({
    phoneNumber: () => readlineSync.question('📱 Номер телефону: '),
    password: async (hint) => {
      const pass = await readlineSync.question(`🔑 Пароль 2FA (${hint || 'немає'}): `);
      return pass || undefined;
    },
    phoneCode: () => readlineSync.question('📲 Код з SMS: ')
  });

  sessions[newSessionName] = client.session.save();
  saveSessions(sessions);
}

async function setupHandlers() {
  currentUser = await client.getMe();
  
  client.addEventHandler(async (event) => {
    if (event.className === 'UpdateNewMessage') {
      const msg = event.message;
      const chatId = msg.chatId?.toJSNumber();
      
      if (!activeChats.has(chatId)) {
        const chatInfo = await client.getEntity(chatId);
        activeChats.set(chatId, {
          id: chatId,
          title: chatInfo.title || 'Приватний чат',
          messages: [],
          unread: 0
        });
      }

      const message = formatMessage(msg);
      activeChats.get(chatId).messages.unshift(message);
      activeChats.get(chatId).unread++;

      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'message',
            chatId,
            message
          }));
        }
      });
    }
  });
}

function formatMessage(msg) {
  return {
    id: msg.id,
    text: msg.text,
    date: new Date(msg.date * 1000).toLocaleString(),
    sender: msg.senderId,
    senderName: msg.sender ? msg.sender.firstName || msg.sender.username : 'Unknown',
    file: msg.file ? `/uploads/${msg.file.name}` : null
  };
}
app.post('/export-active-chat', async (req, res) => {
  try {
    const { chatId, sessionName } = req.body;

    const messages = await client.getMessages(chatId, { limit: 0 });

    const chatContent = messages.map(msg => {
      const senderName = msg.sender ? msg.sender.firstName || msg.sender.username : 'Unknown';
      return `${senderName} (${new Date(msg.date * 1000).toLocaleString()}): ${msg.text}`;
    }).join('\n');

    const exportDir = `exports/${sessionName}`;
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const chatTitle = activeChats.get(chatId).title;
    const fileName = `${exportDir}/${chatTitle.replace(/[^a-z0-9]/gi, '_')}.txt`;
    fs.writeFileSync(fileName, chatContent);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post('/delete-session', (req, res) => {
  const sessionName = req.body.sessionName;
  const sessions = loadSessions();
  if (sessions[sessionName]) {
    delete sessions[sessionName];
    saveSessions(sessions);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

function saveSessions(sessions) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(sessions, null, 2));
}

function loadSessions() {
  return fs.existsSync(SESSION_FILE) ? 
    JSON.parse(fs.readFileSync(SESSION_FILE)) : 
    {};
}

async function start() {
  await initClient();
  await client.connect();
  await setupHandlers();

  const dialogs = await client.getDialogs();
  dialogs.forEach(dialog => {
    const chatId = dialog.id.toJSNumber();
    if (!activeChats.has(chatId)) {
      activeChats.set(chatId, {
        id: chatId,
        title: dialog.title,
        messages: [],
        unread: 0
      });
    }
  });

  app.listen(3000, () => {
    console.log('🌐 Веб-клієнт доступний на http://localhost:3000');
  });
}

start().catch(err => {
  console.error('🚨 Помилка:', err);
  process.exit(1);
});
