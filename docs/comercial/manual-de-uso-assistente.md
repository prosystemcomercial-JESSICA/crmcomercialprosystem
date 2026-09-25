# Manual de uso: CRM Comercial ProSystem

Versão de 25/09/2026. Endereço: https://comercial.prosystemnet.com

Este manual explica, passo a passo, como usar as funções novas do CRM Comercial. Cada seção diz onde fica, como usar e o que acontece por trás.

---

## 1. WhatsApp da empresa

**Onde:** menu **WhatsApp**.

- O CRM usa **um número só**, o WhatsApp da empresa.
- Conversa de número novo chega **sem dono**, na fila. Quem responder primeiro vira o dono da conversa.
- Dá para enviar texto, áudio, foto, vídeo e documento.
- **Identificar** (painel lateral) marca o contato como Cliente, Lead, Parceiro, Equipe, Terceiro de cliente, Fornecedor ou Outro. Só **Lead** fica no funil.

### 1.1 Vincular a conversa a um cliente

1. Abra a conversa e clique em **Identificar → Cliente**.
2. Busque pelo **código**, pelo **nome** ou por **parte do nome** (todas as palavras precisam aparecer), ou pelo **CNPJ**.
3. Clique no cliente. A conversa fica vinculada e o contato sai do funil de leads.

Se o contato mandar o **CNPJ de um cliente que já está na base**, o bot pergunta "É a sua empresa? (razão social)" com os botões **Sim** e **Não**. **Sim** vincula sozinho.

---

## 2. Triagem automática

Todo número novo recebe o menu: **Quero conhecer**, **Serviços**, **Suporte** e **Financeiro**.

- **Quero conhecer:** pergunta o segmento (Padaria ou Farmácia), se já é cliente, o nome, a cidade e o CNPJ. O CNPJ é consultado na Receita e aparece no painel.
- No fim, o lead vira **Qualificado**, toca o **alarme** no CRM e recebe o **material do segmento**.
- Depois vem a oferta de **demonstração** (seção 5.4).
- **Suporte** e **Financeiro** recebem o contato do atendimento geral e saem do funil.

**Configurar:** Configurações → Triagem automática. Ali se liga ou desliga a triagem e se editam os textos de farmácia e padaria.

---

## 3. Painel da TV e resumos por e-mail

- **Painel da TV:** Configurações → Painel da TV gera o link. Tela 1 mostra o dia e a tela 2 o ano, alternando a cada 30 segundos.
- **Resumo executivo (e-mail, 18h, de segunda a sexta):** vai para o Thiago com cópia para a supervisão.
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
- lead qualificado;
- proposta aberta pelo cliente;
- proposta aceita;
- conversa passou do prazo;
- risco de cancelamento;
- resumo curto às 18h;
- resposta da pesquisa de satisfação.

### 5.3 Proposta pelo WhatsApp

1. Na conversa, clique em **📄 Enviar proposta pelo WhatsApp**.
2. Aparecem as propostas abertas com o CNPJ ou o telefone do contato. A proposta precisa ter o **link público** gerado.
3. O cliente recebe o resumo, o link e os botões **Aceitar proposta** e **Tenho dúvidas**.
   - **Aceitar:** gera o contrato, fecha o lead e manda a entrada por **PIX** (ou o aviso do financeiro, se a chave PIX não estiver configurada). Também pede o nome, o CPF e o e-mail de quem vai assinar.
   - **Tenho dúvidas:** a conversa vira prioridade crítica.
4. **Follow-up automático:** vai nos dias 2, 5 e 7, das 9h às 18h, e para assim que o cliente responder.

### 5.4 Demonstração marcada pelo lead

- No fim da triagem, o lead escolhe um horário livre: de segunda a sexta, 9h–12h e 14h–17h, 30 minutos, a partir de 2 horas depois da escolha.
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

### 5.7 IA de texto (Gemini)

Precisa da **chave** em Configurações. A chave é gratuita e se cria em aistudio.google.com/apikey.

