const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const wppconnect = require('@wppconnect-team/wppconnect');

const TOKEN_FOLDER = process.env.TOKEN_FOLDER || 'tokens';
const DEBUG = (process.env.DEBUG || 'false').toLowerCase() === 'true';

// In-memory stores
const clients = new Map(); // session -> client
const sessionEvents = new Map(); // session -> EventEmitter
const statusBySession = new Map(); // session -> last status string
const qrBySession = new Map(); // session -> { base64Qr, asciiQR, attempt, urlCode, ts }

function ensureTokenFolder() {
  const abs = path.resolve(TOKEN_FOLDER);
  if (!fs.existsSync(abs)) fs.mkdirSync(abs, { recursive: true });
  return abs;
}

function getSessionEmitter(session) {
  if (!sessionEvents.has(session)) sessionEvents.set(session, new EventEmitter());
  return sessionEvents.get(session);
}

function formatPhoneId(phone) {
  // Accepts raw digits like 5511999999999 and transforms to WhatsApp id
  if (!phone) throw new Error('phone is required');
  const trimmed = String(phone).trim();
  if (trimmed.endsWith('@c.us') || trimmed.endsWith('@g.us')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) throw new Error('invalid phone');
  return `${digits}@c.us`;
}

async function createOrGetClient(session) {
  if (!session) throw new Error('session is required');
  if (clients.has(session)) return clients.get(session);

  ensureTokenFolder();

  const client = await wppconnect.create({
    session,
    catchQR: (base64Qr, asciiQR, attempt, urlCode) => {
      qrBySession.set(session, { base64Qr, asciiQR, attempt, urlCode, ts: Date.now() });
      statusBySession.set(session, 'QRCODE');
      getSessionEmitter(session).emit('qr', qrBySession.get(session));
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.log(`[${session}] QR disponível (tentativa ${attempt}).`);
      }
    },
    statusFind: (status, sessionName) => {
      statusBySession.set(sessionName, status);
      getSessionEmitter(sessionName).emit('status', status);
      if (DEBUG) console.log(`[${sessionName}] statusFind -> ${status}`);
    },
    headless: true,
    useChrome: true,
    debug: DEBUG,
    disableSpins: true,
    logQR: false,
    tokenStore: 'file',
    folderNameToken: TOKEN_FOLDER,
    // try to keep session alive
    autoClose: 0,
    updatesLog: DEBUG,
    puppeteerOptions: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    },
  });

  clients.set(session, client);

  // Attach runtime events
  client.onStateChange((state) => {
    statusBySession.set(session, state);
    getSessionEmitter(session).emit('state', state);
    if (DEBUG) console.log(`[${session}] onStateChange -> ${state}`);
    if (['CONFLICT', 'UNLAUNCHED'].includes(state)) client.useHere();
  });

  client.onStreamChange((state) => {
    if (DEBUG) console.log(`[${session}] onStreamChange -> ${state}`);
  });

  return client;
}

async function startSession(session) {
  const client = await createOrGetClient(session);
  const status = statusBySession.get(session) || 'STARTED';
  const qr = qrBySession.get(session) || null;
  return { session, status, qrAvailable: !!qr, qrcode: qr?.base64Qr || null };
}

async function getStatus(session) {
  const client = clients.get(session);
  if (client) {
    try {
      const result = await client.getConnectionState();
      return { session, state: result, known: true };
    } catch (e) {
      return { session, state: statusBySession.get(session) || 'UNKNOWN', known: true };
    }
  }
  // Client not loaded: infer by token existence
  const tokenPath = path.resolve(TOKEN_FOLDER);
  const hasToken = fs.readdirSync(tokenPath, { withFileTypes: true })
    .some((d) => d.isDirectory() && d.name.toLowerCase().includes(session.toLowerCase()));
  return { session, state: hasToken ? 'STOPPED' : 'NOTFOUND', known: false };
}

async function getQRCode(session) {
  const qr = qrBySession.get(session);
  if (!qr) return null;
  return { session, ...qr };
}

async function sendMessage(session, phone, message) {
  if (!message || !String(message).trim()) throw new Error('message is required');
  const client = await createOrGetClient(session);
  const to = formatPhoneId(phone);
  const result = await client.sendText(to, message);
  return { session, to, result };
}

async function closeSession(session, { logout = false } = {}) {
  const client = clients.get(session);
  if (!client) return { session, closed: false, reason: 'SESSION_NOT_LOADED' };
  try {
    if (logout && client.logout) {
      await client.logout();
    }
    await client.close();
  } finally {
    clients.delete(session);
    sessionEvents.delete(session);
    statusBySession.delete(session);
    qrBySession.delete(session);
  }
  return { session, closed: true };
}

module.exports = {
  startSession,
  getStatus,
  getQRCode,
  sendMessage,
  closeSession,
  // for use in routes/tests
  _internal: { clients, statusBySession, qrBySession, getSessionEmitter },
};
