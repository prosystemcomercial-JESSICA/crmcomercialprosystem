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
- **📄 Propostas do contato:** abre a lista das propostas do contato (não envia nada sozinho). Para mandar, clique em **Enviar para o cliente** no cartão da proposta: o texto, o link e os botões de aceite saem **uma vez** pelo WhatsApp. A proposta precisa ter o **link público** gerado. Clique repetido em menos de 1 minuto não manda de novo.
- **Enviar chave Pix:** manda, para qualquer contato, só o cartão **Copiar chave Pix** da empresa (sem valor). Use quando a chave não saiu automática ou o cliente pedir de novo.
  - As propostas **já aceitas** aparecem com o botão **Cobrar entrada (Pix)**: manda o valor da entrada e o botão **Copiar chave Pix** (Solution Desenvolvimento, CNPJ 09.559.678/0001-83). Use quando o cliente pedir a chave de novo ou ainda não tiver pago. Fica registrado no histórico da proposta.

**O que o cliente recebe:**
- Quando a proposta tem **mais de um plano** (Pro e Plus), a mensagem mostra **as opções com a mensalidade de cada uma** e marca o recomendado. Os botões são **Aceitar Farma Pro**, **Aceitar Farma Plus** e **Tenho dúvidas**. Com um plano só, o botão é **Aceitar proposta**.
- **Aceitar:** grava o plano escolhido com o valor certo, gera o contrato, fecha o lead e manda o valor da entrada com o botão **Copiar chave Pix** (ou o aviso do financeiro, se a chave PIX não estiver configurada). Também pede o nome, o CPF e o e-mail de quem vai assinar.
  - Se o cliente aceitar **pelo link** de uma proposta que foi pelo WhatsApp, ele recebe a mesma mensagem na conversa.
  - A chave e o **nome de quem recebe** ficam em Configurações → Assistente no WhatsApp. Se o botão não puder sair, a chave vai escrita.
- **Tenho dúvidas:** a conversa vira prioridade crítica.

**Contrato e assinatura (ZapSign):**

> **Atenção (23/10/2026):** a conta da ZapSign ainda não tem o **Plano de API**. Sem ele, "Enviar para assinatura" mostra "A ZapSign recusou… precisa do Plano de API". Enquanto isso, use **Baixar PDF** + **Painel ZapSign** e mande o link de assinatura ao cliente pelo WhatsApp.

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
- **Chaves de IA:** `OPENAI_API_KEY` e `OPENAI_MODEL` ficam só no `.env` do servidor, nunca no GitHub. A transcrição de áudio não usa chave: roda no próprio servidor (Whisper local, desde 29/10/2026). `XAI_API_KEY` entra no mesmo lugar quando existir.
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

### Atualização 29/09/2026: Heitor, o prospectador

**Para que serve:** trazer leads novos de drogarias, farmácias e padarias que ainda não conhecem a Prosystem.

**Como ligar**
1. Abra Escritório › painel do Heitor.
2. Toque em "Ligar o Heitor".
3. Para testar na hora, toque em "Buscar agora". Cada bairro leva alguns minutos.

**O que ele faz sozinho**
- Nos dias úteis, das 7h às 18h, faz uma busca por hora até chegar à cota do dia (padrão: 30 leads).
- Começa pela Grande Vitória e vai avançando, cidade por cidade e bairro por bairro. Depois vem o interior do Espírito Santo, os vizinhos (MG, RJ, BA) e as capitais.
- De cada estabelecimento, junta:
  - nota e avaliações no Google, telefone, endereço e horário;
  - site, Instagram, Facebook, LinkedIn e e-mail;
  - CNPJ, razão social e sócios da Receita. O sócio-administrador vira o responsável do lead.
- Só vira lead quem **tem WhatsApp**. Ele confere antes, sem mandar nenhuma mensagem.
- Ficam de fora:
  - redes grandes (Drogasil, Pague Menos, Pacheco etc.);
  - fechados;
  - o que não é drogaria, farmácia ou padaria;
  - quem já está no CRM (lead, cliente ou conversa).

**Quem manda a mensagem:** a Caroline.
- Ela se apresenta, diz em uma frase por que está chamando e pergunta se a pessoa é a responsável ou qual sistema usa.
- Ela nunca diz que o cliente se inscreveu.
- Esses leads vão por último na fila do dia, depois da campanha, das propostas e da base, e respeitam o limite do número.
- Também têm um teto próprio: "Abordagens por dia", padrão 15.
- Se a Caroline estiver no modo "aprovar antes de enviar", as mensagens aparecem para você aprovar.

**O que você acompanha no painel**
- Onde ele está (onda, cidade e bairro).
- Os números do dia.
- A lista de quem virou lead, quem ficou sem WhatsApp, quem já estava no CRM e quem é rede grande, com o motivo.
- Dá para mudar "Leads por dia", "Abordagens por dia" e os segmentos (drogarias e padarias).

**Atenção**
- Se a Caroline estiver desligada, o Heitor cadastra, mas ninguém manda a primeira mensagem.
- Se o WhatsApp da empresa cair, ele para e avisa no painel.

### Atualização 02/10/2026: contato do decisor passado pela loja

Quando quem atende na loja diz que a pessoa procurada não é dali e passa o WhatsApp do dono, do gerente ou de quem cuida do sistema:

1. O agente agradece e diz que vai falar direto com essa pessoa.
2. O CRM cadastra esse contato como **lead novo**, na campanha "Decisor indicado pela loja". O lead da loja continua no CRM e ganha uma observação com o nome e o número do decisor.
3. A Caroline começa a conversa com ele do zero. Ela conta que pegou o contato com a equipe da loja, nunca diz que ele se inscreveu, e respeita o limite e o horário do número.
4. Se o número já está em conversa com um agente, é de cliente ou está marcado para não falar com agentes, nada é criado. Fica só a anotação no lead da loja.

### Atualização 02/10/2026: cronômetro do técnico no Portal Técnico

1. **Começar:** em Portal Técnico › Implantações, escolha a etapa (Instalação, Conversão, Treinamento ou Correção pós-virada) e toque em **Play**. O relógio aparece no topo.
2. **Trocar de demanda:** é só dar Play em outra. A anterior pausa sozinha, e o tempo nunca conta em dobro.
3. **Outra atividade:** suporte, reunião ou tarefa interna. Use o botão **Outra atividade**, no topo.
4. **Demanda parada:** toque em **Espera** e escolha:
   - **aguardando programação** (com o Sinval);
   - **aguardando cliente**;
   - **processamento rodando** (uma importação, por exemplo; não conta como trabalho).
   Escreva o motivo. Quando resolver, marque **Resolvido** na aba Meu dia.
5. **Meu dia:** mostra o tempo trabalhado, o tempo dentro da jornada (8h às 18h; 7h em dia de virada), o aproveitamento e a hora extra. A gestão escolhe o técnico.
6. **Esqueceu o play ligado?** Ele fecha sozinho às 23h59, e a gestão corrige o horário.

### Atualização 02/10/2026: Portal de Implantação completo (substitui o Trello)

**Técnico (Portal Técnico):**
1. **Quadro:** as mesmas colunas do Trello. Arraste o card ou abra para ver tudo da demanda. **Serviços** fica numa aba própria e só recebe o serviço quando a vendedora move o card para "Em execução".
2. **Ficha de coleta:** preencha no lugar da descrição do Trello (tipo, máquinas, regime, contabilidade, contato, e-mail e WhatsApp para os avisos) e anexe a **tela do Suporte**.
3. **Checklist:** marque cada passo. O cliente acompanha o percentual: 30%, 50% e 80% geram aviso automático para ele.
4. **Virada:** na aba Virada e cobrança, toque em **Iniciar virada** (exige a tela do Suporte) e, ao terminar, em **Loja virada**. O sistema:
   - calcula o 1º vencimento;
   - avisa a gestão para lançar a cobrança;
   - manda ao cliente as boas-vindas com a data do vencimento, a confirmação do e-mail e a regra do boleto (enviado 10 dias antes; se não chegar, pedir até 24 horas antes pelo suporte).
5. **Treinamento:** 3 fases. Dê Play na fase, marque a data e toque em **Fase realizada**: o cliente recebe o resumo.
6. **Correções:** registre bugs e acertos depois da conversão ou da virada e dê Play na correção. A demanda só finaliza com tudo resolvido.
7. **Avisos:** o sino no topo toca quando chega aviso da gestão ou do Otávio.
8. **Dúvidas pelo WhatsApp:** mande mensagem para o número da empresa ("o que falta na Drogaria X?") e o Otávio responde com os dados reais.

**Gestão:**
- **Painel da implantação:** horas e aproveitamento por técnico, esperas e o que mais trava, prazos, viradas, horas por cliente e **cobranças a lançar** (botão "Cobrança lançada").
- **Prazos:** mude no card (aba Resumo) ou os padrões em Configurações.
- **Aviso para o técnico:** no card ou na aba Avisos (urgente também vai por WhatsApp). Mostra quando ele leu.
- **Configurações:**
  - nome e **WhatsApp do Sinval** (com ele preenchido, o Sinval recebe as pendências e o lembrete; sem ele, use o link das pendências);
  - jornada, avisos ao cliente, Otávio, agente de oferta e o **catálogo** de produtos e pacotes (o agente de oferta só liga com o catálogo preenchido).
- **Sinval:** pelo link das pendências (sem login), marca "Resolvido" e o técnico é avisado na hora.

### Atualização 02/10/2026: clientes antigos e virada retroativa

- O quadro do Portal Técnico mostra só as demandas dos **últimos 60 dias**.
- Clientes com contrato antes de 02/10/2026 **não recebem nenhuma mensagem automática** do portal e não geram avisos.
- **Virada retroativa:** abra o card, aba Virada e cobrança, escolha a data em que a loja começou a usar e toque em **Lançar virada retroativa**. O 1º vencimento e o mês da comissão saem dessa data, sem mensagem ao cliente.
- Os avisos de prazo e de demanda sem técnico chegam no seu WhatsApp num **único resumo**, e não um por demanda.

### Atualização 02/10/2026: endereço curto da TV

Para abrir a TV do Escritório no navegador do monitor ou da TV, digite o endereço curto `comercial.prosystemnet.com/t/<código>`. O endereço aparece em Configurações › Painel da TV, com o botão "Trocar código".

### Atualização 02/10/2026: TV no monitor Samsung

Se o navegador do monitor não abrir o endereço normal, use o endereço pelo IP: `http://179.199.134.177:3010/t/<código>` (o código está em Configurações › Painel da TV).

### Atualização 02/10/2026: mensagens de serviço

Nos serviços, o cliente recebe só "recebemos o seu pedido e ele já está na fila do técnico", sem boas-vindas. O tempo dedicado só aparece quando já houve trabalho registrado.

### Atualização 02/10/2026: página Início do Portal Técnico

