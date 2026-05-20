# Sprint 20 — Step 06 — Rodrigo Almeida (QA)
# Inbound WhatsApp — Testes

## Resultado: 20/20 ✅

---

### US-2001 — Recebimento via webhook

| # | Caso | Resultado |
|---|------|-----------|
| 01 | GET /webhook/whatsapp com hub.verify_token correto → retorna hub.challenge | ✅ |
| 02 | GET /webhook/whatsapp com token incorreto → 403 | ✅ |
| 03 | POST /webhook/whatsapp com assinatura HMAC válida + mensagem texto → mensagem armazenada, conversa upsertada, historico registrado | ✅ |
| 04 | POST /webhook/whatsapp com assinatura inválida → 403, nada armazenado | ✅ |
| 05 | Mensagem re-entregue (waMessageId duplicado) → ignorada (skipDuplicates); totalNaoLidas não incrementado duas vezes | ✅ |
| 06 | Mensagem de número não cadastrado como lead → WhatsappConversa criada com leadId null; leadId preenchido automaticamente quando lead com mesmo telefone existe | ✅ |
| 07 | Mensagem tipo imagem → armazenada com tipo IMAGE, mediaId preenchido, texto null | ✅ |

---

### US-2002 — Thread na ficha do lead

| # | Caso | Resultado |
|---|------|-----------|
| 08 | GET /conversas/:leadId retorna mensagens ordenadas por timestamp asc com enviadoPor incluído | ✅ |
| 09 | Abrir aba Conversas → PATCH /conversas/:leadId/lida chamado automaticamente; totalNaoLidas zerado; badge atualizado | ✅ |

---

### US-2003 — Resposta

| # | Caso | Resultado |
|---|------|-----------|
| 10 | Responder dentro da janela de 24h → POST texto livre para Meta API; mensagem OUTBOUND gravada | ✅ |
| 11 | Responder fora da janela → template enviado via enviarWhatsApp; mensagem OUTBOUND gravada | ✅ |
| 12 | VENDEDOR tenta responder conversa de outro vendedor → 403 | ✅ |
| 13 | Lead sem telefone → 400 "Lead sem telefone" | ✅ |

---

### US-2004 — Notificação em tempo real

| # | Caso | Resultado |
|---|------|-----------|
| 14 | Mensagem recebida → SSE notifica vendedor do lead via sseHub.notificarUsuario (evento nova_mensagem_whatsapp) | ✅ |
| 15 | SSE heartbeat enviado a cada 30s `: ping\n\n` → conexão mantida viva sem timeout | ✅ |
| 16 | GET /conversas/nao-lidas/contagem retorna soma correta; VENDEDOR recebe apenas suas conversas | ✅ |

---

### US-2005 — Listagem de conversas

| # | Caso | Resultado |
|---|------|-----------|
| 17 | SUPERVISAO lista conversas → recebe todas, ordenadas por ultimaMensagemEm desc | ✅ |
| 18 | VENDEDOR lista conversas → recebe apenas conversas de leads com vendedorId = userId | ✅ |

---

### US-2006 — Segurança e proxy de mídia

| # | Caso | Resultado |
|---|------|-----------|
| 19 | GET /api/whatsapp/media/:mediaId sem autenticação JWT → 401 | ✅ |
| 20 | GET /api/whatsapp/media/:mediaId com token válido → proxy faz fetch na Meta com Authorization Bearer e retorna stream com Content-Type correto | ✅ |

---

## Pontos de atenção

- **processarMensagemInbound é assíncrona:** Meta recebe 200 imediatamente; falhas no processamento são logadas no console (sem retry automático — Fase 4).
- **rawBody no Fastify:** `addContentTypeParser` deve ser configurado **antes** de registrar rotas; ordem importa.
- **Janela de 24h:** calculada no frontend e no backend de forma independente — sem divergência pois ambos usam `ultimaMensagemRecebidaEm` do banco.
- **Conversas de lead desconhecido:** aparecem na lista com telefone bruto; sem aba Conversas na ficha (leadId null); vínculo manual previsto para Fase 4.
- **SSE hub em memória:** em ambiente multi-process (PM2 cluster), conexões SSE de usuários em processos diferentes não se comunicam. Solução para produção: Redis pub/sub (Fase 4).

## Sprint 20 — APROVADO ✅
