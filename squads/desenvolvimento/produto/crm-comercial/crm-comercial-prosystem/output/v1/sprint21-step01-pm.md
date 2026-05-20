# Sprint 21 — Step 01 — André Vieira (PM)
# BI Avançado — Dashboard Executivo

## Contexto

CEO e Supervisoras precisam de uma visão consolidada de toda a operação comercial — não apenas a tela de Dashboard do Sprint 5 (que já existe com métricas básicas), mas um painel analítico completo com funil visual, cohort de conversão, análise de perda, origem de leads e projeção de receita. Exportável em Excel e PDF para reuniões de diretoria.

## User Stories

**US-2101:** Como CEO, quero ver um painel executivo com os principais KPIs comerciais do mês em cards (leads ativos, propostas enviadas, contratos fechados, receita mensal, taxa de conversão, ticket médio), com comparativo ao mês anterior.

**US-2102:** Como Supervisora, quero visualizar o funil de vendas graficamente (barras horizontais por etapa com contagem e % de conversão etapa a etapa), filtrável por período e vendedor.

**US-2103:** Como CEO, quero ver a análise de cohort de conversão: de todos os leads criados em cada mês dos últimos 6 meses, qual % chegou a proposta, fechamento e contrato.

**US-2104:** Como Supervisora, quero ver a análise de perdas: leads perdidos por motivo (campo motivoPerda), por etapa onde foram perdidos e por concorrente escolhido, para entender onde estamos perdendo.

**US-2105:** Como CEO, quero ver a origem dos leads (campo origem/fonte — se disponível, ou "Sem origem") com barra de comparação de taxa de conversão por origem.

**US-2106:** Como usuário, quero exportar qualquer seção do BI em Excel (dados brutos) ou PDF (gráfico + tabela formatada), com período e filtros aplicados.

## Critérios de aceite

- **US-2101:** 6 cards KPI com valor atual + delta percentual vs mês anterior. Cores: verde se melhora, vermelho se piora. Período selecionável (mês atual / últimos 3 meses / últimos 6 meses / personalizado).
- **US-2102:** Funil horizontal: etapas na vertical, barra horizontal com contagem de leads. Percentual de conversão entre etapas exibido entre barras. Filtros: período (datepicker range), vendedor (multiselect).
- **US-2103:** Tabela de cohort: linhas = meses (jan-jun/2026), colunas = marco (criado / proposta / fechado / contrato), célula = % do cohort que atingiu aquele marco. Heatmap de cores (vermelho-amarelo-verde).
- **US-2104:** 3 gráficos de pizza/donut: (a) motivo de perda, (b) etapa de perda, (c) concorrente. Período filtrável.
- **US-2105:** Tabela: origem | total leads | % convertidos | receita gerada. Ordenável por qualquer coluna.
- **US-2106:** Botão "Exportar" em cada seção. Excel = XLSX com dados brutos. PDF = gráfico renderizado + tabela formatada, com logo ProSystem, período e filtros no cabeçalho.

## Regras

- Dados calculados on-the-fly (sem tabela de snapshot); cache 10min por combinação de filtros
- Cohort usa `createdAt` do lead como âncora do mês; marcos usam datas dos eventos no HistoricoLead
- VENDEDOR não tem acesso ao BI Avançado (apenas ao `/meu-desempenho` do Sprint 13)
- Filtro de período: se não selecionado → mês atual (padrão)
- Delta vs mês anterior: calculado automaticamente sem filtro adicional
- "Origem" mapeada para campo `Lead.origem` (se existir) — caso não exista no schema atual, usar texto "Sem origem" para todos
- Exportação PDF usa `@react-pdf/renderer` (já instalado); Excel usa `xlsx` (já instalado no Sprint 12)

## Acesso por perfil

| Perfil | BI Avançado |
|--------|-------------|
| VENDEDOR | ❌ |
| SUPERVISAO | ✅ |
| CEO | ✅ |
| ADMIN | ✅ |
