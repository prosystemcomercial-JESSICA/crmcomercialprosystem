# TRD: CRM Comercial Prosystem

Documento de requisitos técnicos · versão 1.0 · 27/09/2026

## 1. Arquitetura

```
 Navegador (Next.js 16 / React 19)            WhatsApp (clientes)
        │  HTTPS (JWT)                               │
        ▼                                             ▼
 comercial-frontend (pm2, :3010) ──► comercial-backend (pm2, :3011, Fastify 4 + tsx)
                                        │   │   │   │
                  MySQL (Prisma 5) ◄────┘   │   │   └──► UAZAPI (WhatsApp não oficial, instância única)
                                            │   └──────► OpenAI (gpt-6-luna, gpt-4o-transcribe) · xAI Grok (opcional) · Gemini (legado)
                                            └──────────► Laya (pm2 "laya", 127.0.0.1:8765, modelo local)
 Outros: ZapSign (contratos), BrasilAPI/CNPJá (Receita), Resend/SMTP (e-mail), Google Calendar
```

- **Servidor:** VPS `comercial.prosystemnet.com`, pasta `/var/www/comercial-prosystem`, Nginx na frente.
- **Backend:** Fastify + Prisma (MySQL). Roda com `tsx` (TypeScript sem compilação), então **o tipo não é verificado em produção**: a checagem é feita antes do deploy com `npx tsc --noEmit -p . --rootDir .`.
- **Frontend:** Next.js (App Router), Tailwind e estilos inline com tokens CSS (`--t-card-bg`, `--t-text-primary`…).

## 2. Módulos do backend

| Pasta | Conteúdo |
|---|---|
| `src/routes/` | 45 grupos de rotas (leads, propostas-comerciais, contratos-comerciais, whatsapp, atividades, metas, comissões, painel-tv…) |
| `src/services/` | Regras com banco e rede (caroline, triagem-executor, laya, ia-gemini, assistente-*, escritório, envio-único, uso-ia…) |
| `src/lib/` | Lógica pura e testável (assistente/sdr, triagem/fluxo, laya-caderno, proposta, campanhas, gestao, escritorio…) |
| `prisma/schema.prisma` | 91 modelos (ver `05-esquema-backend.md`) |
| `tests/` | Vitest (≈410 testes; 8 dependem de banco local e falham fora do servidor) |

## 3. Agendadores (`server.ts`)

| Rotina | Intervalo | O que faz |
|---|---|---|
| Assistente | 10 min | Lembretes de demo, Sofia (seg 8h), cópia do Caderno da Laya, uso de IA, SLA estourado, lembrete da Laya (17h), follow-up de propostas |
| Agentes (Caroline/Julio/Luiz) + cutucão da triagem | 2 min | Respostas atrasadas (7h–21h), parou de responder (2 h), retomadas, ciclos, entrega à vendedora (8h30–17h), primeiro contato com limite |
| Resumo executivo | 15 min | 18h, uma vez por dia (trava no banco) |
| Outros | 5–60 min | Lembretes, sequências de e-mail, expiração de propostas, backup |

## 4. Integrações

| Serviço | Uso | Configuração |
|---|---|---|
| UAZAPI | Enviar texto, menu (botões), arquivo, baixar mídia, webhook de mensagens | Token da instância em `WhatsappInstancia` |
| OpenAI | Conversa dos agentes, resumo, tira-dúvidas, pesquisa com busca na web, transcrição | `OPENAI_API_KEY`, `OPENAI_MODEL` (padrão `gpt-6-luna`), `OPENAI_TRANSCRIBE_MODEL` |
| xAI Grok | Tarefas simples (resumo, conversa com agentes) com volta para a OpenAI | `XAI_API_KEY`, `XAI_MODEL` (padrão `grok-4.7`) |
| Gemini | Legado; usado se não houver OpenAI | `GEMINI_API_KEY` ou Configurações |
| Laya | Classificação (segmento, intenção, risco) | `LAYA_URL` |
| ZapSign | Contrato em PDF (mesmo modelo) enviado por `POST /docs` (base64), link pelo WhatsApp, e-mail pela ZapSign; webhook `https://comercial.prosystemnet.com/api/webhook/zapsign` (id 283740) com conferência do status via `GET /docs/{token}` | `ZAPSIGN_API_TOKEN` (produção, só no `.env`), `ZAPSIGN_ENVIRONMENT=production` |
| BrasilAPI / CNPJá | Consulta de CNPJ | — |
| Resend / SMTP | E-mails | `RESEND_API_KEY`, `SMTP_*` |

