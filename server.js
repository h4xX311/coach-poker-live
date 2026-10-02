/**
 * Coach Poker Live v3.0 — Servidor web + Telegram Mini App
 * Con IA (OpenCode Zen), historial, notas, y análisis postflop
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { agent } = require('./index.js');
const AICoach = require('./src/aiCoach');

const PORT = process.env.PORT || 3000;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const OPENCODE_API_KEY = process.env.OPENCODE_API_KEY || '';

const aiCoach = new AICoach();

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

// Validación de Telegram Mini App
function validateTelegramWebApp(initData, botToken) {
  if (!botToken) return null;
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');
  const dataCheckString = Array.from(urlParams.entries())
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (calculatedHash !== hash) return null;
  const user = JSON.parse(urlParams.get('user') || '{}');
  return { id: user.id, first_name: user.first_name, username: user.username };
}

// Cargar historial de notas
function loadNotes() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'data', 'notes.json'), 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}

// Guardar notas
function saveNotes(notes) {
  fs.writeFileSync(path.join(__dirname, 'data', 'notes.json'), JSON.stringify(notes, null, 2));
}

const server = http.createServer(async (req, res) => {
  const allowedOrigins = ['https://coach-poker-live.onrender.com', 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // API: Analizar mano (con IA)
  if (req.method === 'POST' && req.url === '/api/analyze') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const params = JSON.parse(body);
        const result = agent.analyze(params);

        // Generar coaching con IA
        if (OPENCODE_API_KEY) {
          try {
            const aiCoaching = await aiCoach.generateCoaching(result, params);
            result.aiCoaching = aiCoaching;
          } catch (e) {
            result.aiCoaching = null;
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result, null, 2));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // API: Info del agente
  if (req.method === 'GET' && req.url === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(agent.getInfo(), null, 2));
    return;
  }

  // API: Historial
  if (req.method === 'GET' && req.url === '/api/history') {
    const GameRecorder = require('./src/skills/GameRecorder');
    const recorder = new GameRecorder();
    const history = recorder.getRecentHands(50);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(history, null, 2));
    return;
  }

  // API: Guardar nota
  if (req.method === 'POST' && req.url === '/api/notes') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { handId, note } = JSON.parse(body);
        const notes = loadNotes();
        notes[handId] = { note, timestamp: new Date().toISOString() };
        saveNotes(notes);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // API: Obtener notas
  if (req.method === 'GET' && req.url === '/api/notes') {
    const notes = loadNotes();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(notes, null, 2));
    return;
  }

  // API: Telegram auth
  if (req.method === 'POST' && req.url === '/api/telegram/auth') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { initData } = JSON.parse(body);
        const user = validateTelegramWebApp(initData, TELEGRAM_BOT_TOKEN);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ valid: !!user, user }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Servir archivos estáticos
  let filePath = req.url === '/' ? '/index.html' : req.url;
  if (req.url === '/telegram') filePath = '/telegram-app.html';
  filePath = path.join(__dirname, 'public', filePath);

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 - No encontrado');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           🃏 COACH POKER LIVE v3.0 🃏                    ║');
  console.log('║     con IA + Historial + Notas + Postflop               ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  🌐 Web:            http://localhost:${PORT}`);
  console.log(`  📱 Telegram App:   http://localhost:${PORT}/telegram`);
  console.log('');
  console.log('  Endpoints API:');
  console.log(`    GET  http://localhost:${PORT}/api/info`);
  console.log(`    GET  http://localhost:${PORT}/api/history`);
  console.log(`    POST http://localhost:${PORT}/api/analyze`);
  console.log(`    GET  http://localhost:${PORT}/api/notes`);
  console.log(`    POST http://localhost:${PORT}/api/notes`);
  console.log(`    POST http://localhost:${PORT}/api/telegram/auth`);
  console.log('');
  if (OPENCODE_API_KEY) {
    console.log('  ✅ OpenCode Zen configurado');
  } else {
    console.log('  ⚠️  OpenCode Zen no configurado (usa OPENCODE_API_KEY)');
  }
  if (TELEGRAM_BOT_TOKEN) {
    console.log('  ✅ Telegram Bot Token configurado');
  } else {
    console.log('  ⚠️  Telegram Bot Token no configurado (usa TELEGRAM_BOT_TOKEN)');
  }
  console.log('');
});
