# PRD: CRM Comercial Prosystem

Documento de requisitos de produto · versão 1.0 · 27/09/2026 · responsável: Jessica Cardoso (Supervisão Comercial)

## 1. Visão

O CRM Comercial Prosystem é o sistema de vendas da Prosystem Sistemas (ERP e PDV para farmácias, drogarias, farmácias de manipulação, padarias e varejo). Ele concentra, num só lugar, o funil de leads, as propostas e os contratos, o WhatsApp da empresa e uma equipe de agentes de IA que conversa com os clientes, e existe para **trazer o cliente para a Prosystem e fechar contrato**.

**Frase de norte:** nenhum lead fica esquecido, e nenhum cliente é tratado como número.

## 2. Problema

- Os leads chegavam por várias portas (campanhas do Facebook e Instagram, WhatsApp, indicação, site) e se perdiam entre planilhas, celulares e plataformas diferentes.
- A equipe comercial é pequena (supervisora, SDR e técnico) e não consegue retomar sozinha centenas de leads parados.
- Propostas eram enviadas e esquecidas; clientes paravam de responder e ninguém voltava a chamar.
- A diretoria não tinha visão diária dos números.

## 3. Objetivos e métricas de sucesso

| Objetivo | Métrica | Meta inicial |
|---|---|---|
| Nenhum lead sem retorno | % de leads com contato em até 24 h | 95% |
| Mais conversas viram demonstração | Conversas da Caroline que terminam em demonstração | 20% |
| Retomar a base parada | Leads antigos retomados pelo Julio por semana | 75 (15/dia) |
| Propostas não esquecidas | Propostas não assinadas com follow-up nos últimos 7 dias | 100% |
| Proteger o número do WhatsApp | Bloqueios ou banimentos | 0 |
| Custo de IA sob controle | % das chamadas de IA feitas sem custo (Laya) | crescer mês a mês |
| Gestão bem informada | Resumo executivo entregue 1x por dia útil | 100%, sem repetição |

## 4. Personas

| Persona | Quem | O que precisa |
|---|---|---|
| **Supervisora comercial** | Jessica | Ver tudo, aprovar mensagens dos agentes, assumir conversas, distribuir leads, ensinar a IA |
| **Diretoria** | Thiago (CEO) | Resultados: resumo das 18h e contratos assinados, sem ruído |
| **SDR** | Ana | Qualificar leads e passar para a vendedora |
| **Vendedora** | equipe comercial | Receber leads qualificados com resumo, montar e enviar propostas |
| **Técnico de implantação** | Lucas | Implantação depois do contrato |
| **Lead / cliente** | dono de farmácia ou padaria | Ser atendido rápido, sem repetir informação, sem pressão |

## 5. Escopo (o que o produto faz)

### 5.1 Funil comercial
- Leads com origem, campanha, segmento, temperatura e histórico; kanban do SDR e do vendedor; "Leads para Distribuir".
- Propostas comerciais com planos (Basic, Pro, Plus), link público, aceite pelo cliente, aprovação de desconto.
- Contratos com assinatura (ZapSign), comissões (vendedor 15%, supervisão 5%), metas e implantação.

### 5.2 WhatsApp da empresa
- Um número só, com conversas sem dono (pool), Minhas, Todas e Finalizadas.
- Assumir, finalizar, transferir, etiquetar, observações, vincular a cliente ou lead.
- Criar e enviar proposta da própria conversa.

### 5.3 Equipe de agentes (Escritório virtual)
| Agente | Função |
|---|---|
| Bia | Triagem de quem chama pela primeira vez (3 toques) |
| Caroline | SDR: primeiro contato, busca da dor principal, termômetro, demonstração ou vendedora |
| Julio | Follow-up da base de leads, do mais novo para o mais antigo |
| Luiz Felipe | Follow-up de propostas e retomada de propostas não assinadas |
| Lurdinha | Agenda de demonstrações e lembretes |
| Clarice | Tira-dúvidas, resumo, sugestão de resposta e transcrição de áudio |
| Zequinha | Campanhas pelo WhatsApp |
| Helena | Pós-venda: boas-vindas e pesquisa de satisfação |
| Laya | IA local que classifica conversas e aprende com a equipe |
| Marta | Assistente da gestão: comandos, avisos, aprovações |
| Sofia | Pesquisa de assuntos do setor, com fontes |

### 5.4 Gestão
- Painel da TV, resumo executivo diário e semanal, avisos no celular, comandos pelo WhatsApp.

## 6. Requisitos funcionais principais

| ID | Requisito | Prioridade |
|---|---|---|
| RF-01 | Lead de campanha colado no CRM vira lead com origem e campanha, sem duplicar | Alta |
| RF-02 | Toda conversa ativa com um agente mostra quem está atendendo (farol) | Alta |
| RF-03 | Uma pessoa assumiu ou respondeu: nenhum agente responde mais naquela conversa | Crítica |
| RF-04 | Mensagens dos agentes passam por aprovação em horário comercial; fora dele, respostas saem direto | Alta |
| RF-05 | Lead que para de responder é retomado (2 h, depois 3 tentativas, depois ciclos de 30 dias) | Crítica |
| RF-06 | Lead só é entregue à vendedora de segunda a sexta, 8h30 às 17h | Alta |
| RF-07 | Ao assumir, a pessoa recebe no WhatsApp o resumo, o termômetro e as marcações | Alta |
| RF-08 | Proposta com mais de um plano mostra todas as opções com o valor certo e aceite por plano | Alta |
| RF-09 | Nenhuma mensagem automática repetida para a mesma pessoa em 6 h | Crítica |
| RF-10 | Tudo o que a Laya aprende fica documentado e exportável (Caderno da Laya) | Média |
| RF-11 | Pesquisas da Sofia ficam guardadas para sempre (Caderno da Sofia) | Média |
| RF-12 | O CRM não cria atividades sozinho (exceção: demonstração marcada pelo lead) | Alta |
| RF-13 | Leads antigos nunca são apagados | Crítica |
| RF-14 | Contrato: dados de quem assina lidos do WhatsApp, conferência humana, envio à ZapSign com link no WhatsApp, lembrete 24 h, assinatura confirmada na ZapSign | Alta |

## 7. Requisitos não funcionais

- **Proteção do número (WhatsApp não oficial):** limite único de 15 primeiros contatos por dia nas 2 primeiras semanas (máximo 30), intervalo sorteado de 4 a 9 min, "digitando…", só horário comercial, freio automático em falhas.
- **Honestidade:** agentes se apresentam pelo nome, "da equipe Prosystem"; nunca negam ser assistente virtual quando perguntados; nunca inventam informação sobre o produto ou atribuem ao cliente algo que ele não disse.
- **Ética comercial:** agentes nunca falam de preço, desconto ou condição; isso é da consultora.
- **LGPD:** dados pessoais de leads nunca vão para o repositório; chaves de API só no `.env` do servidor.
- **Disponibilidade:** backup do banco antes de toda publicação; nada é enviado duas vezes após reinício.
- **Responsivo:** telas usam a janela inteira e funcionam no celular.

## 8. Fora do escopo (por enquanto)

- API oficial do WhatsApp.
- Integração direta com Facebook Lead Ads (fase 2).
- Negociação de valores por IA.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Bloqueio do número | Limites, intervalo, horário, freio, SAIR respeitado |
| IA fala algo errado | Aprovação humana, material como única fonte, regras de fatos e preço |
| Custo da OpenAI | Laya primeiro, Grok para tarefas simples, painel de uso |
| Lead abordado em dobro | Farol, "pessoa assumiu, agentes param", distribuição só ao fim da conversa |

