# 13/11/2026 — Pisca-pisca no tema de Natal do Escritório

## Pedido
Jessica: "No tema de Natal, inclua pisca pisca".

## Feito
- `frontend/components/escritorio/sala-temas.ts`: campo opcional `pisca` no tipo `Tema`; ligado só no Natal.
- `frontend/components/escritorio/SalaViva.tsx`: componente `PiscaPisca` (SVG). Um fio verde cai em curvas a cada 90 px no alto da parede de cada uma das 7 salas, com uma lâmpada a cada 15 px (nenhuma nos ganchos). As lâmpadas são vermelhas, amarelas, verdes e azuis e acendem com brilho em três tempos defasados (animação `sv-acende`, 1,35 s). Fica atrás das placas das salas (z-index 4).
- Com "reduzir movimento" ligado no sistema, para de piscar (regra que já existia para toda a sala).
- Documentos: os seis de `docs/produto/` (item "Temas de feriado"), `docs/comercial/manual-de-uso-assistente.md` e `docs/comercial/novidades-crm.html`. Entrada no `ESTADO.md`.

## Verificado
- `tsc --noEmit` do frontend sem erro nos arquivos do Escritório; eslint limpo; `vitest run tests/sala-temas.test.ts` 3/3.
- Visual numa prévia isolada (mesmo SVG e CSS, Edge sem janela): fio e lâmpadas aparecem certos, sem cobrir a placa da sala.
- **Não verificado** dentro da página real com login. O resultado do deploy está no `ESTADO.md`.

## Decisões e porquês
- SVG em vez de emojis: o varal de emojis já existe nos corredores; o pisca-pisca precisava de lâmpadas que acendem e apagam de verdade, com brilho.
- Uma marca no tema (`pisca`) em vez de testar `id === 'natal'`: se a Jessica quiser luzinhas em outro tema, basta ligar a marca.
- Só nas paredes das salas, sem mexer no varal nem nos enfeites que já existiam.

## Pendente
Nada desta tarefa.

## Próxima sessão
Se ela pedir ajustes (cor, velocidade, mais luzes no café ou na árvore), mexa em `PiscaPisca` e nas regras `.sv-lampada` de `SalaViva.tsx`.
