# 13/11/2026: quadros da equipe em carrossel, com busca

## Pedido
Print da Jessica da seção "Quadros da equipe" no Escritório: "Ajuste esses cards no escritorio, estao remontando, deixe alinhados, bonitos ou um carrosel assim coloca em uma unica linha e vamos girando o carrosel para encontrar um agente, em cima pode colocar uma barra de pesquisa".

## Feito
- `frontend/components/escritorio/painel/CarrosselQuadros.tsx` (novo): uma linha com rolagem lateral e `scroll-snap`, cards de 300 px todos da mesma altura, setas ‹ › (desligadas nas pontas) e setas do teclado, busca por nome, função ou status sem acento, contador "N de M", aviso quando nada é encontrado, e giro até o card do agente escolhido na sala ou no organograma.
- `frontend/app/escritorio/page.tsx`: a grade `.esc-quadros` foi trocada pelo carrossel (só esse trecho e o import).
- `frontend/components/escritorio/painel/QuadroAgente.tsx`: rodapé em grade fixa (botão principal na largura toda; Agenda e Conversar lado a lado, sempre na base).
- `frontend/components/escritorio/painel/Estilos.tsx`: estilos `.esc-carrossel*`, `.esc-busca`, `.esc-seta` e `.esc-quadro-acoes`.
- Teste `frontend/e2e/carrossel-quadros.spec.ts`, incluído em `playwright.quadro.config.ts` e ignorado no `playwright.config.ts` (o de produção).
- Documentos: os 6 de `docs/produto/`, o manual (5.11), as novidades e o ESTADO.md.

## Verificado
- `npx tsc --noEmit -p .` no frontend: nenhum erro nos arquivos mexidos. Os 3 erros que aparecem são de `components/escritorio/PainelLeads.tsx`, da outra sessão e ainda sem commit.
- Playwright com a API simulada: `carrossel-quadros` 2/2 (12 cards com o mesmo topo e a mesma altura; setas; busca "otavio", "gerente", sem resultado e limpar; 1366 e 390 px sem alargar a página) e `diretoria` 2/2.
- Prints conferidos a olho, em 1366 e 390 px.
- Produção: o commit `e9357d0` entrou no deploy de `4c8affd` (outra sessão, 13/11 12h16): backup 465M, banco sem alterações, build ok, pm2 reiniciado, frontend e backend respondendo. No servidor, o `CarrosselQuadros.tsx` existe e o build tem `esc-carrossel`. Não verificado: a tela logada com dados reais.

## Decisões e porquês
- Escolhi o carrossel em vez de só alinhar a grade, porque foi o que ela descreveu ("uma única linha... girando").
- A rolagem é nativa, com `scroll-snap`, sem biblioteca: funciona com o dedo no celular, com a roda do mouse e com o teclado.
- A busca também olha a função e o status, para dar para procurar por "erro" ou "gerente".
- Os agentes com erro continuam primeiro, como já era na grade.

## Pendente
- A Jessica precisa olhar a tela publicada e dizer se o tamanho do card (300 px) está bom.

## Próxima sessão
- Se ela pedir ajuste de tamanho ou de ordem, mexa em `.esc-carrossel-item` (`Estilos.tsx`) ou na ordenação em `CarrosselQuadros.tsx`, e rode `npx playwright test -c playwright.quadro.config.ts carrossel-quadros`.
