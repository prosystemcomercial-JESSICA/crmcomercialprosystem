# Estado do projeto: CRM Comercial Prosystem

Atualizado em **14/10/2026, noite** (sessão longa com a Jessica). Ao terminar cada tarefa, atualize este arquivo.

## Registro de mudanças após 14/10/2026 (mais novo primeiro)

- **16/10/2026 (pipeline/CI):** `.github/workflows/ci.yml` (backend com MySQL de teste + vitest + tipos sem erro novo via `backend/scripts/checar-tipos.mjs` e linha de base de 61; frontend com tsc + build). `deploy-vps.sh` só publica com a CI verde (`SEM_CI=1` em emergência) e roda `npm ci` quando o lock muda. Testes `assistente-demo` e `laya` atualizados. **Bloqueio:** em 16/10 o GitHub recusou o push (403, "verify your email") da conta prosystemcomercial-JESSICA. A Jessica precisa verificar o e-mail em github.com/settings/emails. Depois: push, conferir a primeira CI, copiar o deploy-vps.sh novo para /root e publicar o Quadro sóbrio (commit local). **Atenção:** o repositório é PÚBLICO; o CPF do representante está em `backend/src/lib/contrato-pdf.ts` (CONTRATADA).
- **16/10/2026 (Portal Técnico sóbrio, etapa 1):** barra do topo e menu do CRM (`SidebarMenu` com `onSelect`/`badge`/`iniciarAberto`), título da página como no WhatsApp e passada de estilo nos cartões (cantos 8/6, títulos mais leves, azul do CRM). Commits `87228fb` e `215733c`. **Próximas etapas:** Quadro (abas sublinhadas e cartões), Meu dia, Tickets, ficha da demanda.
- **15/10/2026 (áudio webm):** "Transcrição indisponível (HTTP 400)" nos áudios gravados pelo navegador: o WebM ia para a OpenAI como `.ogg`. Corrigido com `extensaoAudio` (lib/assistente/ia-texto) em `transcreverOpenAI`.
- **15/10/2026 (churn → CEO: PDF ou WhatsApp):** a aba Exclusões ganhou **📄 Gerar relatório PDF** (o principal, para o Teams, sem WhatsApp) e **📲 Enviar por WhatsApp**. O PDF sai no padrão Prosystem (`lib/churn-exclusao-pdf.ts`) com as observações de cada cliente; rota `POST /casos-churn/exclusao/relatorio`; `canal` no registro. Corrigido `BRAND.site` (cabeçalho do contrato e da renegociação sem o site).
- **15/10/2026 (valor → dados da proposta):** cliente que pede o valor recebe a faixa e o pedido de CNPJ, e-mail e quantidade de computadores (e loja nova/troca, se não estiver claro), como a Jessica pediu por áudio a uma cliente. Com os três, o agente usa `passar_vendedora`. Os dados vão para `SdrLead.dados` e para o Lead (`cnpj`, `responsavel_email`, `qtd_caixas`, só se vazios). Regra em `lib/assistente/sdr.ts` (DADOS PARA A PROPOSTA).
- **15/10/2026 (Ana no churn → CEO):** a Ana Clara (SDR) pode selecionar e enviar ao CEO na aba Exclusões. A regra é "administrar" no módulo Cancelamentos / Churn (Usuários e Permissões); as confirmações de suporte e cobrança continuam só com a gestão.
- **15/10/2026 (churn → CEO):** aba **📤 Exclusões (CEO)** em Churn & Retenção (`components/casos/ExclusaoCeo.tsx`, `services/churn-exclusao.service.ts`, `lib/churn-exclusao.ts`): seleção em lote dos casos perdidos, envio ao CEO por WhatsApp e push, confirmações "retirado do suporte" e "cobrança suspensa" e aviso de concluído a quem enviou. Registro em `ConfiguracaoIntegracao` `churn.exclusao.<casoId>` (sem mudar o banco). 33 casos perdidos esperando envio (4 marcados em 08/10 sem aviso). **Pendência da Jessica:** selecionar e enviar.
- **15/10/2026 (retorno marcado):** conversa de um lead indicado (farmácia que abre em janeiro, 2 computadores; nome e número no arquivo local). A Jessica combinou por áudio chamar no dia 28/10 para ver se o CNPJ saiu e pediu que a Caroline faça o contato. Novo `dados.retorno_equipe = { em, combinado, por }` em conversa assumida: antes da data nenhuma retomada; na data o agente chama no contexto do combinado (`retornoDaEquipe` em lib/assistente/sdr + `retomarAssumidas`). Lead marcado para 28/10/2026 9h30. **Conferir em 28/10** se a mensagem saiu (Escritório › mural da Caroline / observação no lead).
- **15/10/2026 (`ff573c0`):** áudios `data:audio/ogg; codecs=opus;base64` não eram transcritos (botão e agentes). Corrigido com `lerDataUrl` (lib/assistente/ia-texto) em `transcreverAudio` e na foto do cliente. Testes em `tests/data-url.test.ts`.
- **15/10/2026 (`58b6db2`):** Portal Técnico parado em "Carregando…": era o navegador sem sessão válida (401) e o portal não levava ao login nem mostrava o erro. Corrigido no portal, no painel Início e no `api-client`/`AuthProvider` (sessão recusada em tela logada leva ao login). Achado: a cópia dos backups no computador da Jessica não roda desde 08/10 e no MEGA desde 07/10 (pendência 8).

