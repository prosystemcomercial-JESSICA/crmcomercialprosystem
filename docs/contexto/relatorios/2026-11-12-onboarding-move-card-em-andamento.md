# 12/11/2026 — Card vai sozinho para "Em andamento" quando o onboarding começa

## Pedido
Jessica: "A partir do momento que o onboarding iniciar o card tem que passar automatico para em andamento."

## Feito
- Regra pura `colunaAoIniciarOnboarding` e lista `COLUNAS_ANTES_DO_ONBOARDING` em `backend/src/lib/implantacao/portal.ts`.
- Serviço `moverAoIniciarOnboarding` em `backend/src/services/implantacao-portal.service.ts` (move só se a coluna não mudou no meio do caminho, registra no histórico, nunca derruba a ação original).
- Gatilhos: Play na etapa ONBOARDING (`routes/implantacao-cronometro.ts`), item do roteiro do onboarding marcado (`routes/implantacoes.ts`, PATCH checklist), ficha/perguntas salvas pelo técnico designado (`routes/implantacao-portal.ts`, PUT coleta).
- Trava do quadro: "Em andamento" liberado antes do onboarding concluído (antes só BackLog/A fazer/Cancelados). Acompanhamento em diante continua exigindo onboarding concluído.
- Texto do aviso na aba Onboarding técnico (`frontend/components/implantacao/Portal.tsx`).
- Docs: 6 de `docs/produto/`, manual e novidades.

## Verificado
- `vitest`: `implantacao-onboarding-coluna` (novo, 4), `implantacao-portal`, `implantacao-onboarding-ficha`, `implantacao-cronometro`: 28/28.
- `tsc --noEmit` sem erros nos arquivos mexidos.
- **Não verificado em produção:** não publicado (ver Pendente).

## Decisões e porquês
- A sincronização automática da ficha ao abrir o card **não** conta como início (a ficha pode vir preenchida da venda); só ação do técnico conta.
- Só implantação nova (não legada), com técnico, não cancelada, em BackLog/A fazer. Serviços (módulo SERVICO) ficam de fora: não têm onboarding.
- A etapa de execução acompanha a coluna (`etapaDaColuna`), mantendo "uma só verdade".

## Pendente
- **Deploy barrado** pela tabela `AgendaTecnico` (agenda do técnico, commit 55fee79) fora do `PERMITIDO`, aguardando autorização da Jessica. Este commit entra no ar junto no próximo deploy.

## Próxima sessão
Conferir no portal que um card em "A fazer" vai para "Em andamento" ao dar Play no onboarding.