## 10. Documentos relacionados

TRD (`02-TRD.md`), App flow (`03-app-flow.md`), Briefing de UI/UX (`04-briefing-ui-ux.md`), Esquema do backend (`05-esquema-backend.md`), Plano de implementação (`06-plano-implementacao.md`), Manual de uso (`../comercial/manual-de-uso-assistente.md`).


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
  - Mila e Joana aparecem como "Em construção" (Olívia e Heitor já foram construídos) até cada um ser construído.
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

### Atualização 29/09/2026: agentes nunca repetitivos
- **Caso real (Gustavo Castro):** o cliente disse "estou em viagem, assim que voltar entro em contato". O Luiz Felipe cutucou 2 h depois e ainda respondeu ao 👍, repetindo a mesma ideia três vezes.
- **Correções** (`caroline.service.ts` › `falar` e `lib/assistente/sdr.ts`):
  1. **Só confirmação** (`ehSoConfirmacao`: 👍, emojis, ok, obrigado, blz, valeu, combinado…) depois da fala do agente: ele não responde. O lead fica AGUARDANDO, com retomada leve em 7 dias ou na data já combinada.
  2. **Cliente adiou:** a IA devolve `adiar_dias`, porque o prompt manda confirmar uma vez e preencher os dias, com 7 como padrão. O lead fica AGUARDANDO com `retomar_em` às 9h30 do dia e observação "⏸ Cliente pediu para retomar depois…". Sem mensagens nem cutucada de 2 h até lá.
  3. **Trava de repetição** (`semelhanca`, bigramas): uma mensagem com semelhança de 0,6 ou mais a uma das 4 últimas do agente não sai, e o agente espera até o dia seguinte. O prompt também ganhou a regra "NUNCA SEJA REPETITIVO".
- O Gustavo ficou em espera até 06/10, às 9h30.
- Testes: tests/sdr-repeticao.test.ts, incluindo as mensagens reais do caso.

### Atualização 29/09/2026: Heitor (prospecção no Google Maps) construído

**O que faz**
- Busca drogarias, farmácias e padarias no Google Maps.
- Trabalha **por região, em ondas**, e só passa de cidade quando a atual acaba:

  | Onda | Região |
  |---|---|
  | 1 | Grande Vitória (Vitória, Vila Velha, Serra, Cariacica, Viana, Guarapari, Fundão) |
  | 2 | Interior do Espírito Santo (31 cidades) |
  | 3 | Vizinhos: leste de MG, norte do RJ, sul da BA |
  | 4 | Sudeste e capitais |

- Dentro de cada cidade, faz primeiro a cidade inteira e depois bairro por bairro. A IA lista até 25 bairros com comércio de rua; cidade com menos de 60 mil habitantes fica só com a busca da cidade inteira.

**Máximo de dados por estabelecimento**
- Do Google Maps: nome, categoria, telefone, endereço completo, bairro, nota e número de avaliações, horário e link.
- Do site do estabelecimento, quando existe:
  - Instagram, Facebook e LinkedIn;
  - WhatsApp (links wa.me e api.whatsapp);
  - e-mails;
  - CNPJ, validado pelos dígitos verificadores.
- Da Receita (BrasilAPI, dado público), quando há CNPJ:
  - razão social, porte, data de abertura, situação e CNAE;
  - **sócios**: o sócio-administrador vira o responsável do lead.
- O que ele não usa: Instagram e LinkedIn fechados exigem conta logada, o que arrisca bloqueio. Para isso fica o Agent-Reach, de forma manual no computador.

**Quem fica de fora**
- Redes grandes, por uma lista fixa (Drogasil, Raia, Pague Menos, Pacheco, Santa Lúcia, Farmes, supermercados etc.) ou pelo mesmo nome aparecendo 3 ou mais vezes.
- Categoria fora do perfil: veterinária, hospital, distribuidora, supermercado.
- Fechado no Google ou CNPJ inativo.
- **Quem já está no CRM**, pelos últimos 8 dígitos do telefone ou pelo CNPJ: lead (inclusive excluído), conversa de WhatsApp, cliente ou fila de agente.

**WhatsApp confirmado**
- Antes de cadastrar, confere na UazAPI (`POST /chat/check`, só consulta, nada é enviado) qual número tem WhatsApp.
- A ordem é: WhatsApp do site, depois celular, depois fixo.
- Sem WhatsApp, o estabelecimento fica com status SEM_WHATSAPP e não vira lead.

**Cadastro**
- O lead é criado com:
  - origem `PROSPECCAO`, temperatura FRIO, `etapa_sdr` NOVO_LEAD;
  - campanha "Prospecção Heitor", plataforma Google Maps;
  - `created_by` heitor;
  - observação completa com tudo o que foi encontrado, também registrada no histórico de observações.
- Cria a conversa no WhatsApp da empresa.
- Põe o lead na fila da **Caroline** (`SdrLead` agente caroline, status FILA, `criado_por` heitor, `dados.prospeccao` true).
- O Heitor nunca manda mensagem.

**Primeiro contato (Caroline)**
- Abertura própria de contato ativo:
  - apresenta-se como Caroline, da Prosystem, de Vitória/ES;
  - diz em uma frase por que está chamando, com um gancho do dia a dia do segmento;
  - faz uma pergunta fácil: se é o responsável ou qual sistema usa;
  - nunca diz que o cliente se inscreveu;
  - não cita a nota do Google;
  - usa o nome do sócio só se tiver certeza de que é ele quem atende.
- A mensagem de encerramento também tem versão própria, sem "você se inscreveu".

**Proteção do número**
- A abordagem dos leads do Heitor entra no limite diário **único** do número, com o intervalo sorteado e o horário de sempre.
- Eles vão sempre **por último**, depois da campanha, das propostas e da base.
- Têm também um teto próprio por dia ("Abordagens por dia", padrão 15, de 0 a 30).

**Rotina**
- Dias úteis, das 7h às 18h (Brasília), no máximo uma rodada por hora, até a cota de cadastros do dia ("Leads por dia", padrão 30, de 1 a 60).
- Em cada rodada:
  1. Primeiro completa e cadastra os pendentes, das lojas com mais avaliações para as com menos.
  2. Depois busca até 4 bairros.
- Se o WhatsApp da empresa estiver desconectado ou a checagem não responder, para e tenta de novo na rodada seguinte. O motivo aparece no painel.

**Tela (Escritório › painel do Heitor)**
- Botões "Ligar o Heitor" / "Desligar" e "Buscar agora".
- Números do dia: leads, abordados, esperando a Caroline, total de leads e estabelecimentos vistos.
- Posição atual (onda, cidade, bairro X de Y), com barra de progresso das cidades e as ondas.
- Ajuste de leads por dia, abordagens por dia e segmentos.
- Lista filtrável: virou lead, sem WhatsApp, já no CRM, rede grande, todos.
- Aviso quando a Caroline está desligada.
- No Escritório virtual, o Heitor aparece ligado ou desligado, com "cadastrados hoje" e "na fila da Caroline".

