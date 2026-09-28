# Manual de uso: CRM Comercial ProSystem

Versão de 25/09/2026 (noite). Endereço: https://comercial.prosystemnet.com

Este manual explica, passo a passo, como usar as funções novas do CRM Comercial. Cada seção diz onde fica, como usar e o que acontece por trás.

---

## 1. WhatsApp da empresa

**Onde:** menu **WhatsApp**.

- O CRM usa **um número só**, o WhatsApp da empresa.
- Conversa de número novo chega **sem dono**, na fila. Quem responder primeiro vira o dono da conversa.
- Dá para enviar texto, áudio, foto, vídeo e documento.
- **Identificar** (painel lateral) marca o contato como Cliente, Lead, Parceiro, Equipe, Terceiro de cliente, Fornecedor ou Outro. Só **Lead** fica no funil.
- **Mensagem enviada pelo celular** para um número novo cria a conversa no CRM, com o histórico, e a triagem não entra nela.
- **Abas:** Minhas, Sem dono, Todas (gestão) e **Finalizadas**.
- **Notificação de conversas (ícone 💬 no topo):** mostra só as conversas com mensagens **de hoje**. Clicar numa delas **abre a conversa direto**, que vira lida, e a notificação some.

### 1.1 Vincular a conversa a um cliente

1. Abra a conversa e clique em **Identificar → Cliente**.
2. Busque pelo **código**, pelo **nome** ou por **parte do nome** (todas as palavras precisam aparecer), ou pelo **CNPJ**.
3. Clique no cliente. A conversa fica vinculada e o contato sai do funil de leads.

Se o contato mandar o **CNPJ de um cliente que já está na base**, o bot pergunta "É a sua empresa? (razão social)" com os botões **Sim** e **Não**. **Sim** vincula sozinho.

### 1.2 Assumir uma conversa

- Clique em **✋ Assumir**, ou responda a conversa. Ela passa a ser sua.
- Os agentes (Caroline, Julio, Luiz Felipe, Clarice) **param de responder** nela. A Laya continua só aprendendo.
- O lead passa a ser seu e **sai de "Leads para Distribuir"**.
- Você recebe **só para você**, no seu WhatsApp, o **resumo do atendimento**: quem é, o que foi falado, o que falta, a dor principal, o **termômetro**, as **marcações** (etiqueta, intenção, quem atendia) e as **observações** da equipe.

### 1.3 Finalizar um atendimento

- Botão **✅ Finalizar** no topo da conversa: ela sai das listas, do prazo de resposta e dos robôs.
- Se o contato escrever de novo, a conversa **volta sozinha** para a lista.
- Aba **✅ Finalizadas**: consulta e botão **↩ Reabrir**.

### 1.4 Observações (ligações e anotações)

- Campo **📝 Observações** no painel da conversa, abaixo de Responsável. **Ctrl+Enter** salva.
- Cada nota fica com data, hora e autor. Com lead vinculado, vai também para o **histórico do lead**.
- **CNPJ escrito na observação** (por exemplo, passado por telefone) é consultado na Receita e preenche o lead, sem mandar nada ao cliente.
- Os agentes leem as observações antes de escrever, então não repetem o que você já conversou por telefone.

### 1.5 Farol dos agentes

Enquanto um agente conversa com o contato, aparece o selo rosa **"● Caroline atendendo"** (ou Julio, ou Luiz Felipe), na lista, no topo da conversa e em Responsável. O selo some quando alguém assume, quando a conversa termina ou quando é finalizada.

---

## 2. Triagem automática (Bia)

Todo número novo recebe o menu: **Quero conhecer**, **Serviços**, **Suporte** e **Financeiro**.