- O Portal Técnico abre na página **Início**: frase do dia, como está o dia do técnico, **tarefas**, **recados** e o que **pede atenção agora**.
- **Gestão:** no fim da página Início, crie uma **tarefa avulsa** (com prazo) ou um **recado** para o técnico. Marque "urgente" para ele receber também no WhatsApp.
- **Técnico:** toque no círculo da tarefa para concluir e no "Lido" para marcar o recado.
- As telas "Demandas (SLA)" e "Histórico de solicitações" do cliente foram escondidas: nunca tiveram dados. Use **Quadro** e **Serviços**.

### Atualização 02/10/2026: um quadro só

Implantações e serviços ficam no mesmo **Quadro**: use os botões **Tudo / Implantações / Serviços** no topo. No Início, clicar num item de "Pede atenção agora" abre a demanda. O portal ocupa a tela inteira em qualquer tamanho; no celular, o menu vira só ícones.

### Atualização 02/10/2026: sino de novidades

No topo do Portal Técnico, o **sino** mostra o que chegou de novo: implantação nova, serviço novo, tarefa, recado e aviso de prazo. Ao abrir, tudo fica como lido e o número some. Toque num item para abrir a demanda.

### Atualização 02/10/2026: Onboarding técnico

Toda implantação nova começa pelo **Onboarding técnico** (Portal Técnico › Onboarding técnico): o técnico se apresenta, explica as etapas e os prazos, levanta o diagnóstico da loja (empresa, estrutura, equipamentos, fiscal, estoque, integrações, operação e treinamento) e pede a aprovação do cliente. O cliente aprova pela página de acompanhamento, com o nome completo; o botão "Copiar link para o cliente aprovar" fica na ficha da demanda. Prazo: 2 dias úteis. **Até concluir, nada mais da implantação é liberado.**

### Atualização 02/10/2026: perguntas do primeiro contato

Na aba **Onboarding técnico** da demanda, o técnico responde as 15 perguntas principais durante a conversa com o cliente: máquinas, faturamento, caixas, impressora NFC-e, etiquetas, colaboradores, PBMs, financeiro, corretor tributário, gerencial, SNGPC, comunicação, banco único, preço único e TEF. Sem as 15 respondidas, o onboarding não conclui.

### Atualização 26/10/2026: onboarding por segmento

O onboarding e o checklist seguem o **segmento do cadastro do cliente** e o **tipo** (banco zerado ou conversão):

- **Farmácia** (farmácia, drogaria, manipulação ou cliente sem segmento): igual a antes, 15 perguntas.
- **Varejo e Padaria:** 13 perguntas (sem PBMs e SNGPC); sem Farmácias APP, SNGPC, PBM e prescritores no checklist.
- **Banco zerado:** sem a parte de conversão e sem a aba Testes de conversão.

O cabeçalho do card mostra o perfil (ex.: "Implantação · Varejo · banco zerado"). **Se aparecer item que não faz sentido, confira o segmento no cadastro do cliente.** Se trocar banco zerado ↔ conversão na ficha de coleta, o checklist se ajusta sozinho (item já marcado nunca sai).

### Atualização 02/10/2026: técnicos e recados no Portal Técnico

- **Técnico entra direto no Portal Técnico** e não vê o resto do CRM. Para sair, usa o botão **Sair** no canto da tela.
- **Para o técnico receber um card**, abra o card no Quadro e escolha o **Técnico responsável**. Técnico novo cadastrado em Usuários (ativo, cargo de técnico) já aparece na lista.
- **O técnico só vê recados dos cards que são dele.**
- **Recado lido de verdade:** o técnico toca no recado, lê no popup e toca em **Confirmo que li**. Na página Início, a supervisão acompanha em **Leitura dos recados** quem já confirmou e quando.

### Atualização 02/10/2026: ficha do cliente no card

- Ao abrir um card no Portal Técnico, o **nome e o telefone do contato** aparecem em destaque no topo, com botões **Ligar** e **WhatsApp**, junto com o **tipo da demanda**.
- A aba **Ficha do cliente** traz todos os dados do cadastro (empresa, contatos, endereço, observações), **sem nada financeiro**.
- O portal passou a mostrar só o que entrou **a partir de 02/10/2026**. O que é anterior continua guardado no CRM, só não aparece no portal.

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

### Atualização 03/10/2026: primeiro contato (onboarding) concentrado no card

- Implantação com onboarding pendente: o card **já abre na aba Onboarding técnico** (uma vez por abertura; o técnico pode trocar de aba) e mostra no topo a faixa **"Primeiro contato pendente"** com o progresso (X de Y itens) e o botão **Iniciar/Continuar primeiro contato**. A faixa some quando o onboarding fica concluído.
- O item **Onboarding técnico** do menu do portal agora é só da supervisão (visão geral de todas as implantações). O técnico faz o onboarding dentro do card.
- Serviços não têm onboarding (continua igual).

### Atualização 03/10/2026: Portal Técnico conduz o próximo passo

- **Técnico:** ao abrir o card, a faixa **Próximo passo** diz o que fazer. **Começar agora** já liga o cronômetro na etapa certa; **Pedir validação** envia para a supervisão quando tudo estiver pronto.
- **Pré-requisitos:** a virada só começa com onboarding, ficha de coleta, certificado, backup (e conversão, quando houver) e tela do Suporte; "Loja virada" pede a NFC-e emitida em operação. O card mostra o que falta.
- **Supervisão:** designa vendo a carga de cada técnico, valida, devolve com recado ou finaliza direto da faixa; pode liberar a virada com pendências (fica no histórico). A carga da equipe aparece no topo do Quadro.
- **Busca:** Ctrl+K (ou o botão Buscar) acha qualquer card por cliente, CNPJ, técnico ou vendedor.

### Atualização 03/10/2026: agenda, operação assistida e modelos no Portal Técnico

- **Agendar a virada:** na aba Virada do card, escolha data, hora e duração. O cliente recebe a data no WhatsApp e um lembrete no dia útil anterior. Remarcar pede o motivo. Ao marcar a data de uma fase do treinamento, o cliente também é avisado.
- **Agenda:** o Início mostra as viradas e os treinamentos dos próximos 14 dias (a supervisão vê a equipe toda).
- **Operação assistida:** nos 5 dias úteis depois da virada, o técnico registra todo dia se vendas, NFC-e e estoque estão ok. Problema vira correção no card. A validação só libera com os 5 dias checados.
- **Modelos de checklist:** em Configurações, a supervisão monta o checklist por segmento (farmácia, padaria, varejo...) e os itens extras por sistema de origem da conversão.
- **Quadro coerente:** a coluna acompanha os marcos (loja virada não volta para Em andamento, por exemplo).

### Atualização 03/10/2026: tarefas do cliente, saúde do card e passagem ao suporte

- **Tarefas do cliente:** na designação, a implantação já pede ao cliente o certificado, os XMLs e a lista de usuários (lista editável em Configurações). O cliente recebe o link no WhatsApp e envia pela página de acompanhamento; é lembrado se atrasar. O técnico confere no card (Cliente › Tarefas do cliente) e pode pedir reenvio.
- **Saúde do card:** ponto verde, amarelo ou vermelho no Quadro, com o motivo. O filtro **Em risco** mostra só o que precisa de atenção.
- **Passagem ao suporte:** ao validar, o resumo da implantação vai para os tickets do cliente, e a pesquisa de satisfação sai sozinha 2 dias úteis depois.
- **Card:** as abas agora ficam em 5 grupos (Visão geral, Cliente, Execução, Conversa, Tempos).
- **Quadro:** além do Kanban, as vistas Lista, Calendário e Equipe (a última só para a supervisão).

### Atualização 05/10/2026: coluna Interessados no WhatsApp

- Na vista **Por fase** do WhatsApp, a coluna **Interessados** reúne sozinha os contatos que demonstraram interesse (intenção de comprar ou temperatura morna para cima) e mandaram mensagem nos últimos 7 dias. Ela atualiza a cada 10 minutos; quem a equipe já moveu para outra fase não é mexido.

### Atualização 05/10/2026: Portal Técnico completo

- **Indicadores:** no Painel da implantação, os números do mês (dias até a virada, viradas no prazo, espera por causa, retrabalho, horas por implantação, satisfação, remarcações) com a comparação com o mês anterior e o detalhe por técnico. Metas em Configurações.
- **Prazo justo:** o tempo esperando o cliente não conta contra o técnico.
- **Início:** o técnico vê as horas do dia e "Sua vez"; a supervisão vê 4 números que pedem ação.
- **Quadro:** cartões mais limpos, filtros Meus / Virada esta semana / Esperando cliente, Finalizado e Cancelados recolhidos.
- **Card:** linha de marcos no topo e, no celular, Ligar, WhatsApp e Play fixos no rodapé.
- **Sino:** novidades agrupadas por card e escolha do que chega também no WhatsApp.

### Atualização 05/10/2026: arquivos dos clientes no backup

- Os arquivos que os clientes enviam pelo portal (certificado, XMLs, listas) entram em todos os backups do servidor e seguem para o computador e o MEGA. Se a cópia falhar, a gestão é avisada no WhatsApp.

### Atualização 05/10/2026: card mais completo

- **Testes de conversão** voltaram ao card (Execução). Na conversão, a virada só libera com os testes conferidos.
- **Arquivos e links** do card (Cliente › Arquivos), até 15 MB.
- **Inventário técnico** da loja (equipamentos e IDs de acesso remoto, nunca senhas), que o suporte também vê nos tickets.
- **Treinamento comprovado**: o cliente confirma pela página quem participou de cada fase.
- **Indicadores** podem ser exportados em planilha.

### Atualização 05/10/2026: termo de aceite e relatório final

- Ao **validar** a implantação, o cliente (decisor) recebe o **termo de aceite** para assinar pelo ZapSign. A assinatura volta sozinha para o card. Sem decisor ou contato, a supervisão envia depois pelo próprio card.
- O **relatório final em PDF** (o que foi feito, testes, treinamento, equipamentos e contato do suporte) fica no card e na página do cliente.

### Atualização 05/10/2026: pós-implantação e Google Agenda

- Aos **30, 60 e 90 dias** depois da virada, o técnico recebe a tarefa de ligar para a loja e registra a conversa no Início. Nota baixa ou loja sem usar o sistema avisa a supervisão e entra no radar de retenção.
- Viradas agendadas e treinamentos marcados entram sozinhos no **Google Agenda** do técnico (pela agenda da empresa conectada ao CRM).

### Atualização 05/10/2026: conversas de parceria de revenda

- Conversa de parceria, revenda ou representação: identifique o contato como **Parceiro** no Inbox (botão Identificar). Assim os agentes param de agir, a reunião não recebe lembrete de "demonstração" e a revisão do Rafael não trata a pessoa como lead.

### Atualização 05/10/2026: apresentação de padaria

- Link para mandar aos leads de padaria: https://comercial.prosystemnet.com/apresentacao/padaria
- No WhatsApp do CRM, no painel lateral da conversa, o bloco **Apresentação** tem o botão **Enviar apresentação · Padarias**: a mensagem vem pronta com o nome do contato, dá para ajustar e enviar.

### Atualização 05/10/2026: leads da apresentação de padaria

