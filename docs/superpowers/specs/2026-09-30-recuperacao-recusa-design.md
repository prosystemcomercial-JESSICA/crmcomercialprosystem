# Recuperação de proposta recusada — design

Data: 30/09/2026 · Pedido da gestora (Jessica)

## Objetivo

Quando uma proposta é recusada, o Luiz Felipe entra na hora para entender o motivo real e, quando der, recuperar a venda. A conversa é natural, como se uma pessoa da equipe estivesse escrevendo: **nenhum botão, menu ou mensagem de sistema para o cliente** durante a recuperação. O Rafael analisa as recusas e aponta padrões para a gestão.

## Situação hoje

- **Recusa na conversa com o Luiz Felipe** (`lib/assistente/sdr.ts`, MISSÃO Nº 0): ele agradece e encerra na mesma mensagem, sem pergunta. `marcarPerdidoNews` (`services/caroline.service.ts`) marca a proposta como PERDIDA e o lead como PERDIDO, com o motivo que o cliente tiver dito espontaneamente, põe a etiqueta Informativo Prosystem e manda o convite do Instagram.
- **Recusa marcada à mão pela vendedora** (`PUT` em `routes/propostas-comerciais.ts`): só muda o status. Motivo não é pedido e nada é disparado.
- **Rafael** (`services/especialista.service.ts`) revisa conversas e escreve documentos; não fala com cliente e não olha recusas.

## Fluxo novo

### Modo "recuperação" do Luiz Felipe

Um `SdrLead` do Luiz Felipe ganha `dados.recuperacao` com: `origem` (`conversa` | `vendedora`), `iniciada_em`, `pergunta_feita_em`, `motivo_informado` (texto da vendedora, quando houver) e `desfecho` (`recuperada` | `perdida` | `sem_resposta`).

Enquanto o modo está ativo, o prompt do Luiz Felipe recebe um bloco RECUPERAÇÃO no lugar da regra de encerrar na hora:

1. **Primeira mensagem:** acolhe a decisão sem contestar e faz UMA pergunta aberta sobre o que pesou. Sem lista de opções, sem "valor, prazo ou recurso?". Tom de gente, curto, sem pressão.
2. **Resposta do cliente**, conforme o motivo:
   - **PRECO / SEM_ORCAMENTO:** diz que vai ver o que consegue fazer e marca `revisar_proposta: true`. Segue o fluxo de autorização da Jessica que já existe.
   - **TIMING:** pede previsão de data (regra "PEDIU MAIS PRAZO" existente, `adiar_dias`). A proposta volta para EM_NEGOCIACAO.
   - **FUNCIONALIDADE_AUSENTE:** responde pelo MATERIAL; se o material não cobrir, `duvida_fora_material` (equipe retorna).
   - **JA_TEM_FORNECEDOR:** pergunta de leve, uma vez, o que fez escolher o outro sistema (vai para `dados.sistema_atual` e `nota_motivo`), agradece e encerra com porta aberta (`sem_interesse`).
   - **SEM_INTERESSE / OUTRO:** agradece e encerra com porta aberta (`sem_interesse`).
3. **No máximo uma pergunta de "por quê"** na recuperação inteira. Se o cliente já disse o motivo na própria recusa, o Luiz não pergunta de novo: vai direto ao passo 2.
4. **Sem resposta à pergunta:** nenhuma mensagem nova. Após 3 dias, o agendador fecha: proposta PERDIDA com motivo `NAO_INFORMADO`, lead PERDIDO, etiqueta Informativo. `desfecho = sem_resposta`.

### Nada de botões no modo recuperação

- Não enviar o menu de retomada (`BOTOES_RETOMADA` / `enviarChamariz`).
- Proposta revisada após autorização: vai como **texto com o link** da proposta (`linkProposta`), sem o menu "Aceitar proposta / Tenho dúvidas" de `enviarPropostaWhatsapp`. Nova opção `semBotoes` nessa função.
- Convite do Instagram no encerramento: continua, é texto simples. Sai só na despedida, uma vez.

### Caminho 1: recusa na conversa com o Luiz Felipe

