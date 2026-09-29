# Briefing de design UI/UX: CRM Comercial Prosystem

Versão 1.0 · 27/09/2026

## 1. Para quem desenhamos

- **Supervisora (Jessica):** passa o dia no CRM, alterna entre WhatsApp, Escritório virtual e propostas. Precisa ver **o que exige ação agora** e decidir em um clique (aprovar, assumir, refazer).
- **Vendedora e SDR:** precisam de contexto rápido: quem é o cliente, termômetro, dor, o que falta.
- **Diretoria:** consome números, principalmente fora do CRM (e-mail e WhatsApp).
- **Cliente final:** só vê o WhatsApp e a página pública da proposta: tudo deve parecer escrito por uma pessoa, sem cara de robô.

## 2. Princípios

1. **Ação primeiro:** o que precisa de decisão aparece em cima ("O que fazer agora", "✋ Para você aprovar", pendências da Laya).
2. **Quem está atendendo está sempre visível:** farol rosa com o nome do agente; "Sem dono" em amarelo; dono pelo nome.
3. **Nada some sem rastro:** tudo o que um agente fez aparece na conversa, na agenda e no histórico do lead.
4. **Linguagem do usuário:** botões dizem o que acontece ("Aprovar e enviar", "🔄 Refazer", "✅ Finalizar", "↩ Reabrir"). Sem jargão técnico.
5. **Janela inteira:** as páginas usam toda a largura (sem margens largas); responsivo até o celular.
6. **Tom humano nas mensagens ao cliente:** frases curtas, sem travessão, no máximo um emoji, uma pergunta por vez.

## 3. Sistema visual

- **Fonte:** Inter (`--font-sans`), mono Geist Mono.
- **Temas:** azul (padrão), laranja e verde, cada um com modo claro e escuro (`[data-theme]` + `.dark`). Componentes usam tokens, nunca cores fixas de fundo:
  - `--t-content-bg` (fundo da página), `--t-card-bg`, `--t-card-border`, `--t-card-shadow`;
  - `--t-text-primary`, `--t-text-secondary`, `--t-text-muted`;
  - `--t-error-*` para erros.
- **Cor de ação principal:** azul `#2E6EAB`; sucesso `#15803d`/`#16a34a`; alerta `#ea580c`; erro `#dc2626`.
- **Cor por agente** (crachá, borda do painel, farol): Bia `#e11d74`, Lurdinha `#f59e0b`, Clarice `#8b5cf6`, Luiz Felipe `#2563eb`, Zequinha `#16a34a`, Helena `#0891b2`, Laya `#db2777`, Marta `#7c3aed`, Sofia `#ea580c`, Caroline `#be123c`, Julio `#0d9488`.
- **Temperatura do lead:** 🔥 Muito quente `#dc2626`, 🟠 Quente `#ea580c`, 🟡 Morno `#ca8a04`, 🔵 Frio `#2563eb`.
- **Selos:** etiqueta (cor da etiqueta), "Sem dono" (`#FEF3C7`/`#92400E`), farol do agente (`#FCE7F3`/`#BE185D`, bolinha `#EC4899` pulsando, respeita `prefers-reduced-motion`).

## 4. Telas-chave

### 4.1 WhatsApp (3 colunas)
- **Esquerda:** abas Minhas / Sem dono / Todas / Finalizadas; "O que fazer agora"; lista com selos.
- **Centro:** cabeçalho com nome, número, farol, e ações (Assumir, Finalizar, prioridade, etiqueta, transferir); mensagens com balão "Atendimento automático" para robôs.
- **Direita (painel):** Atendimento/SLA, Contato, Triagem, Resumir conversa, **➕ Criar proposta | 📄 Enviar/reenviar**, IA Laya (confirmar/corrigir), Responsável, **📝 Observações**, Mover no funil.

### 4.1b Notificação de conversas
- Ícone 💬 verde no topo com contador; lista só as conversas de hoje; clique abre a conversa e remove o item.

### 4.2 Escritório virtual
- Sala isométrica em estilo LEGO: mesas, café, biblioteca, pebolim, videogame, sala de reunião e sala da Jessica.
- Minifigs com cabelo, acessórios e **tom de pele por agente** (ex.: Helena negra com black power).
- **Interações:** clicar no agente abre a **📅 Agenda**; setas ou clique movem a Jessica; balão de proximidade; zoom (− / + / Ctrl+roda no cursor / arrastar).
- **Abaixo da sala:** painéis da Caroline, do Luiz Felipe e do Julio (cada um com liga/desliga, aprovação, fila, termômetro); Caderno da Laya; Pesquisas da Sofia (3 últimas + 📓 Caderno); cartões dos agentes.

### 4.3 Painel de agente (Caroline / Julio / Luiz Felipe)
- Cabeçalho: título, descrição, "⏰ Começa…", liga/desliga, aprovar antes de enviar, limite do dia.
- Quadro de economia de IA (OpenAI, Grok, Laya, % sem custo).
- **✋ Para você aprovar:** texto editável, "O que mudar?", botões Aprovar/Enviar com meu ajuste e 🔄 Refazer.
- Tabela: lead, situação, termômetro com motivo, dor principal, confirmar temperatura (ensina a Laya).

## 5. Estados

- **Vazio:** sempre com o próximo passo ("Nenhuma pesquisa ainda… clique em Pesquisar agora").
- **Carregando:** texto curto ("Buscando propostas deste contato…").
- **Erro:** diz o que houve e o que fazer ("Não foi possível baixar. Só a gestão pode baixar o Caderno.").
- **Sucesso:** confirma o resultado ("Observação salva. CNPJ consultado na Receita: …").

## 6. Acessibilidade

- Foco visível, `aria-label` nos botões de ícone (zoom, fechar), contraste dos tokens nos dois modos, animações desligadas com `prefers-reduced-motion`.

## 7. Próximas melhorias de UX sugeridas

- Contador de "para aprovar" no menu lateral.
- Linha do tempo do lead unindo WhatsApp, observações, propostas e agentes.
- Filtro "Com agente" na lista de conversas.


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