**Técnico**
- Ferramenta aberta `google-maps-scraper` v1.18.1 (gosom), binário em `/opt/heitor/gmaps` na VPS, com Chrome sem tela (Playwright) e as bibliotecas do sistema instaladas.
- Chamada: `-json -depth 6 -lang pt-BR -email -c 2 -exit-on-inactivity 2m`, com a etiqueta `#!#q<n>` em cada busca para saber o segmento.
- Arquivos temporários em `/opt/heitor/trabalho`. Variáveis `HEITOR_GMAPS_BIN` e `HEITOR_PASTA` são opcionais.
- Tabela nova `ProspeccaoLocal`:
  - `place_id` único;
  - dados do Maps, do site e da Receita;
  - status NOVO, CADASTRADO, SEM_WHATSAPP, JA_NO_CRM, REDE, FORA_DO_PERFIL ou FECHADO, com o motivo;
  - `lead_id` e `sdr_id` do cadastro.
- Configuração em `ConfiguracaoIntegracao` chave `heitor.config` (JSON): ligado, cotas, segmentos, cursor (onda, cidade, bairro), bairros de cada cidade, última rodada e último erro.
- Arquivos:
  - `lib/assistente/heitor.ts`: regras puras (ondas, buscas, redes, perfil, telefone, leitura do site, CNPJ, sócio, observação), com testes em `tests/heitor.test.ts` (8 testes);
  - `services/heitor.service.ts`: rodada, agendador, cadastro e painel;
  - `routes/heitor.ts`: `GET /heitor/painel`, `POST /heitor/config`, `POST /heitor/rodar`, só gestão;
  - `verificarWhatsapp` em `evolution.service.ts`;
  - `components/escritorio/PainelHeitor.tsx`.
- Caroline:
  - `promptCaroline` recebe `lead.prospeccao` (cidade e bairro);
  - `rodarCaroline` deixa os leads com `criado_por` heitor por último e respeita `envios_dia`.
- Começa **desligado**: a gestão liga no painel.

### Atualização 02/10/2026: decisor indicado pela loja vira lead novo

- **Problema:** quando o número da loja respondia "fulano não faz parte da empresa, o telefone dele é X", o agente (Julio, Caroline ou Luiz Felipe) pedia desculpa pelo engano e o número passado se perdia.
- **Agora:**
  - o agente lê o WhatsApp, o nome e o cargo passados na conversa e preenche `novo_contato` na resposta;
  - agradece, diz que vai falar direto com a pessoa e encerra com a porta aberta, sem pedir desculpa como se fosse engano;
  - se a loja só disse o nome, o agente pede o WhatsApp.
- **Cadastro (`registrarDecisorIndicado` em `services/caroline.service.ts`):**
  - cria um **lead novo**, sem apagar nem alterar o da loja: origem `INDICACAO`, campanha "Decisor indicado pela loja", temperatura FRIO;
  - copia do lead da loja a empresa, o CNPJ, o segmento e a cidade;
  - grava observação nos dois leads; no lead da loja ficam o decisor e o número dele (`dados.decisor`, `dados.decisor_numero`);
  - cria ou reaproveita a conversa e coloca o contato na **fila da Caroline** (`SdrLead` status FILA, `dados.indicacao`). A fila já respeita o limite de primeiros contatos, o intervalo e o horário do número.
- **Não cadastra quando o número:**
  - é o mesmo da loja;
  - já está em conversa com um agente;
  - é de cliente ativo;
  - está marcado para não falar com agentes.
  - Nesses casos fica só a observação no lead da loja.
- **Primeira mensagem (`aberturaIndicacao` em `lib/assistente/sdr.ts`):**
  - a Caroline se apresenta e diz que pegou o contato com a equipe da loja;
  - pergunta qual sistema usam hoje;
  - nunca diz que a pessoa se inscreveu.
- **Validação:** `lerNovoContato` só aceita celular brasileiro válido (`numeroWhatsapp`).
- **Testes:** em `tests/sdr-caroline.test.ts`.

### Atualização 02/10/2026: Portal de Implantação, fase 1 (cronômetro e esperas)

Desenho completo: `docs/superpowers/specs/2026-10-02-portal-implantacao-servicos-design.md`. Ele substitui o quadro do Trello dentro do Portal Técnico e prevê 8 fases; a 7ª é o agente de implantação no Escritório.

- **Banco (só acréscimos):**
  - `ImplantacaoSessao`: cada play do técnico, com tipo DEMANDA, SUPORTE, REUNIAO ou INTERNO; etapa INSTALACAO, CONVERSAO, TREINAMENTO ou CORRECAO; início, fim, `origem_fim` (PAUSA, TROCA, ESPERA, AUTO_23H59 ou CORRECAO) e `corrigido_por`;
  - `ImplantacaoEspera`: tipo PROGRAMACAO, CLIENTE ou PROCESSAMENTO, motivo, o que resolver, responsável, início, fim, quem resolveu e a resposta.
- **Regras:**
  - só uma sessão aberta por técnico: o play em outra demanda fecha a anterior (TROCA) e registra a troca na linha do tempo das duas;
  - abrir uma espera pausa o cronômetro, se ele estiver naquela demanda;
  - o processamento automático (uma importação, por exemplo) não conta como trabalho;
  - uma sessão esquecida aberta fecha às 23h59:59 do dia em que começou (verificação a cada 15 min, `iniciarSchedulerCronometro`);
  - a gestão (ou a supervisão técnica) corrige horários, e cada correção fica registrada.
- **Contas (`lib/implantacao/cronometro.ts`, puro):**
  - união de intervalos: duas demandas na mesma hora contam uma hora;
  - jornada configurável em `ConfiguracaoIntegracao` (`implantacao.jornada`); o padrão é 08h às 18h, almoço das 12h às 13h, segunda a sexta (9h), e 07h em dia de virada (10h);
  - o tempo fora da jornada é hora extra;
  - aproveitamento = tempo dentro da jornada ÷ jornada;
  - tempos por demanda: trabalho por etapa, esperas por tipo (quantidade, duração, abertas) e prazo total desde a assinatura.
- **Rotas (`routes/implantacao-cronometro.ts`):**
  - `GET /implantacoes/cronometro/atual`;
  - `POST /implantacoes/cronometro/play` e `/pausa`;
  - `GET /implantacoes/cronometro/dia` (a gestão escolhe o técnico);
  - `PATCH /implantacoes/sessoes/:id` (correção, só a gestão);
  - `GET /implantacoes/:id/tempos`;
  - `POST /implantacoes/:id/esperas`;
  - `POST /implantacoes/esperas/:id/resolver` (gestão, quem abriu, o responsável ou o técnico da demanda);
  - `GET /implantacoes/esperas/abertas`;
  - `GET /implantacoes/cronometro/jornada`.
- **Tela (`components/implantacao/Cronometro.tsx`):**
  - barra no topo do Portal Técnico: o que está rodando, relógio, Pausar, "Outra atividade" (Suporte, Reunião, Tarefa interna), horas de hoje e aproveitamento;
  - em cada implantação: etapa, Play ou Pausar e "Espera" (programação com o Sinval, cliente ou processamento);
  - aba nova **Meu dia**: trabalhado, na jornada, aproveitamento, hora extra, registros do dia e esperas abertas com "Resolvido".
- **Testes:** em `tests/implantacao-cronometro.test.ts`.

### Atualização 02/10/2026: Portal de Implantação, fases 2 a 8 (quadro, serviços, SLA, avisos, virada e cobrança, cliente, treinamento, correções, painel, Otávio e ofertas)

