# CRM como assistente: Fase 1 (aprovada em 25/09/2026)

Origem: docs/comercial/crm-assistente.html (ideias 4, 5, 6, 20 e 21). Decisões da usuária: horários fixos, PIX por botão (chave pendente), só Jessica e Thiago usam comandos/avisos.

## Regras globais
- Nenhuma Atividade criada automaticamente. Exceção explícita: a demo que o PRÓPRIO lead escolhe vira a reunião na agenda (ação do lead, não do sistema).
- Nunca enviar preço/desconto que não venha da proposta montada pela vendedora.
- Tudo pelo WhatsApp da empresa (UAZAPI). Mensagens do robô gravadas como SAIDA `enviada_por: 'bot'`.

## Entrega 1 — Gestão no celular
**Quem é gestão:** usuários ATIVOS com cargo CEO ou SUPERVISAO_COMERCIAL e telefone cadastrado; casa pelos últimos 8 dígitos.
**Comandos (mensagem do número da gestão para o número da empresa):** não cria lead nem conversa; responde e para.
- `hoje` → números do dia (painel da TV, tela 1).
- `semana` → números da semana (resumo semanal).
- `propostas paradas` → propostas ENVIADA/VISUALIZADA/EM_NEGOCIACAO sem atualização há 7+ dias.
- `cliente <código ou nome>` → até 5 clientes (busca por código/nome/CNPJ).
- qualquer outra coisa → ajuda com a lista de comandos.
**Avisos** (enviados aos números da gestão): `lead_qualificado`, `proposta_aberta`, `proposta_aceita`, `sla_estourado`, `risco_cancelar`. Preferência por usuário em ConfiguracaoIntegracao `assistente.avisos.<userId>` (JSON array; ausente = todos). Tela: Configurações → Assistente no WhatsApp.
- sla_estourado: varredura a cada 10 min em horário comercial; avisa uma vez por conversa por prazo.
- risco_cancelar: quando a Laya passa de < 0,5 para ≥ 0,5.

## Entrega 2 — Proposta pelo WhatsApp + follow-up
- Botão "Enviar proposta" na conversa: lista propostas abertas que casam com a conversa (CNPJ da conversa/lead ou telefone do responsável). Envia resumo + link + botões **Aceitar** / **Tenho dúvidas**. RASCUNHO → ENVIADA com histórico.
- **Aceitar** executa o mesmo aceite do link público (`POST /p/:token/aceitar` via inject). Depois: se há chave PIX (`assistente.pix_chave`) e entrada > 0, envia valor + chave; senão "o financeiro vai te enviar a cobrança da entrada". Aviso `proposta_aceita`.
- **Tenho dúvidas** → prioridade CRÍTICA na conversa + evento para a equipe.
- Follow-up: dia 2 lembrete, dia 5 conteúdo do segmento, dia 7 aviso de validade. Para se o cliente mandar qualquer mensagem depois do envio, aceitar ou recusar. Seg–sex, 9h–18h. Campos novos em PropostaComercial: `wpp_conversa_id`, `wpp_enviada_em`, `wpp_followup_etapa`.

## Entrega 3 — Demo marcada pelo lead
- Fim da triagem com desfecho `qualificado` → lista com até 10 horários: seg–sex 9h–12h e 14h–17h (SP), 30 min, ≥ 2 h a partir de agora, sem conflito com REUNIAO PENDENTE/CONFIRMADA de quem atende.
- Escolha → Atividade REUNIAO (responsável: dono da conversa ou supervisão comercial), confirmação, lembrete 2 h antes pelo WhatsApp (campo `lembrete_whatsapp_em`, vínculo `whatsapp_conversa_id` na Atividade).
- Lead escreve "remarcar" → reunião vai para REMARCADA e recebe nova lista.

## Testes
Lógica pura em `src/lib/assistente/*` com Vitest: parser de comandos, casamento de telefone, geração de horários, decisão de follow-up, textos.