- Quem preenche o formulário da apresentação de padaria entra no CRM como **lead quente**, em **Leads para distribuir**, com os dados que informou. A gestão recebe o aviso no WhatsApp na hora e a conversa desse cliente aparece com prioridade crítica.

### Atualização 05/10/2026: apresentações de farmácia e do sistema

- Farmácia: https://comercial.prosystemnet.com/apresentacao/farmacia (PDF: https://comercial.prosystemnet.com/apresentacao/farmacia/apresentacao-prosystem.pdf)
- Sistema (varejo em geral): https://comercial.prosystemnet.com/apresentacao/sistema
- No WhatsApp do CRM, o bloco **Apresentação** tem os botões de cada uma, com a mensagem pronta.
- Atalho mais rápido: no campo de mensagem da conversa, toque no botão com ícone de tela (ao lado do ✨), escolha a apresentação, confira a mensagem e toque em **Enviar no WhatsApp**.

### Atualização 05/10/2026: os agentes mandam a apresentação

- A **Caroline** e o **Julio** mandam a apresentação do segmento (padaria para padaria, farmácia para farmácia) já no primeiro contato, com um convite do tipo "estamos aqui para te mostrar como o Prosystem vai adiantar a sua vida na farmácia".
- Quem já foi contatado e ainda não recebeu ganha **uma** retomada com o link, no contexto da conversa e sem cobrar. Sai uma por vez, até 20 por dia, nos horários de retomada. Se a aprovação estiver ligada, ela aparece para você aprovar como as outras retomadas.
- A **Bia** manda o link junto com o material no fim da triagem.
- Ninguém recebe a apresentação duas vezes: se o link já está na conversa (enviado por um agente, pela Bia ou por você pelo botão), não vai de novo.
- Ficam de fora: proposta em acompanhamento (Luiz Felipe) e o primeiro contato de prospecção ou indicação. Nesses dois, o link sai quando o cliente responder.

### Atualização 05/10/2026: nova demanda no WhatsApp do técnico

- Ao designar uma demanda no Portal Técnico, o técnico recebe na hora no WhatsApp dele: "🆕 Nova demanda", o cliente, o tipo e o link do portal.
- O celular usado é o do cadastro do técnico em **Usuários**. Se estiver sem telefone, o portal avisa você na hora: coloque o celular e designe de novo.
- Se o técnico desligou o WhatsApp nas preferências do portal, ele vê só no portal (e você é avisada).

### Atualização 06/10/2026: Prints e Histórico do card

- **Prints:** no card, abra **Prints**. Escolha a categoria (Print do suporte, Conversa, Aviso ou Outro) e cole com **Ctrl+V**, ou toque em **Colar print** / **Escolher imagens**. Escreva a observação de cada print e salve. Para mudar a observação, toque no lápis; para tirar, na lixeira (fica guardado na Auditoria, módulo Portal Técnico).
- **Histórico do card:** em **Histórico**, tudo o que aconteceu na demanda, por dia: quando começou, cada pausa e o motivo, esperas, recados, observações e prints. No topo, escreva uma observação e, se quiser, cole um print junto.
- **Pausar:** agora o cronômetro pergunta o motivo (um toque). Esperando cliente ou programação? Use **Espera**, não pausa.

### Atualização 06/10/2026: a equipe de agentes trabalha junto

- Os agentes agora têm um **mural da equipe** que não se perde: quem passa um cliente para outro passa junto o que sabe (Bia e Julio para a Caroline), as dúvidas sobem para o **Rafael**, e o que deu certo ou errado vira experiência para todos.
- Todo dia útil, entre 8h e 10h, o **Rafael faz a reunião da equipe**: tira os aprendizados do dia, orienta quem precisa e responde as dúvidas que sabe.
- Veja tudo em **Escritório › Mural da equipe** (com filtros). O botão **Reunião da equipe agora** faz o Rafael reunir a equipe na hora.
- Na página do sistema, a parte **Sua rotina antes e depois** brilha e mostra "Toque para comparar" até o cliente tocar; quando ele chega nela, a página já mostra sozinha a diferença uma vez.


### Atualização 06/10/2026: "O que fazer" no card do serviço

- Ao abrir um card de **serviço** (troca de CNPJ, comunicação, impressora, outros), a **Visão geral** começa com **O que fazer**: a tarefa em uma frase (ex.: "Realizar a troca de CNPJ de 27.829.030/0001-61 para 65.045.303/0001-76"), o CNPJ e a razão social antigos e novos, ou as lojas da comunicação, e **com quem falar**, com o telefone para ligar ou chamar no WhatsApp.
- Na **troca de CNPJ**, o card mostra lado a lado os **dados antigos** e os **dados novos** (CNPJ, razão social, fantasia, inscrição estadual, endereço, telefone e e-mail). Se o cadastro do CRM ainda estiver com o CNPJ antigo, aparece um aviso.
- Toque em **Copiar resumo** para colar o texto no WhatsApp ou no suporte.


### Atualização 06/10/2026: Dashboard de vendas para a base

- No módulo **Cross-sell**, a aba **📊 Dashboard** mostra tudo o que foi vendido para quem já é cliente: trocas de CNPJ, upgrades, comunicação, pacote fiscal e serviços.
- **MRR de expansão** é quanto a mensalidade da base aumentou com essas vendas. **Receita única** é o setup e os serviços cobrados uma vez. Os dois aparecem separados.
- Escolha o período (este ano, últimos 12 meses, este trimestre ou datas suas). Veja o mês a mês, o crescimento do MRR, o ranking dos serviços mais vendidos, os vendedores e as comissões (pagas e a pagar) e a lista de vendas com busca. **Exportar planilha** baixa a lista para o Excel.
- O CEO tem a página **Vendas para a base** no menu, com o mesmo painel.


### Atualização 06/10/2026: Painel da IA

- No menu, **Painel da IA** mostra tudo o que os 17 agentes do Escritório fizeram em **Hoje**, **7 dias** ou **30 dias**.
- **Funil dos agentes:** dos contatos novos às vendas fechadas, com a passagem de cada etapa, a origem dos leads e como a Caroline, o Julio e o Luiz Felipe estão indo (abordados, quem respondeu, demos).
- **Produtividade por agente:** quem está ligado, a última ação, mensagens, conversas, quanto os clientes responderam e as entregas de cada um.
- **Atendimento e horários:** tempo da 1ª resposta (agentes e pessoas), clientes sem resposta, mensagens por dia e o mapa dos horários em que os clientes mais chamam.
- **Equipe, qualidade e mercado:** mural e última reunião do Rafael, pós-venda e CSAT, implantações, Laya, pesquisas e documentos esperando sua aprovação.
- Uma faixa laranja **Agora** avisa se há conversa esperando resposta, conversa sem dono ou mensagem de agente para aprovar.


### Correção 06/10/2026: alertas de implantação no sino

- O sino deixou de avisar implantações antigas (de antes do recomeço do Portal Técnico, em 02/10/2026) como "atrasadas". Agora ele usa a mesma régua do portal: só demandas novas, conta a virada e a conclusão feitas no portal e pausa o prazo enquanto a loja não entrega o que precisa.


### Atualização 06/10/2026: Cross-sell & Up-sell no Painel do CEO

- No **Dashboard** (Painel do CEO), a aba **Cross-sell & Up-sell** traz todos os relatórios das vendas para a base: MRR de expansão, receita única, mês a mês, serviços mais vendidos, vendedores e comissões e a lista de vendas para exportar.


### Correção 06/10/2026: número sem WhatsApp

- Ao abrir uma conversa nova pelo número, o CRM confere antes se ele tem WhatsApp. Se não tiver, aparece: "Este número não tem WhatsApp. Confira o número com o cliente." (antes aparecia um erro técnico só na hora de enviar).
- Celular de DDD como 93, 31, 62… às vezes está no WhatsApp sem o 9 extra. O CRM descobre sozinho e usa a forma certa.


### Atualização 06/10/2026: Painel do CEO num lugar só

- O **Painel do CEO** (antigo Dashboard) abre no **Panorama**: receita recorrente, vendas novas, leads, base de clientes, cross-sell e up-sell e agentes de IA, cada bloco com um atalho para o detalhe.
- Pipeline, Metas e Análise comercial agora são abas do painel. A aba **Leads** mostra só os números (origem, etapas, conversão, vendedores, motivos de perda) — o CEO não precisa mais abrir a Central de Leads.
- **Cross-sell & Up-sell** tem tela própria no menu.


### Atualização 06/10/2026: Up-sell × Cross-sell e filtro por mês

- No fim do dashboard de vendas para a base, o bloco **Up-sell × Cross-sell** separa o que é **up-sell** (o cliente usa mais do sistema: upgrade de plano e mais lojas na comunicação) do que é **cross-sell** (compra outra coisa: pacote fiscal, TEF, troca de CNPJ, serviços), com números e gráfico mês a mês.
- No período, escolha **Por mês** e o mês na lista (ex.: "Setembro de 2026"): o painel mostra do dia 1 ao último dia daquele mês.


### Correção 06/10/2026: Fila de Chamados por atendente

- Em **WhatsApp › Fila de Chamados › Por atendente**, o quadro agora mostra todas as conversas, não só as da aba aberta: aparecem as colunas dos agentes, da triagem, de cada pessoa que assumiu conversas (ex.: **Jessica Cardoso**) e de **Sem dono**.


### Correção 06/10/2026: SDR nos casos de churn

- A SDR agora vê **Churn & Retenção** no menu e consegue registrar um caso novo e tratá-lo: atualizações, diagnóstico, plano de retenção e ações. Excluir continua só com o CEO.


### Correção 06/10/2026: cliente que ainda não pode

- Quando o cliente avisa que **o CNPJ ainda não saiu**, que **está viajando** ou que **a loja está abrindo**, os agentes não chamam no mesmo dia nem perguntam "já saiu?". Voltam só **3 a 4 dias depois**, com uma mensagem curta e humana, a **apresentação do segmento** (farmácia ou padaria) e o recado de que, assim que o CNPJ sair, montamos a proposta com o melhor preço possível.
- Toda a equipe de agentes recebeu a regra: **antes de qualquer mensagem, pesquisar como se comportar** (ler a conversa inteira, o combinado, suas instruções e os procedimentos aprovados).


### Atualização 06/10/2026: menu por setor

- O menu agora é organizado por setor, com o mais usado no topo: **Painéis**, **Atendimento & IA**, **Vendas**, **Clientes & Pós-venda**, **Técnico**, **Metas & Financeiro**, **Análises & TV** e **Administração**. Telas do mesmo assunto ficam juntas (ex.: Cross-sell e Cross-sell & Up-sell; Churn, Health Score e NPS). Ninguém ganhou nem perdeu acesso.


### Atualização 07/10/2026: Relatório de Retenção

- Em **Clientes & Pós-venda › Relatório de Retenção**:
  - **Motivos de saída:** o ranking de por que os clientes saem (fechou a loja, migração de rede, trocou de sistema, suporte, preço, inadimplência…), juntando os casos de churn e o histórico de inativações. Toque num motivo para ver como ele foi escrito. Dá para ver só os casos de churn ou só a base histórica, e exportar.
  - **LTV por cliente:** quanto cada cliente já pagou (mensalidades, instalação e vendas adicionais), tempo de casa, LTV por mês, LTV por segmento e por tempo de casa. Busca, filtros, ordenação e exportação para o Excel.