Quando a IA devolve `sem_interesse` numa conversa com proposta e ainda não há `dados.recuperacao`, o sistema **não** chama `marcarPerdidoNews`. Em vez disso:
- ativa `dados.recuperacao` (`origem: conversa`);
- se as mensagens da IA já contiverem a pergunta de recuperação (o prompt pede isso), envia normalmente e grava `pergunta_feita_em`;
- a proposta passa para RECUSADA (se ainda não estiver) com histórico "Cliente recusou pelo WhatsApp; Luiz Felipe entendendo o motivo".

Na rodada seguinte, com recuperação ativa, `sem_interesse` encerra de verdade: `marcarPerdidoNews` com o motivo real + convite do Instagram. `desfecho = perdida`.

### Caminho 2: vendedora marca "Recusada"

- Ao salvar a proposta com status RECUSADA, o formulário pede o **motivo** (mesma taxonomia `MOTIVOS_PERDA`, obrigatório) e mostra a caixa **"Pedir ao Luiz Felipe para entender o motivo e tentar recuperar"**, marcada por padrão.
- Marcada: o backend cria (ou reativa) o `SdrLead` do Luiz Felipe para a proposta com `dados.recuperacao` (`origem: vendedora`, `motivo_informado`), e **devolve a conversa ao agente** (a vendedora está entregando explicitamente; é a exceção à regra "pessoa assumiu, agente não fala"). Registrado no histórico da proposta e na timeline do lead.
- A primeira mensagem sai **na hora** se estiver no horário comercial (seg–sex 8h30–17h, mesma regra da vendedora); fora dele, às 8h30 do próximo dia útil.
- O prompt recebe o motivo informado pela vendedora para a pergunta soar natural (ex.: sabe que foi preço e pergunta se o valor foi o principal).
- Desmarcada: só grava o motivo e fecha como hoje (sem mensagem ao cliente).

### Travas (valem nos dois caminhos)

- Não envia se a conversa tem `optout_campanhas`, se não há telefone válido, ou se o limite diário de primeiros contatos do número foi atingido (a mensagem espera a próxima janela).
- Se uma pessoa da equipe responder na conversa depois de iniciada a recuperação, o Luiz para (regra atual de conversa assumida).
- Uma recuperação por proposta. Proposta que já passou por recuperação e voltou a ser recusada não reabre o modo.
- Nada repetido: vale a regra "NUNCA SEJA REPETITIVO" do prompt.

### Status da proposta

| Momento | Status |
|---|---|
| Recusa registrada, recuperação em andamento | RECUSADA |
| Cliente voltou a negociar (preço autorizado, prazo, dúvida) | EM_NEGOCIACAO |
| Encerrou sem recuperar, ou sem resposta em 3 dias | PERDIDA |

Relatórios e painéis já tratam RECUSADA e PERDIDA juntas como perdidas; nada muda neles.

### Rafael analisa

- **Revisão das 17h:** bloco "Recusas" com as recuperações do dia e da semana: iniciadas, recuperadas, perdidas, sem resposta, e os motivos mais frequentes (com o texto do cliente).
- **Estudo das quartas:** se um motivo se repete (ex.: 3+ recusas por preço na semana), o Rafael propõe um documento de ajuste de abordagem para aprovação da Jessica, pelo fluxo de aprovação que já existe. Só vale depois de aprovado.
- **Escritório virtual:** o painel do Rafael mostra o contador de recusas da semana e a taxa de recuperação.

## Fora do escopo

- Recuperar propostas recusadas antes desta entrega.
- Mais de uma tentativa de recuperação por proposta.
- Oferecer desconto sem autorização da Jessica (continua proibido).

## Documentação

Atualizar `docs/produto/01` a `06`, `docs/comercial/manual-de-uso-assistente.md` e `docs/comercial/novidades-crm.html`.

## Testes

- Unidade: montagem do prompt em modo recuperação (bloco presente, regra de encerrar na hora ausente, motivo da vendedora incluído); decisão do caminho 1 (primeira recusa ativa recuperação, segunda encerra); fechamento por falta de resposta após 3 dias; envio da proposta revisada sem botões.
- Rota: salvar RECUSADA exige motivo; com a caixa marcada cria o `SdrLead` em recuperação; desmarcada não cria.
- Checagem de tipos: `npx tsc --noEmit -p . --rootDir .` no backend.
