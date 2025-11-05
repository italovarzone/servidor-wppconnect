require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { setupSwagger } = require('./swagger');
const wpp = require('./wpp');

const PORT = Number(process.env.PORT || 3000);

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.status(200).send('ok'));

// Session routes
app.post('/api/session/start', async (req, res) => {
  try {
    const { session } = req.body || {};
    if (!session) return res.status(400).json({ error: 'session is required' });
    const data = await wpp.startSession(session);
    // Additionally include dataURL if QR available
    if (data.qrcode) data.qrDataURL = `data:image/png;base64,${data.qrcode}`;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'FAILED_TO_START_SESSION', details: err.message });
  }
});

app.get('/api/session/status/:session', async (req, res) => {
  try {
    const { session } = req.params;
    const status = await wpp.getStatus(session);
    return res.json(status);
  } catch (err) {
    return res.status(500).json({ error: 'FAILED_TO_GET_STATUS', details: err.message });
  }
});

app.get('/api/session/qr/:session', async (req, res) => {
  try {
    const { session } = req.params;
    const qr = await wpp.getQRCode(session);
    if (!qr) return res.status(404).json({ error: 'NO_QR_AVAILABLE' });
    return res.json({ ...qr, dataURL: `data:image/png;base64,${qr.base64Qr}` });
  } catch (err) {
    return res.status(500).json({ error: 'FAILED_TO_GET_QR', details: err.message });
  }
});

app.delete('/api/session/:session', async (req, res) => {
  try {
    const { session } = req.params;
    const logout = String(req.query.logout || 'false').toLowerCase() === 'true';
    const result = await wpp.closeSession(session, { logout });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'FAILED_TO_CLOSE_SESSION', details: err.message });
  }
});

// Message routes
app.post('/api/send-message', async (req, res) => {
  try {
    const { session, phone, message } = req.body || {};
    if (!session || !phone || !message) return res.status(400).json({ error: 'session, phone and message are required' });
    const result = await wpp.sendMessage(session, phone, message);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'FAILED_TO_SEND_MESSAGE', details: err.message });
  }
});

setupSwagger(app, PORT);

app.listen(PORT, () => {
  console.log(`Servidor WPPConnect rodando em http://localhost:${PORT}`);
  console.log(`Documentação Swagger: http://localhost:${PORT}/api/docs`);
});