**Regra:** chaves ficam **só** no `.env` do servidor (permissão 600) ou em `ConfiguracaoIntegracao`; nunca no Git.

## 5. Regras técnicas críticas

1. **Pessoa assumiu, agentes param:** `assumirSeSemDono` zera `bot_ativo`, pausa a cadência, marca `SdrLead` como `HUMANO` e dispara o resumo para quem assumiu. `pessoaAssumiu()` e `humanoAssumiu()` checam dono e mensagens humanas.
2. **Anti-bloqueio:** limite diário único (`SdrLead.primeiro_envio_em` + `CampanhaEnvio` do dia), `intervaloSorteado()` 4–9 min, `delay` de "digitando" no `/send/text`, horário comercial, pausa após 3 falhas.
3. **Trava de repetição:** `envio-unico.service` grava `envio.<chave>` em `ConfiguracaoIntegracao`; o mesmo aviso não vai 2x em 6 h; resumo e lembrete da Laya 1x por dia, mesmo com reinício.
4. **IA em JSON:** a OpenAI exige a palavra "json" na mensagem no modo `json_object` (tratado em `chamarOpenAI`).
5. **Sem travessão e sem preço:** `lerRespostaCaroline` remove travessões e recusa respostas com valores em reais.
6. **Horários:** comercial = seg–sex 8h–18h e sáb 8h–12h; vendedora = seg–sex 8h30–17h; retomadas = 9h–11h30 e 14h–17h; respostas a quem conversa = 7h–21h; cutucões = 8h–20h.
7. **Contrato:** `captarDadosAssinante` (webhook do WhatsApp) preenche `representante_*`; `gerar-e-enviar` exige nome, CPF e e-mail; lembretes em `rodarLembretesAssinatura` (rotina de 10 min, trava `envio.contrato_*`); o webhook só marca assinado depois de conferir na ZapSign.
8. **Dados pessoais:** exemplos e testes usam dados fictícios.

## 6. Deploy

1. `npx tsc` (backend com `--rootDir .`, frontend) e `npx vitest run`.
2. `git commit` e `git push origin HEAD:main`.
3. Script `deploy-tmp.sh` via SSH (chave `~/.ssh/crm_comercial_vps`): `mysqldump` → `git pull` → `prisma generate` → checagem do diff do banco contra a lista `PERMITIDO` (só mudanças aditivas autorizadas) → `prisma db push` → `build` → `pm2 restart --update-env` → health check.
4. Backups em `/root/backups-deploy`; Caderno da Laya em `/root/laya-caderno`.

## 7. Segurança

- JWT com papéis (`CEO`, `ADMIN`, `DIRETOR`, `SUPERVISAO_COMERCIAL`, `SUPERVISAO`, `VENDEDOR`, `SDR`, `TECNICO_IMPLANTACAO`); rotas de gestão com `requireGestor`; conversas com `whereLeituraConversa` e `whereAcaoConversa`.
- 2FA, auditoria de usuários, contas de consulta só leitura.
- Senhas da VPS e do MySQL: mantidas (decisão da Jessica em 28/09). O deploy usa só a chave SSH `~/.ssh/crm_comercial_vps`.

## 8. Testes

- `tests/sdr-caroline.test.ts`: leitura de leads, horários, limites, termômetro, prompts, agendamento.
- `tests/triagem-*.test.ts`: roteiro da Bia, CNPJ, Laya.
- `tests/laya-caderno.test.ts`, `tests/assistente-proposta.test.ts`, `tests/escritorio.test.ts` e outros.


### Atualização 28/09/2026: resposta em até 1 minuto e dúvidas
- Quando o lead ou cliente escreve, a resposta do agente (Caroline, Julio, Luiz Felipe) sai **na hora, sem aprovação, em qualquer horário**: o agente espera 20 s para juntar mensagens seguidas e responde em cerca de 30 a 50 s (máximo ~1 min).
- A aprovação ("Aprovar antes de enviar") vale só para o que o agente puxa sozinho: primeiro contato e retomadas. Retomadas de quem já conversou, fora do horário comercial ou no sábado, também saem direto.
- Dúvida do cliente: (1) o agente procura no material e responde; (2) se não entendeu a pergunta, pergunta mais ao cliente; (3) só se o material não cobrir, avisa que confirma com a equipe (acao `duvida_fora_material`).
- Técnico: `caroline.service.ts` (`semAprovacao` inclui toda `fase === "resposta"`, `ESPERA_MS = 20_000`); `lib/assistente/sdr.ts` (regra NÃO INVENTE NADA reescrita). Sem mudança de schema. Regra também gravada como instrução da equipe no Escritório virtual.