### Atualização 07/10/2026: quem saiu, ano a ano (LTV)

- No **LTV dos Clientes** (e na aba "Quem saiu, ano a ano" do Relatório de Retenção): compara quem saiu este ano com o ano passado (quantos, mensalidade perdida, tempo ativo médio e LTV médio), mostra as saídas mês a mês, os motivos e a lista de cada cliente que saiu — quando entrou, quando saiu, quanto tempo ficou e quanto pagou. Exporta para o Excel.
- O ano passado aparece pelos totais do Balanço 2025 (o CRM não tem a lista de quem saiu em 2025). Os clientes inativos sem data de saída entram sozinhos quando as datas forem preenchidas.


### Atualização 07/10/2026: formulário de captação de leads

- O formulário do site/blog manda o lead direto para o CRM: entra **Morno**, sem dono (em Leads para Distribuir), a gestão recebe um aviso no WhatsApp e a **Caroline faz o primeiro contato** entregando o que a pessoa pediu. Quem já é cliente ou já está em conversa não é chamado de novo.
- Guia para quem monta o formulário: `docs/comercial/formulario-captacao-leads.md`.


### Atualização 07/10/2026: mais números de WhatsApp

- Em **Configurações › Números de WhatsApp** ficam 5 vagas: o número principal (o de hoje), o **Número 2** (UAZAPI: cole o token da instância nova) e os **Números 3, 4 e 5** (API gratuita: clique em "Conectar pelo QR" e leia com o celular do chip novo em WhatsApp › Aparelhos conectados).
- Marque **"Usar na prospecção (rodízio)"** para o número entrar nos primeiros contatos dos agentes. Cada número começa devagar (10 por dia na 1ª semana, 20 na 2ª, 30 na 3ª e depois 40). O número principal continua com o atendimento, a Bia e os clientes.
- **Regra fixa:** o contato fica sempre no número que conversou com ele primeiro. Nenhum outro número chama ou responde esse contato (nem os agentes). Se o número dele estiver desconectado, a mensagem não sai por outro: reconecte o número.
- No Inbox, a conversa de um número extra tem a etiqueta roxa **📱** com o nome do número. Responder por ali já sai pelo número certo.
- Se um número falhar 3 vezes seguidas, ele sai do rodízio sozinho e a gestão recebe um aviso no WhatsApp.

### Atualização 14/10/2026: encerramento das propostas, agentes que leem a conversa e tela do WhatsApp

- **Luiz Felipe:** quem não responde às 3 tentativas recebe uma mensagem de encerramento: a proposta expirou, obrigado pela atenção, e os links do blog e do Instagram. Se o cliente ainda não tinha recebido a apresentação de padaria ou farmácia, ela vai junto. Se ele responder depois, o Luiz Felipe retoma a conversa.
- **Os agentes leem a conversa antes de escrever.** Param sozinhos, e você recebe um aviso 🛑 no WhatsApp, quando: alguém da equipe escreveu que o contato não deve mais ser chamado (vale também mensagem mandada pelo celular, ex.: "vou pedir para os consultores não te chamarem mais"); o cliente pediu para parar; ou a conversa é de quem já é cliente (técnicos, banco de dados, troca de endereço, cupom já saindo).
- **Tela do WhatsApp:** ao lado do título há uma bolinha para cada número. Passe o mouse (ou toque) para ver o número e se está conectado, conectando ou se caiu a conexão. O número completo e a conexão ficam em Configurações › Números de WhatsApp. As mensagens que a equipe envia agora aparecem em cinza claro.
- **Cabeçalho:** o alarme da reunião (5, 10, 15 ou 30 minutos antes) e o cronômetro ficam ao lado da lua, em cima.
- **Seu perfil:** no primeiro acesso aparece a janela para colocar a foto e conferir nome e telefone. Para mudar depois: menu do seu nome › **Meu perfil**, ou **Configurações** no menu lateral.
- **Tela do WhatsApp (tarde de 14/10):** no notebook e no tablet a conversa ganha mais espaço. O painel de atendimento abre pelo botão **ⓘ** quando a tela é menor, e os ícones de vincular, agendar, etiquetar, transferir e excluir ficam no menu **⋯ Mais**.


## WhatsApp: organização da interface (14/10/2026)

Na lista, use Nova para revelar o campo de telefone e Iniciar para abrir o atendimento. A busca e os filtros ficam junto às conversas. As apresentações ficam somente no ícone de monitor junto ao campo da mensagem: escolha o segmento, confira o texto e envie; o link ver continua disponível. O painel lateral não repete esse acesso. Sugerir resposta ajuda a escrever; Resumir conversa reúne o histórico e não envia mensagem. No cabeçalho, Mais ações reúne prioridade, etiquetas, vínculo, reunião e exclusão conforme as permissões. Detalhes pode ser fechado para ampliar o chat. Em telas menores, os detalhes abrem sobre a conversa; no celular, Voltar retorna à lista.


### Correção 14/10/2026 — isolamento ao trocar conversas

Ao trocar de contato, aguarde “Carregando conversa…” desaparecer para consultar o histórico. O campo de mensagem é limpo e uma gravação ainda em andamento é cancelada na troca. Se ocorrer falha, clique em “Tentar novamente”. Mensagens já enviadas continuam destinadas ao contato original e não são exibidas na nova conversa.

### Correção 14/10/2026 (noite): a fila de primeiros contatos voltou a andar

- **O que acontecia:** quando a primeira mensagem de um lead ficava esperando a sua aprovação, a fila inteira parava nele. Desde 05/10 quase nenhum lead novo foi chamado.
- **Agora:** quem espera aprovação fica de lado e a fila segue com os próximos, respeitando o limite do dia, o intervalo e o horário.
- **Aprovou e o número não tem WhatsApp?** O aviso aparece, a mensagem é descartada e o lead sai da fila sozinho (status Sem WhatsApp, com anotação no lead para conferir o telefone).
- **Robô da loja:** boas-vindas, "aguarde", folheto em imagem, "atendimento finalizado", "não precisa responder" e pesquisa de nota são reconhecidos como robô. O agente pede o contato do decisor ao atendente uma única vez e não conversa com o robô.
- **No painel da Caroline:** "Hoje: N primeiros contatos", o limite do número principal e quantas mensagens esperam sua aprovação. A contagem "Na fila" agora mostra o total real.

### Atualização 14/10/2026 (noite): aprovar o primeiro contato ou as retomadas, separadamente

- No painel da Caroline há duas caixas: **Aprovar o primeiro contato** e **Aprovar as retomadas**.
- Desde 14/10 o primeiro contato sai sozinho (decisão da Jessica), com as mesmas proteções do número: limite do dia, intervalo entre mensagens, horário e nada repetido. As retomadas continuam esperando sua aprovação.

### Atualização 14/10/2026 (noite): agentes com contexto e foco em quem decide

- **Os agentes leem a conversa inteira** (as últimas 40 mensagens e o começo dela) e recebem uma ficha com o que o lead já contou. Não perguntam de novo o que já sabem.
- **O foco é o porquê:** por que o lead procura outra solução e por que se inscreveu na campanha. Com isso claro, mostram como a Prosystem resolve e convidam para a demonstração.
- **Quem decide, já na primeira resposta:** no número geral da farmácia, o agente identifica se fala com o proprietário, o farmacêutico responsável ou o gerente. Se for o atendente, pede o nome e o WhatsApp de quem decide. O contato passado vira lead novo na fila.
- **Lead não é jogado fora:** se o atendente disser "não temos interesse", o agente não encerra; pede o contato de quem decide.
- **Ramo certo:** se a conversa mostra outro ramo (ex.: material de construção), o agente segue a conversa e não manda apresentação de outro segmento.
- **Robô da loja** aparece para o agente como mensagem automática, nunca como resposta do cliente.

### Correção 14/10/2026 (noite): IA recusando pedidos por causa de emoji

- Quando uma mensagem longa era cortada no meio de um emoji, a IA recusava o pedido inteiro. Era isso que derrubava o treino do Julio. Agora todo texto vai para a IA sem esses pedaços quebrados, e quando a IA recusar algo o aviso diz o motivo.


### WhatsApp compacto — 14/10/2026

Os filtros do WhatsApp agora ficam no nome acima da busca (por exemplo, Minhas ou Atenção). Clique para trocar a lista ou escolher o tipo de contato. A seleção continua visível após fechar o menu. Para retirar o tipo escolhido, abra o menu e use Remover filtro de tipo. Nova e busca permanecem à mão; a tela foi compactada para o zoom padrão de 100%.

### Novidade 14/10/2026 (noite): responder as perguntas do Rafael

- **Onde:** Escritório › Painel do Rafael › aba **Perguntas para você**. O botão do painel mostra quantas perguntas esperam você, e o aviso do WhatsApp traz um link que abre direto nelas.
- **O que aparece:** o que o Rafael precisa que você confirme (produto, preço, prazo, regra da casa) e as dúvidas de clientes que nenhum agente soube responder, com o contexto e, quando houver, o botão **Abrir conversa**.
- **Como responder:** escreva como explicaria para a equipe e toque em **Responder** (ou Ctrl+Enter). A resposta vale na hora para todos os agentes e vira fonte oficial no material deles. Se a pergunta não fizer sentido, use **Não se aplica**.
- **Juntar o que já foi perguntado:** o botão **Rafael: juntar perguntas dos documentos** faz ele reler os documentos dos últimos 30 dias e trazer para a lista tudo o que ficou "para confirmar".

### Atualização 14/10/2026 (noite): números extras para a prospecção do Heitor

- Os números extras (3 e 4, em rodízio) agora chamam primeiro os leads encontrados pelo Heitor; o número da empresa segue com campanhas, propostas e a base antiga do Julio. As duas frentes andam todo dia.
- O teto do Heitor subiu para 30 por dia, mas de forma controlada: cada número novo começa com 10 contatos por dia e sobe uma etapa por semana até 40.


## Fila de chamados mais compacta — 14/10/2026

No WhatsApp, abra **Fila de Chamados**. Use **Por atendente** para localizar quem está cuidando de cada conversa, ou **Por fase** para acompanhar o andamento. A busca por nome ou telefone fica no topo. Se houver um filtro de tipo vindo da lista, use **Remover filtro** para voltar a ver todos os tipos.

Clique no cartão (ou use Tab e Enter) para abrir a conversa. O número destacado indica mensagens não lidas. Prazo vencido e prioridade crítica aparecem em vermelho. A prioridade Normal e o nome do atendente repetido foram retirados dos cartões; em Por fase, o responsável continua aparecendo. Para mudar uma fase, arraste o cartão até a coluna desejada. No celular, deslize o quadro para os lados; cada coluna pode ser rolada para baixo.

### Novidade 14/10/2026 (noite): placar e nenhum interessado esquecido