Desenho: `docs/superpowers/specs/2026-10-02-portal-implantacao-servicos-design.md`. Tudo fica dentro do Portal Técnico (`/portal-tecnico`).

**Banco (só acréscimos; nada é apagado):**
- **`Implantacao`, campos novos:**
  - `modulo` (IMPLANTACAO ou SERVICO), `tipo_servico`, `coluna`;
  - `coleta` (Json) e `tela_suporte_arquivo_id`;
  - `sla_aviso`;
  - `venda_adicional_id` (único) e `cliente_id`;
  - `contato_whatsapp` e `contato_email`;
  - `virada_inicio_em` e `virada_fim_em`;
  - `cobranca_lancada_em` e `cobranca_lancada_por`;
  - `token_cliente` (único) e `concluida_fila_em`.
  - `contrato_id` passou a aceitar vazio, porque o serviço não tem contrato.
- **Campos novos em tabelas existentes:**
  - `ImplantacaoChecklistItem.fase` (fase do treinamento);
  - `ImplantacaoSessao.ocorrencia_id`;
  - `ImplantacaoEspera.lembrete_em`.
- **Tabelas novas:** `AvisoTecnico`, `ImplantacaoTreinamentoFase`, `ImplantacaoOcorrencia`, `ImplantacaoComunicacao` (única por demanda, marco e canal) e `OfertaCliente`.

**Regras (`lib/implantacao/portal.ts`, puro, com testes em `tests/implantacao-portal.test.ts`):**
- **Colunas do quadro** (as do Trello): BackLog, A fazer, Em andamento, Acompanhamento e Treinamento, Concluído, Validado Supervisão, Finalizado e Cancelados. As demandas antigas caem na coluna pela etapa de execução.
- **Prazo (SLA):**
  - em risco a partir de 80% do tempo; estourado depois do prazo;
  - padrões: conversão 15 dias até a virada e 30 até finalizar; banco zerado 10 e 25; serviço 3 dias úteis;
  - tudo configurável no portal.
- **1º vencimento:** 30 dias após o início de uso, no primeiro dia da lista 01, 05, 10, 15, 20 ou 25 igual ou posterior. Depois do dia 25, vai para o dia 01 do mês seguinte.
- **Comissão:** o mês de pagamento é o mês seguinte ao 1º vencimento (`confirmarImplantacao`).
- **Progresso para o cliente:**
  - conta Instalação + Conversão (banco zerado: só Instalação);
  - a implantação só chega a 100% com "Loja virada";
  - o serviço chega a 100% com o seu checklist completo.
- **Avisos ao cliente (`marcosDevidos`):**
  - marcos: CONTRATO, P30, P50, P80, VIRADA e TREINO_n;
  - cada marco vai uma vez só;
  - dos percentuais alcançados de uma vez, vai só o maior, e os menores ficam como PULADO;
  - a virada pula os percentuais que faltaram.
- **Treinamento em 3 fases:** Caixa e PDV; Estoque, compras e cadastros; Financeiro e gestão. O checklist ganhou "Mensagerias WhatsApp" e "Prosystem Dashboard", que estavam no cartão do Trello.

**Fluxos integrados:**
- **Serviços:** o card do kanban de serviços (cross-sell) indo para "Em execução" cria a demanda no módulo Serviços (`criarServicoDaVenda`), com checklist do tipo (troca de CNPJ, comunicação, impressora, banco de dados, outro) e prazo de 3 dias úteis. Os técnicos são avisados. Ao finalizar no quadro, o card comercial vai para "Concluído" e o envio ao Thiago continua com a vendedora.
- **Contrato assinado:** a implantação nasce com a página do cliente (`token_cliente`), o WhatsApp e o e-mail do responsável da proposta e os prazos pelo tipo.
- **Designação do técnico:** cria as fases do treinamento e avisa o técnico.
- **Virada:**
  - "Iniciar virada" exige a tela do Suporte anexada e avisa a gestão;
  - "Loja virada" grava o início de uso, calcula o 1º vencimento, recalcula o mês da comissão, move para Acompanhamento e Treinamento e avisa a gestão para lançar a cobrança;
  - a gestão recebe aviso todo dia útil até marcar "Cobrança lançada".
- **Mensagens ao cliente (`rodarPortal`, a cada 10 minutos, dias úteis das 8h às 18h, até 3 por rodada):**
  - texto escrito pela IA com o contexto real (nome, loja, etapa, passos feitos, próximos passos, tempo dedicado), sem falar de esperas nem problemas; se a IA falhar, vai um texto padrão com os mesmos dados;
  - WhatsApp (gravado no Inbox) e e-mail no visual da Prosystem, com barra de progresso, etapas e botão "Acompanhar passo a passo";
  - a mensagem da virada é as **boas-vindas** e sempre traz, em texto fixo: o 1º vencimento, a confirmação do e-mail dos boletos e a regra do boleto (enviado 10 dias antes; se não chegar, pedir a segunda via pelo menos 24 horas antes pelo suporte, (27) 99779-8103).
- **Pós-venda (Helena):** nas implantações com página do cliente, as boas-vindas não saem mais na assinatura. A mensagem da virada marca `wpp_boasvindas_em`, e a pesquisa de satisfação conta a partir dela.
- **Programação (Sinval, sem usuário no CRM):**
  - página `/programacao/<link>` sem login, com as pendências e o botão "Resolvido";
  - com o WhatsApp dele configurado, recebe cada pendência na hora e um lembrete depois de 4 horas úteis (configurável);
  - pode responder "resolvido" pelo WhatsApp;
  - o técnico recebe aviso urgente quando a pendência é resolvida.
- **Avisos para o técnico:**
  - a gestão envia pelo portal (normal ou urgente; urgente também vai por WhatsApp);
  - o técnico vê no sino do topo, com som, e marca como lido;
  - a gestão vê quem leu;
  - o sistema também avisa: prazo em risco ou estourado, espera longa, serviço novo, designação.
- **Otávio (agente novo do Escritório):**
  - **vigia:** demanda sem técnico; ficha incompleta; tela do Suporte faltando; cliente sem contato; demanda parada 3 dias sem espera; correção alta aberta há mais de 1 dia; play ligado há mais de 5 horas;
  - **responde no WhatsApp** o técnico e a programação, com os dados reais das demandas.
- **Agente de oferta:**
  - depois da virada (15 dias, configurável), oferece um item do catálogo que o cliente não usa;
  - 1 oferta por cliente a cada 30 dias, até 2 por rodada;
  - nunca oferece se uma pessoa estiver atendendo a conversa;
  - **começa desligado, até o catálogo ser preenchido** nas Configurações.

**Rotas (`routes/implantacao-portal.ts`):**
- Quadro e ficha:
  - `GET /implantacoes/quadro?modulo=`;
  - `PATCH /implantacoes/:id/coluna` (Finalizado exige virada feita e nenhuma correção aberta; Validado e Cancelados só a gestão);
  - `GET /implantacoes/:id/portal`;
  - `PUT /implantacoes/:id/coleta`;
  - `POST` e `GET /implantacoes/:id/tela-suporte`;
  - `PATCH /implantacoes/:id/prazos`.
