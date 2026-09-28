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
