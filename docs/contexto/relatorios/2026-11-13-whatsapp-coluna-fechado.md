# 13/11/2026: clientes que fecharam na coluna Fechado do WhatsApp

## Pedido
Print da Jessica da Fila de Chamados (WhatsApp, vista "Por fase") com a coluna Fechado em 0: "Os clientes que fecharam precisam estar no kanban corretamente, pois está em implantação mas preciso manter contato com ele".

## Feito
- **Causa:** a coluna usa só `WhatsappConversa.estagio_funil`; nada passava para `FECHADO` a conversa de quem fechou (só o botão "Finalizar" ou arrastar à mão). A lista do quadro também esconde conversas finalizadas e corta nas 500 mais recentes.
- `backend/src/lib/funil-whatsapp.ts`: regras puras `vendaFechada`, `finaisTelefone`, `rotuloImplantacao`.
- `backend/src/services/funil-whatsapp.service.ts`: `moverFechados`. Lead em `FECHADO`, `GANHO` ou com implantação não cancelada (também a implantação sem `lead_id`, achada pela proposta) leva a conversa para `FECHADO`. Acha a conversa pelo `lead_id` ou pelos 8 últimos dígitos dos telefones do lead e pausa a cadência.
- `backend/src/server.ts`: chamada no agendador do funil (a cada 10 min e 60 s após o boot), junto com `moverInteressados`.
- `backend/src/routes/whatsapp.ts` (`GET /whatsapp/conversas?escopo=quadro`): junta até 300 conversas em Fechado que ficaram de fora (marcadas com `so_no_fechado`) e anexa `implantacao` (rótulo).
- `frontend/app/whatsapp/page.tsx` e `whatsapp.css`: a visão "Por atendente" ignora os extras; o cartão mostra em verde a situação da implantação.
- Docs: os 6 de `docs/produto/`, o manual, as novidades e o ESTADO.md.

## Verificado
- vitest `tests/funil-whatsapp.test.ts`: 7/7.
- `tsc` sem erro nos arquivos mexidos, no backend e no frontend. O erro em `routes/whatsapp.ts:1638` (transferir) já existia antes.
- **Deploy** de `c2a0a052` (13/11, 16h33): backup 468M, banco sem alterações, build ok, health 200. No log do backend: `[FUNIL] 6 conversa(s) de cliente fechado movida(s) para Fechado`.
- **Não verificado:** quais são os 6 clientes, e se algum cliente em implantação ficou de fora. A leitura do banco de produção foi bloqueada pela permissão automática da sessão.

## Decisões e porquês
- Sincronização periódica em vez de gancho em cada ponto de fechamento: a venda fecha por vários caminhos (contrato, arrastar o lead, portal da implantação), e o agendador do funil já existia.
- Se alguém tirar de Fechado um cliente fechado, ele volta na rodada seguinte. Cliente fechado é Fechado, como a Jessica pediu.
- Telefone pelos 8 últimos dígitos: é a mesma chave que o resto do CRM usa (`routes/leads.ts`).
- Durante a tarefa, um `git stash` disparado por engano guardou as mudanças da outra sessão. Elas foram devolvidas na hora com `git stash pop`, sem conflito.

## Pendente
- Jessica: conferir a coluna Fechado depois do deploy e dizer se falta algum cliente. Quem não tem conversa ligada ao lead nem telefone igual não entra. Possível melhoria: achar a conversa pelo CNPJ.

## Próxima sessão
Se faltar cliente, comparar as implantações ativas com as conversas, numa leitura de produção só de leitura (`Implantacao` → `Lead` → `WhatsappConversa`). Skill sugerida: `diagnosing-bugs`.
