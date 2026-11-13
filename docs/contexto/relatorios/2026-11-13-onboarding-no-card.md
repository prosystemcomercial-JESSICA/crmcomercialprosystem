# 13/11/2026: tela "Onboarding técnico" sai do menu; barra do onboarding no card do Quadro

## Pedido
A Jessica mandou o print da tela Onboarding técnico do Portal Técnico: "Acho que não precisamos dessa seção, já estão nos cards dos clientes, isso acaba ficando repetitivo, vamos deixar apenas no card e implemente a barra de evolução lá."

## Feito
- `backend/src/lib/implantacao/portal.ts`: função pura `etapaOnboarding` (etapa, feitos, total, prazo de 2 dias úteis, atrasado), antes duplicada dentro da rota.
- `backend/src/routes/implantacao-portal.ts`: `GET /implantacoes/quadro` devolve `onboarding: { etapa, prazo, atrasado }` por card; `GET /implantacoes/onboarding` usa a mesma função (sem tela agora).
- `frontend/components/implantacao/Portal.tsx`: bloco `OnboardingNoCard` no card do Quadro (etapa, barra de evolução, itens, prazo, "atrasado" em vermelho), no lugar da etiqueta "🔒 Onboarding x/y"; tela `OnboardingTecnico` removida.
- `frontend/app/portal-tecnico/page.tsx`: item do menu removido; `?tab=onboarding` abre o Quadro.
- Teste novo: `backend/tests/implantacao-onboarding-etapa.test.ts`. Docs de produto, manual e novidades atualizados.

## Verificado
- vitest: `implantacao-onboarding-etapa`, `implantacao-portal`, `implantacao-onboarding-coluna`: 21/21.
- tsc (backend e frontend): sem erro nos arquivos mexidos.
- Deploy e visual em produção: ver ESTADO.md (registrado depois do deploy).

## Decisões e porquês
- O bloco só aparece em implantações com onboarding pendente (não em serviço, legado ou concluído), para não poluir o card.
- A seção Onboarding técnico dentro do card continua: é onde o técnico trabalha.
- Commit montado com índice temporário: havia mudanças de outra sessão (agente de oferta / Joana / Heitor) nos mesmos arquivos, que não foram levadas.

## Pendente
- Em ~30 dias, se ninguém sentir falta, apagar `GET /implantacoes/onboarding` e `apiClient.getOnboardingTecnico` (Claude, sem decisão da Jessica).

## Próxima sessão
Nada obrigatório. Se a Jessica pedir ajuste visual do bloco, ele está em `OnboardingNoCard` (`Portal.tsx`).