- **Quero conhecer (3 toques):** segmento (Padaria ou Farmácia) e nome. Cidade e CNPJ ficam para depois, na conversa com a Caroline ou com a equipe. Um CNPJ enviado a qualquer momento continua sendo consultado na Receita.
- **Com a Caroline ligada:** a Bia diz "A Caroline, da nossa equipe, já vai continuar o seu atendimento" e a Caroline assume em 1 a 3 minutos. O lead só entra em "Leads para Distribuir" quando a Caroline terminar.
- **Com a Caroline desligada:** o lead vira **Qualificado**, toca o **alarme**, recebe o material do segmento e a oferta de demonstração (seção 5.4).
- **Suporte** e **Financeiro** recebem o contato do atendimento geral, *27 99779-8103*, com o botão **💬 Falar com o suporte** (ou financeiro), que abre o chat direto, e saem do funil.

**Configurar:** Configurações → Triagem automática. Ali se liga ou desliga a triagem e se editam os textos de farmácia e padaria.

---

## 3. Painel da TV e resumos por e-mail

- **Painel da TV:** Configurações → Painel da TV gera o link. Tela 1 mostra o dia e a tela 2 o ano, alternando a cada 30 segundos.
- **Resumo executivo (e-mail, 18h, de segunda a sexta):** vai para o Thiago com cópia para a supervisão. Sai **uma vez por dia**, mesmo que o servidor reinicie.
  - **De segunda a quinta:** o dia de hoje e o acumulado do ano.
  - **Na sexta:** a semana, com as **atividades concluídas** e a **eficiência da equipe**.
- **Eficiência:** atividades feitas no prazo ÷ atividades que já deviam estar feitas. Fica verde a partir de 80%, amarela de 50% a 79% e vermelha abaixo de 50%.
- **Lista de pendências por e-mail (8h e 17h):** vai para a vendedora e para a SDR.

---

## 4. Atividades com SLA

**Onde:** **Atividades → Nova atividade**.

1. Em **Designar para**, escolha a pessoa. A SDR aparece marcada como "(SDR)".
2. Em **Prazo de execução → SLA (horas)**, escolha 1h, 2h, 4h, 8h, 24h ou 48h, ou digite outro valor.
3. Passou do SLA, a atividade aparece como atrasada.

O CRM **não cria atividades sozinho**. A única exceção é a demonstração que o próprio lead marca.

---

## 5. Assistente no WhatsApp

**Configurar:** Configurações → **Assistente no WhatsApp**.

### 5.1 Perguntar ao CRM pelo celular (gestão)

Do celular cadastrado (Jessica ou Thiago), mande **só a frase** para o número da empresa:

| Mensagem | Resposta |
|---|---|
| `hoje` | números do dia |
| `semana` | resumo da semana, com a eficiência |
| `propostas paradas` | propostas sem resposta há 7 dias ou mais |
| `cliente 381` / `cliente padaria pão` | dados do cliente |
| `tarefa Ana ligar para Farmácia Rangel amanhã 10h` | monta a atividade e pede **Confirmar** |
| `ajuda` | lista de comandos |

Qualquer outra mensagem vai para o Inbox normalmente.

### 5.2 Avisos no celular

Cada pessoa da gestão escolhe o que recebe:
- lead qualificado (inclui "lead pronto para a vendedora" e "⏸ parou de responder");
- proposta aberta pelo cliente;
- proposta aceita;
- **novo contrato assinado**;
- **contrato pronto para conferir**, sem assinatura há 2 dias ou recusado;
- conversa passou do prazo;
- risco de cancelamento;
- resumo curto às 18h;
- resposta da pesquisa de satisfação;
- pesquisa semanal da Sofia;
- **lembrete das 17h da Laya** (confirmações pendentes).

**Trava contra repetição:** a mesma mensagem nunca vai duas vezes para a mesma pessoa em 6 horas.

O **Thiago** recebe só o resumo das 18h e os novos contratos assinados.

### 5.3 Proposta

**Na conversa, dois botões:**
- **➕ Criar proposta:** abre a tela de proposta **numa aba nova**, já preenchida com os dados do lead, da Receita e do contato.
- **📄 Enviar / reenviar:** lista as propostas abertas do contato. A proposta precisa ter o **link público** gerado.

