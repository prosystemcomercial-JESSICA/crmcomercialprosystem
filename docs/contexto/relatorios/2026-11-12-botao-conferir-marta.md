# 12/11/2026 — Botão "Conferir com a Marta" no contrato

**Pedido:** colocar no contrato o botão para a Marta conferir (antes a conferência só tinha rodado por script, no contrato 56/2026). O perfil dos agentes do Escritório ficou com outra sessão, a pedido da Jessica.

**O que mudou**
- `backend/src/routes/contratos-comerciais.ts`: nova rota `POST /contratos-comerciais/:id/conferir`. Reaproveita `completarContrato` (completa pela Receita só os dados vazios da empresa) e devolve o contrato com as pendências e uma frase pronta. Contrato já enviado para assinatura responde 400.
- `frontend/app/contratos/page.tsx`: botão roxo "Conferir com a Marta" ao lado de "Enviar para assinatura", só para contratos A gerar, Gerado ou Pendente de correção. Pede para salvar antes se houver alteração não salva. Não gera PDF e não envia nada.
- Documentos: os seis de `docs/produto/`, o manual, as novidades e o ESTADO.md.

**Incidente:** o disco C: chegou a 0 MB livre e o ESTADO.md ficou vazio. Ele foi restaurado da versão do Git, e foram apagados só caches que se refazem sozinhos (`frontend/.next`, cache do npm e `backend/node_modules/.cache`).

**Verificação:** `tests/contrato-assinatura.test.ts` com 8 testes passando. O tsc do backend não mostra erro novo (o da linha 786, sobre comissão, já existia). O tsc do frontend não mostra erro em `contratos/page.tsx`.

**Não incluído no commit:** mudanças pendentes da outra sessão (prioridade da Laya, Escritório, WhatsApp, `lib/api-client.ts`). Elas continuam na pasta, intactas.
