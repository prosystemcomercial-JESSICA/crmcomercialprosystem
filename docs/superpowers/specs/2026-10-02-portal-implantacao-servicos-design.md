# Portal de Implantação e Serviços: desenho

Data: 02/10/2026. Pedido da Jessica. Substitui o quadro "IMPLANTAÇÃO" do Trello.

## 1. Objetivo

Acompanhar tudo o que acontece depois do contrato assinado, dentro do CRM, sem sistema separado. O ciclo completo é: contato → proposta → contrato → implantação → virada da loja → treinamento → saída da fila da implantação.

Cada demanda precisa medir:
- **tempo de execução:** quanto o técnico trabalhou de fato (play e pausa);
- **tempo de espera:** quanto ficou parado aguardando a programação (Sinval), o cliente ou um processamento;
- **prazo total:** da assinatura até a conclusão.

O cliente acompanha o passo a passo e o tempo gasto na demanda dele. A cobrança da mensalidade começa na virada da loja, sem esquecimento.

## 2. Base

Evoluímos o que já está no ar:
- a tabela `Implantacao`, criada automaticamente quando o contrato é assinado (`lib/comissao-fluxo.ts`), com técnico, tipo de base (banco zerado ou conversão), checklist, anexos, testes e linha do tempo;
- as rotas de `routes/implantacoes.ts`;
- a tela **Portal Técnico** (`/portal-tecnico`).

O app separado `portal-implantacao/` (feito para o Railway e nunca publicado) **fica arquivado**: não é apagado e não recebe mudanças.

## 3. Os dois módulos

| Módulo | O que entra | Checklist padrão |
|---|---|---|
| **Implantação** | contrato novo (instalação do zero ou conversão de outro sistema) | Instalação (15), Conversão (10, só quando é conversão), Treinamento (21, em fases) |
| **Serviços** | troca de CNPJ, comunicação entre filiais, impressora, banco de dados e outros serviços vendidos | checklist curto, próprio de cada tipo de serviço |

Os dois módulos usam o mesmo cronômetro, as mesmas esperas, o mesmo SLA e a mesma página do cliente.

O kanban segue as colunas do Trello: BackLog, Serviços, A fazer, Em andamento, Acompanhamento e Treinamento, Concluído, Validado Supervisão, Cancelados, Finalizado, Serviços Finalizados. Cada mudança de coluna fica na linha do tempo.

Os itens do checklist padrão são os do "Cartão padrão" do Trello, copiados um a um. Assim a cópia manual do cartão deixa de existir.

## 4. Ficha de coleta

Substitui a descrição em texto livre do cartão. Campos:
- tipo (zerado ou conversão) e sistema anterior;
- número de máquinas, caixas e terminais;
- regime tributário;
- certificado digital;
- dados da contabilidade (nome, contato, e-mail);
- filiais e se usa comunicação entre elas;
- balança, gaveta e impressora NFC-e;
- contato principal e observações.

Junto com a ficha vai o **upload da tela do Suporte**, a tela de liberação do sistema. Sem esse anexo, o botão "Iniciar virada" fica bloqueado.

## 5. Cronômetro do técnico

### 5.1 Regras

- O técnico aperta **play** numa demanda e escolhe a etapa: Instalação, Conversão, Treinamento ou Correção pós-virada.
- **Só um cronômetro dele roda por vez.** Se ele der play em outra demanda, a anterior pausa sozinha e a troca fica registrada. Uma hora com duas demandas abertas nunca vira duas horas.
- **Outra atividade:** suporte, reunião e tarefa interna também têm play, sem estar ligadas a uma demanda. Assim o tempo não aparece como ocioso.
- **Processamento automático** (por exemplo, uma importação rodando): é registrado na demanda como "processamento em andamento", com início e fim. Esse tempo **não conta** como trabalho do técnico, e ele pode dar play em outra demanda enquanto isso.
- **Esquecimento:** um cronômetro aberto é fechado sozinho às 23h59 do dia, com aviso ao técnico e à gestão. A gestão pode corrigir o horário, e cada correção fica registrada com o nome de quem corrigiu.

### 5.2 Esperas

- **Aguardando programação:** registra o motivo, o que precisa ser resolvido e o responsável (Sinval). A espera conta até ele marcar "resolvido", com a resposta.
- **Aguardando cliente:** registra o motivo; conta até o técnico retomar.
- Ao entrar em espera, o cronômetro daquela demanda pausa.

