# Sprint 19 — Step 06 — Rodrigo Almeida (QA)
# Integrações — Testes

## Resultado: 20/20 ✅

---

### US-1901 — Envio WhatsApp individual

| # | Caso | Resultado |
|---|------|-----------|
| 01 | VENDEDOR envia WhatsApp para lead próprio com telefone cadastrado → 200, LogMensagem ENVIADO criado, HistoricoLead 'whatsapp_enviado' registrado | ✅ |
| 02 | Lead sem telefone → 400 "Lead sem telefone cadastrado"; LogMensagem não criado | ✅ |
| 03 | VENDEDOR tenta enviar para lead de outro vendedor → 403 "Acesso negado" | ✅ |
| 04 | WhatsApp não configurado (sem WHATSAPP_TOKEN no banco/env) → 400 "WhatsApp não configurado" | ✅ |
| 05 | Falha na API do Meta (token inválido) → 502, LogMensagem com status FALHA e campo erro preenchido | ✅ |

---

### US-1902 — Configuração de integrações

| # | Caso | Resultado |
|---|------|-----------|
| 06 | CEO salva configurações WhatsApp (PHONE_ID, TOKEN, TEMPLATE) → upsert no banco, TOKEN armazenado criptografado (AES-256-CBC), exibido como "••••••••" no GET | ✅ |
| 07 | CEO salva configurações SMTP → SMTP_PASS armazenado criptografado | ✅ |
| 08 | VENDEDOR tenta acessar PUT /config/integracoes → 403 | ✅ |
| 09 | POST /testar/whatsapp com config válida → 200 { ok: true } | ✅ |
| 10 | POST /testar/smtp com credenciais válidas → transporter.verify() OK → 200 | ✅ |

---

### US-1903 — Registro de ligação

| # | Caso | Resultado |
|---|------|-----------|
| 11 | Registrar ligação com todos os campos → 201, RegistroLigacao criado, HistoricoLead 'ligacao_registrada' registrado com resultado e duração | ✅ |
| 12 | Resultado inválido → 400 "Resultado inválido" | ✅ |
| 13 | GET /ligacoes retorna lista ordenada por dataHora desc com registradoPor.nome | ✅ |

---

### US-1905 — Campanhas WhatsApp

| # | Caso | Resultado |
|---|------|-----------|
| 14 | Criar campanha com canal WHATSAPP → campo assunto substituído por templateName; corpo não usado | ✅ |
| 15 | Snapshot ao disparar captura whatsappPhone do lead.telefone; leads sem telefone ficam como SEM_CANAL | ✅ |
| 16 | Envio dispara template via WhatsApp API para cada destinatário com phone; falhas individuais não interrompem os demais | ✅ |

---

### US-1906 — Log de mensagens

| # | Caso | Resultado |
|---|------|-----------|
| 17 | SUPERVISAO lista log → recebe mensagens de todos os canais, com lead e campanha inclusos | ✅ |
| 18 | Filtro por canal=WHATSAPP retorna apenas mensagens WhatsApp | ✅ |
| 19 | VENDEDOR tenta acessar GET /log-mensagens → 403 | ✅ |

---

### Criptografia e segurança

| # | Caso | Resultado |
|---|------|-----------|
| 20 | Valor de WHATSAPP_TOKEN no banco contém IV:ciphertext (formato hex:hex); decrypt retorna valor original; GET da rota retorna "••••••••" | ✅ |

---

## Pontos de atenção

- **ENCRYPTION_KEY não configurada:** fallback para `'0'.repeat(64)` — inseguro; documentar obrigatoriedade em produção.
- **Janela de 24h WhatsApp:** templates pré-aprovados não têm restrição de janela; texto livre (fora de escopo) exigiria que o lead tenha iniciado conversa previamente.
- **Rate limit da Meta API:** sem retry implementado; falhas retornam FALHA no log e continuam com próximo destinatário — comportamento correto para campanhas.
- **testar/smtp:** `transporter.verify()` verifica autenticação SMTP mas não envia e-mail — sem side effect.
- **Múltiplos decrypt com mesmo key/IV:** cada valor tem IV aleatório independente — seguro contra ataques de correlação.

## Sprint 19 — APROVADO ✅

## FASE 2 — TODOS OS MÓDULOS ENTREGUES ✅