**O que o cliente recebe:**
- Quando a proposta tem **mais de um plano** (Pro e Plus), a mensagem mostra **as opções com a mensalidade de cada uma** e marca o recomendado. Os botões são **Aceitar Farma Pro**, **Aceitar Farma Plus** e **Tenho dúvidas**. Com um plano só, o botão é **Aceitar proposta**.
- **Aceitar:** grava o plano escolhido com o valor certo, gera o contrato, fecha o lead e manda a entrada por **PIX** (ou o aviso do financeiro, se a chave PIX não estiver configurada). Também pede o nome, o CPF e o e-mail de quem vai assinar.
- **Tenho dúvidas:** a conversa vira prioridade crítica.

**Contrato e assinatura (ZapSign):**
1. Depois do aceite, o cliente manda **nome completo, CPF e e-mail** de quem vai assinar no WhatsApp. O CRM lê a resposta, preenche o contrato e, se faltar algo, pede só o que falta.
2. Com os dados completos, você recebe **"📄 Contrato pronto para conferir"**.
3. Em **Contratos**, confira e clique em **✍️ Enviar para assinatura** (e em **Confirmar: enviar agora**). O contrato é o **mesmo PDF de sempre**; o link vai para o **WhatsApp** e o **e-mail** do cliente.
4. Sem assinatura em **24 h**, o cliente recebe um lembrete; em **48 h**, você é avisada.
5. **Assinou:** a ZapSign avisa o CRM, que confere o status direto na ZapSign, marca como assinado, calcula a comissão, cria a implantação, avisa "novo contrato assinado" e agradece o cliente.
6. **Recusou:** você é avisada para corrigir. O caminho manual (Baixar PDF, Painel ZapSign, Marcar assinado) continua disponível.

**Follow-up automático (Luiz Felipe):** nos dias 2, 5 e 7, das 9h às 18h. Para assim que o cliente responder.

**Telefone da vendedora na proposta:** para a Jessica, é fixo **27 99752-1370**. O campo continua editável.

### 5.4 Demonstração marcada pelo lead

- O lead escolhe um horário livre: de segunda a sexta, 9h–12h e 14h–17h, 30 minutos, a partir de 2 horas depois da escolha.
- A reunião entra na agenda. O lead recebe o **lembrete 2 horas antes** e pode responder **remarcar**.

### 5.5 Aprovação de desconto pelo celular

- Desconto acima do limite (padrão **30%** da implantação) trava o envio da proposta pelo WhatsApp.
- Clique em **💸 Pedir aprovação do desconto**. A gestão recebe o resumo com **Aprovar** e **Recusar**.
- Com a aprovação, a proposta já pode ser enviada. Se o desconto aumentar depois, é preciso pedir de novo.
- O limite fica em Configurações. Com 0, não é preciso aprovação.

### 5.6 O que fazer agora

No topo da lista de conversas aparece a lista do que fazer agora. É só sugestão e não cria atividade. Da mais urgente para a menos:
- prioridade crítica;
- prazo estourado;
- demonstração de hoje;
- proposta aberta pelo cliente;
- fila sem dono.

### 5.7 IA de texto (Clarice) · ligada

A IA usa o **ChatGPT pago** (modelo `gpt-6-luna`). O **Grok** já está preparado para as tarefas simples e entra quando a chave da xAI for configurada.

- **✨ Resumir conversa** (painel): quem é, o que já foi falado, qual o próximo passo e uma possível venda adicional.
- **✨** ao lado do campo de texto: **sugere a resposta**, e você revisa antes de enviar.
- **Transcrição de áudio:** automática.
- **Tira-dúvidas automático** (ligado no modo **sempre**, só para leads):
  - responde dúvidas sobre o sistema com o guia comercial;
  - no máximo 3 respostas por dia por conversa;
  - não responde em conversa que tem dono, em que alguém da equipe já escreveu ou que está com a Caroline, o Julio ou o Luiz Felipe;
  - **nunca fala de preço ou desconto**.

### 5.8 IA Laya e o Caderno da Laya

