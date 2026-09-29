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