- **✨ Resumir conversa** (painel): quem é, o que já foi falado, qual o próximo passo e uma possível venda adicional.
- **✨** ao lado do campo de texto: **sugere a resposta**, e você revisa antes de enviar.
- **Transcrição de áudio:** automática, ou pelo botão "Transcrever áudio".
- **Tira-dúvidas automático** (só para leads):
  - responde dúvidas sobre o sistema com o guia comercial;
  - pode ficar ativo **só fora do horário**, **sempre** ou **desligado**;
  - no máximo 3 respostas por dia por conversa;
  - nunca responde se alguém da equipe falou nas últimas 2 horas;
  - **nunca fala de preço ou desconto**.

### 5.8 IA Laya (aprendendo até 14/10/2026)

- No painel da conversa, **🤖 IA Laya**: confirme ou corrija o segmento, a intenção e o risco de cancelamento, ou marque **Não comercial**. Cada confirmação ensina a Laya.
- Depois do treino, ligue em Configurações:
  - **Usar a Laya na triagem**, para entender respostas escritas livremente;
  - o **limite de risco de cancelamento**.

### 5.9 Pós-venda automático (desligado até você ligar)

- **Boas-vindas** quando o contrato for assinado. Nunca vai para lançamentos retroativos nem para contratos anteriores à data em que foi ligado.
- **Pesquisa de satisfação** 30 dias depois, com as opções Ótima, Regular e Ruim. **Ruim** vira aviso e prioridade crítica.

### 5.10 Campanhas pelo WhatsApp

**Onde:** Configurações → Assistente → **Abrir Campanhas pelo WhatsApp**.

1. Escolha o público: **Leads parados** (15 a 180 dias sem movimento) ou **Clientes da base**. Opcionalmente, filtre por segmento.
2. Escreva a mensagem. `{nome}` vira o primeiro nome.
3. Clique em **Ver quantos vão receber**, depois **Criar campanha** e **Sim, enviar**.
4. Saem cerca de 24 mensagens por hora, só em horário comercial. Quem responder **SAIR** não recebe mais.

### 5.11 Escritório virtual

**Onde:** menu **Escritório virtual**.

Uma sala em 3D com os dez agentes do assistente trabalhando. Cada um tem uma mesa, um crachá e uma luz de status: 🟢 trabalhando (agiu nos últimos 10 minutos), 🟡 parado ou ⚪ desligado. Quem está trabalhando mostra um balão com a última ação. Clique na mesa para ver o que o agente fez hoje. A tela atualiza a cada 30 segundos.

**Você no escritório:** a Jessica aparece como supervisora. Ande com as setas do teclado ou clicando no chão. Perto de uma mesa aparece um balão com **Ver trabalho**, **Chamar à minha sala** e **Liberar**. **Reunir a equipe** leva todos para a sala de reunião.

**Conversar (💬):** envie uma **instrução** (fica gravada e passa a valer nas respostas da IA daquele agente, ou de toda a equipe) ou uma **pergunta** (o agente responde com os dados dele).

**Pesquisas da Sofia:** toda segunda às 8h, e quando você clicar em **Pesquisar agora**, a Sofia busca na internet os assuntos mais falados para farmácias, padarias, varejo e gestão. Cada assunto vem com resumo, por que importa, uma sugestão de mensagem para clientes (botão copiar) e as fontes. A gestão recebe um aviso no WhatsApp. Usa a IA do ChatGPT.