- **15/10/2026:** computador, GitHub e servidor conferidos no mesmo commit; no servidor, os `package-lock.json` reescritos pelo npm (sem as linhas `libc`) foram devolvidos à versão do GitHub para não travar deploys futuros.
- **15/10/2026:** regra nova da Jessica: tudo o que for feito é registrado na hora (este arquivo, o arquivo local e commit + push). Referências a acesso de servidor e chave SSH foram tiradas do repositório (`deploy-vps.sh`, `02-TRD.md`, `LEIA-PRIMEIRO.md`) e ficam só no arquivo local `C:\Users\prosy\CONTEXTO-CRM-COMERCIAL-LOCAL.md`.

## Resumo em 5 linhas

1. Outubro estava com **0 contratos** contra meta de 15; o gargalo era a fila de primeiros contatos, travada desde 05/10.
2. Retomamos o **Plano de Expansão** (a "Nova missão do comercial" do documento *Meta Comercial 2026*, de maio) e implementamos em 4 partes, todas **no ar**.
3. Os agentes de IA foram endurecidos: leem a conversa inteira, buscam o porquê do lead e quem decide, não respondem robô de loja, não descartam lead por recusa do atendente e desconfiam de concorrente.
4. O que falta agora é **execução e decisão da Jessica**, reunido no *Manual da Jessica* (Claude Docs, abaixo).
5. Último commit publicado: `93e3bb8` (produção atualizada).

## Documentos (Claude Docs, conta da Jessica)

| Documento | Para quê | Link |
| --- | --- | --- |
| Reunião Comercial: 01 a 14/10/2026 | Pauta e números da reunião de 14/10 | https://claude.ai/code/artifact/4f0ce3dc-e7be-44da-8e22-9fe996635f21 |
| Plano de Expansão e Captação: outubro/2026 | Onde estava o plano, dados, campanhas, abordagens, plano de fechamento, plano orgânico, pesquisa de mercado, situação atual | https://claude.ai/code/artifact/2497e87b-31d8-4355-b82f-f125e9c58e8d |
| Manual da Jessica: o que fazer para o plano andar | **Todas as pendências dela**, passo a passo, decisões e rotina | https://claude.ai/code/artifact/adc38cc9-18b2-4095-a1d5-e436a6c9cef2 |

Documento de origem do plano: `C:\Users\prosy\Downloads\Meta_Comercial_2026 (4).docx` (metas 10 a 15 contratos/mês, Programa de Ativos 8 contatos/dia por vendedor, serviços para a base, indicação premiada de 50% na próxima mensalidade).

## Diagnóstico de 14/10/2026 (dados de produção, agregados)

- 01 a 14/10: 313 leads novos (300 da prospecção do Heitor), 1 demonstração, 0 propostas criadas, 0 contratos. Setembro: 2 contratos.
- Contratos por mês em 2026: jan 4, fev 2, mar 6, abr 3, mai 19, jun 5, jul 5, ago 1, set 2, out 0.
- Churn 01 a 14/10: 13 clientes perdidos (R$ 3.907/mês), 10 por inadimplência; 1 recuperado; base de 533 ativos.
- Cross-sell: 3 vendas (R$ 1.900); up-sell 0.
- Programa de Ativos parado desde 04/09; 362 dos 533 clientes ativos sem `grupo_tecnico`; nenhuma indicação registrada em 2026.
- Campanhas pagas: só ~10 leads em 75 dias (Facebook, `prosystem_demonstracao_*`); blog (WordPress/Elementor) sem formulário ligado ao CRM.
- Pesquisa de mercado (fontes no doc do Plano): independentes fecham mais que abrem (2025: 6.555 fechadas x 5.459 abertas), 56% com lucro em queda, só 8% usam o cadastro de clientes para vender.

