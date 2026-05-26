# Setup N8N — Integração Google Meet

## Por que N8N?

O N8N gerencia o OAuth do Google internamente (com renovação automática de token), sem precisar de código extra no CRM. Funciona com Gmail e Google Workspace.

---

## 1. Instalar ou acessar o N8N

### Opção A — N8N Cloud (recomendado, sem servidor)
- Acesse: https://app.n8n.cloud
- Crie uma conta gratuita (trial 14 dias, depois ~$20/mês)

### Opção B — Docker local (grátis, exige servidor)
```bash
docker run -d --name n8n -p 5678:5678 -v n8n_data:/home/node/.n8n n8nio/n8n
# Acesse: http://localhost:5678
```

---

## 2. Criar a credencial Google OAuth2 no N8N

1. No N8N, vá em **Settings → Credentials → Add Credential**
2. Busque **"Google Calendar OAuth2 API"** (ou "Google OAuth2 API")
3. Preencha:
   - **Client ID**: o mesmo `GOOGLE_CLIENT_ID` do seu `.env` do CRM
   - **Client Secret**: o mesmo `GOOGLE_CLIENT_SECRET`
4. Clique em **Sign in with Google** e autorize com a conta Google que quer usar para criar os Meet
5. Salve a credencial — anote o **ID** (visível na URL ao editar)

---

## 3. Importar o workflow

1. No N8N, vá em **Workflows → Import from file**
2. Selecione o arquivo: `backend/n8n-workflows/crm-criar-meet.json`
3. Abra o node **"Criar Evento no Google Calendar"**
4. Em **Credential**, selecione a credencial Google que você criou no passo anterior
5. Clique em **Save**

---

## 4. Ativar o webhook

1. Clique em **Activate** (canto superior direito) — mude de cinza para verde
2. Abra o node **"Receber Dados da Reunião"** (Webhook)
3. Copie a **Production URL** — será algo como:
   ```
   https://SEU-DOMINIO.n8n.cloud/webhook/crm-criar-meet
   ```

---

## 5. Configurar o CRM (.env)

Abra o arquivo `.env` do backend e adicione:

```env
# N8N — Geração de link Google Meet
N8N_CRIAR_MEET_WEBHOOK=https://SEU-DOMINIO.n8n.cloud/webhook/crm-criar-meet
N8N_WEBHOOK_SECRET=uma-senha-forte-aqui
```

> **N8N_WEBHOOK_SECRET** é opcional, mas recomendado. Se preenchido, o CRM envia o header `x-webhook-token` e você pode validar no N8N com um node "IF" antes de criar o evento.

Reinicie o backend após salvar o `.env`.

---

## 6. Testar

No terminal, envie uma requisição de teste:

```bash
curl -X POST http://localhost:3001/agenda/criar-meet-temp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_JWT_TOKEN" \
  -d '{
    "titulo": "Reunião de Teste ProSystem",
    "data_prevista": "2026-06-01T14:00:00.000Z",
    "duracao_minutos": 60
  }'
```

Resposta esperada:
```json
{
  "status": "success",
  "data": {
    "meet_link": "https://meet.google.com/xxx-xxx-xxx",
    "via": "n8n"
  }
}
```

---

## Fluxo completo

```
Frontend (formulário)
  ↓ POST /agenda/criar-meet-temp
Backend Fastify
  ↓ POST N8N_CRIAR_MEET_WEBHOOK
N8N Workflow
  ↓ POST Google Calendar API (OAuth gerenciado pelo N8N)
  ↓ Retorna meet_link
Backend
  ↓ Retorna meet_link para o frontend
Frontend
  ↓ Exibe link nos templates WhatsApp
```

---

## Fallback automático

Se o N8N não estiver configurado ou indisponível, o CRM automaticamente tenta criar o evento via Google Calendar direto (usando o token salvo no banco). Ou seja: o sistema nunca trava por causa do N8N.
