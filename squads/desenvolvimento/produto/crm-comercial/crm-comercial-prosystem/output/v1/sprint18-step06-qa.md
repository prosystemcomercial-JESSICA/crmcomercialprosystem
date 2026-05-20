# Sprint 18 — Step 06 — Rodrigo Almeida (QA)
# Campanhas — Testes

## Resultado: 20/20 ✅

---

### US-1801 — Criação de campanha

| # | Caso | Resultado |
|---|------|-----------|
| 01 | SUPERVISAO cria campanha com todos os campos → 201 com objeto, status RASCUNHO | ✅ |
| 02 | VENDEDOR tenta criar campanha → 403 "Acesso negado" | ✅ |
| 03 | Criar campanha sem nome → 400 (validação Fastify) | ✅ |

---

### US-1802/1803 — Segmentação e prévia

| # | Caso | Resultado |
|---|------|-----------|
| 04 | GET /campanhas/preview com filtroEtapas=["qualificacao"] → retorna leads filtrados com comEmail e semEmail corretos | ✅ |
| 05 | GET /campanhas/preview sem filtros → retorna todos os leads | ✅ |
| 06 | Preview com filtro de vendedor específico → apenas leads do vendedor retornados | ✅ |

---

### US-1804 — Disparo imediato e agendamento

| # | Caso | Resultado |
|---|------|-----------|
| 07 | POST /campanhas/:id/disparar sem agendadaPara → status muda para ENVIANDO imediatamente | ✅ |
| 08 | POST /campanhas/:id/disparar com agendadaPara futura → status AGENDADA, campo agendadaPara gravado | ✅ |
| 09 | Tentar disparar campanha já ENVIANDO → 400 "Campanha não pode ser disparada neste status" | ✅ |
| 10 | Tentar disparar campanha sem leads correspondentes → 400 "Nenhum lead corresponde aos filtros" | ✅ |

---

### US-1805 — Métricas e progresso

| # | Caso | Resultado |
|---|------|-----------|
| 11 | SSE /campanhas/:id/progresso retorna eventos a cada 1.5s com totalEnviados/totalFalhas/status atualizado | ✅ |
| 12 | Após conclusão do envio, SSE emite evento com status CONCLUIDA e fecha conexão | ✅ |
| 13 | Campanha concluída: totalEnviados + totalFalhas = totalDestinatarios - contagem SEM_CANAL | ✅ |

---

### US-1806 — Controle de acesso VENDEDOR

| # | Caso | Resultado |
|---|------|-----------|
| 14 | VENDEDOR lista campanhas → recebe somente campanhas que incluem seus leads | ✅ |
| 15 | VENDEDOR acessa detalhe de campanha com seu lead → 200 OK | ✅ |
| 16 | VENDEDOR tenta editar campanha → 403 (checado na rota PATCH) | ✅ |

---

### US-1807 — Registro por destinatário

| # | Caso | Resultado |
|---|------|-----------|
| 17 | Após disparo, leads sem e-mail aparecem em campanha_destinatarios com status SEM_CANAL | ✅ |
| 18 | Falha de SMTP para um lead → destinatário marcado como FALHA com campo erro preenchido; outros leads continuam sendo processados | ✅ |

---

### Cancelamento

| # | Caso | Resultado |
|---|------|-----------|
| 19 | Cancelar campanha AGENDADA → status CANCELADA, leads ficam como PENDENTE | ✅ |
| 20 | Cancelar campanha ENVIANDO → loop verifica status e para; leads pendentes não enviados permanecem como PENDENTE; status final CANCELADA | ✅ |

---

## Pontos de atenção

- **Cron e campanhas agendadas:** `verificarCampanhasAgendadas` roda a cada hora. Janela de delay máximo = 59min. Aceitável para o contexto de campanhas comerciais (não é disparo em tempo real).
- **Envio em massa e SMTP throttle:** `setImmediate` entre envios respeita a fila de eventos, mas sem rate-limit explícito. SMTP providers (Gmail, SendGrid) podem rejeitar em alta frequência. Recomendado configurar um SMTP transacional (SendGrid/Mailgun) em produção.
- **Variáveis de template:** `{nome}`, `{empresa}`, `{vendedor}` são substituídas silenciosamente por string vazia se o lead não tiver o campo preenchido — sem quebra no envio.
- **Re-disparo de campanha:** `createMany skipDuplicates` protege contra re-snapshot acidental; status deve ser RASCUNHO ou AGENDADA para re-disparar.

## Sprint 18 — APROVADO ✅
