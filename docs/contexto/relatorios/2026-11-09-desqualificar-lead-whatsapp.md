# 09/11/2026: desqualificar o lead pela tela de WhatsApp, com motivo

## Pedido
Jessica: "Incluir desqualificar o lead na tela de whatsapp pedindo o motivo e preciso desses dados depois, o motivo da desqualificação do lead."

## Feito
- Tela de WhatsApp (`frontend/app/whatsapp/page.tsx`): opção **Desqualificar lead** no menu … (computador) e na folha de ações (celular), só quando a conversa tem lead. Janela com motivo obrigatório e detalhe (obrigatório em "Outro").
- Lista de motivos única para Leads e WhatsApp: `frontend/lib/motivos-perda.ts` (antes ficava só dentro de `app/leads/page.tsx`), com o motivo novo `FORA_DO_PERFIL`.
- API `POST /whatsapp/conversas/:id/desqualificar` (`backend/src/routes/whatsapp.ts`) e serviço `desqualificarLead` (`backend/src/services/whatsapp-vinculo.service.ts`). Detalhes de campos e tabelas nos 6 documentos de `docs/produto/` (seção "Atualização 09/11/2026").
- Rótulo "Fora do perfil" no Sensor de Mercado (`routes/relatorio-comercial.ts`).
- Manual (`docs/comercial/manual-de-uso-assistente.md`) e novidades (`docs/comercial/novidades-crm.html`).

## Verificado
- `npx vitest run tests/desqualificar-lead.test.ts tests/fora-do-funil.test.ts`: 7 de 7 passam.
- Checagem de tipos: nenhum erro novo nos arquivos mudados (backend e frontend); os erros que aparecem em `routes/whatsapp.ts` e `relatorio-comercial.ts` são antigos, em outras linhas.
- Deploy `06ece3a` na VPS em 09/11 (backup, "banco sem alterações", build ok, PM2 online); o botão "Desqualificar lead" está no frontend publicado e a rota nova responde (401 sem login). Não verificado: desqualificar um lead de verdade pela tela (não usei dados reais).

## Decisões e porquês
- Desqualificar = marcar **Perdido** com motivo, reaproveitando o campo `motivo_perda` e o formato da tela de Leads (`CHAVE` ou `CHAVE: detalhe`), para os dados caírem nos relatórios que já existem.
- Grava também em `LeadPerda` (quem, quando, valor), porque o `motivo_perda` do lead é sobrescrito se o lead for reaberto e perdido de novo; a tabela guarda o histórico.
- O lead **não** é desvinculado (diferente do "Desvincular do funil"), senão os dados saem do funil. Os agentes param nessa conversa.
- Não mexi na lista de motivos da IA (`MOTIVOS_PERDA` de `lib/assistente/sdr.ts`): "Fora do perfil" só existe para a equipe.

## Pendente
- Tela com a lista e os totais de leads desqualificados/perdidos por motivo (os dados já estão em `GET /funil/perdas` e no Sensor de Mercado, que hoje não tem tela). Decide: Jessica.
- A tela de Leads (arrastar para Perdido) grava só `motivo_perda`, sem `LeadPerda`. Unificar se a Jessica quiser o histórico completo de lá também.

## Próxima sessão
Se a Jessica pedir o relatório dos motivos: criar a tela lendo `GET /funil/perdas` (por motivo, por vendedor, por período). Skills: `brainstorming`, `interface-design`.
