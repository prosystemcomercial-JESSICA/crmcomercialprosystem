# WhatsApp da empresa (instância única UAZAPI) — design

Data: 2026-09-23 · Base: `origin/main` @ bb8a329 (código em produção em comercial.prosystemnet.com)

## Contexto

O Inbox de WhatsApp em produção já usa a UAZAPI (`backend/src/services/evolution.service.ts`, nome
herdado), mas no modelo **uma instância por vendedor**: cada "Conectar" chama `/instance/init` com o
admin token e consome uma instância paga. A empresa vai pagar **uma** conta UAZAPI com uma instância
para este CRM (e outra para outro CRM). A instância deste CRM já existe e está pareada:

- Server URL: igual a `EVOLUTION_API_URL` já configurada na VPS
- Instância `EMKV0r`, número 5527997521370 (o token é informado pela gestão na tela; nunca vai para o repositório)

Problemas encontrados em produção que esta mudança resolve:
1. O webhook `/whatsapp/webhook` só entende payload no formato Evolution (`event: MESSAGES_UPSERT`,
   `payload.instance`, `data.key.remoteJid`). A UAZAPI envia `EventType: "messages"`, `token: <instance token>`,
   `message: {...}` (ver OpenAPI `/webhook`, exemplo com `EventType` e `token`). Mensagens recebidas não entram.
2. `EVOLUTION_WEBHOOK_URL` na VPS aponta para `https://comercial.prosystemnet.com/whatsapp/webhook`, mas o nginx
   só encaminha `/api/*` ao backend. O correto é `https://comercial.prosystemnet.com/api/whatsapp/webhook`
   (ajuste de variável de ambiente no deploy, não de código).
3. Envio de áudio chama `/send/audio`, que não existe na OpenAPI (só `/send/media`).

## Decisões (confirmadas com a usuária)

- **Uma instância para o CRM todo** ("WhatsApp da empresa"). A gestão cola o **token da instância** em
  Configurações; o CRM não cria nem pareia instâncias. URL continua vindo de `EVOLUTION_API_URL`.
- **Conversa de número novo entra sem dono (pool)**; o vendedor clica **Assumir** ou responde e vira dono.
- **Nada existente é apagado**: instâncias antigas por vendedor e suas conversas continuam no banco e
  visíveis como hoje; apenas não é mais possível criar instância nova quando a da empresa estiver configurada.
- Funil (estágio/prioridade), SLA, cadência, SSE, bot, captação de lead, etiquetas, vincular cliente,
  reunião e transferência continuam funcionando — só passam a valer também para conversas da empresa.

## Desenho

### Dados (Prisma, mudança só aditiva — seguro para `prisma db push` com dados)
- `WhatsappConversa.dono_id`: `String` → `String?` (`null` = pool).
- A instância da empresa é uma linha de `WhatsappInstancia` com `instancia_nome = 'empresa'`
  (constante única no código), `apelido = 'WhatsApp da empresa'`, `instance_token`, `numero`, `status`,
  `dono_id` = id do gestor que configurou (campo obrigatório existente; não é usado para escopo desta instância).

### Configuração (gestão: `requireGestor` de `@/lib/scope`)
- `GET /whatsapp/empresa` → `{ configurado, conectado, numero, status }` (status ao vivo via `obterStatus(token)`).
- `PUT /whatsapp/empresa` body `{ instance_token }` → valida chamando `obterStatus(token)` (erro/`DESCONECTADO`
  por token inválido → 400 com mensagem clara), faz upsert da linha `empresa`, chama `configurarWebhook(token)`
  e devolve o mesmo formato do GET. O token nunca é devolvido ao frontend depois de salvo.
- `configurarWebhook`: garantir que o corpo segue a OpenAPI `/webhook` (url, enabled, events com `messages`
  e `connection`; `excludeMessages` para não receber eco `wasSentByApi` se a API suportar) e que falha é logada.

### Webhook `POST /whatsapp/webhook` (público)
- Se o payload tem `EventType`/`event` no formato UAZAPI **e** `payload.token` igual ao `instance_token` da
  instância `empresa` → processar como UAZAPI. Token ausente/diferente → ignorar (log de aviso, sem processar).
