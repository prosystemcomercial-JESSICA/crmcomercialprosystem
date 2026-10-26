# 26/10/2026: etapa "Finalizado" nos casos de churn

## Pedido
A Jessica mandou o print do seletor de status do caso de churn (NOVO … AGUARDANDO_EXCLUSAO) e pediu: "Inclua a coluna finalizado (totalmente resolvido)".

## Feito
- Status novo `FINALIZADO`, última etapa, depois de "Aguardando exclusão do cadastro". Lista única em `backend/src/lib/caso-churn-status.ts` (`STATUS_CASO`, `STATUS_PERDA`, `STATUS_ENCERRADO`), usada em `types/dto.ts`, `services/caso-churn.service.ts`, `routes/casos-churn.ts`, `routes/ceo.ts`, `routes/ativos.ts`, `routes/implantacao-portal.ts`, `services/dashboard-retencao.service.ts`, `services/relatorio-retencao.service.ts`.
- Aba Exclusões (CEO): `STATUS_LISTA_EXCLUSAO` em `lib/churn-exclusao.ts`; reenvio não volta o finalizado para "Aguardando exclusão".
- Tela `frontend/app/casos/page.tsx`: coluna Finalizado no Kanban, filtro, seletor (só em caso perdido), botão "✅ Finalizar caso" no dossiê, selo no Radar; `components/casos/ExclusaoCeo.tsx` mostra "Finalizado".
- Evento "✅ Caso de churn finalizado" na ficha do cliente.
- Detalhes: seção "Atualização 26/10/2026: etapa Finalizado nos casos de churn" nos 6 documentos de `docs/produto/` e no manual.

## Verificado
- `npx vitest run` de `churn-exclusao`, `churn-exclusao-pdf` e o novo `caso-churn-status.test.ts`: 12 testes passando.
- `tsc` do backend: nenhum erro novo nos arquivos mudados (o de `ceo.ts:107` é antigo). `tsc` do frontend: sem erros em `casos/page.tsx` e `ExclusaoCeo.tsx`.
- Não verificado: tela no navegador e produção (não publicado).

## Decisões e porquês
- Finalizado conta como **perda** (só vale a partir de PERDIDO / SISTEMA_REMOVIDO / AGUARDANDO_EXCLUSAO), como o print sugere (vem depois da exclusão do cadastro). Caso recuperado continua em RECUPERADO.
- Sem mudança automática de status (nem ao CEO confirmar suporte e cobrança): regra do projeto de não automatizar sem pedido.
- Correção junto: antiduplicação ao abrir caso tratava SISTEMA_REMOVIDO/AGUARDANDO_EXCLUSAO como abertos; agora usa `STATUS_ENCERRADO`.
- Sem mudança de banco (`CasoChurn.status` é texto).

## Pendente
- Publicar: a `main` ainda espera o `ALTER TABLE WhatsappConversa ADD COLUMN fora_do_funil_em ...` do `f017b30` antes do deploy (ver ESTADO.md). Decide/libera: Jessica (permissão da sessão na VPS).
- Se a Jessica quiser: passar o caso para Finalizado sozinho quando o CEO marcar suporte retirado e cobrança suspensa.

## Próxima sessão
Com a permissão liberada: backup, o ALTER TABLE pendente e `backend/scripts/deploy-vps.sh <hash da main>`; depois trocar o selo da novidade para "No ar".