### 5.3 Jornada e aproveitamento

| Tipo de dia | Jornada | Horas úteis |
|---|---|---|
| Dia normal | 08h às 18h, menos 1h de almoço | 9h |
| Dia com virada | entrada às 07h | 10h |
| Fora do horário (madrugada ou noite) | hora extra, em separado | não entra na conta |

- **Aproveitamento do dia** = tempo registrado dentro da jornada ÷ horas úteis do dia.
- A jornada fica nas configurações, por técnico, para valer também quando entrarem outros técnicos.

## 6. Prazo máximo (SLA)

- Cada demanda tem prazo de conclusão. Há um prazo padrão por tipo (configurável pela gestão), e a gestão pode mudar o prazo de cada demanda.
- **Situação:** no prazo; em risco (passou de 80% do prazo); estourado. Aparece no card, no painel e na TV do Escritório.
- O tempo esperando a programação aparece em separado, para mostrar quanto do atraso veio de fora do técnico. O prazo em si continua correndo.

## 7. Avisos para o técnico

- A gestão escreve um aviso para o técnico, ligado ou não a uma demanda, com prioridade normal ou urgente.
- O aviso aparece no Portal Técnico com contador e som, e fica marcado como lido quando ele abre.
- A gestão vê quem já leu.

## 8. Virada da loja e cobrança

1. **Iniciar virada:**
   - exige a tela do Suporte anexada;
   - marca o dia como dia de virada (jornada a partir das 07h);
   - avisa a gestão.
2. **Loja virada:**
   - grava a data de início de uso;
   - leva o progresso a 100%;
   - calcula o 1º vencimento;
   - cria a pendência de cobrança.
3. **Regra do 1º vencimento:**
   - conta 30 dias a partir do início de uso;
   - o vencimento é o **primeiro dia da lista 01, 05, 10, 15, 20 ou 25 que seja igual ou posterior** a essa data;
   - se a data cair depois do dia 25, vai para o dia 01 do mês seguinte;
   - exemplos: 30º dia no dia 12 → vence no dia 15; 30º dia no dia 25 → vence no dia 25; 30º dia no dia 27 → vence no dia 01 do mês seguinte.
4. **Pendência de cobrança:**
   - aparece para a gestão e para o financeiro, com aviso no WhatsApp da gestão e na TV;
   - repete o aviso todo dia útil até alguém marcar "cobrança lançada";
   - o mês de pagamento da comissão (`mes_pagamento_comissao`) é recalculado a partir desse vencimento.

## 9. Treinamento e correções

- **Treinamento em fases.** Os 21 itens são agrupados em fases (por exemplo: Fase 1, Caixa e PDV; Fase 2, Estoque e Compras; Fase 3, Financeiro e Gerencial).
  - Cada fase tem data marcada e data realizada.
  - As horas da fase são as do cronômetro na etapa Treinamento.
- **Correções e bugs.** O que aparecer depois da conversão ou da virada vira uma ocorrência, com:
  - título, descrição e gravidade;
  - situação: aberta, em correção, aguardando programação ou resolvida;
  - horas gastas, contadas pelo cronômetro na etapa Correção.
- **Saída da fila.** A demanda sai da implantação quando o treinamento termina e não há ocorrência aberta. O cliente segue para o acompanhamento de Clientes Ativos e da jornada de CS.

## 10. Página do cliente

- Endereço com link sem senha, único por demanda: `/acompanhamento/<código>`.
- **Mostra:**
  - as etapas padrão e em qual o cliente está;
  - o percentual;
  - o tempo total dedicado à demanda dele;
  - a data da virada e as fases do treinamento.
- **Não mostra:** as descrições internas, as esperas da programação e os motivos.
- **Percentual:** itens concluídos de Instalação + Conversão até a virada (banco zerado conta só a Instalação). A virada vale 100%. O Treinamento aparece como uma fase à parte, depois.

## 11. Comunicação com o cliente

| Momento | Mensagem |
|---|---|
| Contrato assinado | próximos passos + link da página de acompanhamento |
| 30%, 50% e 80% | progresso, com o que já foi feito e o tempo dedicado |
| Loja virada (100%) | **boas-vindas do pós-venda**, que saem daqui e não mais da assinatura do contrato |
| Fase de treinamento concluída | resumo da fase e o que vem na próxima |
| Depois da virada | o agente de oferta (fase final, depende do catálogo) |

