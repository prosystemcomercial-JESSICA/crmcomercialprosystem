# 21/10/2026: Health Score, NPS e Pesquisas saem do menu

## Pedido
A Jessica não usa mais os módulos Health Score, NPS e Pesquisas: "Já tenho no CRM de atendimento onde estão concentradas as pesquisas e as qualidades de atendimento" e "Precisamos concentrar nos casos que vamos registrar no Churn". Ela quer o CRM mais enxuto, mas sem perder nada essencial.

## Feito
- `frontend/components/dashboard/DashboardLayout.tsx`: os três itens saíram do grupo Clientes & Pós-venda (e os ícones que ficaram sem uso).
- `frontend/app/health-score/page.tsx`, `nps/page.tsx`, `pesquisas/page.tsx`: agora só redirecionam para `/casos`. As telas antigas continuam no histórico do Git.
- `frontend/app/dashboard/page.tsx`: o aviso "clientes em risco" abre `/casos`.
- `frontend/app/casos/page.tsx`: saiu o cartão "Saúde da carteira por técnico", que levava ao Health Score.
- `frontend/app/manual/page.tsx`, os seis documentos de `docs/produto/`, `docs/comercial/manual-de-uso-assistente.md`, `docs/comercial/novidades-crm.html` e `docs/contexto/ESTADO.md` foram atualizados.

## Verificado
- `npx tsc --noEmit` do frontend: nenhum erro nos arquivos alterados.
- O resultado do commit e do deploy está no ESTADO.md e na resposta da sessão. A navegação no navegador **não foi verificada**.

## Decisões e porquês
- Não houve mudança no backend nem no banco, e nenhum dado foi apagado. As rotas `health-score`, `pesquisa` e `csat` ainda alimentam outras partes do CRM:
  - a pesquisa pública `/pesquisa`, enviada no fim da implantação pelo Portal Técnico, onde uma nota baixa abre um caso de churn;
  - a abertura de caso, que rebaixa o Health Score;
  - o NPS que aparece no Dashboard, no Panorama do CEO, na Análise Comercial e na ficha do cliente.
- As páginas antigas redirecionam em vez de serem apagadas, para que links salvos não deem erro 404.
- As Pesquisas da Sofia, no Escritório, são pesquisas de mercado e não fazem parte do pedido. Ficaram como estão.

## Pendente
- A Jessica decide se o número de NPS também sai do Dashboard, do Panorama do CEO, da Análise Comercial e da ficha do cliente.
- A Jessica decide se a pesquisa do fim da implantação deve parar de ser enviada, caso o CRM de atendimento já faça isso.

## Próxima sessão
Se ela pedir para tirar o NPS das telas, comece por `frontend/components/ceo/PanoramaCEO.tsx`, `frontend/app/dashboard/page.tsx` e `frontend/components/ceo/AnaliseComercialConteudo.tsx`. Não mexa no fluxo de nota baixa que vira caso de churn (`backend/src/routes/pesquisa.ts`) sem a confirmação dela.
