# WhatsApp Inbox — Setup da Evolution API (Railway)

Conexão de WhatsApp ao CRM via **Evolution API** (self-host), pareamento por **QR Code**.
Multi-instância: cada usuário conecta o próprio número; gestão (CEO/ADMIN/Supervisão
Comercial) enxerga todas as conversas.

## Visão geral

```
WhatsApp do usuário ──QR──► Evolution API (Railway) ──webhook──► CRM backend ──► MySQL
                                    ▲                                   │
                                    └──────── enviar mensagem ◄─────────┘
                                                                  Tela /whatsapp (CRM)
```

## Passo 1 — Subir a Evolution API no Railway

1. No projeto do Railway, **New → Deploy from Docker Image**.
2. Imagem: `atendai/evolution-api:latest` (ou `evoapicloud/evolution-api:latest`).
3. Adicione um volume persistente (a sessão do WhatsApp precisa sobreviver a restarts).
4. Variáveis de ambiente mínimas no serviço Evolution:
   - `AUTHENTICATION_API_KEY` = uma chave forte que você inventa (guarde-a).
   - `DATABASE_ENABLED` = `true` e aponte para um Postgres/Mongo do Railway, **ou**
     deixe o padrão de armazenamento em arquivo + volume (mais simples para começar).
   - `CONFIG_SESSION_PHONE_CLIENT` = `ProSystem CRM` (nome que aparece no celular).
5. Após o deploy, copie a **URL pública** do serviço Evolution
   (ex.: `https://evolution-production-xxxx.up.railway.app`).

## Passo 2 — Configurar o backend do CRM

No serviço **backend** do CRM (Railway), adicione:

| Variável | Valor |
|----------|-------|
| `EVOLUTION_API_URL` | URL pública da Evolution (passo 1.5) |
| `EVOLUTION_API_KEY` | a mesma `AUTHENTICATION_API_KEY` |
| `EVOLUTION_WEBHOOK_URL` | URL pública do backend + `/whatsapp/webhook` |

> Ex.: `EVOLUTION_WEBHOOK_URL=https://backend-production-xxxx.up.railway.app/whatsapp/webhook`

Sem essas variáveis, a tela de WhatsApp mostra "integração não configurada" e o resto do
CRM funciona normalmente (degrada com elegância).

## Passo 3 — Migração do banco

Os modelos `WhatsappInstancia`, `WhatsappConversa`, `WhatsappMensagem` são criados
automaticamente no deploy (o `build` roda `prisma generate && prisma db push`).
**São tabelas novas** — operação aditiva, não afeta dados existentes.
⚠️ Nunca rodar `db push --accept-data-loss` (apaga tabelas SQL raw do projeto).

## Passo 4 — Conectar (cada usuário)

1. No CRM, menu **Comercial → WhatsApp**.
2. Clicar **Gerar QR Code**.
3. No celular: WhatsApp → **Aparelhos conectados → Conectar aparelho** → ler o QR.
4. A tela vira "Conectado" sozinha. Conversas recebidas começam a aparecer.

## Como funciona o escopo

- Instância de cada usuário: `instancia_nome = crm-<userId>`.
- `dono_id` em conversa/instância = usuário que conectou.
- Vendedor: vê só as próprias conversas. Gestão (`podeVerTudo`): vê todas.

## Endpoints (backend)

| Método | Rota | Função |
|--------|------|--------|
| GET  | `/whatsapp/instancia` | status da própria instância (sincroniza com a Evolution) |
| POST | `/whatsapp/conectar` | cria instância + retorna QR |
| POST | `/whatsapp/desconectar` | logout da instância |
| GET  | `/whatsapp/conversas` | lista conversas (escopadas) |
| GET  | `/whatsapp/conversas/:id/mensagens` | mensagens + marca lidas |
| POST | `/whatsapp/conversas/:id/enviar` | envia texto |
| POST | `/whatsapp/webhook` | **público** — recebe eventos da Evolution |

## Notas / próximos passos

- A tela usa **polling** (4–5s). Para tempo real puro, evoluir para WebSocket depois.
- Recebimento trata texto; mídia entra como "[mídia recebida]" (extensível em `whatsapp.ts`).
- Conversas tentam **vincular ao Lead** pelo telefone (últimos 8 dígitos) — base para
  captação automática de leads (EVO-4).
- API não-oficial (Baileys): evitar disparo em massa para não arriscar o número.
