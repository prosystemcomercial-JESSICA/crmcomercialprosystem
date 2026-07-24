# Financeiro — KPIs no Centro de Custos

## Contexto

Sub-projeto da auditoria UX/Produto/CRM (sequência de Dashboard → Análise Comercial → Forecast/Preditivas). O Centro de Custos (`frontend/app/centro-custos/page.tsx`) já tinha balanço geral, entradas/saídas por categoria e comissões, mas nenhum KPI financeiro analítico (DRE, fluxo projetado, churn financeiro).

## Escopo

3 novas seções no Centro de Custos existente, inseridas entre "Balanço Geral" e "Comissões do mês":

1. **DRE simplificado** — reapresentação dos campos já calculados por `/financeiro/balanco` (receita → despesas → comissões destacadas → resultado líquido), sem rota nova.
2. **Fluxo de caixa projetado (M+1 a M+3)** — novo endpoint `GET /financeiro/fluxo-projetado`: MRR contratado atual (recorrente esperado) − despesas já lançadas com competência naquele mês futuro. Não infere recorrência: se não houver despesa lançada, mostra aviso em vez de custo zero.
3. **Churn financeiro mensal** — novo endpoint `GET /financeiro/churn-mensal`: série de 6 meses de `Cliente.mrr_perdido` agrupado por mês de `inativado_em`, em gráfico de barras.

**Fora de escopo** (decidido no brainstorm): inadimplência real — não há tracking de pagamento por cliente/mês hoje (só input manual pontual em `CasoChurn`); implementar isso exigiria um sistema novo de contas a receber, não é um KPI que falta calcular. Fica como sub-projeto futuro se o usuário priorizar.

## Testes
- Testar mês sem nenhuma despesa lançada no futuro (fluxo projetado mostra aviso, não custo zero).
- Testar sem nenhum churn no período (gráfico mostra estado vazio, não gráfico quebrado).
- Conferir visualmente no navegador.
