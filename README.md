# Servidor WPPConnect (Node.js)

Servidor HTTP em Node.js que usa [WPPConnect](https://wppconnect.io) para:
- Criar/gerenciar sessões do WhatsApp Web sem custo por instância
- Armazenar/restaurar tokens de sessão automaticamente (arquivos JSON)
- Expor endpoints REST com documentação Swagger

## Requisitos
- Node.js 18+ (recomendado 20+)
- Chrome/Chromium instalado (o WPPConnect usa um navegador controlado pelo Puppeteer)

## Instalação

```powershell
# Dentro da pasta do projeto
Copy-Item .env.example .env
npm install
npm run dev
```

O servidor iniciará em `http://localhost:3000` e a documentação estará em `http://localhost:3000/api/docs`.

## Fluxo de uso
1. Inicie (ou restaure) uma sessão:
   - POST /api/session/start
   - Body:
```json
{
  "session": "user-5519999999999"
}
```
   - Resposta trará o status e, se disponível, o QR em base64 (`qrcode` e `qrDataURL`).

2. Caso o QR não venha de imediato, consulte:
   - GET /api/session/qr/{session}

3. Escaneie o QR no WhatsApp do usuário (apenas na primeira vez). O token será salvo em `tokens/`.

4. Envie mensagens via HTTP:
   - POST /api/send-message
```json
{
  "session": "user-5519999999999",
  "phone": "5511999999999",
  "message": "Olá! Seu agendamento foi confirmado."
}
```

5. Consulte status:
   - GET /api/session/status/{session}

6. Encerrar sessão (opcionalmente com logout):
   - DELETE /api/session/{session}?logout=true

## Endpoints (resumo)
- GET /health — healthcheck
- POST /api/session/start — cria/restaura sessão e dispara QR se necessário
- GET /api/session/status/{session} — status atual
- GET /api/session/qr/{session} — último QR gerado (base64 e ASCII)
- DELETE /api/session/{session}?logout=true — fecha sessão (e faz logout se indicado)
- POST /api/send-message — envia texto

Veja detalhes e modelos no Swagger: `/api/docs`.

## Configuração
Variáveis em `.env`:
- `PORT` (padrão 3000)
- `TOKEN_FOLDER` (padrão `tokens`)
- `DEBUG` (`true`/`false`)

## Observações
- Telefones devem ser enviados com DDI+DDD+Número. O servidor converte automaticamente para o formato do WhatsApp (`@c.us`).
- Sessões são carregadas sob demanda. Se existir token na pasta, a restauração acontece sem novo QR.
- Para produção, execute com `npm start` e utilize um gerenciador de processos (PM2, systemd, etc.).

## Licença
MIT

## Deploy na Railway (API) + Swagger na Vercel

### Railway (API com persistência de tokens)

Opção 1: Docker (recomendado)

1. Faça push deste repositório para o GitHub.
2. No painel Railway: New Project > Deploy from Repo > escolha o repo.
3. Railway detectará o `Dockerfile`.
4. Configure variáveis de ambiente:
    - `PORT=3000`
    - `TOKEN_FOLDER=/data/tokens`
    - `PUBLIC_URL=https://SEU-SUBDOMINIO.up.railway.app`
5. Adicione um Volume (Persistent Storage) e monte em `/data`.
6. Deploy. A API ficará acessível em `https://SEU-SUBDOMINIO.up.railway.app`.

Opção 2: Nixpacks/Node (sem Docker)

- Garanta que o deploy aponte para a RAIZ do projeto (onde está o `package.json`). Se usar CLI, rode `railway up` na pasta do projeto (não em `src/`).
- Defina Build Command: `npm ci`
- Start Command: `node src/index.js` (ou use o `Procfile` incluso)
- Crie Volume e aponte `TOKEN_FOLDER` para o caminho montado (ex.: `/data/tokens`).
- Se o Railpack reclamar "Script start.sh not found" ou não detectar Node, ele pode estar usando o builder Shell por falta do `package.json` no snapshot. Suba a partir da raiz ou use a opção Docker.

### Vercel (Swagger apontando para Railway)

Este projeto inclui uma página estática em `docs/index.html` que carrega um OpenAPI remoto.

Opção 1: Rewrites via `vercel.json`
- Edite `vercel.json` e troque `https://your-railway-service.up.railway.app` pelo domínio real da Railway.
- Crie um novo projeto na Vercel apontando para este repo e deploy.
- Acesse `https://seu-projeto.vercel.app/` — o Swagger abrirá com o spec remoto via `/docs.json`.

Opção 2: Query String
- Sem mexer no `vercel.json`, acesse:
   `https://seu-projeto.vercel.app/?url=https://SEU-SUBDOMINIO.up.railway.app/api/docs.json`
- A página `docs/index.html` lerá o spec diretamente do backend.

Observação
- A API continua disponível também no próprio backend Railway em `/api/docs` e `/api/docs.json`.