- **Placar no topo do Escritório virtual:** primeiros contatos, respostas, interessados, demonstrações, propostas e contratos de hoje e da semana, comparados com a meta da semana do plano.
- **Interessado sem demonstração há mais de 48 h:** aparece no placar e no sino, com o link para a conversa. Chame ou peça para a consultora marcar.
- **Proposta em rascunho há mais de 1 dia:** aparece no sino de quem criou (e da gestão), com o atalho para enviar.
- **Resumo da manhã no WhatsApp:** nos dias úteis, entre 9h e 11h, só quando há algo parado.


## Aparência: Champagne e Branco gelo

Em **Configurações → Aparência**, escolha **Claro** ou **Escuro** e depois a paleta. **Champagne** combina fundos quentes com detalhes em bronze. **Branco gelo** combina superfícies frias e discretas. Azul Prosystem, Laranja e Verde continuam disponíveis. As miniaturas mostram a versão do modo escolhido. A mudança vale para fundos, painéis, menus e campos, mantendo cores de alerta.

A preferência é salva automaticamente neste navegador; não precisa usar Salvar configurações e não muda a aparência dos colegas. Para usar a mesma aparência em outro navegador/dispositivo, selecione novamente.

### Novidade 14/10/2026 (noite): Programa de Ativos com contatos do dia e indicação premiada

- **Contatos de hoje:** no topo de Ativos aparecem os 8 clientes da vez de cada vendedor: primeiro quem está em risco, depois quem nunca foi contatado, depois quem está parado há mais de 14 dias. Toque no nome para abrir o questionário. O sino lembra quantos faltam no dia.
- **Indicação premiada:** em todo contato, pergunte "Você conhece alguma farmácia ou loja que esteja procurando sistema? Posso falar que foi indicação sua?". No questionário, toque em **Registrar indicação** e informe nome e WhatsApp. A Caroline chama o indicado citando o cliente, e se fechar o cliente ganha 50% de desconto na próxima mensalidade.
- **Clientes sem grupo técnico:** em Designar fila, escolha "Clientes sem grupo técnico (em lotes)" e o tamanho do lote (80 clientes levam cerca de 2 semanas com 8 contatos por dia).
- **Placar:** os clientes contatados aparecem no placar do Escritório, com a meta do dia.

### Novidade 14/10/2026 (noite): página de captação, funil por origem e robô da loja

- **Página de captação:** `comercial.prosystemnet.com/conhecer`. Coloque no blog e nos anúncios um botão para ela; quem preenche vira lead no CRM e a Caroline chama no WhatsApp. No fim do link vai de onde a pessoa veio, por exemplo `?origem=blog&material=Guia do SNGPC`.
- **De onde vêm as vendas:** abaixo do placar do Escritório, abra o funil por origem para ver, por canal e campanha, quantos leads responderam, se interessaram, tiveram demonstração, proposta e contrato.
- **Robô da loja:** nenhum agente responde a mensagem automática. Quando só o robô respondeu, o agente espera a retomada e então escreve para a pessoa, pedindo o contato de quem decide.


### Menu menor e grupos recolhíveis

Clique no nome de um grupo (Painéis, Vendas etc.) para fechar ou abrir seus atalhos. No topo, o botão de recolher grupos fecha todos; clique novamente para abrir. O botão de recolher menu deixa somente ícones e libera espaço. Ao expandir, seus grupos permanecem como você deixou. As escolhas ficam salvas neste navegador e também valem no menu Mais do celular. O grupo fechado da tela atual continua marcado.

Em Configurações → Aparência, Azul intenso recupera um menu azul mais marcante, com versões clara e escura. Azul Prosystem continua disponível com superfícies neutras.


### Ao abrir o CRM e usar WhatsApp em outra aba

Os grupos do menu agora começam fechados a cada abertura ou recarregamento. Você pode abrir os que precisar durante o uso; essa revisão substitui a preferência anterior de guardar grupos abertos. O modo de largura do menu continua salvo. Ao lado da lua/sol, clique no ícone do WhatsApp para abrir o atendimento do CRM em uma nova aba, mantendo a tela atual. O atalho aparece para quem tem acesso ao WhatsApp.

### Novidade 14/10/2026 (noite): relatório de sexta e painel das indicações

- **Toda sexta, entre 16h e 18h,** chega no WhatsApp o resumo da semana: placar contra a meta, de onde vieram os leads, contatos de Ativos por pessoa e indicações.
- **Ativos › Indicações** (gestão): quem indicou, em que pé está cada indicado e os prêmios a aplicar. Quando o indicado fechar, lance o desconto de 50% no faturamento do cliente e toque em **Marcar desconto aplicado**.

### Correção 14/10/2026 (noite): concorrente disfarçado, mensagem repetida e despedida

- **Possível concorrente ou consultor:** se o nome do WhatsApp ou da empresa parece de sistemas, consultoria, mentoria ou marketing (ou lembra o nome Prosystem), você recebe um aviso e o agente confirma qual é a loja e a cidade antes de marcar qualquer coisa. Se não for loja, ele encerra com educação, sem demonstração, preço ou material.
- **Aprovar e enviar** não repete mais a mensagem, mesmo com cliques seguidos.
- **"Até", "tchau", "abs"** não recebem resposta do agente.

### Correção 15/10/2026: Portal Técnico e sessão vencida

- Se a sessão terminar (ou o portal for aberto num navegador sem login), o CRM leva direto para a tela de login, em vez de ficar parado em "Carregando…". Depois de entrar, o portal abre normal.

### Correção 15/10/2026: transcrição de áudios

- Áudios que não transcreviam ("O áudio não está disponível para transcrever"), principalmente nos números novos, agora transcrevem pelo botão e os agentes passam a entender os áudios dos clientes.

### Novidade 15/10/2026: retorno marcado com o cliente

- Quando você combina com o cliente "te chamo no dia X", o agente respeita essa data: não manda nenhuma retomada antes e, no dia, chama no contexto do que vocês conversaram (inclusive o que foi dito por áudio).
- Se o cliente responder só "ok", o retorno continua de pé. Se ele mandar outra coisa, a conversa é sua.
- Por enquanto, para marcar um retorno, peça ao Claude com a data e o combinado (ex.: "marque o retorno desse cliente para o dia 28, para ver se o CNPJ saiu").

### Novidade 15/10/2026: enviar clientes de churn ao CEO

1. Abra **Churn & Retenção** e toque na aba **📤 Exclusões (CEO)**.
2. Em **Selecionar e enviar ao CEO** aparecem os clientes perdidos que ainda não foram enviados. Marque os que devem sair (ou "Selecionar todos"), escreva uma observação se quiser e toque em **Enviar ao CEO**.
3. O CEO recebe no WhatsApp a lista com código, nome, CNPJ, mensalidade, valor devido e motivo, e um link para a mesma aba.
4. Em **Com o CEO**, ele (ou você, se ele avisar) marca **Retirado do suporte** e **Cobrança suspensa**. Com as duas marcadas, você recebe a confirmação no WhatsApp e o cliente vai para **Concluídos**.
- Só aparecem casos perdidos. Se o cliente ainda está em negociação, marque o caso como **Perdido** no Kanban primeiro.
- Tudo fica registrado na linha do tempo do caso e na ficha do cliente.
- **Quem pode enviar (15/10/2026):** você, o CEO e quem tiver "administrar" no módulo **Cancelamentos / Churn** em Usuários e Permissões (hoje, a Ana Clara). A Ana seleciona e envia; quem marca "Retirado do suporte" e "Cobrança suspensa" é o CEO ou a gestão.

### Novidade 15/10/2026: cliente pediu o valor

- O agente informa a faixa de mensalidade e já pede o que falta para montar a proposta: **CNPJ, e-mail e quantos computadores** a loja vai ter (e se é loja nova ou troca de sistema, se ainda não souber).
- Ele não pede de novo o que o cliente já mandou. Se o CNPJ ainda não saiu, ele não insiste.
- Quando o cliente manda os três, o agente agradece, diz que a consultora vai montar a proposta e passa o lead para a vendedora. Os dados já ficam no lead (CNPJ, e-mail do responsável e máquinas), então o formulário da proposta abre preenchido.
- **Duas opções de envio (15/10/2026):** depois de marcar os clientes, escolha:
  - **📄 Gerar relatório PDF**: baixa um relatório com o padrão visual da Prosystem, com resumo, total das mensalidades, valor devido, motivo, relato, financeiro e últimas observações de cada cliente, e caixas para marcar. Você posta no Teams para o CEO. Nenhum WhatsApp é enviado.
  - **📲 Enviar por WhatsApp**: o CEO recebe a lista no número dele.
  - Nos dois casos, os clientes vão para **Com o CEO** para as confirmações. Precisa do PDF de novo? Use **📄 Baixar relatório dos pendentes**.

### Correção 15/10/2026: transcrição dos áudios gravados no CRM

- Os áudios que você grava pelo CRM, que davam "Transcrição indisponível (HTTP 400)", agora transcrevem pelo botão "Transcrever áudio".

### Novidade 16/10/2026: Portal Técnico com a cara do CRM

- O Portal Técnico agora tem a mesma barra do topo e o mesmo menu lateral do CRM, com as mesmas cores, inclusive no modo escuro. A tela ficou mais sóbria, como a do WhatsApp.
- Tudo continua no mesmo lugar: Início, Quadro, Meu dia, Avisos, Tickets & SLA, Templates e Base de Conhecimento.
- No celular, toque em ☰ para abrir o menu.

### Correção 16/10/2026: nenhuma conversa fica sem resposta

- Os agentes não param mais de responder quando a resposta parece com algo que já disseram. Se travarem, pedem ajuda ao Rafael e aos colegas e tentam de novo a cada 10 minutos. Na segunda vez, você recebe "🆘 … travou na conversa de …" com o link para responder.
- Todos os agentes seguem o playbook da casa: conversa com começo, meio e fim, as respostas para as objeções mais comuns ("não sou o responsável", "já tenho sistema", "está caro", "agora não", "manda por e-mail"…) e técnicas de persuasão éticas.
- O Rafael, ao revisar as conversas, ensina o time ("quando o cliente disser X, responda Y"), orienta o agente de cada conversa com problema e faz o agente retomar na hora quem ficou sem resposta.
- Tocar numa notificação agora abre direto a conversa certa no WhatsApp do CRM.

### Atualização 19/10/2026: números em outra conta da UAZAPI (Números 2 e 6)

- Em **Configurações › Números de WhatsApp** agora há duas vagas UAZAPI extras: **Número 2** e **Número 6**. Elas podem ficar numa conta da UAZAPI diferente da do número principal, que continua conectado como está.
- Para conectar: no painel da UAZAPI da conta nova, clique em **Nova Instância**, leia o QR com o celular do número e copie o **token da instância**. No CRM, na vaga livre, cole o **Server URL** da conta (aparece no topo do painel, por exemplo `https://suaconta.uazapi.com`) e o token, e clique em **Conectar**. O CRM confere tudo e liga o recebimento de mensagens sozinho.
- Deixe o Server URL vazio só se a instância estiver na mesma conta do número principal.
- Depois de conectado, o número mostra a conta em que está. Para usá-lo na prospecção, marque **Usar na prospecção (rodízio)**: ele começa com 10 primeiros contatos por dia e sobe uma etapa por semana.

