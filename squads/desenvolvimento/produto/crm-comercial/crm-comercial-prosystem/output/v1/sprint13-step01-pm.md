# Sprint 13 — Step 01 — André Vieira (PM)
# Ranking Comercial Avançado

## Contexto

O CRM já possui um Ranking básico no Dashboard de Supervisão (leads ativos, propostas enviadas, fechamentos do mês). O Sprint 13 eleva isso a um módulo dedicado com metas configuráveis, histórico mensal, gamificação visual e visão comparativa entre períodos.

## User Stories

**US-1301:** Como Supervisora/CEO, quero ver o ranking de vendedores por receita fechada, número de fechamentos e taxa de conversão no mês atual, para identificar os melhores desempenhos.

**US-1302:** Como Supervisora/CEO, quero configurar metas mensais por vendedor (leads abordados, propostas enviadas, fechamentos, MRR) para acompanhar o atingimento em tempo real com barra de progresso.

**US-1303:** Como Supervisora/CEO, quero comparar o desempenho do mês atual com o mês anterior e com a meta, com indicadores de variação (+/-%).

**US-1304:** Como Vendedor, quero ver meu próprio ranking (posição no time, minha barra de progresso vs meta) e as conquistas desbloqueadas (badges de 1º lugar, meta batida, maior deal, etc.).

**US-1305:** Como Supervisora/CEO, quero exportar o ranking do período em CSV ou PDF com todos os indicadores.

**US-1306:** Como CEO, quero ver o ranking consolidado do time com filtro por período (mês atual, mês anterior, trimestre, ano) e ordenação por qualquer coluna.

## Critérios de aceite

- **US-1301:** Tabela com colunas: posição, vendedor, fechamentos, MRR fechado, propostas enviadas, taxa de conversão (fechamentos/propostas × 100). Ordenação padrão: MRR decrescente.
- **US-1302:** Formulário de metas por vendedor (campo por campo). Metas salvas por mês/ano. Progress bar com % de atingimento por indicador.
- **US-1303:** Coluna "vs. mês anterior" com delta absoluto e percentual (+12% em verde / -5% em vermelho).
- **US-1304:** Vendedor vê somente sua linha + posição no ranking + badges conquistados + gráfico de linha mensal dos últimos 6 meses.
- **US-1305:** Export CSV e PDF do ranking com data/hora de geração e período selecionado.
- **US-1306:** Filtro de período no topo (select: Mês atual | Mês anterior | Trimestre | Ano). Clique no cabeçalho da coluna ordena.

## Indicadores do ranking

| Indicador | Fórmula |
|-----------|---------|
| Fechamentos | COUNT(leads status='fechado' no período) |
| MRR Fechado | SUM(potencialMensalidade dos leads fechados no período) |
| Propostas Enviadas | COUNT(propostas criadas no período) |
| Taxa de Conversão | fechamentos / propostas enviadas × 100 |
| Ticket Médio | MRR Fechado / Fechamentos |
| Leads Abordados | COUNT(leads do vendedor com dataUltimoContato no período) |

## Badges de gamificação

| Badge | Condição |
|-------|---------|
| 🥇 Campeão do Mês | 1º lugar em MRR no mês |
| 🎯 Meta Batida | Atingiu 100% da meta de fechamentos |
| 💎 Maior Deal | Lead fechado com maior potencialMensalidade do mês |
| 🔥 Em Chamas | 3 fechamentos consecutivos na semana |
| 📈 Crescimento | MRR deste mês > mês anterior |

## Fluxo de navegação

- /ranking — tela principal (Supervisão/CEO)
- /ranking/metas — configuração de metas (só Supervisão/CEO)
- /ranking/meu-desempenho — visão do Vendedor (redirect automático por perfil)

## Perfis e acesso

| Perfil | Acesso |
|--------|--------|
| VENDEDOR | Somente "Meu Desempenho" — posição, metas, badges, histórico pessoal |
| SUPERVISAO | Ranking completo + configurar metas + export |
| CEO | Ranking completo + configurar metas + export + todos os períodos |
| ADMIN | Igual CEO |
