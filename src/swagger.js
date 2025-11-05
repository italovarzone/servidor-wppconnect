const swaggerUi = require('swagger-ui-express');

function buildSpec(port) {
  const serverUrl = process.env.PUBLIC_URL || `http://localhost:${port}`;
  return {
    openapi: '3.0.3',
    info: {
      title: 'Servidor WPPConnect - API',
      version: '1.0.0',
      description:
        'API para gerenciar sessões do WhatsApp Web via WPPConnect, enviar mensagens e consultar status.\n\n' +
        '• Cada usuário cria uma sessão (POST /api/session/start) e escaneia o QR uma única vez.\n' +
        '• O servidor armazena um token de sessão em arquivo JSON (sem custo por instância).\n' +
        '• Para enviar mensagens, use POST /api/send-message.\n',
    },
    servers: [
      { url: serverUrl, description: 'Servidor local' },
    ],
    tags: [
      { name: 'Session', description: 'Gerenciamento de sessões do WhatsApp' },
      { name: 'Messages', description: 'Envio de mensagens' },
    ],
    components: {
      schemas: {
        StartSessionRequest: {
          type: 'object',
          required: ['session'],
          properties: {
            session: { type: 'string', example: 'user-5519999999999' },
          },
        },
        StartSessionResponse: {
          type: 'object',
          properties: {
            session: { type: 'string' },
            status: { type: 'string', example: 'QRCODE' },
            qrAvailable: { type: 'boolean' },
            qrcode: { type: 'string', nullable: true, description: 'Base64 (sem data URL). Prefira GET /api/session/qr/{session}' },
          },
        },
        SendMessageRequest: {
          type: 'object',
          required: ['session', 'phone', 'message'],
          properties: {
            session: { type: 'string', example: 'user-5519999999999' },
            phone: { type: 'string', example: '5511999999999' },
            message: { type: 'string', example: 'Olá! Seu agendamento foi confirmado.' },
          },
        },
        SendMessageResponse: {
          type: 'object',
          properties: {
            session: { type: 'string' },
            to: { type: 'string', example: '5511999999999@c.us' },
            result: { type: 'object' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            details: { type: 'string' },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          summary: 'Healthcheck',
          tags: ['Session'],
          responses: { 200: { description: 'OK' } },
        },
      },
      '/api/session/start': {
        post: {
          summary: 'Inicia (ou restaura) uma sessão',
          description: 'Cria a sessão e dispara a leitura de QR se necessário. Retorna o status atual. Para obter o QR, consulte GET /api/session/qr/{session}.',
          tags: ['Session'],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/StartSessionRequest' } },
            },
          },
          responses: {
            200: { description: 'Sessão iniciada', content: { 'application/json': { schema: { $ref: '#/components/schemas/StartSessionResponse' } } } },
            400: { description: 'Erro de validação', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            500: { description: 'Erro interno', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/api/session/status/{session}': {
        get: {
          summary: 'Consulta o status da sessão',
          tags: ['Session'],
          parameters: [
            { name: 'session', in: 'path', required: true, schema: { type: 'string' }, example: 'user-5519999999999' },
          ],
          responses: {
            200: { description: 'Status', content: { 'application/json': { schema: { type: 'object', properties: { session: { type: 'string' }, state: { type: 'string' }, known: { type: 'boolean' } } } } } },
          },
        },
      },
      '/api/session/qr/{session}': {
        get: {
          summary: 'Obtém o QRCode atual (se houver)',
          tags: ['Session'],
          parameters: [
            { name: 'session', in: 'path', required: true, schema: { type: 'string' }, example: 'user-5519999999999' },
          ],
          responses: {
            200: { description: 'QR atual', content: { 'application/json': { schema: { type: 'object', properties: { session: { type: 'string' }, base64Qr: { type: 'string' }, asciiQR: { type: 'string' }, attempt: { type: 'integer' }, urlCode: { type: 'string' }, ts: { type: 'integer' }, dataURL: { type: 'string' } } } } } },
            404: { description: 'Sem QR disponível', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/api/session/{session}': {
        delete: {
          summary: 'Fecha a sessão (opcionalmente faz logout)',
          tags: ['Session'],
          parameters: [
            { name: 'session', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'logout', in: 'query', required: false, schema: { type: 'boolean', default: false } },
          ],
          responses: {
            200: { description: 'Sessão encerrada', content: { 'application/json': { schema: { type: 'object', properties: { session: { type: 'string' }, closed: { type: 'boolean' } } } } } },
          },
        },
      },
      '/api/send-message': {
        post: {
          summary: 'Envia mensagem de texto',
          tags: ['Messages'],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SendMessageRequest' } } },
          },
          responses: {
            200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/SendMessageResponse' } } } },
            400: { description: 'Erro de validação', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            500: { description: 'Erro ao enviar', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
    },
  };
}

function setupSwagger(app, port) {
  const spec = buildSpec(port);
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec));
  app.get('/api/docs.json', (_req, res) => res.json(spec));
}

module.exports = { setupSwagger };