### Atualização 19/10/2026: agentes não perguntam mais "você é quem decide?" para quem nos procurou

- Quando o cliente procurou a Prosystem (WhatsApp, campanha ou site), os agentes tratam quem escreve como o interessado e não perguntam mais se ele é quem decide. Essa pergunta fica só para quando nós chamamos a loja (prospecção do Heitor) ou quando alguém passou o contato do dono.
- Se o cliente responde que ainda está procurando sistema, o agente já mostra que dá para ajudar, pergunta o que motivou a busca e oferece a demonstração com os horários livres.
- Os agentes também não repetem uma pergunta que já fizeram na conversa.

### Novidade 21/10/2026: Analista de Resultados (relatório de sexta)

- **Onde fica:** menu **Análises & TV › Analista de Resultados** (só gestão comercial). Toda sexta, às 16h, o relatório é montado sozinho e um resumo chega no WhatsApp indicado pela Jessica, com o link da página.
- **O que mostra:** números da semana e do mês; ações da próxima semana (marque "feito" conforme for fazendo); leads quentes, mornos e frios, com a chance de fechar, o motivo e o próximo passo; propostas paradas para reativar, com a soma da mensalidade; ranking dos retornos (por quem respondeu, agente, segmento, cidade, dia e hora); decisores conseguidos e retornos combinados que ficaram para trás; sistemas mais citados; o que trava as conversas e como converter mais; dados que faltam preencher.
- **Clique no nome do lead** para abrir a conversa no WhatsApp do CRM.
- **Gerar agora com os dados de hoje:** refaz o relatório da semana em 1 a 3 minutos (a IA lê as conversas). A página atualiza sozinha quando termina.
- **Imprimir ou salvar PDF:** para levar à reunião com a diretoria.
- **Semanas anteriores:** escolha no seletor ao lado dos botões.
- **Para a análise melhorar:** marque o resultado de cada demonstração na agenda, registre ligações como observação na conversa e preencha o sistema atual e o número de computadores dos leads.

### Atualização 21/10/2026: Health Score, NPS e Pesquisas saem do menu

- **Pedido da Jessica:** enxugar o CRM. Pesquisas e qualidade do atendimento ficam no CRM de atendimento; aqui o foco é o caso registrado no Churn & Retenção.
- **Menu (`components/dashboard/DashboardLayout.tsx`):** saem Health Score, NPS e Pesquisas do grupo Clientes & Pós-venda. O grupo fica: Clientes, Cross-sell, Cross-sell & Up-sell, Ativos (CS), Churn & Retenção, Relatório de Retenção.
- **Endereços antigos:** `/health-score`, `/nps` e `/pesquisas` levam direto para `/casos` (`redirect` do Next).
- **Atalhos:** o aviso "clientes em risco" do Dashboard abre `/casos`; saiu da tela de Churn o cartão "Saúde da carteira por técnico", que levava ao Health Score. Manual do CRM (`app/manual/page.tsx`) atualizado.
- **O que continua igual (de propósito):** nenhuma tabela ou dado apagado e nenhuma mudança de banco. As rotas do backend seguem no ar, porque alimentam outras telas: a pesquisa pública `/pesquisa` do fim da implantação (Portal Técnico) continua, e nota baixa continua abrindo caso de churn; abrir caso continua rebaixando o Health Score do cliente; NPS no Dashboard, no Panorama do CEO e na Análise Comercial; "Pesquisas de satisfação" na ficha do cliente; Pesquisas da Sofia (Escritório), que são pesquisas de mercado.

### Correção 21/10/2026: Previsão, Ciclo de Vendas e retomadas

- **Previsão de Fechamento** (Análises & TV › Previsão): agora mostra quantos contratos devem fechar, em três cenários, a partir das propostas abertas e dos leads quentes e mornos do Analista. Cada oportunidade aparece com a chance e o link. A meta do mês e o realizado vêm do módulo de contratos. Se aparecer o aviso de meta em reais, corrija a meta de contratos em **Metas** (número de contratos, ex.: 5).
- **Ciclo de Vendas:** mostra quanto tempo vai da entrada do lead até a proposta e até o contrato, nos contratos assinados desde junho. Para o número ficar preciso, crie a proposta no CRM quando enviar ao cliente e o contrato no dia da assinatura.
- **Retomadas dos agentes:** havia leads com retorno combinado que nunca eram chamados. Agora todos entram na vez, do mais atrasado ao menos. Como as retomadas passam pela sua aprovação, você deve ver mais mensagens em **Para você aprovar** nos próximos dias.

### Novidade 23/10/2026: comportamento do cliente na proposta

- Agora o CRM mostra o que o cliente faz com a proposta: quantas vezes abriu, quanto tempo ficou, por quais telas passou e se foi direto aos valores.
- Na tela **Propostas**, o selo roxo "👁 3× · 8 min" mostra as aberturas e o tempo. O "💲" quer dizer que ele foi direto aos valores.
- Abra a proposta para ver o painel **Comportamento do cliente**: um resumo em frases, onde o tempo foi gasto e, em "Tempo por tela, cada abertura e cliques", o caminho completo de cada abertura.
- Quando o cliente volta à proposta depois de um tempo, chega o aviso "voltou à proposta" no seu WhatsApp e no celular. É a melhor hora para chamar. Se você já tinha escolhido quais avisos receber, marque esse novo nas suas preferências.
- Só contam as aberturas do cliente. Quando você ou alguém da equipe abre o link no navegador com o CRM logado, não conta.
- Propostas abertas antes de 23/10 não têm esse histórico.

### Correção 23/10/2026: por que os números "caíram" em 22 e 23/10

- O problema não era a UAZAPI. De madrugada, o servidor instala sozinho atualizações de segurança e religa os programas. Ao religar, o CRM voltava a usar o endereço da conta antiga da UAZAPI (de antes de 19/10), que não reconhece os números novos. Por isso aparecia "Caiu a conexão" com tudo conectado no painel.
- Corrigido: o CRM agora sempre usa o endereço certo ao ligar, mesmo quando o servidor religa sozinho.
- Se mesmo assim aparecer "Caiu a conexão" com o painel da UAZAPI em "connected", avise: não é para acontecer mais.

### Correção 22/10/2026: número aparecendo "Caiu a conexão" sem ter caído

- Em 22/10, das 10h06 às 10h17, a UAZAPI recusou por alguns minutos os acessos do CRM, mesmo com os números conectados no painel dela. O CRM entendeu que os números tinham caído: mostrou "Caiu a conexão", segurou mensagens e não mandou alguns avisos.
- Agora, quando a UAZAPI falha, o CRM tenta de novo e mantém o número como estava. Só mostra "Caiu a conexão" se a falha durar mais de 15 minutos seguidos ou se a própria UAZAPI disser que o celular desconectou.
- O CRM também confere sozinho todos os números a cada 5 minutos. Não precisa abrir Configurações para o status voltar ao certo.
- Se aparecer "Caiu a conexão", confira no painel da UAZAPI. Se lá estiver "connected", espere até 5 minutos que o CRM se acerta sozinho.
- O **Número 4 (API gratuita)** continua desconectado de verdade: o celular dele (final 8103) agora está no Número 2. Falta você decidir se as conversas dele passam para o Número 2.

### Novidade 26/10/2026: pedir ao Rafael a análise de uma conversa

- Na conversa do WhatsApp, abra o menu **…** › **Pedir análise ao Rafael**. Se quiser, escreva o que ele deve olhar (ex.: "não houve fluxo de conversa").
- Em 1 a 2 minutos a análise aparece em **Escritório › Rafael**: onde o agente errou, mensagem por mensagem, como deveria ter sido e a regra para não repetir. A correção vai na hora para o agente e a lição para o time.
- **Regra nova dos agentes no contato ativo (lojas que nós chamamos):** primeiro se apresentam e entendem a loja; a demonstração só é oferecida depois que a pessoa conta uma dificuldade ou pede para ver o sistema. Confirmar o nome da loja não é interesse. Se perguntarem "com quem estou falando?", o agente se apresenta de novo, sem mandar horários.

### Novidade 26/10/2026: o que a implantação pede ao cliente

- O pedido inicial ao cliente agora é: **certificado digital A1** (arquivo .pfx; a senha o técnico pega por telefone), **código CSC da NFC-e**, **dados do contador** (nome, CPF ou CNPJ, CRC e e-mail), **regime tributário** e **inscrição estadual**. Não pede mais os XMLs nem a lista de usuários.
- Na página de acompanhamento, o cliente preenche cada item **campo a campo** (só o certificado é arquivo). A resposta aparece em Cliente › Tarefas do cliente, um campo por linha, e já preenche a ficha de coleta onde estava vazia.
- **Lista de usuários:** depois do primeiro contato, o técnico clica em **Pedir a lista de usuários** (Cliente › Tarefas do cliente). O cliente recebe no WhatsApp o link de um formulário com nome e função de cada pessoa, e a lista chega organizada no card.

### Novidade 26/10/2026: conversa desvinculada do funil fica sem agentes

- Quando você clica em **Desvincular do funil** (menu … da conversa) ou põe uma etiqueta que não é venda (Financeiro, Renegociação, Serviço, Parceiro, Pessoal, Suporte), **nenhum agente fala mais com esse contato**: nem o robô da triagem, nem a Caroline, o Julio ou o Luiz Felipe, nem a IA que tira dúvidas, nem os lembretes de demonstração. Vale também quando o contato escrever de novo.
- No topo da conversa aparece **"fora do funil, agentes desligados"**. As mensagens continuam chegando no Inbox normalmente; quem responde é a equipe.
- O contato também não volta sozinho para o funil quando escreve de novo.
- **Para pôr de volta no funil:** menu … › **Identificar** › **Lead**. A partir daí os agentes voltam a poder atuar.
- Se o contato responder "SAIR" de uma campanha, o pedido continua sendo respeitado.

### Atualização 26/10/2026: ficha da demanda confortável e campos confortáveis em todas as janelas

- **Pedido da Jessica:** as janelas de preenchimento, acompanhamento e checklist estavam compactas e difíceis de usar. Ela aprovou o protótipo (`docs/prototipos/ficha-demanda-confortavel.html`) com três decisões: manter a ordem das perguntas do primeiro contato; salvar sozinho e manter o botão de salvar como reforço; uso principal no computador, o dia todo, sempre no modo espaçoso (sem modo compacto).
- **No card de implantação:** as seções ficam no menu da esquerda; o que fazer agora e os telefones do cliente, à direita.
- **Perguntas do primeiro contato:** clique Sim ou Não, use − e + nos números e digite o resto. Não precisa salvar: aparece "Salvo automaticamente às…". O botão **Salvar respostas** continua lá, se quiser garantir. "Próxima sem resposta" leva direto à pergunta que falta.
- **Checklist:** clique em qualquer lugar da linha para marcar. "Esconder os itens já feitos" deixa só o que falta.
- **No resto do CRM:** os campos ficaram maiores e com borda visível.
- **Segunda leva (mesmo dia, "aplicar todos"):** a ficha do lead e a janela da proposta ficaram mais largas e com letras maiores; na ficha do lead o botão Salvar fica sempre à vista embaixo.