- No painel da conversa, **🤖 IA Laya**: confirme ou corrija o segmento, a intenção e o risco de cancelamento, ou marque **Não comercial**. Cada confirmação ensina a Laya **na hora**.
- **Caderno da Laya** (Escritório virtual): tudo o que ela aprende fica escrito (regras, palavras típicas, casos difíceis, exemplos e acerto por tarefa), com cópia diária no servidor e botões para baixar. Se a Laya parar, o Caderno ensina outra IA.
- **Níveis por tarefa:** Aprendiz → Assistente (30 exemplos e 80% de acerto) → Titular (50 exemplos e mais de 90%). A partir de Assistente, ela **age sozinha**: preenche o ramo do lead, etiqueta Suporte ou Financeiro e avisa risco de cancelamento também para leads.
- **Meta:** 15 confirmações por dia. Às 17h dos dias úteis chega o lembrete "📓 Laya: hora de ensinar". O treino geral é em 14/10.

### 5.9 Pós-venda automático (Helena · desligado até você ligar)

- **Boas-vindas** quando o contrato for assinado. Nunca vai para lançamentos retroativos nem para contratos anteriores à data em que foi ligado.
- **Pesquisa de satisfação** 30 dias depois, com as opções Ótima, Regular e Ruim. **Ruim** vira aviso e prioridade crítica.

### 5.10 Campanhas pelo WhatsApp (Zequinha)

**Onde:** Configurações → Assistente → **Abrir Campanhas pelo WhatsApp**.

1. Escolha o público: **Leads parados** (15 a 180 dias sem movimento) ou **Clientes da base**. O público de clientes usa o DDD e os telefones do cadastro. Opcionalmente, filtre por segmento.
2. Escreva a mensagem. `{nome}` vira o primeiro nome.
3. Clique em **Ver quantos vão receber**, depois **Criar campanha** e **Sim, enviar**.
4. Saem cerca de 24 mensagens por hora, só em horário comercial. Quem responder **SAIR** não recebe mais. As campanhas contam no limite diário dos agentes (seção 5.12).

### 5.11 Escritório virtual

**Onde:** menu **Escritório virtual**.

Uma sala em 3D com os onze agentes trabalhando. Cada um tem uma mesa, um crachá e uma luz de status: 🟢 trabalhando (agiu nos últimos 10 minutos), 🟡 parado ou ⚪ desligado.

- **Clique no agente**, na sala ou no cartão: abre a **📅 Agenda** dele, com quem está falando, mensagem esperando sua aprovação, horários combinados ("chamar segunda de manhã"), quem parou de responder e quando ele volta a chamar.
- **Zoom:** botões **− / +** no canto da sala, ou **Ctrl + roda do mouse**, que aproxima no ponto do cursor, até 300%. Com zoom, **clique e arraste** para andar pela sala. **ajustar** volta ao normal.
- **Você no escritório:** a Jessica aparece como supervisora. Ande com as setas do teclado ou clicando no chão. Perto de uma mesa aparece um balão com **Agenda**, **Chamar à minha sala** e **Liberar**. **Reunir a equipe** leva todos para a sala de reunião.
- **Conversar (💬):** envie uma **instrução** (fica gravada e passa a valer nas respostas da IA daquele agente, ou de toda a equipe) ou uma **pergunta** (o agente responde com os dados dele). A Bia segue um roteiro fixo de botões: mudanças no fluxo dela são feitas no código.
- **Pesquisas da Sofia:** toda segunda às 8h, ou quando você clicar em **Pesquisar agora**. Foco em assuntos de **negócio** (impostos, reforma tributária, NFC-e, SNGPC, Farmácia Popular, custos), com fonte e sugestão de mensagem. No painel ficam as **3 últimas**. O botão **📓 Caderno da Sofia** mostra todas, por mês e dia, com busca, filtro por segmento e download.