### Atualização 28/09/2026: desistência vira "perdido" com motivo + lista News + Instagram
- Quando o cliente diz que não quer, ou que já fechou com outro sistema, o agente se despede com a porta aberta (sem fazer pergunta nessa despedida) e a IA devolve `motivo_perda` (PRECO | JA_TEM_FORNECEDOR | SEM_ORCAMENTO | TIMING | SEM_INTERESSE | FUNCIONALIDADE_AUSENTE | OUTRO, as mesmas chaves do funil e do relatório comercial).
- Quando há proposta (Luiz Felipe) ou o motivo é JA_TEM_FORNECEDOR, `marcarPerdidoNews` (caroline.service.ts) faz o seguinte:
  - Lead: `status/etapa_funil/etapa_comercial = PERDIDO`, `motivo_perda` recebe "CHAVE: o que o cliente disse", e uma linha é gravada em `LeadPerda`. Se a proposta não tiver lead vinculado, o sistema acha o lead pelo celular (últimos 8 dígitos) ou cria um com origem PROPOSTA.
  - Proposta: `status = PERDIDA` e uma linha em `PropostaHistorico` (tipo STATUS, com o motivo).
  - Etiqueta do sistema **News** (roxa, `sistema=true`) aplicada ao lead.
  - Mensagem automática com o Instagram: https://instagram.com/prosystemoficial.
- Campanhas (Zequinha): novo público **NEWS**, que reúne os leads com a etiqueta News e vem com um modelo de informativo que já traz o Instagram. O "SAIR" continua valendo.
- Sem mudança de schema (usa Etiqueta, LeadEtiquetaAplicada, LeadPerda e PropostaHistorico, que já existiam).

### Atualização 28/09/2026: vídeos e suporte vão para o setor de suporte
- Se o cliente pede vídeos (tutoriais, treinamento, "como usar"), ajuda técnica ou suporte, o agente (Caroline, Julio ou Luiz Felipe) usa a nova ação `encaminhar_suporte`, com `mensagens: []`, e não promete enviar vídeos.
- Em seguida o sistema envia o texto padrão `mensagemSuporte(agente)` (lib/assistente/sdr.ts): "O envio de vídeos, treinamentos e o suporte técnico são feitos pelo nosso setor de suporte. Eu sou o Luiz Felipe, do setor comercial…". A mensagem vai com o botão de link "💬 Falar com o suporte" (`LINK_CONTATO_GERAL`, o mesmo usado na triagem) e fica registrada na conversa.
- A função `encaminharSuporte` fica em caroline.service.ts. O lead continua em CONVERSANDO. Não há mudança de schema.

### Atualização 28/09/2026: conversa mais simples, direta e com os desafios da farmácia
- **Menos perguntas:** no máximo 2 perguntas de investigação na conversa inteira, e nunca repetir uma pergunta já respondida. Assim que o cliente diz qual é o problema, mesmo numa palavra ("demora"), o agente mostra em 1 ou 2 frases como o MATERIAL resolve e já oferece a demonstração (`oferecer_demo`, sem esperar a nota 60).
- **Resposta curta** ("nada", "isso") é tratada como sinal de pouca paciência: nada de mais perguntas abertas, o agente vai direto para a solução e a demonstração.
- **Pergunta direta:** "Qual é o maior problema que você quer resolver hoje na farmácia?", com o convite para explicar por áudio (os áudios são transcritos).
- **Dia a dia da farmácia (conhecimento geral)**, usado de forma natural, um exemplo por vez:
  - fila e demora no caixa;
  - estoque furado e remédio vencendo;
  - controlados e receitas (SNGPC);
  - convênios, PBM e Farmácia Popular;
  - fiado e crediário;
  - margem e preço;
  - cliente de uso contínuo que não volta;
  - fechamento de caixa;
  - nota fiscal e impostos.
- A solução para cada um desses problemas só vem do MATERIAL.
- Onde está no código: `promptCaroline` em lib/assistente/sdr.ts. Não há mudança de schema.