- Parsing UAZAPI: reaproveitar `backend/src/lib/uazapi-webhook-parser.ts` + `backend/tests/uazapi-webhook-parser.test.ts`
  do branch local `feature/whatsapp-uazapi` (`git show feature/whatsapp-uazapi:<path>`); ajustar se o exemplo de
  payload da OpenAPI mostrar campos diferentes, com teste para o exemplo real da OpenAPI.
- Mensagem recebida de contato: mesma lógica de hoje (idempotência por `externo_id`, `acharLeadPorTelefone`,
  captação de lead, SLA, cadência pausa, bot atrás de `WHATSAPP_BOT_ATIVO`, SSE), com estas diferenças para a
  instância da empresa: conversa nova nasce com `dono_id = lead?.responsavel_id ?? null`; lead captado nasce
  **sem** `responsavel_id`/`vendedor_nome`.
- Mídia recebida (imagem/áudio/documento): baixar via `POST /message/download` com o token da instância
  (conferir campos na OpenAPI linha ~7183; branch antigo tem `baixarMidia`) e guardar como data URL base64 em
  `midia_url`, como o código atual já faz; se falhar, logar e guardar o texto sem mídia.
- `fromMe`/`wasSentByApi`: status numérico 3/4 → atualizar `WhatsappMensagem.status` (ENTREGUE/LIDA) por
  `externo_id`; demais → comportamento atual de `registrarMensagemPropria` (sem duplicar eco do CRM).
- O caminho antigo (formato Evolution / instâncias por vendedor) continua como está.

### Pool e escopo (backend)
- `GET /whatsapp/conversas?escopo=pool` → `{ dono_id: null }` (visível a todo usuário logado);
  sem `escopo` = só as próprias (como hoje); `escopo=todos` = gestão (como hoje). Resposta inclui `dono_nome`
  (via `resolverNomesUsuarios`).
- `POST /whatsapp/conversas/:id/assumir` → atômico (`updateMany where { id, dono_id: null }`); 409 se outro
  dono; 200 se já é do usuário; atualiza o lead só se ele não tiver `responsavel_id`.
- Ações por conversa (mensagens, enviar, áudio, etiqueta, estágio, prioridade, painel, reunião, vincular,
  desvincular, excluir): permitidas para dono **ou** pool (gestão como hoje). Enviar/áudio/reunião numa
  conversa do pool tornam o remetente dono.
- Hook `onRequest` no plugin de rotas do WhatsApp: 401 se não houver usuário, exceto `/whatsapp/webhook`.
- SSE: eventos de conversa do pool devem chegar a todos os usuários conectados (ver `whatsapp-eventos.service.ts`).

### Instâncias por vendedor
- Com a instância `empresa` configurada: `POST /whatsapp/conectar`, `POST /whatsapp/instancias` e
  `POST /whatsapp/instancias/:id/conectar` respondem 409 "Este CRM usa o WhatsApp da empresa".
- `/whatsapp/abrir`, envio de resumo de proposta (`propostas-comerciais.ts`) e cadência
  (`whatsapp-cadencia.service.ts`): usar a instância `empresa` quando existir; senão, comportamento atual.
- Envio de áudio: corrigir para `/send/media` conforme OpenAPI (tipo áudio/ptt, arquivo base64 se suportado).

### Frontend
- Configurações: seção "WhatsApp da empresa" (gestão) com campo do token (password), botão salvar, status
  (conectado + número) e o endereço do webhook informativo.
- Tela WhatsApp: quando a empresa está configurada, esconder a barra de criar/conectar instância; abas
  **Minhas / Sem dono / Todas (gestão)**; botão **Assumir** em conversa sem dono; badge "Sem dono" na lista;
  sino do cabeçalho conta Minhas + Sem dono.

## Testes
- Unitários (vitest, imports relativos `../src/...`): parser (incluindo exemplo da OpenAPI), `baixarMidia`,
  `configurarWebhook` corpo, envio de áudio corpo — `fetch` mockado.
- Manual após deploy: texto, áudio e imagem recebidos; assumir; responder; status LIDA; sino.

## Fora de escopo
- Migrar/juntar conversas antigas das instâncias por vendedor.
- Rota genérica `/configuracoes/integracoes` (o token desta feature não fica lá).