- Avisos: `POST` e `GET /implantacoes/avisos`, `POST /implantacoes/avisos/:id/lido` e `/lidos`.
- Virada e cobrança: `POST /implantacoes/:id/virada/iniciar` e `/concluir`, `POST /implantacoes/:id/cobranca-lancada`, `GET /implantacoes/cobrancas-pendentes`.
- Treinamento e correções: `PATCH /implantacoes/fases/:id`, `POST /implantacoes/:id/ocorrencias`, `PATCH /implantacoes/ocorrencias/:id`.
- Página do cliente: `POST /implantacoes/:id/pagina-cliente` (demanda antiga: os marcos que já passaram ficam como PULADO).
- Públicas: `GET /publico/acompanhamento/:token`, `GET /publico/programacao/:token`, `POST /publico/programacao/:token/esperas/:id/resolver`.
- Gestão: `GET` e `PUT /implantacoes/portal/config` (prazos, programação, jornada, agentes, catálogo), `GET /implantacoes/painel?de&ate`.

**Telas:**
- **Portal Técnico, abas novas:**
  - **Quadro** e **Serviços**: arrastar e soltar, etiquetas, progresso, prazo, espera e correção;
  - **Avisos**, com sino no topo;
  - para a gestão: **Painel da implantação** (aproveitamento e horas por técnico, esperas e o que mais trava, prazos, viradas, prazo médio, horas por cliente, cobranças a lançar) e **Configurações**.
- **Ficha da demanda** (gaveta lateral): Resumo (tempos, paradas, prazos, aviso ao técnico), Ficha de coleta (com a tela do Suporte), Checklist, Virada e cobrança, Treinamento (fases, Play por fase), Correções (Play por correção), Tempos, Cliente (link e mensagens enviadas) e Histórico.
- **Páginas públicas:** `/acompanhamento/<link>` (cliente) e `/programacao/<link>` (Sinval).
- **Escritório:** Otávio na sala, com painel (abre as configurações do portal).

### Atualização 02/10/2026 (tarde): demandas antigas, quadro de 60 dias e virada retroativa

- **Demandas anteriores ao portal** (contrato antes de 02/10/2026, `ehLegado` em `lib/implantacao/portal.ts`):
  - ficam no CRM, mas não geram nenhum aviso automático: nem mensagem ao cliente, nem oferta, nem aviso de prazo ou falta para a gestão e o técnico;
  - a cobrança delas aparece só no painel da gestão, fora do aviso diário;
  - `enviarMarco` também recusa demanda antiga, como trava final.
- **Avisos à gestão agrupados:** prazos em risco ou estourados e demandas sem técnico chegam num único resumo por rodada, e não mais uma mensagem por demanda. Motivo: no primeiro deploy, as 14 implantações antigas geraram cerca de 20 mensagens no WhatsApp da gestão.
- **Quadro:** mostra só as demandas com contrato (ou entrada do serviço) nos **últimos 60 dias** (`DIAS_QUADRO`).
- **Virada retroativa** (só a gestão):
  - na aba Virada e cobrança, informa a data em que a loja começou a usar (`POST /implantacoes/:id/virada/concluir` com `{ data }`);
  - não exige "Iniciar virada" nem a tela do Suporte;
  - calcula o 1º vencimento e o mês da comissão a partir dessa data;
  - não manda mensagem ao cliente nem aviso.

### Atualização 02/10/2026: endereço curto da TV do Escritório

- **Endereço:** `/t/<código>` (`app/t/[codigo]/page.tsx`) leva à `/tv/escritorio?chave=...`. Serve para digitar no controle de monitores e TVs que não aceitam transmitir a aba do Chrome.
- **Rotas:**
  - `GET /painel-tv/atalho/:codigo`: devolve a chave da TV; tem um atraso de 400 ms para frear tentativas em sequência;
  - `POST /painel-tv/atalho` (gestão): mostra o código, ou cria um novo; com `{ trocar: true }`, troca o código.
- **Configuração:** o código fica em `ConfiguracaoIntegracao` com a chave `painel_tv.atalho` (6 caracteres) e aparece em Configurações › Painel da TV.
- **Menu:** o Portal Técnico agora abre sempre o `/portal-tecnico` do próprio CRM. A variável `NEXT_PUBLIC_PORTAL_URL` apontava para o app do Railway, que está fora do ar.

### Atualização 02/10/2026: TV pelo IP

- Monitores cujo navegador não abre o https do domínio (ex.: Samsung M5) podem abrir a TV pelo IP: `http://179.199.134.177:3010/t/<código>`.
- Aberta pelo IP, a página busca os dados no mesmo IP, porta 3011 (`app/t/[codigo]` e `app/tv/escritorio`).
- O CORS libera só essa origem.

### Atualização 02/10/2026: texto das mensagens de serviço

- **Serviço** (o cliente já usa o Prosystem): não recebe boas-vindas. O aviso inicial diz que o pedido do serviço foi recebido e já está na fila do técnico.
- **Tempo dedicado:** só aparece na mensagem e no e-mail quando passa de 1 minuto.

### Atualização 02/10/2026: página Início do Portal Técnico, tarefas avulsas e telas antigas escondidas

- **Início** (primeira aba do Portal Técnico, `components/implantacao/Inicio.tsx`, `GET /implantacoes/inicio`):
  - saudação pelo horário e **frase do dia** (`lib/implantacao/frases.ts`: 30 frases do dia a dia da implantação, a mesma para todos no dia);
  - **Meu dia**: trabalhado, tempo na jornada, hora extra e aproveitamento;
  - **Minhas tarefas** e **Recados**;
  - **Pede atenção agora**: prazo estourado ou em risco, demanda parada, virada em andamento, treinamento marcado para os próximos 7 dias e, para a gestão, demanda sem técnico.
- **Tarefas avulsas:**
  - `AvisoTecnico` ganhou `tipo` (AVISO ou TAREFA), `prazo` e `concluida_em`;
  - a gestão cria tarefa ou recado no próprio Início (urgente também vai por WhatsApp);
  - o técnico conclui ou reabre (`POST /implantacoes/tarefas/:id/concluir`);
  - tarefa ligada a uma demanda vai para o histórico dela ao ser concluída;
  - nenhuma tarefa é criada automaticamente.
- **Telas escondidas, sem apagar nada:**
  - "Demandas (SLA)", no menu do Portal Técnico;
  - aba "Histórico" (Solicitações de serviço), na ficha do cliente.
  - As duas liam a tabela `SolicitacaoServico`, que nunca foi criada em produção, e por isso apareciam sempre zeradas.

### Atualização 02/10/2026: Portal Técnico unificado e de tela cheia

- **Quadro único** (`QuadroDemandas`):
  - implantações e serviços juntos, com filtro **Tudo / Implantações / Serviços** e a contagem de cada um;
  - `GET /implantacoes/quadro` sem `modulo` devolve tudo;
  - as colunas se esticam para ocupar a largura da tela;
  - quando não há nada em andamento, mostra uma mensagem explicando o que entra e quando.
- **Menu:** saíram "Serviços" (agora é o filtro do Quadro) e a lista antiga "Implantações" (Datas/Executar), sem apagar código.
- **Início:** os itens de "Pede atenção agora" abrem direto o card da demanda no Quadro.
- **Tela cheia e responsiva:**
  - Início em grade fluida (4 colunas em tela grande, 2 em notebook ou tablet, 1 no celular), sem largura máxima;
  - Configurações em duas colunas;
  - ficha da demanda com até 1100px;
  - abaixo de 900px, o menu lateral vira só ícones e o topo esconde o título.