### Atualização 26/10/2026: etapa "Finalizado" nos casos de churn

- **Pedido da Jessica:** incluir a coluna **Finalizado (totalmente resolvido)** depois de "Aguardando exclusão do cadastro".
- **Status novo `FINALIZADO`:** última etapa do caso de churn. Só vale a partir de PERDIDO, SISTEMA_REMOVIDO ou AGUARDANDO_EXCLUSAO (o backend recusa vindo de outra etapa, com a mensagem "Só é possível finalizar um caso PERDIDO, com sistema removido ou aguardando exclusão"). Sem mudança de banco: `CasoChurn.status` é texto.
- **Lista única de status (`backend/src/lib/caso-churn-status.ts`):** `STATUS_CASO` (os 9 status, usado na validação do DTO e na transição), `STATUS_PERDA` (PERDIDO, SISTEMA_REMOVIDO, AGUARDANDO_EXCLUSAO, FINALIZADO) e `STATUS_ENCERRADO` (RECUPERADO + perdas). Antes cada arquivo repetia a lista.
- **Onde conta:** finalizado conta como **perda** nos gráficos de churn (`/casos-churn/graficos`), no painel do CEO (`/ceo`, perdidos e tempo de resolução), no gráfico do dashboard de retenção e no relatório de retenção (motivos de saída). Conta como **encerrado** na lista de casos (aparece mesmo com o cliente inativo), na antiduplicação ao abrir caso (no serviço e no módulo Ativos) e na pesquisa pós-implantação (que só abre caso se não houver um aberto). Correção junto: essas antiduplicações tratavam SISTEMA_REMOVIDO e AGUARDANDO_EXCLUSAO como "caso aberto"; agora usam `STATUS_ENCERRADO`.
- **Ficha do cliente:** ao finalizar, entra o evento "✅ Caso de churn finalizado" (uma vez).
- **Aba Exclusões (CEO):** os finalizados continuam na lista (`STATUS_LISTA_EXCLUSAO`), para o histórico do pedido não sumir; reenviar um finalizado não o volta para "Aguardando exclusão". `STATUS_PODE_ENVIAR` não mudou. PDF e lista mostram "Finalizado".
- **Tela Churn & Retenção (`frontend/app/casos/page.tsx`):** coluna **Finalizado** (verde, "Totalmente resolvido, nada pendente") no fim do Kanban, aceita arrastar; opção FINALIZADO no filtro de status e no seletor da linha (só em caso perdido); botão **✅ Finalizar caso** no dossiê de um caso aguardando exclusão; selo "Finalizado" no Radar. Teste: `backend/tests/caso-churn-status.test.ts`.
- **Como usar:** quando tudo de um cliente perdido estiver resolvido (cadastro excluído, cobrança suspensa, nada pendente), arraste o card para a coluna **Finalizado** no Kanban, escolha FINALIZADO no seletor da linha ou abra o caso e toque em **✅ Finalizar caso**. Se precisar, dá para voltar o caso para outra etapa.


### Atualização 26/10/2026 (2ª parte): Finalizado ligado às confirmações do CEO e card com a trilha do cancelamento

- **Pedido da Jessica:** "quando eu marcar esses dois checkbox, ele tem que ir para finalizado"; tirar do Kanban e deixar só em Concluídos (aba Exclusões); tirar as caixinhas dos concluídos "para não correr o risco de desmarcar"; no lugar, abrir o card com a trilha (fluxograma) e todas as informações do cliente.
- **Muda a 1ª parte do mesmo dia:** saíram a coluna Finalizado do Kanban, o botão "Finalizar caso" do dossiê e a opção FINALIZADO do seletor da linha e do filtro. Finalizado não é mais escolhido à mão na tela.
- **Automático com as duas confirmações:** em `marcarExclusao` (`backend/src/services/churn-exclusao.service.ts`), quando "Retirado do suporte" e "Cobrança suspensa" ficam marcados, o caso vai para `FINALIZADO` pelo `CasoChurnService.update` (linha do tempo "Status alterado: … → FINALIZADO" e evento "✅ Caso de churn finalizado" na ficha). Regra pura `statusAposConfirmacao` em `backend/src/lib/churn-exclusao.ts` (só a partir de PERDIDO, SISTEMA_REMOVIDO ou AGUARDANDO_EXCLUSAO). O aviso a quem enviou continua igual.
- **Definitivo:** caso finalizado não aceita mais desmarcar confirmação (o backend responde "Caso finalizado: as confirmações não podem mais ser mudadas."). O backend aceita voltar de FINALIZADO para AGUARDANDO_EXCLUSAO só por mudança de status manual (via API), não pela tela.
- **Fora do Kanban e da lista:** `CasoChurnService.list` esconde FINALIZADO quando não há filtro de status (Kanban, lista, Radar e exportação). Continua contando como perda nos gráficos, no painel do CEO e no relatório de retenção.
- **Aba Exclusões › Concluídos (`frontend/components/casos/ExclusaoCeo.tsx`):** sem caixinhas; cada linha mostra as datas de "Retirado do suporte" e "Cobrança suspensa" e o botão **📂 Abrir card**. A seção "Com o CEO" continua com as caixinhas.
- **Card da trilha (`frontend/components/casos/TrilhaCancelamento.tsx`, só leitura):** fluxograma de 7 etapas (Caso aberto, Cliente perdido, Sistema removido (opcional, "não se aplicou"), Enviado ao CEO, Retirado do suporte, Cobrança suspensa, Finalizado), com data e quem fez; quadro do cliente (cidade, segmento e plano, técnico, responsável, telefone, e-mail, cliente desde com tempo de casa, vencimento, mensalidade perdida, valor devido, inativado em, sistema removido em); quadro do caso (aberto e perdido em, financeiro, reaberto, motivo, relato, motivo da inativação, diagnóstico, observação financeira, renegociação, planos e ações de retenção, envio ao CEO); linha do tempo com as atualizações do caso e os eventos da ficha do cliente em ordem, com filtro Tudo / Caso de churn / Ficha do cliente. Fecha com Esc ou clicando fora. Conferido com fotos (1440 e 400px, dados fictícios).
- **Rota nova:** `GET /casos-churn/:id/trilha` (mesma permissão da aba Exclusões), serviço `trilhaCancelamento` e regra pura `etapasDoCancelamento` (data do Finalizado = a última das duas confirmações). `apiClient.getTrilhaCancelamento`.
- **Casos já concluídos antes desta mudança (7 em 26/10):** `backend/scripts/finalizar-exclusoes-concluidas.ts` (simulação; `--aplicar` aplica) passa para FINALIZADO os que já têm as duas confirmações, em nome de quem enviou ao CEO. Rodar na VPS depois do deploy.
- **Testes:** `backend/tests/caso-churn-status.test.ts` (regra do Finalizado e fluxograma). Sem mudança de banco.
- **Como usar (substitui o "Como usar" da 1ª parte):** em **Churn & Retenção › 📤 Exclusões (CEO)**, marque "Retirado do suporte" e "Cobrança suspensa" em "Com o CEO". Com as duas marcadas, o caso sai do Kanban e vai para **Concluídos**. Lá, toque em **📂 Abrir card** para ver o passo a passo do cancelamento, os dados do cliente e tudo o que foi registrado.

### Atualização 26/10/2026 (3ª parte): etiqueta "em observação" / "pediu cancelamento" e retorno marcado nos casos de churn

- **Pedido da Jessica:** marcar no card, de forma clara, os clientes em observação (bolinha azul piscando) e os que pediram o cancelamento de fato (bolinha vermelha), organizar o quadro por isso e marcar data de retorno (atividade, contato ou ação) com alerta, para ela mesma fazer ou designar a um colaborador.
- **Banco (aditivo, `CasoChurn`):** `situacao_pedido` (OBSERVACAO | CANCELAMENTO | nulo), `situacao_pedido_em`, `retorno_em`, `retorno_tipo` (CONTATO | ATIVIDADE | ACAO), `retorno_obs`, `retorno_responsavel_id`, `retorno_responsavel_nome`, `retorno_marcado_por`, `retorno_marcado_por_nome`, `retorno_avisado_em` e índice em `retorno_em`. Precisa do `ALTER TABLE` antes do deploy (lista no ESTADO.md).
- **Regras puras (`backend/src/lib/churn-retorno.ts`):** `estadoRetorno` (VENCIDO quando a hora passou; HOJE no mesmo dia de Brasília; FUTURO), `deveAvisarRetorno` (uma vez por retorno; remarcar zera o aviso), `destinatariosRetorno` (responsável e quem marcou, sem repetir), `textoRetorno`. Teste: `backend/tests/churn-retorno.test.ts`.
- **Serviço (`backend/src/services/churn-retorno.service.ts`):** `definirSituacaoPedido`, `marcarRetorno` (sem responsável escolhido, fica com quem marcou; designado a outra pessoa, ela recebe push na hora), `concluirRetorno` (registra "✅ … feito: <como foi>" na linha do tempo e limpa o retorno), `desmarcarRetorno`, `retornosMarcados` e `avisarRetornosChurn`. Toda mudança vai para a linha do tempo do caso (etiqueta como STATUS; retorno marcado como OBSERVACAO; retorno de contato feito como CONTATO). Caso encerrado não aceita retorno.
- **Rotas (`ROLES_TRATAM_CHURN`):** `PATCH /casos-churn/:id/situacao` `{ situacao }`, `PUT /casos-churn/:id/retorno` `{ em, tipo, obs?, responsavel_id? }`, `POST /casos-churn/:id/retorno/concluir` `{ texto? }`, `DELETE /casos-churn/:id/retorno`. Cliente: `apiClient.situacaoCaso`, `marcarRetornoCaso`, `concluirRetornoCaso`, `desmarcarRetornoCaso` e `getCaso`.
- **Aviso:** agendador `iniciarSchedulerRetornoChurn` em `server.ts` (a cada 5 min): retorno que chegou a hora manda push "⏰ Hora do retorno: <cliente>" para o responsável e quem marcou, com link `/casos?caso=<id>` (abre a ficha do caso). Sino de Alertas (`GET /alertas`): tipo `CHURN_RETORNO`, ALTA quando vencido e MÉDIA quando é para hoje; gestão vê todos, os demais só os seus; CEO não vê. Fica no sino até ser feito, remarcado ou desmarcado.
- **Tela Churn & Retenção (`frontend/app/casos/page.tsx`):** no card do Kanban, selo "● Em observação" (azul, bolinha piscando) ou "● Pediu cancelamento" (vermelho) e borda esquerda da mesma cor; chip do retorno ("📅 Retorno 29/10 16:42 · Bruno", amarelo quando é hoje, vermelho piscando quando venceu). Em cada coluna aberta, a ordem é: pediu cancelamento, em observação, retorno vencido e depois o risco. Acima do Kanban: filtros "Todos os casos · Pediu cancelamento · Em observação · Com retorno marcado · Retorno vencido" (com contagem; valem também para a tabela) e o quadro "⏰ Retornos para agora e para hoje" (toque abre o caso). Na ficha do caso (aberto): "🏷️ Situação do cliente" (Sem marcação / Em observação / Pediu cancelamento) e "📅 Próximo retorno" (data e hora, o que fazer, quem faz, observação; Marcar/Remarcar, "Como foi?" + ✅ Retorno feito, Desmarcar). Selo também na tabela e na Visão Executiva. Animação respeita "reduzir movimento". Conferido com fotos (1500 e 400px, dados fictícios).
- **Regras do projeto:** nenhuma atividade automática (o retorno é marcado por uma pessoa); casos antigos começam sem etiqueta e sem retorno.
- **Como usar:** em **Churn & Retenção**, abra o caso. Em "Situação do cliente", escolha **Em observação** ou **Pediu cancelamento**; o card ganha a bolinha azul (piscando) ou vermelha. Em "Próximo retorno", escolha data e hora, o que fazer e quem faz, e toque em **Marcar retorno**. Na hora marcada chega o aviso no celular e o retorno aparece no sino e no topo do Churn. Depois de falar com o cliente, escreva "Como foi?" e toque em **✅ Retorno feito**, ou remarque. Use os filtros acima do Kanban para ver só quem pediu cancelamento, só quem está em observação ou os retornos vencidos.