## O que foi entregue em 14/10/2026 (tudo no ar)

### Parte 1: primeiro contato
- **Fila destravada** (`f6f8266`): lead com mensagem esperando aprovação era escolhido de novo a cada rodada e travava a fila. Número sem WhatsApp na aprovação tira o lead da fila. Painel da Caroline com contagem real e "Hoje: N primeiros contatos".
- **Aprovação separada** (`aa2f9bb`): `aprovar_abertura` (primeiro contato) e `aprovar` (retomadas). Configurado: primeiro contato **sem** aprovação, retomadas **com**.
- **Números extras reservados ao Heitor** (`5c33478`): rodízio (Números 3 e 4, grátis) chama primeiro os leads do Heitor; principal fica com campanha, propostas e base. Teto do Heitor 30/dia (`heitor.config.envios_dia`), ritmo pelo aquecimento (10 → 20 → 30 → 40 por semana).
- **Agentes com contexto** (`9c2e256`): conversa inteira (40 mensagens + começo), ficha do lead (`fichaDoLead`), missão "por que procura outra solução / por que se inscreveu", **quem decide** já na primeira resposta, atendente recusando não encerra o lead, apresentação pelo ramo real.
- **Mensagens automáticas** (`f6f8266`, `ef31867`, `93e3bb8`): robô de loja reconhecido (`ehRespostaAutomatica`, `ehEncerramentoAutomatico`, `soRoboDaLoja`); **nenhum agente responde robô**; na retomada, pede o contato de quem decide.
- **IA recusando pedido** (`e9331e0`): corte de texto no meio de emoji gerava `invalid_json` na OpenAI; `jsonParaIa` limpa todos os pedidos; erro passa a mostrar o motivo.
- **Aprovação sem repetição** (`93e3bb8`): trava atômica PENDENTE → ENVIANDO (cliques repetidos mandavam a mesma mensagem 3 vezes).
- **Concorrente/consultor** (`93e3bb8`): `sinaisDeNaoLoja` (nome do WhatsApp/empresa/robô com cara de sistemas, consultoria, mentoria, marketing, ou parecido com "Prosystem") → aviso à gestão; agente confirma loja e cidade antes de demonstração/material; `perfil` concorrente/consultor encerra cordial. Despedidas ("Até", "tchau") não recebem resposta.

### Parte 2: do interesse à demonstração e proposta (`b20f5a7`)
- Placar no topo do Escritório (`GET /comercial/placar`): hoje e semana contra a meta (`METAS_PADRAO`, editável na config `comercial.metas_semana`; semana de 12/10: 200/4/3/1; 19/10 e 26/10: 330/8/7/2).
- Interessado (termômetro 35+) sem demonstração há 48 h e proposta em rascunho há 1 dia: no placar, no sino e no resumo da manhã no WhatsApp (dias úteis, 9h a 11h).

### Parte 3: Programa de Ativos (`86c29aa`, `77e9d6d`)
- Contatos de hoje: 8 por vendedor (risco → nunca contatado → parado 14+ dias), no topo de Ativos e no sino do vendedor; linha no placar.
- Lotes dos clientes sem grupo técnico (`__SEM_GRUPO__`, lote padrão 80).
- Indicação premiada: botão no questionário → Lead + `Indicacao` + fila da Caroline, que cita o cliente que indicou. Aba **Ativos › Indicações** com situação de cada indicado e prêmio a aplicar.

### Parte 4: campanhas e captação orgânica (`ef31867`)
- Página pública `https://comercial.prosystemnet.com/conhecer` (lê `origem`, `material`, `segmento`, UTMs) → `POST /api/publico/leads/formulario`.
- Funil por origem (`GET /comercial/funil-origem`), abaixo do placar: leads → responderam → interessados → demonstrações → propostas → contratos, por canal e campanha.
- Padrão de UTM para Meta Ads: `utm_source=facebook&utm_medium=pago&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`; nome da campanha `segmento_mêsano_tema`.

