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

### Atualização 28/09/2026: pedido de prazo sempre com previsão + campanha/revisão com autorização
- **Luiz Felipe:** quando o cliente pede mais prazo, o agente nunca sai só agradecendo. Ele pede uma previsão ("pra quando você acha que consegue decidir? assim já te chamo nesse dia"), confirma a data e deixa a porta aberta.
- **Do dia 20 ao último dia do mês** (`janelaCampanhaAtiva`, horário de Brasília), ele também diz que temos campanhas ativas e que pode revisar a proposta, sem citar valores. Essa mensagem vem marcada com `revisar_proposta: true`, e aí:
  - ela sempre vai para "✋ Para você aprovar", mesmo sendo uma resposta;
  - a Jessica recebe um aviso no WhatsApp ("🙋 Autorização: … quer oferecer revisão da proposta") com o texto;
  - fora da janela, uma mensagem com essa marcação é descartada e nunca sai.
- **Código:** `promptCaroline` (parâmetro `janelaCampanha`) e `lerRespostaCaroline` em lib/assistente/sdr.ts; `falar` em caroline.service.ts. Não há mudança de schema.

### Atualização 28/09/2026: máquina de negociação do Luiz Felipe (autorização por botão no WhatsApp)
- **Pedido de autorização:** quando o Luiz marca uma mensagem com `revisar_proposta` (entre o dia 20 e o fim do mês, uma vez por mês por cliente), a mensagem fica PENDENTE e `pedirAutorizacaoNegociacao` (assistente-negociacao.service.ts) envia para a gestão, só a quem recebe o aviso `lead_qualificado` (o Thiago não recebe), um menu com:
  - a prévia da proposta: empresa, contato, plano, mensalidade, implantação e link;
  - a mensagem que vai para o cliente;
  - as opções de desconto: implantação -30% ou -20% e mensalidade -10% por 12 meses, com os valores de antes e depois.
- **Botões** (`lib/assistente/negociacao.ts`): `neg_30_<msgId>` "✅ Autorizar 30%", `neg_20_<msgId>` "✅ Autorizar 20%" e `neg_0_<msgId>` "❌ Não autorizar". `responderComandoGestao` encaminha para `responderAutorizacaoNegociacao`:
  - **Autorizar:** grava `SdrLead.dados.desconto_autorizado` (impl_pct, mens_pct 10, meses 12, valores de antes e depois, quem autorizou) e `campanha_mes`, aprova a mensagem (`decidirMensagem`) e confirma para a gestora.
  - **Não autorizar:** a mensagem sai trocada só pelo pedido de previsão de decisão e o cliente fica marcado com `campanha_recusada` no mês.
- **Com desconto autorizado:** o prompt do Luiz recebe `instrucaoDescontoAutorizado`, que manda ser comercial e conduzir ao fechamento. Ele apresenta a condição só em porcentagem, como campanha válida até o fim do mês. Se o cliente topar, usa a ação `aceitar_condicao`.
- **`aceitar_condicao` → `aplicarCondicaoNaProposta`:**
  - na proposta: `desconto` = X% da implantação, `valor_final` recalculado, `condicao_especial` com a mensalidade -10% por 12 meses, `desconto_aprov_status=APROVADO`, status EM_NEGOCIACAO e histórico RENEGOCIACAO;
  - reenvio pelo WhatsApp (`enviarPropostaWhatsapp`) com os botões de aceite de sempre, mais o texto "Condição da campanha aplicada";
  - aviso 🔥 para a gestão.
- **Sem desconto autorizado,** o Luiz continua proibido de oferecer valores ou condições.
- Não há mudança de schema. Teste: tests/negociacao.test.ts.

### Atualização 28/09/2026: campanha negociada vale 5 dias corridos
- A condição autorizada vale `VALIDADE_CAMPANHA_DIAS = 5` dias corridos, contados a partir do momento da autorização (`desconto_autorizado.em`). As funções `validadeCampanha` e `campanhaVigente` ficam em lib/assistente/negociacao.ts.
- O Luiz apresenta a condição como "válida por 5 dias (até DD/MM)". O texto "Condição da campanha aplicada" mostra a mesma data, e a confirmação enviada à gestora também.
- Passados os 5 dias, a condição deixa de ir para o prompt e `aplicarCondicaoNaProposta` recusa a aplicação.
- A oferta ao cliente passou a dizer "campanha ativa por poucos dias", no lugar de "campanhas ativas este mês".

### Atualização 28/09/2026: cliente nunca fica órfão por mensagem mandada do celular
- **Causa:** a Jessica mandou uma mensagem pelo celular sem assumir a conversa no CRM. `pessoaAssumiu` tratava isso como se uma pessoa tivesse assumido: o agente virava HUMANO, a conversa ficava sem dono e ninguém respondia o cliente.
- **Correção em `pessoaAssumiu`** (caroline.service.ts): o dono no CRM continua valendo como assumido. Já uma mensagem humana sem dono só conta como "pessoa conversando" se tiver sido enviada nos últimos 10 minutos.
- **Correção em `aoReceberDoLead`:** o SdrLead HUMANO volta para CONVERSANDO e o agente responde quando as quatro condições valem:
  - o cliente escreveu;
  - a conversa não tem dono;
  - a conversa não foi finalizada;
  - ninguém conversou nos últimos 10 minutos.
- A regra "uma pessoa assumiu, nenhum agente responde" continua valendo para quem assume pelo CRM (fica como dono) e para a conversa finalizada.
- Não há mudança de schema.

