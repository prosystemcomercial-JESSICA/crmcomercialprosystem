# Cards do quadro de implantações e serviços invadindo a coluna vizinha

1. **Pedido:** a Jessica mandou o print do "Quadro · implantações e serviços" com "Vamos ajustar isso aqui". O defeito visível: os cards de A fazer (GARCIA E PERON, RONAIRA) mais largos que a coluna, por cima de Em andamento, com "sem técnico" e o selo "Onboarding" cortados.
2. **Feito:** em `frontend/components/implantacao/Portal.tsx`: a coluna do quadro ganhou `gridTemplateColumns: minmax(0, 1fr)` (antes a grade crescia com o conteúdo), o card ganhou o mesmo limite e `minWidth: 0`, o rodapé (prazo + técnico) quebra linha com o técnico à direita, e a etiqueta (`Etq`) usa `maxWidth: 100%` em vez de 230 px. Registro em `docs/contexto/ESTADO.md` e `docs/produto/04-briefing-ui-ux.md`.
3. **Verificado:** `npx tsc --noEmit` do frontend sem erros no arquivo. Não verificado em navegador antes do deploy; conferir na produção.
4. **Decisões:** só layout; nada de regra, dados ou banco. Os outros cinco documentos de produto e o manual não mudaram porque não há comportamento novo.
5. **Pendente:** a Jessica conferir o quadro e dizer se queria ajustar mais alguma coisa nele (o pedido foi só o print).
6. **Próxima sessão:** se ela pedir mais ajustes no quadro, o componente é `Portal.tsx`, bloco `pt-kanban` (perto da linha 168).
