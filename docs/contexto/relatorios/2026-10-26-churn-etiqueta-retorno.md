# 26/10/2026: casos de churn com etiqueta (observação / pediu cancelamento) e retorno marcado

## Pedido
A Jessica pediu, com um print do card de churn: "alguns clientes estão em observação, outros pediram o cancelamento, preciso de uma etiqueta no card marcando isso de forma clara (pode ser bolinha azul piscando; os que pediram cancelamento de fato em vermelho) e ajuste na organização disso. Além disso, preciso marcar data de retorno de atividade, contato ou ação com data marcada, e que dê o alerta para que eu possa entrar em contato ou designe para um colaborador."

## Feito
Detalhe técnico completo na seção "Atualização 26/10/2026 (3ª parte)" de `docs/produto/01-PRD.md` (igual nos seis documentos e no manual). Resumo:
- Banco: colunas novas em `CasoChurn` (`situacao_pedido`, `situacao_pedido_em`, `retorno_*`) e índice em `retorno_em`.
- Backend: `backend/src/lib/churn-retorno.ts` (regras), `backend/src/services/churn-retorno.service.ts`, 4 rotas em `backend/src/routes/casos-churn.ts`, alerta `CHURN_RETORNO` no `/alertas` (`routes/complementos.ts`), agendador de 5 min `iniciarSchedulerRetornoChurn` em `server.ts` (push na hora marcada).
- Tela `frontend/app/casos/page.tsx`: selos no card, organização por etiqueta, filtros, quadro "Retornos para agora e para hoje", seções "Situação do cliente" e "Próximo retorno" na ficha do caso, link `/casos?caso=<id>`.
- Novidades: cartão "Churn: etiqueta e retorno marcado" (selo "No ar").

## Verificado
- `npx vitest run tests/churn-retorno.test.ts`: 5 testes verdes.
- `tsc` do backend: nenhum erro nos arquivos novos (os 2 de `complementos.ts` linhas 184 e 197 são antigos). `tsc` do frontend sem erros na página.
- Fotos com API simulada e dados fictícios (1500 e 400 px): card, filtros, quadro de retornos e ficha do caso conferidos.
- `tests/retencao.test.ts` não roda neste computador (precisa do MySQL da CI). Não verificado aqui.
- CI do GitHub verde em 5e76199 (inclui os testes com banco). Publicado em produção às 20h: backup pre-alter-20261026-195710.sql.gz, ALTER conferido com o diff do Prisma, deploy ok, agendador ligado (log de boot), rota nova responde. Não verificado: um aviso real chegando ao celular.

## Decisões e porquês
- Colunas no próprio caso, e não uma Atividade da agenda: a regra do projeto proíbe atividades automáticas, e o retorno pertence ao caso (aparece no card e no sino). Um retorno por vez; o histórico fica na linha do tempo.
- Sem responsável escolhido, o retorno fica com quem marcou. O aviso vai para o responsável e para quem marcou, uma vez; remarcar zera o aviso.
- Etiqueta e retorno só aparecem em casos abertos; caso encerrado não aceita retorno.
- Organização: em cada coluna, pediu cancelamento no topo, depois em observação, depois retorno vencido, depois o risco.

## Pendente
- Jessica: marcar as etiquetas nos casos atuais (começam sem marcação) e ativar as notificações do celular de quem vai receber retornos.

## Próxima sessão
Quando a Jessica marcar o primeiro retorno, conferir no log `[CHURN-RETORNO]` se o aviso saiu na hora e se apareceu no sino.