| Agente | Função |
|---|---|
| Bia | Recepção: triagem de novos contatos (3 toques) e passagem para a Caroline |
| Lurdinha | Agenda: demonstrações marcadas e lembretes |
| Clarice | Tira-dúvidas com IA e transcrição de áudio |
| Luiz Felipe | Follow-up de propostas e retomada de propostas não assinadas |
| Zequinha | Campanhas pelo WhatsApp |
| Helena | Pós-venda: boas-vindas e pesquisa |
| Laya | IA que analisa as conversas e aprende (Caderno da Laya) |
| Marta | Assistente da gestão: comandos, avisos e aprovações |
| Sofia | Pesquisadora: assuntos do setor, com fontes (Caderno da Sofia) |
| Caroline | SDR: primeiro contato com os leads das campanhas e da triagem |
| Julio | Follow-up de leads: retoma a base, do mais novo para o mais antigo |

### 5.12 Caroline, Julio e Luiz Felipe: agentes que conversam

Os três conversam pela IA no WhatsApp da empresa, cada um com o próprio painel no Escritório virtual (liga/desliga, aprovar antes de enviar, fila e mensagens para aprovar).

**Caroline (SDR)**
1. **Leads de campanha:** no painel dela, cole um ou vários leads como vêm da plataforma ("Lead se Cadastrou em..."). Marque "Eu já mandei a mensagem de abertura" se você já chamou pelo celular. Clique em **Conferir** e depois em **Confirmar**. O lead nasce no CRM com a origem da campanha; se já existir, é vinculado, sem duplicar. Se o número (com ou sem o 9) **já está com a Caroline**, aparece 🔗 e o botão **completar cadastro**: ela ganha a empresa, o e-mail e a campanha, sem duplicar e sem mensagem nova.
2. **Leads da triagem:** recebe da Bia quem escolheu "Quero conhecer".
3. **Missão nº 1: o problema principal do cliente.** Fala pouco, uma pergunta por vez, na linguagem do cliente, sem travessão, e se apresenta como "Caroline, da equipe Prosystem". Só usa o guia comercial e nunca fala de preço. Pede o CNPJ só com a conversa avançada. Ouve áudios e vê fotos.
4. **Termômetro:** nota de 0 a 100 (dor principal até 35, momento de compra até 25, quem decide até 15, engajamento até 15, perfil até 10). Sem dor principal não passa de 59. A nota vira a temperatura do lead (80+ muito quente, 60+ quente, 35+ morno).
5. **Fim:** oferece a demonstração, passa para a vendedora com resumo ou encerra com gentileza. Dúvida fora do material: ela avisa você.

**Julio (follow-up de leads, começa segunda 28/09 às 9h)**
- Retoma os leads abertos com celular, **do mais novo para o mais antigo**, incluindo os que já têm vendedora. Pula quem tem proposta aberta, porque esses são do Luiz Felipe.
- Pergunta como está a rotina e **se já fechou com outro sistema**. Se já fechou, anota qual e por quê e encerra com a porta aberta.
- **Achou interesse** (nota 35+, botão "Quero saber mais" ou "Me chama depois"): a conversa **passa para a Caroline**.

**Luiz Felipe (propostas não assinadas, começa segunda 28/09 às 9h)**
- Retoma as propostas enviadas, visualizadas, em negociação ou expiradas, paradas há mais de 7 dias.
- Pergunta se o cliente avaliou, se ficou dúvida ou se já fechou com outro sistema. **Nunca negocia valores:** quem negocia é a consultora.

**Retomadas de quem não responde**
- Na 1ª e na 2ª tentativa, a mensagem é sutil, com um gancho do **dia a dia** (correria do balcão, SNGPC, Farmácia Popular, cadastro de produtos). Assuntos da atualidade só em follow-up de quem já conversou.
- Botões de um toque: **Quero saber mais** (interesse, nota 45), **Me chama depois** (interesse, nota 35) e **Agora não**. Na última tentativa vai também a imagem do material.
- **Me chama depois:** o agente oferece o **próximo dia útil de manhã ou à tarde** e chama no horário combinado (9h30 ou 14h30), lembrando o combinado.
- As retomadas só saem entre 9h e 11h30 e entre 14h e 17h.