### Atualização 28/09/2026: lembrete da demonstração para a responsável
- As demonstrações marcadas pelo lead já eram gravadas como Atividade (tipo REUNIAO, `created_by = lead_whatsapp`) e aparecem na Agenda da responsável: o dono da conversa ou, sem dono, a Supervisão Comercial.
- **Novo:** `lembrarResponsavelDemo` (assistente-demo.service.ts) roda no agendador do assistente a cada 10 minutos. Quando uma reunião ativa começa em até 75 minutos, a responsável recebe no WhatsApp dela um aviso com:
  - "⏰ Lembrete: demonstração às HH:MM";
  - o título da reunião;
  - o nome e o número do cliente;
  - o link da reunião ou, se não houver, um alerta para enviá-lo.
- O aviso chega entre 65 e 75 minutos antes, portanto sempre com pelo menos 1 hora de antecedência. É uma vez só por reunião (trava `lembrete_demo_resp.<id>`).
- O lembrete do cliente, 2 horas antes, continua como estava. Não há mudança de schema.

### Atualização 28/09/2026: CRM como app de iPhone no celular (etapa 1 de 4)
- **Base:** guia de interface da Apple (HIG iOS), usado a partir de `reference/ios.md` das skills impeccable e anti-ui-slop. Vale só abaixo de 768px; no computador nada muda.
- **Barra de abas embaixo** (`components/mobile/AppIOS.tsx` › `BarraAbasIOS`):
  - WhatsApp, Leads, Propostas (gerador), Dashboard e Mais;
  - material translúcido com blur e linha fina de separação;
  - alvos de toque de 44pt, ícones de 24px e rótulos de 10px;
  - cor de ação azul do sistema (#007AFF, ou #0A84FF no escuro);
  - área segura da barra de início respeitada.
  - Uma aba só aparece se a pessoa tiver permissão para a tela, pelo mesmo filtro do menu (`gruposVisiveis`).
- **Folha "Mais"** (`FolhaMaisIOS`): sobe de baixo com alça e botão fechar, e traz o título grande "Mais". Mostra todas as outras telas liberadas em listas agrupadas no estilo Ajustes (ícone em quadrado arredondado, linha de 44pt, seta), com animação de folha iOS e respeito a `prefers-reduced-motion`.
- **Estrutura:** o menu hambúrguer foi escondido (a aba "Mais" substitui). A barra de cima respeita o notch e a Dynamic Island. O conteúdo tem espaço embaixo para a barra de abas, e a fonte do sistema (San Francisco) vale no celular.
- **Estilos** em `app/ios.css`, com tokens `--ios-*` para os modos claro e escuro (`.dark`).
- **Instalação na tela inicial:**
  - `app/manifest.ts`: standalone, `start_url` /whatsapp, ícones de 192 e 512 (também maskable);
  - `apple-touch-icon.png` de 180px, com a marca ▶ da Prosystem sobre fundo branco;
  - `appleWebApp` com o título "CRM Prosystem".
- **Próximas etapas:**
  - 2: WhatsApp e Leads (títulos grandes, listas e folhas);
  - 3: Propostas e Dashboard;
  - 4: telas do "Mais".

### Atualização 28/09/2026: celular no padrão iOS, etapa 2 (WhatsApp e Leads)
Tudo vale só abaixo de 768px, com classes `ios-*` em `app/ios.css`. No computador nada muda.
- **WhatsApp, lista** (estilo app Mensagens):
  - título grande "WhatsApp" de 34pt;
  - Conversas/Fila e Minhas/Sem dono/Todas/Finalizadas viram controles segmentados;
  - campo de busca iOS (preenchimento cinza, 17pt);
  - linhas de 76pt com avatar de 52pt e separador recuado;
  - selo "Conectado" e faixa "WhatsApp da empresa" escondidos no celular.
- **WhatsApp, conversa** (estilo iMessage):
  - a barra de abas some (classe `ios-em-chat` no body);
  - barra de navegação translúcida com "‹ Conversas", nome, ⓘ (detalhes) e ⋯ (ações);
  - bolhas de 18pt de raio, enviadas em azul do sistema e recebidas em cinza #E9E9EB, texto de 17pt;
  - campo de mensagem em pílula na barra translúcida, com área segura.
- **Folha de ações ⋯** (padrão action sheet): Assumir, Finalizar/Reabrir, Detalhes do atendimento, Prioridade, Etiquetar, Agendar reunião, Vincular a cliente da base, Transferir, Desvincular do funil, Excluir (em vermelho) e Cancelar. A fileira de botões só aparece no computador (`hidden md:contents`).
- **Detalhes ⓘ:** o painel lateral (Criar proposta, Observações, IA, funil etc.) abre como folha em tela cheia, com cabeçalho "Detalhes" e botão OK (estado `painelMobile`).
- **Leads:**
  - título grande "Central de Leads";
  - busca iOS em linha própria;
  - filtros como pílulas em faixa rolável horizontal;
  - "Novo Lead" em azul do sistema;
  - funil com uma etapa por página (coluna com a largura da tela e rolagem com encaixe), navegando pelas setas de 44pt, pelos pontos ou deslizando.
  - O passo das setas passou a medir a largura real da coluna (`colWidth()`), o que vale para o computador e para o celular.
- **Próximas etapas:**
  - 3: Propostas (gerador) e Dashboard;
  - 4: telas do "Mais".

### Atualização 29/09/2026: celular no padrão iOS, etapa 3 (Propostas e Dashboard)
Tudo vale só abaixo de 768px (`app/ios.css`). No computador nada muda.
- **Classes genéricas para outras telas:**
  - `ios-tela`: fundo agrupado #F2F2F7; os `.ps-card` viram cartões iOS com raio de 12, sem borda e sem sombra.
  - `ios-topo`: cabeçalho em coluna, com título grande de 34pt e subtítulo de 15pt.
  - `ios-seg-inline` e `ios-abas`: controles segmentados.
  - `ios-filtros`: busca iOS em linha própria e campos de 36 a 44pt.
  - `ios-lista-cartoes`: a tabela vira lista de cartões, com cabeçalho escondido, uma linha por cartão e botões de ação de 44pt.
  - `ios-modal-*`: o modal vira folha em tela cheia.
- **Propostas (gerador):**
  - título grande "Gerador de Proposta Comercial";
  - Lista/Kanban como segmentado;
  - "Nova Proposta" em botão largo azul do sistema, com 44pt;
  - indicadores em cartões iOS;
  - lista de propostas em cartões: empresa em 17pt, detalhes em 15pt e ações Ver/Editar/Link/WhatsApp com 44pt.
- **Formulário da proposta em folha de tela cheia:**
  - barra de título translúcida com área segura e botão fechar redondo;
  - passos com 44pt e a cor de ação do sistema;
  - campos em uma coluna, de 17pt e 44pt de altura (o `gridColumn: span 2` do FormField é anulado no celular);
  - botões do rodapé com 44pt.
- **Dashboard:**
  - título grande "Dashboard Executivo";
  - filtros e Atualizar com 36pt;
  - abas (`AbaTabs`) como segmentado rolável, com a aba ativa em cartão branco;
  - cartões iOS;
  - barras horizontais com rótulo de 92px para caber na tela.
- **Próxima:** etapa 4, com as telas do "Mais" (Escritório, Agenda, Contratos etc.), usando as classes genéricas.

### Atualização 29/09/2026: notificações no celular, bolinha no ícone e tela "Aprovar"
- **Notificações (Web Push):**
  - Tabela nova `PushInscricao` (id, usuario_id, endpoint único de 700, p256dh, auth, aparelho, created_at, ultimo_ok), com um registro por aparelho.
  - Biblioteca `web-push` no backend.
  - Chaves VAPID (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) só no `.env` do servidor, com chmod 600.
  - `services/push.service.ts`: `enviarPush(prisma, usuarioIds, {titulo, corpo, url, tag})` envia a todos os aparelhos da pessoa, grava `ultimo_ok` e apaga inscrições vencidas (404/410). Nunca lança.
  - `contagemPendencias` soma aprovações pendentes (gestão), conversas sem dono com mensagens não lidas e não lidas das conversas da pessoa.
- **Rotas** (`routes/push.ts`):
  - `GET /push/chave`
  - `POST /push/inscrever`
  - `POST /push/cancelar`
  - `POST /push/teste`
  - `GET /push/contagem`
  - `GET /assistente/aprovacoes` (gestão)
  - `POST /assistente/aprovacoes/:id/negociacao` com {pct: 0 | 20 | 30}
- **Quem dispara notificação:**
  - `enviarAvisoGestao`: todo aviso que vai pelo WhatsApp da gestão também vira notificação. Abre /aprovar quando o texto fala de aprovação ou autorização; senão, /whatsapp.
  - `pedirAutorizacaoNegociacao`: "🙋 Luiz Felipe pede autorização de campanha", abrindo /aprovar.
  - `lembrarResponsavelDemo`: "⏰ Demonstração às HH:MM", abrindo /atividades.
- **Negociação:** `decidirNegociacao` foi separada de `responderAutorizacaoNegociacao` e é usada pelos botões do WhatsApp e pela tela Aprovar. A mensagem pendente guarda `negociacao: true` no meta.
- **Frontend:**
  - `public/sw.js`: service worker que recebe o push, mostra a notificação, atualiza a bolinha (`setAppBadge`) e abre a URL ao tocar.
  - `components/mobile/NotificacoesApp.tsx`: registra o service worker e mostra o aviso flutuante "Receba avisos no celular" (Ativar / Agora não). No iPhone fora do app, o aviso ensina a instalar na Tela de Início.
  - Ao ativar, o app pede permissão, inscreve o aparelho e manda um push de teste.
  - A bolinha no ícone é atualizada a cada 60 s e ao voltar para o app.
- **Tela `/aprovar`** (item "Aprovar" no menu, só gestão): cartões iOS com tudo o que espera decisão, de todos os agentes.
  - Mensagens: Aprovar e enviar / Editar (enviar com meu ajuste) / Refazer (o que mudar?).
  - Campanhas: Autorizar 30% / Autorizar 20% / Não autorizar.
  - Mostra o tempo de espera e o link "Ver conversa"; atualiza a cada 30 s.

### Atualização 29/09/2026: app do CEO e etapa 4 (telas do "Mais")
- **CEO no celular:**
  - Abas próprias (`ABAS_CEO` em AppIOS.tsx): Painel (/dashboard) · Análise (/analise-comercial) · Previsão (/previsao) · Leads · Mais. A folha "Mais" traz o resto das telas de leitura dele (CEO_VISIVEL).
  - Indicadores do Painel (`KpiCard`) como widgets do iPhone: raio de 20, rótulo de 13pt sem caixa alta, valor de 28pt (34pt no destaque) com números tabulares. O primeiro indicador de cada grade ocupa a largura toda.
  - Análise Comercial e Previsão com `ios-tela`, `ios-topo` e título grande. Tabelas largas rolam dentro do próprio cartão.
  - Notificações liberadas para a conta de consulta: `/push/inscrever`, `/push/cancelar` e `/push/teste` entraram em `ROTAS_ESCRITA_LIBERADAS_LEITURA`, porque só mexem no aparelho da própria pessoa.
  - O CEO recebe só os avisos que já escolheu (resumo diário e contrato assinado).
  - A bolinha do CEO não conta aprovações, porque quem aprova é a Supervisão Comercial ou o Admin.
- **O app abre na tela de cada pessoa:** o manifest agora tem `start_url` "/", e o início redireciona conforme o cargo (CEO e gestão → Painel/Dashboard; vendedora → Radar; SDR → funil).
- **Etapa 4:** Escritório virtual, Atividades, Agenda, Contratos, Clientes e Campanhas ganharam `ios-tela` (fundo agrupado e cartões iOS) e título grande de 34pt no celular. Com isso, o plano de 4 etapas do app iOS está concluído.

### Atualização 29/09/2026: revisão para todos os iPhones
- **Como foi revisado:** prints automáticos (Playwright com emulação de iPhone) nos tamanhos 17 Pro Max 440×956, Air 420×912, 17 e 17 Pro 402×874 e 16e/SE 375×667. Foram medidos, em cada tela, os elementos que saem da largura: nenhum em 11 telas × 4 tamanhos, nas visões Supervisão e CEO.
- A revisão rodou no CRM local, com usuário fictício e sem servidor de dados; nenhuma credencial real foi usada.
- **Correções em `app/ios.css`:**
  - `100dvh` no lugar de `100vh`, para a tela não ficar atrás da barra do Safari; folhas com `88dvh` e `70dvh`.
  - Campos com 16px ou mais no celular, para o iPhone não dar zoom ao tocar.
  - Áreas seguras laterais com o celular deitado (topbar, conteúdo, abas e folhas), e barra de abas mais baixa em paisagem.
  - Até 380pt (16e/SE): título de 30pt, segmentados de 12pt, abas de 9,5pt, avatar de 46pt, widgets de 24/30pt, coluna do funil com 100vw−32.
  - A partir de 420pt (Pro Max/Air): bolhas de 74% e espaço de 12 nas grades.
  - Segmentados encolhem com reticências, sem estourar; nada cria rolagem lateral na página.
  - Margem lateral padrão de 16pt em todas as telas `ios-tela` (12pt até 380pt), inclusive no Escritório, que encostava na borda.
  - Rótulos pequenos em caixa alta quebram linha em vez de cortar (Atividades).
  - Em grade de 2 colunas com número ímpar de itens, o último ocupa a linha toda (Propostas).
  - Leads: busca em linha própria, filtros em pílulas que quebram linha (todos visíveis) e "Novo Lead" como botão principal azul de 44pt.
- **Alerta de reunião** (`AlertaReuniaoModal`): no celular fica acima da barra de abas. Antes, o botão "15 min antes" cobria a aba "Mais" e impedia o toque nela. O botão de configurar os minutos fica só no computador (`ios-so-computador`).
- **Tela Aprovar:** sem conexão, mostra "Sem conexão com o servidor…" (antes dizia "Só a gestão aprova"); o 403 explica que a tela é da Supervisão Comercial; e o subtítulo não fica preso em "Carregando…".

### Atualização 29/09/2026: ajustes a partir de print real (iPhone 17 Pro Max)
- **Seletor de visão do Dashboard** ("Como vendedora / Como supervisora / Administração", `VisaoSwitch`, classe `ios-visao`): agora é um controle segmentado iOS numa linha só. Os botões dividem a largura por igual, com 32pt de altura e 13pt de letra, cortando com reticências quando precisa; o selecionado fica em branco com sombra. Antes quebrava em duas linhas e cortava "supervisora".
- **Cartão MRR vazio:** a regra de fundo branco dos cartões (`.ios-tela .ps-card`) cobria o gradiente escuro do MRR, e o valor branco sumia. Agora o fundo branco só vale para cartões sem `background` próprio (`:not([style*="background"])`).
- **Barra de cima no celular:** o botão de tela cheia e as divisórias foram escondidos (`ios-so-computador`). O modo escuro, as conversas, as notificações e o perfil continuam, com área de toque de 44pt.
- **Filtro de vendedor + Atualizar** dividem a linha por igual.

### Atualização 29/09/2026: desempenho da Central de Leads
- **Diagnóstico:** o servidor responde rápido (`/leads/kanban` abaixo de 1 s nos registros). O travamento vinha do navegador desenhando um cartão para cada lead, em todas as etapas ao mesmo tempo, e isso também deixava o resto do CRM lento.
- **Correção** (`app/leads/page.tsx`):
  - cada etapa desenha só os primeiros 30 cartões (`CARTOES_POR_ETAPA`);
  - o botão "Mostrar mais (N restantes)" libera mais 60 por toque, com o estado `limiteEtapa` por etapa;
  - o contador da etapa, a busca, os filtros e a exportação continuam sobre todos os leads carregados.
- **Próximo passo possível:** enviar do servidor só os campos que o cartão usa, para diminuir o tamanho da resposta. Ainda não foi feito.

### Atualização 29/09/2026: desfecho real das reuniões e WhatsApp mais rápido
- **Concluir reunião** (`POST /atividades/:id/concluir`): para atividades do tipo REUNIAO, `desfechoDaReuniao` (lib/reuniao-desfecho.ts) lê o resultado escrito e as falas do cliente na conversa do WhatsApp (de 12 h antes do horário até agora, incluindo a transcrição de áudios).
  - Havendo sinal de que a reunião não aconteceu (não compareceu/não deu retorno/remarcar/adiar/deixar pra próxima/viagem/imprevisto/outro dia…), grava `CLIENTE_NAO_COMPARECEU` em vez de `REALIZADA`.
  - O lead recebe "⚠️ Reunião: cliente não compareceu", com o motivo detectado, e a resposta da rota explica isso à pessoa.
  - Teste: tests/reuniao-desfecho.test.ts.
- **Dados corrigidos:** as demonstrações de 29/09 (Redemed Suka Pharma 09:00 e Wellington Quaresma 10:00) passaram de REALIZADA para CLIENTE_NAO_COMPARECEU, com observação de correção no lead. Nas conversas, os clientes pediram para adiar ("Prefiro adiar" / "Deixar pra próxima").
- **WhatsApp:** `GET /whatsapp/conversas/:id/mensagens` agora devolve as 200 mensagens mais recentes (antes, as 200 mais antigas) e sem o base64 das mídias.
  - As mídias vêm marcadas como `midia:<id>` e são baixadas à parte por `GET /whatsapp/mensagens/:id/midia` (com o mesmo filtro de leitura da conversa e cache privado de 24 h).
  - No frontend, `components/whatsapp/MidiaMensagem.tsx` baixa cada foto, vídeo, áudio ou PDF só quando ele aparece na tela (IntersectionObserver), com cache em memória.
- **Computador:** a barra de abas do celular não aparece mais no computador. Por padrão, `.ios-tabbar` fica `display: none` e só vira `flex` abaixo de 768px. A regra de paisagem vale só em tela de toque.

### Atualização 29/09/2026: Bloco 1 (itens 1 a 4) e documento de NPS
- **Horário de Brasília no WhatsApp:** toda formatação de data e hora das telas `app/whatsapp/**` e `components/whatsapp/**` usa `timeZone: 'America/Sao_Paulo'`, independentemente do fuso do aparelho. Isso vale para mensagens, lista de conversas, prazo (SLA), observações e campanhas.
- **O que foi conversado vai para as observações do lead** (`services/obs-conversa.service.ts`, `registrarConversasNasObservacoes`, que roda no agendador a cada 10 min):
  - quando a conversa de um lead fica 30 min parada e o cliente respondeu desde o último registro, a IA (`resumirConversa`) grava na timeline do lead "💬 Conversa no WhatsApp com …", com Quem / O que foi conversado / O que falta / Oportunidade;
  - se o contato tem proposta, entra a linha "📄 Proposta (plano): PENDENTE / RECUSADA / ACEITA…";
  - o marcador por conversa fica em `ConfiguracaoIntegracao` (chave `obs_wpp.<conversaId>`), com até 12 resumos por rodada e janela de 48 h;
  - a primeira rodada registrou 12 conversas.
- **Proposta recusada:** `marcarPerdidoNews` também grava no lead "📄 Proposta RECUSADA pelo cliente (motivo)".
- **Informativo Prosystem (jornal):**
  - a etiqueta "News" foi renomeada para "Informativo Prosystem", com a mesma lista: 4 leads na virada;
  - todo `sem_interesse` com lead agora entra nessa lista, mesmo sem proposta; só os casos com proposta ou JA_TEM_FORNECEDOR viram "perdido";
  - o prompt dos agentes trata "já resolvi / já resolvemos / já temos sistema / já fechamos" como sem interesse (JA_TEM_FORNECEDOR);
  - o público das campanhas passou a se chamar "Informativo Prosystem" e aceita os dois nomes da etiqueta.
- **Documento novo:** `docs/comercial/pesquisa-satisfacao-e-nps.md`, com o formulário em 4 etapas, a fórmula do score de 0 a 100, as ações automáticas, o cálculo do NPS (estrelas × 2), o CSAT e sugestões (NPS padrão de 0 a 10, envio pela Mila, tarefa para detratores, metas).

### Atualização 29/09/2026: Kanban do WhatsApp por atendente (Bloco 1, item 6)
- A tela "Fila de Chamados" ganhou o seletor **👥 Por atendente** (padrão) / **📊 Por fase**.
- **Por atendente** (`colunasPorAtendente` em `app/whatsapp/page.tsx`):
  - uma coluna por agente (🤖 Caroline, Julio, Luiz Felipe, Clarice…, na ordem do funil e com a cor de cada um);
  - 🧭 Em triagem (Bia);
  - 👤 uma coluna por pessoa da equipe que é dona de conversas;
  - 📥 Sem dono.
  - Só aparecem as colunas que têm conversas. Tocar no cartão abre a conversa. Nessa visão não se arrasta cartão, porque quem define a coluna é o atendimento.
- **Por fase:** a visão de sempre (`estagio_funil`), em que se arrasta para mudar a fase.
- **Pendências registradas:**
  - item 5 (leads aguardando distribuição) espera a definição: agente continua ou vai direto para a vendedora;
  - Jornalista informativo (Bloco 4): envia **só para o Informativo Prosystem**, a partir das pesquisas da Sofia, com texto curto e simples e aprovação na tela Aprovar; a frequência ainda está a definir.

### Atualização 29/09/2026: Leads para Distribuir vão para o Julio (Bloco 1, item 5)
- `abastecerFila` do Julio (caroline.service.ts) coloca na frente da fila os leads de "Leads para Distribuir", pela mesma regra de `GET /leads/prontos-para-distribuir`: `etapa_sdr = QUALIFICADO` e sem vendedora, ou com a própria SDR que cadastrou.
- Depois deles vêm os demais leads, do mais novo para o mais antigo.
- Continuam valendo:
  - o limite diário único do número e o intervalo entre contatos;
  - não chamar quem conversou nos últimos 7 dias, quem pediu para sair ou quem tem proposta aberta (esses ficam com o Luiz Felipe).
- Se o lead demonstrar interesse, passa para a Caroline. Se for qualificado para a vendedora, volta para "Leads para Distribuir" já com a conversa e o resumo.
- **Jornalista informativo (Bloco 4, definição):** envia só para o Informativo Prosystem. Cada lead recebe no máximo um informativo a cada 20 a 25 dias, com os envios se revezando entre os leads da lista, para proteger o número.

### Atualização 29/09/2026: Bloco 2 — Desempenho do setor e Métricas da IA; ajuste das pesquisas da Sofia
- **Rota `GET /relatorios/desempenho?dias=7|30|90`** (gestão, `routes/desempenho.ts`) lê apenas dados que o CRM já registra:
  - **Agentes** (`SdrLead` criados no período, por agente): leads, contatados, responderam, efetivos (DEMO, VENDEDORA ou nota ≥ 60), demonstrações marcadas pelas conversas do agente, sem interesse, assumidas por pessoa e as taxas de resposta e de efetivos.
  - **Intervenções** (`SdrMensagem` por status): aprovadas sem mudar, editadas, refeitas (DESCARTADA), enviadas sozinhas, pendentes, e conversas assumidas por pessoa (HUMANO).
  - **Compromissos** (REUNIAO com data no período): marcados, realizados, não compareceu, cancelados, remarcados e pendentes; mais as outras atividades por tipo.
  - **Propostas:** mudanças de status (`PropostaHistorico` STATUS) por novo status, e propostas criadas.
  - **IA:** uso por dia (`ia.uso.AAAA-MM-DD`: OpenAI paga, Grok, Laya grátis), total e % sem custo.
  - **Laya:** vezes acionada e confirmações (`IaAmostra`).
- **Tela `/desempenho`** (item "Desempenho do setor" no menu, só gestão) e **janela "📊 Métricas da IA"** no Escritório virtual. As duas usam `components/desempenho/PainelDesempenho.tsx`:
  - período de 7, 30 ou 90 dias;
  - números em destaque;
  - barras de uma série com nome e valor escritos: respostas e efetivos por agente, o que aconteceu com os compromissos, mudanças de status das propostas, outras atividades e as suas decisões sobre as mensagens;
  - colunas por dia da IA paga e da Laya;
  - tabela com todos os números.
- **Primeira leitura (30 dias):**
  - Caroline: 10 leads, 6 responderam, 3 efetivos. Julio: 10 leads, 8 contatados, 4 responderam. Luiz Felipe: 20 leads, 7 responderam.
  - 71 mensagens enviadas sozinhas, 22 aprovadas, 5 refeitas e 1 conversa assumida.
  - 2 demonstrações marcadas, com 2 não comparecimentos.
  - 31 mudanças de status de proposta.
  - IA: 114 chamadas à OpenAI e Laya acionada 86 vezes (43% sem custo), com 42 confirmações.
- **Pesquisas da Sofia** (`PesquisasSofia.tsx`): os cartões não se sobrepõem mais (grade `minmax(min(280px,100%),1fr)`, `minWidth: 0` e quebra de texto em qualquer ponto). Os links crus "([site](url))" viram "🔗 site" clicável (`TextoComLinks`).

### Atualização 29/09/2026: Bloco 2 — Cronômetro de atividades longas e "Meu tempo"
- **Banco** (tabelas novas):
  - `Cronometro`: usuario_id, usuario_nome, titulo, atividade_id?, status RODANDO/PAUSADO/FINALIZADO, segundos acumulados sem as pausas, rodando_desde, resultado, iniciado_em, finalizado_em.
  - `CronometroEvento`: tipo INICIO/PAUSA/RETOMADA/FIM, com motivo e data.
- **Rotas** (`routes/cronometro.ts`, cada pessoa só mexe nos próprios cronômetros e tem um aberto por vez):
  - `GET /cronometros/ativo`
  - `POST /cronometros` {titulo}; responde 409 se já houver um aberto
  - `POST /cronometros/:id/pausar` {motivo}, com motivo obrigatório
  - `POST /cronometros/:id/retomar`
  - `POST /cronometros/:id/finalizar` {resultado?}
  - `GET /cronometros/relatorio?dias=` (a gestão pode passar `usuario_id`), que devolve total, horas por dia, tempo por título, pausas por motivo e a lista
- **Tela:**
  - **Cartão flutuante em todas as telas** (`components/cronometro/Cronometro.tsx`, montado no DashboardLayout, canto inferior esquerdo):
    - fechado, é um botão "⏱ 00:12:34" (verde rodando, âmbar pausado);
    - aberto, mostra o título, o tempo correndo, Pausar (pede o motivo), Retomar, Finalizar ("Como terminou?"), o link Meu tempo e "↗ Destacar";
    - no celular fica acima da barra de abas e some dentro de uma conversa.
  - **Janelinha destacável** `/cronometro`: janela pequena separada, para acompanhar mesmo usando outros programas. Sincroniza com o CRM a cada 20 s e na hora de cada ação, também entre abas.
  - **Relatório `/meu-tempo`** (item "Meu tempo" no menu):
    - cronômetro e tempo total em 7, 30 ou 90 dias, com a média por dia trabalhado;
    - gráfico de horas por dia;
    - barras de tempo por tarefa;
    - pausas por motivo;
    - tabela com tarefa, início, tempo, pausas, situação e como terminou.
- **Teste no servidor:** iniciar, recusar o segundo aberto, pausar com motivo, retomar, finalizar e gerar o relatório funcionaram, e o registro de teste foi apagado.

### Atualização 29/09/2026: Helena ligada para os clientes novos (até 90 dias do contrato)
- A Helena (pós-venda) está **ligada** e cuida dos clientes novos, até 90 dias depois do contrato assinado. A **Mila (CS)**, quando for criada, fica com a base: clientes com 8 meses ou mais e os que assinaram este ano.
- Ao ligar, `desde` passa a ser hoje − 90 dias (`JANELA_CLIENTE_NOVO_DIAS`), e não mais "a partir de agora".
- **Fluxo:**
  1. Boas-vindas, para contratos assinados há até 7 dias.
  2. Acompanhamento ("como está a implantação? ficou alguma pendência?") para quem passou dos 7 dias sem receber nada, até 90 dias (`elegivelAcompanhamento`, `textoAcompanhamento`). Vale como primeiro contato.
  3. Pesquisa de satisfação 30 dias depois, com os botões Ótima / Regular / Ruim, como já existia.
- **Proteção do número:** no máximo 3 mensagens de pós-venda por rodada (a cada 10 min, em horário comercial), das mais recentes para as mais antigas. Antes podiam sair até 50 de uma vez.
- **Na virada:** 1 cliente vai receber boas-vindas e 6 vão receber acompanhamento, aos poucos.

### Atualização 29/09/2026: Bloco 3 — agentes aprendem com as conversas que a equipe assume
- **`aprendizadoDaEquipe`** (caroline.service.ts, exportada):
  - busca as respostas escritas por pessoas (SAIDA sem remetente automático) nos últimos 30 dias, com texto ou áudio transcrito de 25 caracteres ou mais;
  - pega a mensagem do cliente logo antes de cada resposta;
  - forma até 6 pares "Cliente → Equipe", um por conversa, dos mais recentes;
  - guarda em cache por 30 min.
- **Uso no prompt:**
  - Caroline, Julio e Luiz Felipe (`promptCaroline`, parâmetro `aprendizado`) recebem a seção "COMO A EQUIPE RESPONDE QUANDO ASSUME A CONVERSA", com a orientação de aprender o jeito, a abordagem e os argumentos, fazer igual ou melhor, sem copiar palavra por palavra e nunca repetir dados de outro cliente;
  - a Clarice (tira-dúvidas, `autoResponderDuvida`) recebe a mesma seção.
- Isso soma com o aprendizado que já existia, pelas mensagens editadas na aprovação (`exemplosEditados`).
- **Primeira leitura:** 6 exemplos reais, incluindo áudios transcritos da Jessica.
- **Nova abordagem inicial (item 11):** fica para depois de criar o agente Especialista em vendas de software (Bloco 4), que vai construí-la junto, como pedido.

### Atualização 29/09/2026: Bloco 4 — Rafael, especialista em vendas de software; novos agentes no escritório
- **Novos agentes** (`lib/assistente/escritorio.ts` › AGENTES):
  - **Rafael**: especialista em vendas de software (ativo).
  - **Olívia**: concorrentes.
  - **Heitor**: prospectador.
  - **Mila**: CS da base.
  - **Joana**: jornalista do Informativo Prosystem.
  - Olívia, Heitor, Mila e Joana aparecem como "Em construção" até cada um ser construído.
  - A sala isométrica ganhou a 4ª fileira de mesas (D 7,4 → 9,7 e novo corredor em y 7,05), com aparência própria para cada novo agente.
- **Tabela nova `EspecialistaDoc`:** tipo (POP / PROCESSO / EXEMPLO / DICA / ALERTA / ABORDAGEM), título, conteúdo em markdown, agente_alvo, status (PROPOSTO / APROVADO / ARQUIVADO), versão, fontes, origem, quem decidiu e quando. O mesmo título ganha nova versão, e vale sempre a última aprovada.
- **`services/especialista.service.ts`:**
  - `estudarVendas(tema?)`: pesquisa na internet as práticas de especialistas de vendas do Brasil (B2B/SaaS, SDR, negociação, pós-venda) e de ERP/PDV para varejo pelo WhatsApp, e gera de 3 a 6 POPs, processos, exemplos e dicas para aprovar.
  - `revisarConversas()`: olha as conversas das últimas 48 h.
    - Conversas deixadas de lado: a última mensagem é do cliente, sem resposta há 2 h ou mais.
    - Até 12 conversas avaliadas pela IA (não satisfatórias, com o problema e como melhorar, mais dicas para o time).
    - Grava um documento ALERTA e avisa a gestão pelo WhatsApp e pela notificação.
  - `proporAbordagem()`: para Caroline, Julio e Luiz Felipe, pega a taxa de resposta real, as primeiras mensagens reais (respondeu / não respondeu), o material aprovado e a pesquisa na internet. Propõe diagnóstico, diretriz e 3 exemplos de primeira mensagem.
  - `decidirDoc`: aprovar arquiva as versões anteriores. Uma ABORDAGEM aprovada vira `AgenteInstrucao` do agente com o prefixo "ABORDAGEM INICIAL (aprovada pela gestão…)", substituindo a anterior; a partir daí o agente usa no primeiro contato e nas retomadas.
  - `rodarRafael`: revisão de segunda a sexta às 17h e estudo às quartas às 9h, uma vez por dia (trava de envio único).
  - `cadernoRafael`: todos os documentos aprovados em markdown.
- **Rotas** (`routes/especialista.ts`, só gestão):
  - `GET /especialista/docs`
  - `POST /especialista/estudar | revisar | abordagem`: rodam em segundo plano, com trava para não repetir
  - `POST /especialista/docs/:id/decidir`
  - `GET /especialista/caderno`
- **Painel do Rafael no Escritório** (`components/escritorio/PainelRafael.tsx`):
  - botões Propor nova abordagem, Revisar conversas agora, Estudar agora (com tema opcional) e baixar o Caderno do Rafael;
  - abas Para aprovar / Abordagens / Revisões / POPs / Processos / Exemplos / Dicas;
  - cada documento abre para leitura, com Aprovar (e aplicar no agente) ou Arquivar.
- **Primeira proposta de abordagem**, já gerada e esperando aprovação:
  - Caroline: 70% de resposta. Mantém a abertura direta sobre a rotina, citando a campanha e o negócio do cliente.
  - Julio: 50%. Troca o genérico "ainda está procurando ou já resolveu?" por uma pergunta sobre a prioridade atual.
  - Luiz Felipe: 35%. Troca a pergunta dupla "avaliou ou já resolveu?" por uma pergunta sobre o próximo passo ou a dúvida pendente.

### Atualização 29/09/2026: etapa do lead avança sozinha na Central de Leads
- **Auditoria:** os agentes não moviam o lead de coluna. Havia:
  - 9 leads conversando com agente mas em "Novo Lead";
  - 4 leads com proposta em "Novo Lead" e 1 em "Qualificado";
  - 1 lead com demonstração marcada em "Novo Lead";
  - 3 leads sem interesse em "Novo Lead";
  - 1 lead na etapa `ACEITO`, que não tem coluna no quadro e por isso fica invisível.
- **`lib/etapa-lead.ts`:** `avancarEtapaLead(leadId, alvo, motivo, quem)` e `deveAvancar`.
  - Só avança: NOVO_LEAD → PRIMEIRO_CONTATO → EM_ATENDIMENTO → QUALIFICADO/AGUARDANDO_RETORNO → PROPOSTA_A_GERAR → PROPOSTA_ENVIADA → EM_NEGOCIACAO.
  - Nunca mexe em Fechado, Perdido, Aceito, colunas personalizadas de quadros ou leads GANHO/PERDIDO.
  - Cada avanço vira observação "➡️ Avançou para …: motivo" no lead.
- **Onde avança:**
  - agente envia mensagem → Primeiro Contato (se o SDR tem proposta, Proposta Enviada);
  - lead responde → Em Atendimento;
  - lead marca demonstração → Qualificado;
  - proposta enviada pelo WhatsApp → Proposta Enviada;
  - cliente topa a condição da campanha → Em Negociação.
- **Correção dos dados:** 13 leads avançaram pela mesma regra. Os leads sem interesse sem proposta não foram movidos (aguardando definição), e o lead em ACEITO também ficou como estava.
- Teste: tests/etapa-lead.test.ts.

### Atualização 29/09/2026: definições da Jessica sobre as etapas
- **Sem interesse sem proposta:** entram só no Informativo Prosystem (etiqueta), com a observação "📰 Sem interesse agora… Não é perda: a porta fica aberta". Não viram Perdido e ficam na etapa em que estavam. Leads ajustados: Lisifarma, Thatiane Frederico da Silva e Drogaria Caiuá.
- **Etapa ACEITO:** o quadro já exibe leads nessa etapa dentro da coluna Fechado (`leads.ts`, normalização da etapa antiga), então eles não somem. O lead Alex Borges (status GANHO) teve a etapa gravada como FECHADO, com observação, para ficar coerente em relatórios e filtros.

### Atualização 29/09/2026: Olívia (concorrentes) ligada
- **`pesquisarConcorrentes(foco?)`** (especialista.service.ts): pesquisa na internet os concorrentes de PDV/ERP para farmácias/drogarias e padarias/confeitarias, com recursos, preço público, avaliações (Google, Reclame Aqui, apps), reclamações e elogios comuns, e fonte.
  - Tom factual, sem inventar notas nem preços e sem falar mal de concorrente.
  - Grava dois documentos no painel do Rafael:
    - **CONCORRENCIA** "Panorama da concorrência", com as oportunidades para a Prosystem;
    - **EXEMPLO** "Quando o cliente cita um concorrente", com respostas respeitosas.
  - Avisa a gestão pelo WhatsApp e pela notificação.
- **Integração com o Rafael:** os documentos de concorrência aprovados entram no material que ele usa em `proporAbordagem`. O Caderno do Rafael ganhou a seção "Concorrência".
- **Rotina:** a cada 15 dias, na terça entre 9h e 12h (trava de 13 dias). Também dá para rodar na hora pelo botão "🔍 Olívia: pesquisar concorrentes" no painel do Rafael (usa o campo de tema como foco), rota `POST /especialista/concorrentes`.
- **Escritório:** a Olívia aparece ligada, com o número de panoramas e o histórico.
- **Primeira pesquisa (29/09):** mapeou Trier, HOS Farma (preço público de R$ 299 a R$ 549/mês), Linx Big Farma, A7Pharma, Saipos, ConnectPlug, Sischef e outros, com avaliações, reclamações comuns (suporte demorado, estoque, SNGPC) e 8 respostas prontas. Está esperando aprovação.