### Atualização 02/10/2026: sino de novidades do Portal Técnico

- **O sino abre uma caixa de "Novidades"** com os últimos 20 avisos: nova implantação, novo serviço, tarefa, recado, prazo.
- **Ao abrir, marca tudo como lido** e o contador zera.
- **Cada item abre o card da demanda** no Quadro.
- **Quem recebe:** `avisarEquipe` manda a novidade para os técnicos de implantação, a supervisão técnica e os ADMIN quando:
  - um contrato assinado gera uma implantação (`lib/comissao-fluxo.ts`);
  - um serviço entra em execução.
- As novidades ficam só no portal, sem WhatsApp.

### Atualização 02/10/2026: Onboarding técnico (primeiro contato, antes de qualquer ação)

- **O que é:** responsabilidade do técnico, com prazo de 2 dias úteis após a designação. A aba "Onboarding" do Portal Técnico agora é o **Onboarding técnico**. A tela antiga dependia de `Licenca`, sempre vazia, e ficou no código, fora de uso.
- **Roteiro** (`ONBOARDING_SECOES` em `lib/implantacao/portal.ts`, 21 itens tirados da Fase 1.0 do portal antigo), em 10 seções:
  - Apresentação; Diagnóstico da empresa; Estrutura; Infraestrutura; Equipamentos; Fiscal; Estoque e migração; Financeiro e integrações; Operação e treinamento; Fechamento;
  - o último item é **"Diagnóstico aprovado pelo cliente"**.
  - É semeado como grupo `ONBOARDING` na designação, antes de Instalação, Conversão e Treinamento.
- **Trava** (`onboardingOk`; não vale para serviços nem para demandas anteriores a 02/10/2026). Enquanto o onboarding não estiver 100%:
  - o play só aceita a etapa "Onboarding técnico" (etapa nova `ONBOARDING` no cronômetro);
  - os itens dos outros grupos não podem ser marcados;
  - o card não sai de BackLog ou A fazer;
  - "Iniciar virada" fica bloqueado.
- **Conclusão automática:** `Implantacao.onboarding_concluido_em` é gravado sozinho quando o último item é marcado, e volta a vazio se algum item for desmarcado.
- **Aprovação pelo cliente:**
  - a página `/acompanhamento/<link>` mostra o **Diagnóstico da sua loja** (os dados da ficha de coleta);
  - o cliente aprova com o nome completo (`POST /publico/acompanhamento/:token/aprovar-diagnostico`);
  - isso marca o item de aprovação, grava `onboarding_aprovado_em` e `onboarding_aprovado_por` e avisa o técnico.
- **O que o cliente vê:** o onboarding aparece como um passo só, "Primeiro contato e diagnóstico", sem os itens internos. Ele entra no percentual de andamento.
- **Ficha de coleta:** ganhou usuários, responsável pelo sistema, internet, inscrição estadual, CSC, outros equipamentos, volume de produtos, controle de lote, integrações, horário e dias de pico, janela da implantação, pessoas a treinar e modalidade.
- **Telas:**
  - tela **Onboarding técnico**, em kanban: Sem técnico, Primeiro contato, Diagnóstico, Aprovação do cliente e Concluído, com prazo e atraso;
  - aba "Onboarding técnico" na ficha da demanda, com o roteiro por seção e o botão de copiar o link para o cliente aprovar;
  - cadeado 🔒 nos cards do Quadro.
- **Otávio:** avisa o técnico quando o onboarding passa do prazo.
- **Rota:** `GET /implantacoes/onboarding`.

### Atualização 02/10/2026: 15 perguntas principais do primeiro contato

- **As perguntas** (`PERGUNTAS_PRIMEIRO_CONTATO`), na ordem em que o técnico pergunta:
  - máquinas, faturamento, caixas, impressora NFC-e, etiquetas, colaboradores, PBMs;
  - financeiro, corretor tributário, gerencial, SNGPC, comunicação, banco único, preço único e TEF.
- **Ficha de coleta:** viraram o grupo "Primeiro contato".
- **Aba Onboarding técnico:** aparecem como um formulário no topo.
- **Item novo do roteiro** "Perguntas principais do primeiro contato respondidas":
  - marca sozinho ao salvar a ficha com as 15 preenchidas, e desmarca se alguma for apagada;
  - não pode ser marcado à mão sem as respostas.
- **Página do cliente:** as respostas aparecem no diagnóstico que ele aprova.

### Atualização 02/10/2026: técnicos só no Portal Técnico, designação no card e leitura confirmada de recados

- **Acesso do técnico:** cargos `TECNICO`, `TECNICO_IMPLANTACAO` e `TECNICO_SUPORTE` entram direto no Portal Técnico após o login e não abrem nenhuma outra tela do CRM (qualquer rota do `DashboardLayout` redireciona para `/portal-tecnico`; helper `ehSoPortalTecnico` em `frontend/lib/auth-context.tsx`). No portal, o botão flutuante "← CRM" vira **Sair** para eles. A Supervisão Técnica continua com o menu completo. As rotas da API não mudaram (o bloqueio é de tela).
- **Designar técnico no card:** no resumo do card do Quadro, a gestão escolhe o **Técnico responsável** (`POST /implantacoes/:id/designar`). Só depois disso o card aparece no Quadro do técnico (regra que já existia: técnico vê só os cards designados a ele). A lista (`GET /implantacoes/tecnicos`) vem dos usuários **ativos** com cargo `TECNICO`, `TECNICO_IMPLANTACAO`, `TECNICO_SUPORTE` ou `SUPERVISAO_TECNICA`: cadastrou em Usuários, já aparece.
- **Recados só do card designado:** para quem não é gestão, recados e tarefas ligados a um card só aparecem se o técnico for o designado naquele card (filtro `soDoDesignado` em `/implantacoes/avisos`, contador de não lidos e página Início). Recados sem card continuam aparecendo. Os avisos automáticos "Nova implantação" e "Novo serviço para executar" (`avisarEquipe`) agora vão só para Supervisão Técnica e Admin.
- **Leitura confirmada:** tocar no recado (Início, sino ou aba Avisos) abre um popup com o texto completo; só o botão **Confirmo que li** marca `lido_em`. O sino não marca mais tudo como lido ao abrir e o botão "Marcar todos como lidos" saiu. Componente `frontend/components/implantacao/ConfirmarLeitura.tsx`.
- **Radar da supervisão:** na página Início, a gestão vê o quadro **Leitura dos recados**: para quem foi cada recado (da gestão ou automático para o técnico do card), quando foi enviado e se já confirmou a leitura (com data e hora) ou não.

### Atualização 02/10/2026: ficha do cliente no card e portal recomeçando em 02/10

