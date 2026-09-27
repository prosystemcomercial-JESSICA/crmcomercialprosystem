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
| ZapSign | Assinatura de contratos | Configurações |
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
7. **Dados pessoais:** exemplos e testes usam dados fictícios.

## 6. Deploy

1. `npx tsc` (backend com `--rootDir .`, frontend) e `npx vitest run`.
2. `git commit` e `git push origin HEAD:main`.
3. Script `deploy-tmp.sh` via SSH (chave `~/.ssh/crm_comercial_vps`): `mysqldump` → `git pull` → `prisma generate` → checagem do diff do banco contra a lista `PERMITIDO` (só mudanças aditivas autorizadas) → `prisma db push` → `build` → `pm2 restart --update-env` → health check.
4. Backups em `/root/backups-deploy`; Caderno da Laya em `/root/laya-caderno`.

## 7. Segurança

- JWT com papéis (`CEO`, `ADMIN`, `DIRETOR`, `SUPERVISAO_COMERCIAL`, `SUPERVISAO`, `VENDEDOR`, `SDR`, `TECNICO_IMPLANTACAO`); rotas de gestão com `requireGestor`; conversas com `whereLeituraConversa` e `whereAcaoConversa`.
- 2FA, auditoria de usuários, contas de consulta só leitura.
- Pendente: troca das senhas da VPS e do MySQL (atividade de 28/09).

## 8. Testes

- `tests/sdr-caroline.test.ts`: leitura de leads, horários, limites, termômetro, prompts, agendamento.
- `tests/triagem-*.test.ts`: roteiro da Bia, CNPJ, Laya.
- `tests/laya-caderno.test.ts`, `tests/assistente-proposta.test.ts`, `tests/escritorio.test.ts` e outros.