**Caroline, a SDR:** faz o primeiro contato com os leads das campanhas (Facebook/Instagram Ads) pelo WhatsApp da empresa.
1. No painel dela, cole um ou vários leads como vêm da plataforma ("Lead se Cadastrou em..."). Marque "Eu já mandei a mensagem de abertura" se você já chamou pelo celular. Clique em **Conferir** e depois em **Confirmar**. O lead nasce no CRM com a origem da campanha; se já existir, é vinculado, sem duplicar.
2. Ela conversa buscando o **problema principal** do cliente: fala pouco, uma pergunta por vez, na linguagem do cliente. Só usa o guia comercial e nunca fala de preço. Ouve áudios (transcrição) e vê fotos.
3. **Termômetro:** nota de 0 a 100 a cada resposta (dor principal até 35, momento de compra até 25, quem decide até 15, engajamento até 15, perfil até 10). Sem dor principal não passa de 59. A nota vira a temperatura do lead (80+ muito quente, 60+ quente, 35+ morno).
4. **Fim:** oferece a demonstração (horários da agenda), passa para a vendedora ("Leads para Distribuir") com resumo, ou encerra com gentileza. Dúvida fora do material: ela avisa você.
5. **Segurança do número:** no máximo 15 primeiros contatos por dia nas 2 primeiras semanas (somados às campanhas), um a cada 4 a 9 minutos, só em horário comercial, com "digitando...". Sem resposta: tenta de novo em 2 e em 5 dias úteis, no máximo 3 vezes. Quem pede SAIR sai na hora. Três falhas seguidas: ela pausa e avisa.
6. **Aprovar antes de enviar** (padrão ligado): cada mensagem dela aparece no painel para você aprovar, ajustar ou descartar. Seus ajustes ensinam o seu tom para ela.
7. **Uma pessoa assumiu, ela sai:** se alguém assume a conversa ou responde nela, a Caroline e as outras IAs param de responder ali; a Laya continua só aprendendo.
8. Ela começa **desligada**: ligue no painel dela.

**Caderno da Laya:** tudo o que a Laya aprende com as confirmações da equipe fica escrito: regras, palavras típicas de cada cliente, casos difíceis, exemplos e acerto por tarefa. Cópia diária no servidor (`/root/laya-caderno`) e botões para baixar. Se a Laya parar, o Caderno ensina outra IA. Ela aprende na hora (cada confirmação vale na próxima conversa parecida) e sobe de nível por tarefa: Aprendiz, Assistente (30 exemplos e 80% de acerto) e Titular (50 exemplos e mais de 90%). Meta: 15 confirmações por dia. Confirmar a temperatura dos leads da Caroline também ensina a Laya.

| Agente | Função |
|---|---|
| Bia | Recepção: triagem de novos contatos |
| Lurdinha | Agenda: demonstrações marcadas e lembretes |
| Clarice | Tira-dúvidas com IA e transcrição de áudio |
| Luiz Felipe | Follow-up de propostas |
| Zequinha | Campanhas pelo WhatsApp |
| Helena | Pós-venda: boas-vindas e pesquisa |
| Laya | IA que analisa as conversas e aprende |
| Marta | Assistente da gestão: comandos, avisos e aprovações |
| Sofia | Pesquisadora: assuntos do setor e novidades, com fontes |
| Caroline | SDR: primeiro contato com os leads das campanhas |

---

## 6. Regras que valem para tudo

- Preço, desconto e contrato são decididos por pessoas. O assistente nunca promete valores.
- Atividade só existe quando alguém lança ou confirma. A exceção é a demonstração escolhida pelo próprio lead.
- Mensagens automáticas ficam na conversa, marcadas como do robô, da IA, da campanha ou da cadência.
- Contatos marcados como Equipe, Parceiro ou Fornecedor não recebem nada automático.
- Antes de qualquer mudança no banco, é feito um backup na VPS, em `/root/backups-deploy`.

---

## 7. Para a equipe técnica

- **Código:** GitHub `prosystemcomercial-JESSICA/crmcomercialprosystem`, branch `main`. Cada entrega é commitada e enviada antes de ir para o servidor.
- **Publicação:** VPS `comercial.prosystemnet.com`, pasta `/var/www/comercial-prosystem`, com pm2 `comercial-backend` (3011) e `comercial-frontend` (3010). A IA Laya roda no pm2 `laya` (local, porta 8765).
- **Documentos relacionados:**
  - `docs/comercial/base-conhecimento-comercial.md`: guia comercial, usado pela IA;
  - `docs/comercial/crm-assistente.html`: ideias e fluxos;
  - `docs/comercial/novidades-crm.html`: apresentação das novidades;
  - `docs/superpowers/specs/2026-09-25-assistente-fase1-design.md`: especificação.