- **Contato em evidência:** no topo do card (gaveta da demanda) aparece um bloco destacado com o **nome do contato** e o **telefone** em letra grande, com os botões **Ligar** (`tel:`) e **WhatsApp** (`wa.me`). Ordem de preferência: contato da ficha de coleta, telefone do contato no cadastro, 2º contato, WhatsApp dos avisos, telefones 1, geral e 2 (sem repetir número). Sem telefone, o bloco fica vermelho avisando.
- **Tipo da demanda** em etiqueta no topo do card (ex.: "Serviço · Banco de dados", "Implantação · conversão de X").
- **Aba "Ficha do cliente"** (para técnico e gestão): blocos Demanda (tipo, serviço vendido, plano, vendedor, técnico, entrada), Empresa (razão social, fantasia, CNPJ, IE, código, segmento, regime tributário, grupo técnico, situação, cliente desde), Contatos (todos os nomes, telefones e e-mail), Endereço e Observações do cadastro. **Sem dados financeiros** (mensalidade, valores, vencimentos, pagamentos, observações financeiras) e sem CPF/RG do responsável. `GET /implantacoes/:id/portal` passa a devolver `cliente_ficha` (select só com esses campos; acha o cliente por `cliente_id` ou pelo CNPJ), `tipo_demanda` e `servico_descricao`.
- **Portal recomeça em 02/10/2026:** constante `CORTE_PORTAL` (02/10/2026 00:00 de Brasília) em `backend/src/lib/implantacao/portal.ts`. Quadro, onboarding e Início só mostram demandas com assinatura a partir dessa data (`desdeQuadro()`); recados, tarefas, contador do sino e radar de leitura só os criados a partir dela; o robô de avisos (Otávio) não avisa mais sobre demandas criadas antes. **Nada foi apagado**: tudo continua no banco e no CRM.

### Atualização 02/10/2026: recado lido sai da tela do técnico

- Depois que o técnico toca em **Confirmo que li**, o recado some da lista dele (Início, sino e aba Avisos). Não é apagado do banco: continua no radar **Leitura dos recados** da supervisão, com data e hora da confirmação. (`/implantacoes/avisos` e Início filtram `lido_em: null` para o próprio usuário.)

### Atualização 02/10/2026: leitura de recado no histórico do card

- Quando o recado é ligado a uma demanda, a confirmação de leitura entra no **Histórico** do card do cliente: "✅ <técnico> confirmou a leitura do recado de <quem enviou>: <texto>" (`POST /implantacoes/avisos/:id/lido` grava `ImplantacaoAtividade`).

### Atualização 02/10/2026: Satisfação (CSAT) só para a supervisão

- O item **Satisfação** do Portal Técnico (grupo Suporte) só aparece para a gestão técnica (CEO, Admin, Supervisão Comercial/Técnica). O técnico não vê o menu nem abre a tela.

### Atualização 02/10/2026: observações do card e responsável da empresa (decisor)

- **Aba "Observações" no card do cliente** (Portal Técnico), com dois blocos:
  - **Observações compartilhadas:** técnico e supervisão escrevem e veem tudo.
  - **Minha observação pessoal (🔒):** só quem escreveu vê; não é compartilhada com ninguém, nem com a supervisão.
  - Cada um apaga só as próprias observações.
  - Tabela nova `ImplantacaoObservacao` (`implantacao_id`, `autor_id`, `autor_nome`, `texto`, `privada`, `created_at`). Rotas: `GET/POST /implantacoes/:id/observacoes` (o GET devolve as compartilhadas + só as pessoais do próprio usuário) e `DELETE /implantacoes/observacoes/:obsId` (só o autor).
- **Responsável da empresa (decisor):** a supervisão informa nome e telefone no topo do card (botão "+ Informar responsável da empresa"). Aparece em destaque verde, acima do contato, com **Ligar** e **WhatsApp**, para o técnico falar direto com quem decide. Só a gestão edita (`PATCH /implantacoes/:id/decisor`, `exigirGestao`); fica em `coleta.decisor_nome` / `coleta.decisor_telefone`, preservado quando o técnico salva a ficha de coleta, e registrado no Histórico do card. Também aparece na aba Ficha do cliente.

### Atualização 02/10/2026: bloco Demanda da Ficha do cliente reorganizado

- Tipo da demanda em etiqueta ao lado do título; "O que foi vendido" em caixa de largura total (fundo suave, barra lateral); Plano, Vendedor, Técnico e Entrou em em 4 mini-cartões com ícone (2 por linha no celular). Técnico não designado aparece em vermelho. Demais blocos alinhados pelo topo.

### Atualização 02/10/2026: redesenho do card da demanda (estilo ordem de serviço)

- **Direção:** card como ordem de serviço calma, SaaS moderno e leve. Bordas finas (`var(--t-card-border)`), quase sem cor; azul ProSystem #2E6EAB só em ação, telefone e tipo da demanda; verde só no ícone do WhatsApp. Sem caixas coloridas pesadas.
- **Cabeçalho:** tipo da demanda em azul acima do nome; nome do cliente 20px/650 com tracking negativo; linha discreta com CNPJ · plano · técnico; progresso com % em números tabulares.
- **Faixa de contatos** (`PainelContatos`, substitui `ResponsavelEmpresa` + `ContatoDestaque`): um painel com duas linhas (Decisor e Contato), nome + telefone clicável e botões redondos de Ligar/WhatsApp (área de toque ampliada). Supervisão edita o decisor ali mesmo ("Informar decisor" / "Editar").
- **Ficha do cliente:** "Demanda" com o texto do que foi vendido solto, em parágrafo legível, e Plano/Vendedor/Técnico/Entrou em em linha; Empresa, Contatos e Endereço como lista de definição (rótulo à esquerda 170px, valor à direita, linhas finas; empilha no celular). Telefones clicáveis.
- **Observações:** blocos "Equipe" e "🔒 Só para mim" com campo de texto embutido em painel e lista com divisórias finas.

### Atualização 03/10/2026: primeiro contato (onboarding) concentrado no card

- Implantação com onboarding pendente: o card **já abre na aba Onboarding técnico** (uma vez por abertura; o técnico pode trocar de aba) e mostra no topo a faixa **"Primeiro contato pendente"** com o progresso (X de Y itens) e o botão **Iniciar/Continuar primeiro contato**. A faixa some quando o onboarding fica concluído.
- O item **Onboarding técnico** do menu do portal agora é só da supervisão (visão geral de todas as implantações). O técnico faz o onboarding dentro do card.
- Serviços não têm onboarding (continua igual).

### Atualização 03/10/2026: Fase 1 do plano de UX do Portal Técnico (próximo passo, etapas que travam, carga, botões, busca)

Origem: documento "Portal Técnico ProSystem: pesquisa de UX e o que falta" (03/10/2026), lacunas 1, 4, 5, 10 e 12.

**Regra única (`backend/src/lib/implantacao/portal.ts`):** `proximoPasso()`, `pendenciasIniciarVirada()`, `pendenciasConcluirVirada()`, `pendenciasValidacao()`. Testes em `backend/tests/implantacao-proximo-passo.test.ts`.
- Ordem da implantação: Designar (supervisão) → Primeiro contato → Ficha de coleta (regime tributário + contato) → Preparar a virada → Iniciar virada → Loja virada → Treinamento (fase N de M) → Correções → Pedir validação → Validar (supervisão) → Finalizar (supervisão).
- Serviço: Designar → Executar o checklist → Correções → Pedir validação → Validar → Finalizar.
- Cada passo diz quem age (técnico, supervisão), a aba do card e a etapa do cronômetro.

**Etapas que travam:**
- *Iniciar virada* exige: onboarding concluído, ficha de coleta (regime + contato), itens "Uninfe e Certificado" e "Copy (backup)"; na conversão também "Conversão dos dados" e "Validar Produtos"; e a tela do Suporte anexada. Item que não existe no card não trava; demanda antiga (antes do portal) não trava.
- *Loja virada* exige: virada iniciada e o item "Emitir uma nota de saída NFCE em Operação".
- *Concluído* (pedir validação ou arrastar) exige: implantação com loja virada, todas as fases do treinamento realizadas e nenhuma correção aberta; serviço com o checklist completo.
- A supervisão pode **liberar mesmo assim** a virada (confirmação na tela); a liberação fica no Histórico com a lista do que faltava. O técnico não pode.
- **Validar, Finalizar e Cancelar** passam a ser só da supervisão (Finalizar era livre antes).