### Novidade 29/10/2026: transcrição de áudio sem custo

- Os áudios do WhatsApp agora são transcritos **no próprio servidor do CRM**, sem pagar a OpenAI. Nada muda no uso: o botão "Transcrever áudio" e a transcrição automática continuam iguais.
- Um áudio de 15 segundos leva cerca de 4 segundos para virar texto.
- Se aparecer "Transcritor local indisponível", o transcritor do servidor está parado: avise o suporte técnico (ele é reiniciado com `pm2 restart transcritor`). Enquanto isso, nada é cobrado.

### Atualização 29/10/2026: uso da IA por assistente (requisições, falhas e tokens)
- **Pedido da Jessica:** saber quantas requisições cada assistente faz à OpenAI ("preciso de controle total"). Antes só existia o total do dia (`ia.uso.AAAA-MM-DD`), todas as assistentes somadas.
- **Contagem:** cada requisição à OpenAI, ao Grok ou ao Whisper local registra quem pediu, se falhou e os tokens enviados e recebidos (`usage` da resposta). Fica em memória e é gravada pelo agendador junto com o total do dia, em `ConfiguracaoIntegracao` `ia.agentes.AAAA-MM-DD` = `{ "<assistente>": { openai, grok, whisper, falhas, tokens_entrada, tokens_saida } }`. Sem mudança de banco.
- **Quem pediu:** `chamarGemini` e `pesquisarComGemini` aceitam `agente`. Sem ele, vale o arquivo de serviço que chamou, lido da pilha antes de qualquer `await` (`lib/uso-ia-agentes.ts`, `agenteDaPilha`): assistente-ia = Clarice, especialista e equipe = Rafael, caroline, heitor, joana, analista-resultados = Analista, implantacao-portal = Portal, sofia-pesquisa = Sofia; arquivo novo aparece com o próprio nome; fora de serviço = "Outros". Explícitos: Caroline/Julio/Luiz Felipe (`agenteDe(sdr)`), Olívia e Mila (pesquisas), conversa no Escritório (`conversa-<agente>`), áudio = "Transcrição de áudio".
- **Falha:** a IA não respondeu (tempo esgotado, rede) ou devolveu erro HTTP. A requisição conta mesmo assim.
- **Tela:** `GET /relatorios/desempenho` devolve `ia.por_agente` (uma linha por assistente no período, quem mais usou a OpenAI primeiro). Em `/desempenho` e na janela "Métricas da IA" do Escritório: barras "Requisições à OpenAI (paga) por assistente" e tabela "Uso da IA por assistente" (OpenAI, Grok, Whisper, falhas, tokens enviados e recebidos).
- **Limite:** os dias antes de 29/10/2026 não têm a divisão por assistente (só o total). Chamadas ao Gemini (legado, sem uso hoje) não entram na divisão.
- **Testes:** `backend/tests/uso-ia-agentes.test.ts`.
- **Para a Jessica:** em **Desempenho do setor** (ou Escritório › Métricas da IA), escolha o período e veja "Uso da IA por assistente": quantas vezes cada uma chamou a OpenAI (paga), o Grok e o transcritor grátis, quantas falharam e quantos tokens gastou. A contagem por assistente começou em 29/10/2026.

### Atualização 29/10/2026: Groq grátis na frente das IAs pagas (economizar antes) e medição do uso

- **Pedido da Jessica:** "preciso que ele entre antes de gastar os tokens pagos; meu intuito é economizar antes".
- **Ordem nova da IA de texto** (`services/ia-gemini.service.ts`, `tentarGroq`): todo pedido só de texto e sem busca na internet tenta primeiro o **Groq** (`GROQ_API_KEY` no `.env` do servidor, modelo `GROQ_MODEL`, padrão `openai/gpt-oss-120b`, `reasoning_effort` `GROQ_RACIOCINIO`, padrão `low`). Só se ele não der conta segue o caminho de sempre: Grok (tarefas simples) → OpenAI → Gemini. Imagem, PDF, áudio (Whisper local) e as pesquisas com busca (Sofia, Rafael, Olívia, Mila) não passam pelo Groq.
- **Quando o Groq é pulado** (`lib/ia-groq.ts`, regras puras com testes em `tests/ia-groq.test.ts`): pedido estimado acima de `GROQ_MAX_ENTRADA` tokens (padrão 5000; ~3 caracteres por token), cota por minuto lida há menos de 1 minuto sem espaço, ou bloqueio depois de um 429 (`retry-after`, padrão 1 minuto) ou da cota do dia zerada (até `x-ratelimit-reset-requests`). `GROQ_FORA=caroline,rafael` tira assistentes do Groq se a qualidade não servir. Falha do Groq nunca derruba o pedido: ele cai na IA paga.
- **Cota da conta (teste de 29/10/2026):** `openai/gpt-oss-120b` com 1.000 pedidos por dia e 8.000 tokens por minuto. A Llama 3.3 não está liberada na conta.
- **Medição:** `ia.uso.AAAA-MM-DD` ganha `groq`; `ia.agentes.AAAA-MM-DD` ganha por assistente `groq` (respondidas), `groq_reserva` (o Groq não deu conta e o pedido foi para a paga) e `groq_tokens`. A última cota lida dos cabeçalhos `x-ratelimit-*` fica em memória e é gravada em `ConfiguracaoIntegracao` `ia.groq.cota`. Sem mudança de banco.
- **Tela:** `GET /relatorios/desempenho` devolve `ia.groq` (`respondidas`, `foram_para_paga`, `tokens`, `cota`, `ligado`) e `groq` em `ia.por_dia`/`ia.total`; "IA sem custo" passa a contar Laya + Groq. Em `/desempenho` e em Escritório › Métricas da IA: cartão "Groq (grátis) respondeu" (tokens sem custo, idas para a paga, cota restante do dia), colunas "Respostas do Groq (grátis) por dia" e, na tabela "Uso da IA por assistente", as colunas "Groq (grátis)" e "Groq → paga". Os cartões do Groq só aparecem com a chave configurada.
- **Privacidade:** o Groq informa que não usa os dados da API para treinar modelos. A chave fica só no `.env` do servidor.
- **Para a Jessica:** a IA agora tenta primeiro o Groq, que é grátis; a paga só entra quando ele não consegue. Em **Desempenho do setor** (ou Escritório › Métricas da IA) o cartão "Groq (grátis) respondeu" mostra quantas respostas saíram de graça, quantas tiveram de ir para a paga e quanto ainda sobra da cota do dia.

### Atualização 29/10/2026: Configurações › Modelos de IA (modelo principal e reserva por assistente) e Gemini ligado

- **Pedido da Jessica:** um painel em Configurações, como o de outro sistema que ela usa, para escolher a IA de cada função e a reserva.
- **Tela** (`components/configuracoes/ModelosIa.tsx`, em Configurações, só gestão, logo depois de "Assistente no WhatsApp"): uma linha por assistente, em três grupos (Conversas com leads: Caroline, Julio, Luiz Felipe; Assistentes da equipe: Clarice, Heitor, Joana, Analista de Resultados, Portal de implantação, Conversa no Escritório; Pesquisa e estratégia: Rafael, Olívia, Mila, Sofia). Cada linha tem "Modelo principal", "Reserva" e o botão de voltar ao automático. Opções: "Automático (grátis primeiro)", Groq GPT-OSS 120B, Groq GPT-OSS 20B, Groq Qwen 3.8 27B, Google Gemini 2.5 Flash (grátis), OpenAI (modelo do `.env`), xAI Grok; na reserva também "Sem reserva". Modelo sem chave aparece desabilitado com "(sem chave)". Botão "Salvar modelos".
- **API:** `GET /configuracoes/ia-modelos` devolve `modelos` (id, nome, grátis, lê imagem, pesquisa, `tem_chave`) e `funcoes` (com `principal` e `reserva`); `PUT /configuracoes/ia-modelos` com `{ rotas: { <função>: { principal, reserva } } }` valida (função e modelo desconhecidos viram automático), grava e vale na hora (`routes/ia-modelos.ts`, `requireGestor`).
- **Gravação:** `ConfiguracaoIntegracao` `ia.rotas` = `{ <função>: { principal, reserva } }`, só as funções fora do automático. Sem mudança de banco. Cache de 30 s, limpo ao salvar.
- **Regras** (`lib/ia-rotas.ts`, 11 testes em `tests/ia-rotas.test.ts`): `chamarGemini` e `pesquisarComGemini` tentam primeiro o principal e depois a reserva. Reserva "Automático" = se os dois falharem, segue a ordem automática (Groq grátis → Grok nas tarefas simples → OpenAI → Gemini); "Sem reserva" = o pedido para com o erro. Modelo sem chave, ou que não serve para o pedido (Groq com imagem/PDF ou com pesquisa na internet), é pulado; se nada escolhido servir, vale o automático, para nunca deixar o pedido sem IA. Conversa no Escritório (`conversa-<agente>`) usa a linha "Conversa no Escritório". Áudio continua sempre no Whisper local.
- **Gemini:** chamadas ao Gemini passam por `chamarApiGemini` e contam no uso por assistente (`gemini` em `ia.agentes.<dia>` e `ia.uso.<dia>`; coluna "Gemini" na tabela de Desempenho). A chave do Google foi posta em `GEMINI_API_KEY` no `.env` do servidor (29/10/2026). O plano grátis do Gemini pode usar o conteúdo para treinar modelos do Google: o aviso está na tela.
- **Para a Jessica:** em **Configurações › Modelos de IA**, escolha para cada assistente a IA principal e a reserva e clique em **Salvar modelos**. Deixe em "Automático" para continuar no grátis primeiro. A seta circular volta a linha ao automático.