### Também no ar
- **Perguntas para você** no painel do Rafael (`5915d63`): o que o Rafael precisa que a Jessica confirme + dúvidas de clientes; resposta vira fonte oficial no material dos agentes. 10 perguntas abertas em 14/10.
- **Relatório de sexta** (`77e9d6d`): sexta 16h a 18h no WhatsApp da gestão.
- Rafael estudou em 14/10 "abordagem e venda de ERP/PDV para farmácias" (4 documentos aprovados no material); treino do Julio refeito.
- Orientação no mural para todos os agentes: nunca responder robô de loja.

## Rotinas agendadas relevantes (`rodarRafael`, `especialista.service.ts`)

| Quando | O quê |
| --- | --- |
| Dias úteis 8h a 10h | Reunião diária da equipe (Rafael), pode gerar perguntas para a Jessica |
| Dias úteis 9h a 11h | Resumo "o que está parado" (só se houver) |
| Dias úteis 12h e 17h | Revisão das conversas dos agentes (Rafael) |
| Sexta 16h a 18h | Relatório da semana |
| A cada 2 min | Rodada dos agentes (`rodarCaroline`, `server.ts`) |

## Decisões da Jessica (14/10/2026)

- Primeiro contato da Caroline sem aprovação; retomadas com aprovação.
- Teto do Heitor 30/dia "de forma controlada" e números extras reservados para ele.
- Nenhum agente responde mensagem automática; vale para todos os agentes.
- Contexto obrigatório em toda conversa; foco no porquê do lead e em quem decide (proprietário, farmacêutico responsável, gerente).
- Pendências dela sempre num manual único ao final.

## Pendências da Jessica (detalhe no Manual)

1. Aprovar ou descartar 3 primeiros contatos que ficaram de antes da mudança; chamar a interessada esquecida que aparece no placar.
2. Responder as 10 perguntas do Rafael (preços/descontos permitidos, se atende material de construção, cadência de retomada, recursos por segmento, links oficiais etc.).
3. Decidir: quem faz os contatos de Ativos; sistema de comandas (para voltar com campanha paga de padaria); atende material de construção?; o WhatsApp do botão do blog está no CRM?; meta de outubro (15 ou 5); regra da indicação premiada; manter aprovação das retomadas?
4. Abrir filas de Ativos (lotes sem grupo) para quem vai ligar.
5. Subir campanhas com os criativos de 13/10 usando o padrão de UTM.
6. Colocar o botão `/conhecer` nos artigos do blog (Elementor) e manter 2 artigos/semana.
7. Cadastrar o segundo número pago (vaga "Número 2 (UAZAPI)") se ele existir.
8. Backups: a cópia no computador dela não roda desde 08/10 e no MEGA desde 07/10 (o computador precisa estar ligado às 17h; conferir a tarefa agendada e o MEGA).

Quando ela responder as decisões, ajustar o CRM conforme a resposta (ex.: meta em `comercial.metas_semana`, orientação aos agentes, filas).

## Pendências e cuidados técnicos

- Na sexta 16/10, com uma semana de dados: conferir nas conversas reais se os agentes seguem as regras novas (robô, quem decide, contexto, concorrente) e ler o primeiro relatório de sexta.
- Conferir o funil por origem depois de 7 dias de campanha com UTM.
- `tsc` do backend tem ~89 linhas de erros antigos (ex.: `demo_a_partir` em caroline.service, raw queries em complementos/whatsapp/lancamentos-retroativos): não são regressão.
- Disco `C:` estava cheio em 14/10 (liberado para ~10 GB); `backend/node_modules` foi reinstalado.
- `Indicacao` tem rotas antigas sem guarda de gestão em `routes/comissoes.ts` (`GET/POST/PATCH /indicacoes`), sem tela; o painel novo usa `/ativos/indicacoes`.

## Commits de 14/10/2026 (mais novo primeiro)

`93e3bb8` aprovação sem repetição, concorrente, despedida · `77e9d6d` relatório de sexta e painel das indicações · `ef31867` parte 4 · `86c29aa` parte 3 · `f039f49`/`b20f5a7` parte 2 · `5c33478` números extras para o Heitor · `5915d63` Perguntas para você · `e9331e0` emoji cortado na IA · `9c2e256` contexto obrigatório · `aa2f9bb` aprovação separada · `f6f8266` fila destravada e robô. Outros do dia (menu, temas, WhatsApp) foram de outra sessão.
