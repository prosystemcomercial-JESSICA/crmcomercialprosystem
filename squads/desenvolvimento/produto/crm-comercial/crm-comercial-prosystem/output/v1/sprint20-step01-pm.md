# Sprint 20 — Step 01 — André Vieira (PM)
# Inbound WhatsApp — Recebimento de Mensagens

## Contexto

O Sprint 19 implementou envio de WhatsApp via template. Este sprint fecha o loop bidirecional: receber mensagens de leads no CRM, exibir conversas em thread, notificar o vendedor responsável e permitir resposta direta pelo CRM (dentro da janela de 24h).

## User Stories

**US-2001:** Como sistema, quero receber e armazenar mensagens WhatsApp enviadas por leads via webhook da Meta, associando automaticamente à ficha do lead pelo número de telefone.

**US-2002:** Como Vendedor, quero ver as mensagens recebidas de um lead na aba "Conversas" da ficha do lead, organizadas em thread cronológica com mensagens enviadas e recebidas.

**US-2003:** Como Vendedor, quero responder uma mensagem WhatsApp diretamente pelo CRM (texto livre dentro da janela de 24h, ou template fora da janela), sem precisar abrir o WhatsApp no celular.

**US-2004:** Como Vendedor, quero ser notificado em tempo real quando um lead envia uma mensagem WhatsApp, via badge de notificação no menu e alertas visuais.

**US-2005:** Como Supervisora, quero ver todas as conversas de todos os leads com filtro por vendedor, para monitorar o atendimento.

**US-2006:** Como sistema, quero verificar o token do webhook (handshake Meta) e validar a assinatura HMAC de cada requisição recebida, para garantir que apenas mensagens legítimas da Meta sejam processadas.

## Critérios de aceite

- **US-2001:** Endpoint `GET /webhook/whatsapp` (verificação Meta) + `POST /webhook/whatsapp` (mensagens). Lead identificado por `from` (número E.164). Se número não encontrado → mensagem armazenada como "lead desconhecido" com o número bruto. Suporte a tipos: text, image, document, audio (outros tipos: armazenar como "tipo não suportado").
- **US-2002:** Aba "Conversas" na ficha do lead (6ª aba). Thread mescla enviadas (outbound, azul à direita) + recebidas (inbound, cinza à esquerda). Scroll automático para mensagem mais recente.
- **US-2003:** Caixa de resposta abaixo da thread. Verificar se está dentro da janela de 24h desde a última mensagem do lead. Se sim → enviar texto livre via API. Se não → exibir seletor de template. Resposta aparece na thread imediatamente (otimista).
- **US-2004:** Badge vermelho no ícone de conversas no sidebar com contagem de mensagens não lidas. SSE ou polling 10s para atualizar. Mensagem marcada como lida ao abrir a conversa.
- **US-2005:** Página `/conversas` com lista de todas as conversas ativas (último contato, nome do lead, preview da última mensagem, vendedor). Filtro por vendedor. SUPERVISAO/CEO/ADMIN veem todas; VENDEDOR vê só as suas.
- **US-2006:** GET verifica `hub.verify_token` (env var WHATSAPP_VERIFY_TOKEN). POST valida assinatura `X-Hub-Signature-256` com `WHATSAPP_APP_SECRET`. Requisições inválidas → 403.

## Regras

- Janela de 24h: calculada a partir do `timestamp` da última mensagem recebida do lead (não enviada)
- Número de telefone do lead: normalizar para E.164 (+55...) antes de comparar
- Lead desconhecido: criar entrada temporária em tabela `whatsapp_conversa` sem leadId; admin pode vincular manualmente (Fase 4)
- Mídia (imagem, documento, áudio): armazenar media_id da Meta; download on-demand (não armazenar arquivo localmente neste sprint)
- Mensagem marcada como lida: `PATCH /api/conversas/:leadId/lida` — atualiza campo `lida` nas mensagens não lidas
- Histórico do lead: registrar evento 'mensagem_recebida' e 'mensagem_respondida'

## Acesso por perfil

| Ação | VENDEDOR | SUPERVISAO | CEO | ADMIN |
|------|----------|------------|-----|-------|
| Ver conversas próprias | ✅ | ✅ | ✅ | ✅ |
| Ver todas as conversas | ❌ | ✅ | ✅ | ✅ |
| Responder mensagem | ✅ (próprios leads) | ✅ | ✅ | ✅ |
| Configurar webhook | ❌ | ❌ | ✅ | ✅ |

## Fora do escopo

- Grupos WhatsApp
- Chamadas de voz/vídeo WhatsApp
- Leitura de confirmação de entrega ("tique azul" — requer webhook adicional)
- Download automático de mídia para servidor local