**Nenhum lead fica esquecido**
- **Parou no meio da conversa:** depois de 1 dia útil, você recebe "⏸ Fulano parou de responder" e a retomada é programada (até 3 tentativas).
- **Mensagem de encerramento:** 2 dias úteis depois da 3ª tentativa sem resposta, sai uma última mensagem: viu a inscrição e não teve retorno, "quanto antes começar a mudança, antes você resolve as pendências", pergunta se ainda tem interesse e lista 2 ou 3 soluções do material do segmento, com os botões.
- **Sem resposta ao encerramento (5 dias úteis):** o Julio volta a chamar **a cada 30 dias**, até 3 ciclos. Depois disso, o lead vai para a vendedora ligar.

**Lead para a vendedora só no expediente (seg a sex, 8h30 às 17h)**
- Dentro do horário, entra em "Leads para Distribuir" na hora, com aviso.
- Fora do horário, o cliente ouve "A nossa consultora fala com você amanhã a partir das 8h30", e o lead entra na lista às 8h30 do próximo dia útil.

**Aprovar antes de enviar** (ligado nos três)
- Cada mensagem aparece para você **aprovar**, **ajustar** ou **🔄 Refazer**, com o campo opcional "o que mudar?".
- Refazer escreve outra versão na hora, diferente das descartadas.
- Os seus ajustes ensinam o seu tom para eles.
- Confirmar a temperatura na tabela do painel ensina a Laya.

**Proteção do número (o mais importante)**
- **Um limite único por dia** para os três agentes e as campanhas juntos: 15 primeiros contatos por dia nas duas primeiras semanas, depois até 30.
- Um contato de cada vez, com 4 a 9 minutos sorteados entre um e outro, e "digitando…" antes de cada mensagem.
- Só em horário comercial. Quem pede **SAIR** sai na hora.
- Três falhas seguidas: o agente pausa sozinho e avisa.
- Responder quem já está conversando e os contatos que chegam pela triagem não contam no limite.

**Economia de IA:** o painel da Caroline mostra quantas vezes a OpenAI, o Grok e a Laya foram usados hoje e em 7 dias, e quantos % das chamadas saíram sem custo.

---

## 6. Regras que valem para tudo

- Preço, desconto e contrato são decididos por pessoas. O assistente nunca promete valores.
- Atividade só existe quando alguém lança ou confirma. A exceção é a demonstração escolhida pelo próprio lead.
- **Uma pessoa assumiu a conversa, os agentes param.** Só ela responde, e a Laya continua aprendendo.
- Mensagens automáticas ficam na conversa, marcadas como do robô, da IA, da campanha, da cadência ou do agente que enviou.
- Contatos marcados como Equipe, Parceiro ou Fornecedor não recebem nada automático.
- Antes de qualquer mudança no banco, é feito um backup na VPS, em `/root/backups-deploy`.

---

## 7. Para a equipe técnica

- **Código:** GitHub `prosystemcomercial-JESSICA/crmcomercialprosystem`, branch `main`. Cada entrega é commitada e enviada antes de ir para o servidor.
- **Publicação:** VPS `comercial.prosystemnet.com`, pasta `/var/www/comercial-prosystem`, com pm2 `comercial-backend` (3011) e `comercial-frontend` (3010). A IA Laya roda no pm2 `laya` (local, porta 8765).
- **Chaves de IA:** `OPENAI_API_KEY` e `OPENAI_MODEL` ficam só no `.env` do servidor, nunca no GitHub. `XAI_API_KEY` entra no mesmo lugar quando existir.
- **Cópias diárias:** Caderno da Laya em `/root/laya-caderno`.
- **Documentos relacionados:**
  - `docs/comercial/base-conhecimento-comercial.md`: guia comercial, usado pela IA;
  - `docs/comercial/crm-assistente.html`: ideias e fluxos;
  - `docs/comercial/novidades-crm.html`: apresentação das novidades;
  - `docs/superpowers/specs/2026-09-25-assistente-fase1-design.md` e `docs/superpowers/specs/2026-09-25-caroline-sdr-design.md`: especificações.


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
