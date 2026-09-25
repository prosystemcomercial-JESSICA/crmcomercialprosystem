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
- **Suporte** e **Financeiro** recebem o contato do atendimento geral, *27 99779-8103*, e saem do funil.

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
1. **Leads de campanha:** no painel dela, cole um ou vários leads como vêm da plataforma ("Lead se Cadastrou em..."). Marque "Eu já mandei a mensagem de abertura" se você já chamou pelo celular. Clique em **Conferir** e depois em **Confirmar**. O lead nasce no CRM com a origem da campanha; se já existir, é vinculado, sem duplicar.
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
- **Sem resposta às 3 tentativas:** o Julio volta a chamar **a cada 30 dias**, até 3 ciclos. Depois disso, o lead vai para a vendedora ligar.

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