- **Canais:** WhatsApp **e** e-mail.
  - O e-mail segue o design system da Prosystem (cores, logo, tipografia), em layout próprio.
- **Texto personalizado:** cada mensagem é escrita pela IA com o contexto real do cliente: nome, loja, etapa, o que foi concluído, tempo dedicado e o próximo passo. Se a IA falhar, vai um texto padrão preenchido com os mesmos dados.
- **Nada repetido:** cada marco é enviado uma única vez por canal (registro por demanda, marco e canal).
- **Proteção do número:** as mensagens de WhatsApp respeitam o horário e o intervalo do número.
- **Pessoa assumiu a conversa:** esses avisos são informativos e continuam sendo enviados. O agente **não responde** ao que o cliente escrever depois; a resposta fica com a pessoa.

## 12. Painel da gestão

- Trabalho por demanda e por etapa.
- Trabalho por dia, sem contar em dobro, mais as horas extras.
- Esperas pela programação: quantidade, duração e motivos mais comuns.
- Prazo de entrega e SLA (no prazo, em risco, estourado).
- Aproveitamento diário e semanal.
- Horas de treinamento e de correção por cliente.
- Viradas da semana e cobranças pendentes.

## 13. Banco de dados (somente acréscimos, nada é apagado)

- **`Implantacao`, campos novos:**
  - `modulo` (IMPLANTACAO ou SERVICO) e `tipo_servico`;
  - `coluna` (kanban);
  - `coleta` (Json da ficha) e `tela_suporte_arquivo_id`;
  - `sla_prazo` e `sla_horas`;
  - `virada_inicio_em` e `virada_fim_em`;
  - `cobranca_lancada_em` e `cobranca_lancada_por`;
  - `token_cliente`;
  - `concluida_fila_em`.
- **`ImplantacaoSessao`** (cronômetro):
  - técnico, demanda (opcional) e etapa;
  - tipo (DEMANDA, SUPORTE, REUNIAO ou INTERNO);
  - início e fim;
  - origem (play, troca automática, fechamento automático ou correção manual);
  - `ocorrencia_id` (opcional).
- **`ImplantacaoEspera`:**
  - demanda e tipo (PROGRAMACAO, CLIENTE ou PROCESSAMENTO);
  - motivo, o que resolver e responsável;
  - início e fim;
  - quem resolveu e a resposta.
- **`ImplantacaoOcorrencia`:** demanda, título, descrição, gravidade, situação, aberta em e resolvida em.
- **`ImplantacaoTreinamentoFase`:** demanda, nome, ordem, data marcada e data realizada. Os itens do checklist ganham o campo `fase`.
- **`ImplantacaoComunicacao`:** demanda, marco, canal, texto, enviado em; único por demanda, marco e canal.
- **`AvisoTecnico`:** de, para, demanda (opcional), texto, prioridade, lido em.
- **Configurações** (em `ConfiguracaoIntegracao`):
  - jornada por técnico;
  - prazo padrão por tipo de demanda;
  - checklist por tipo de serviço.

## 14. Entrega em fases

1. **Cronômetro e esperas:**
   - tabelas novas;
   - play único por técnico, outras atividades, aguardando programação ou cliente, processamento;
   - fechamento automático às 23h59;
   - painel "Meu dia" do técnico.
2. **Kanban, ficha, Serviços, SLA e avisos:**
   - colunas do Trello;
   - ficha de coleta e tela do Suporte;
   - módulo Serviços;
   - prazo por demanda;
   - avisos para o técnico.
3. **Virada e cobrança:** iniciar virada, loja virada, 1º vencimento, pendência de cobrança com aviso.
4. **Cliente:**
   - página de acompanhamento;
   - mensagens personalizadas por WhatsApp e e-mail (próximos passos, 30/50/80%, virada);
   - boas-vindas do pós-venda passam para a virada.
5. **Treinamento em fases e correções pós-virada.**
6. **Painel da gestão** e cartão na TV do Escritório.
7. **Agente de oferta:** depende do catálogo de produtos e pacotes com preços.

Os cartões ativos no Trello serão migrados para o portal numa importação única, sem apagar nada do Trello.

## 15. Pendências

- Catálogo de produtos e pacotes com preço, para o agente de oferta (fase 7).
- Nomes das fases do treinamento: os do item 9 são uma proposta.
- Prazo padrão (SLA) de cada tipo: conversão, banco zerado e cada serviço.
- Usuário do Sinval no CRM, para ele marcar as esperas como resolvidas.