**Escopo por papel:**
- Cargos `TECNICO`, `TECNICO_IMPLANTACAO` e `TECNICO_SUPORTE` só veem e mexem nas demandas designadas a eles (antes o filtro valia só para `TECNICO_IMPLANTACAO`). Helper `ehCargoTecnico`, usado no portal, no cronômetro e em `/implantacoes`.
- Técnico do card: **Começar agora** (move para Em andamento quando cabe e dá play na etapa certa), **Abrir <aba>**, **Pedir validação**.
- Supervisão e admin: **Designar** (seletor com a carga de cada técnico), **Validar**, **Devolver ao técnico** (com recado urgente), **Finalizar**, liberar virada com pendências, **carga da equipe** no topo do Quadro.

**Rotas novas:**
- `POST /implantacoes/:id/pedir-validacao`: confere `pendenciasValidacao`, move para Concluído, pausa o cronômetro do técnico naquela demanda, registra no Histórico e avisa a gestão (sino da Supervisão Técnica/Admin + WhatsApp da aprovadora).
- `POST /implantacoes/:id/devolver` (supervisão): volta para Em andamento (ou Acompanhamento, se a loja já virou), registra o motivo e manda recado urgente ao técnico.
- `GET /implantacoes/busca?q=`: busca por cliente, CNPJ, técnico ou vendedor (até 12), dentro do escopo de quem busca.
- `GET /implantacoes/tecnicos?carga=1` (supervisão): acrescenta `ativas`, `em_virada` e `horas_mes` a cada técnico.
- `GET /implantacoes/:id/portal` devolve `proximo_passo`; `GET /implantacoes/quadro` devolve `proximo_passo` (chave, título, quem) por cartão.
- `POST /virada/iniciar` e `/virada/concluir` aceitam `forcar: true` só da supervisão; os erros de pré-requisito trazem `data.pendencias`.

**Tela:**
- Card: faixa **Próximo passo** no topo ("Sua vez" / "Com a supervisão" / "Com <técnico>"), com o que falta em lista e os botões do papel de quem vê. Substitui a faixa de primeiro contato.
- Aba Virada: passo "Pré-requisitos da virada" com o que falta.
- Quadro: cada cartão mostra "→ próximo passo" (azul quando é a vez de quem está olhando); supervisão vê a **Carga da equipe**.
- Topo do portal: **Buscar (Ctrl+K / ⌘K)**, com ↑ ↓ e Enter para abrir o card.

### Atualização 03/10/2026: Fase 2 do plano de UX do Portal Técnico (agenda, operação assistida, modelos, uma só verdade)

Origem: documento de pesquisa de UX (lacunas 2, 3, 6 e 8). Operação assistida definida pela Jessica em **5 dias úteis**.

**Agenda da virada e do treinamento**
- Campos novos em `Implantacao`: `virada_agendada_para`, `virada_duracao_h`, `virada_remarcacoes`, `virada_lembrete_em`. Em `ImplantacaoTreinamentoFase`: `lembrete_em`.
- `POST /implantacoes/:id/agendar-virada` (técnico do card ou supervisão): data/hora no futuro, duração opcional; remarcar exige motivo (cliente pediu, problema técnico, aguardando programação, outro) e conta em `virada_remarcacoes`; outra virada do mesmo técnico no mesmo dia devolve 409 e pede confirmação. O cliente recebe a data no WhatsApp com o que preparar (marco `AGENDA_VIRADA`); remarcação avisa a supervisão.
- Marcar a data de uma fase do treinamento avisa o cliente (`AGENDA_TREINO_<n>`) e rearma o lembrete.
- Robô do portal (a cada 10 min, horário comercial, a partir das 9h): lembrete ao cliente no dia útil anterior à virada (`LEMBRETE_VIRADA`, com aviso ao técnico) e a cada fase marcada (`LEMBRETE_TREINO_<n>`). Limite de 3 mensagens por rodada, como as demais mensagens ao cliente.
- Próximo passo: depois da ficha de coleta vem **Agendar a virada com o cliente**; os passos seguintes mostram a data agendada.
- Tela: bloco **Agenda da virada** na aba Virada (agendar/remarcar); etiqueta "📅 Virada dd/mm hh:mm" no cartão do Quadro; seção **Agenda** (próximos 14 dias, viradas e fases) no Início — do técnico, só as dele; da supervisão, a equipe toda com o nome do técnico; bloco **Datas combinadas** na página de acompanhamento do cliente.

**Operação assistida (5 dias úteis)**
- Tabela nova `ImplantacaoAssistida` (`implantacao_id`, `dia` YYYY-MM-DD, `vendas_ok`, `nfce_ok`, `estoque_ok`, `observacao`, `ocorrencia_id`, técnico; único por demanda + dia).
- Vale para implantações com loja virada a partir de 03/10/2026. Os dias são os 5 dias úteis seguintes ao dia da virada.
- `POST /implantacoes/:id/assistida`: registra a checagem de um dia que já chegou. Problema em algum item exige observação, abre uma **correção** ligada ao card (gravidade alta se vendas ou NFC-e) e avisa a supervisão.
- Corre **junto** com o treinamento (decisão: o caixa precisa estar treinado no dia da virada); a checagem do dia aparece como próximo passo antes do treinamento. **Pedir validação/Concluído exige os 5 dias checados.**
- Robô: a partir das 15h, lembra o técnico da checagem do dia que ainda não foi feita (uma vez por dia).
- Etapa nova do cronômetro: **Operação assistida** (`ASSISTIDA`).
- Tela: aba **Operação assistida X/5** no card (os 5 dias, situação de cada um e o formulário do dia).

**Modelos de checklist**
- `ConfigPortal.modelos` (segmento → itens de Instalação, Conversão e Treinamento) e `ConfigPortal.extras_sistema` (sistema de origem → itens extras na Conversão). O checklist padrão foi para `CHECKLIST_PADRAO` na lib.
- Na designação, a implantação recebe o modelo do segmento do cliente (cadastro do cliente, comparação sem acento e maiúsculas) ou o padrão, mais os extras do sistema anterior. Ao preencher a ficha de coleta com um sistema de origem novo, os extras que faltam entram no checklist.
- Tela: em Configurações, **Modelos de checklist por segmento** (um item por linha, novo modelo começa com o padrão) e **Itens extras por sistema de origem**. Itens com "certificado", "backup/Copy", "Conversão dos dados", "Validar Produtos" e "NFCE em Operação" seguem travando a virada.

**Uma só verdade (coluna x etapa)**
- A coluna do quadro manda; `etapa_execucao` é sempre gravada junto (`etapaDaColuna`) em mover coluna, iniciar virada, pedir validação e devolver. A rota antiga `POST /implantacoes/:id/etapa` grava a coluna correspondente (`colunaDaEtapa`) e finalizar por ela é só da supervisão.
- A coluna precisa combinar com os marcos (`colunaIncoerente`): loja virada não volta para antes de Acompanhamento; virada iniciada não volta para A fazer; Acompanhamento só depois de "Loja virada".
