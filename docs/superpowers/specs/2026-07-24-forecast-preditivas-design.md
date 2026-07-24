# Forecast/Preditivas — Análise Comercial

## Contexto

Sub-projeto da auditoria UX/Produto/CRM, sequência de "Métricas comerciais que faltam" (tela `/analise-comercial` já implementada). Esta parte adiciona previsão de verdade: projeta o futuro em vez de só descrever o passado.

## Escopo

1. **Alerta de ritmo de meta** — compara % do mês decorrido vs % da meta batida, por vendedor.
2. **Projeção de MRR futuro** — M+1, M+2, M+3, combinando MRR atual + pipeline ponderado − churn esperado.
3. **Score de fechamento por lead individual** — regras ponderadas por sinais históricos (etapa, temperatura, dias parado, origem, segmento), com fallback para a probabilidade fixa por etapa quando a amostra é pequena.
4. **Risco de churn por cliente** — reaproveita `HealthScore` existente, adiciona tabela `HealthScoreSnapshot` para tendência ao longo do tempo, ordena por MRR em risco.

Ordem de implementação: 1 → 2 → 3 → 4 (do mais simples ao mais pesado), cada um commitado e deployado separadamente. Tudo na rota `GET /analise-comercial` existente e na tela `/analise-comercial` existente — sem novas telas.

## Design

### 1. Ritmo de meta
Em `analise-comercial.ts`, na seção `atingimento_meta` já existente: adicionar `dias_decorridos_pct` (dia atual / dias do mês) e `ritmo` (`'acima' | 'no_ritmo' | 'abaixo'`, com margem de ±5pp), comparando `percentual` (já calculado) contra `dias_decorridos_pct`. Também `projecao_fim_mes` = `realizado_valor / dias_decorridos_pct` (regra de três simples: se o ritmo atual continuar, quanto fecha o mês).

### 2. Projeção de MRR futuro
Nova seção `projecao_mrr` na resposta: array de 3 pontos `{ mes: 'M+1'|'M+2'|'M+3', mrr_projetado }`.
- MRR atual: mesma query usada no dashboard (`Cliente.mensalidade_base` soma dos ativos, ou o campo que o dashboard-power já usa).
- Pipeline ponderado por mês: reaproveita o cálculo de forecast (etapa → probabilidade → valor anualizado), mas distribui a receita esperada em 3 baldes mensais iguais (simplificação: sem dado de "previsão de fechamento" por data, divide o total ponderado por 3).
- Churn esperado por mês: soma do `mrr_perdido` potencial = MRR dos clientes com `nivel` CRITICO ou RISCO no HealthScore atual, multiplicado por uma taxa histórica de conversão risco→churn real (calculada comparando quantos clientes que estiveram em CRITICO/RISCO nos snapshots realmente ficaram `situacao: INATIVA` depois — com fallback fixo de 15%/mês para CRITICO e 5%/mês para RISCO se não houver amostra histórica suficiente ainda).
- `mrr_projetado[i] = mrr_atual + soma(pipeline_mensal, 1..i) − soma(churn_mensal, 1..i)`.

### 3. Score de lead individual
Nova função `calcularScoreLeads(prisma, scopeId)`:
- Busca fechamentos e perdas dos últimos 12 meses (`Lead` com `status IN (FECHADO, PERDIDO)` ou equivalente via `PropostaComercial`), com os sinais: `etapa_comercial`, `temperatura`, `origem`/`utm_source`, `segmento`.
- Calcula taxa de conversão por combinação (etapa + temperatura) — nível de granularidade que ainda gera amostra razoável. Se a combinação tem menos de 5 casos históricos, usa a probabilidade fixa por etapa (`PROB_ETAPA`) como fallback.
- Para cada lead ativo hoje, calcula `dias_na_etapa` (via `LeadObservacao` mais recente com `coluna_nova` = etapa atual, fallback `updated_at`) como sinal extra de penalização: score reduzido proporcionalmente se `dias_na_etapa` > mediana histórica daquela etapa.
- Retorna lista de leads ativos com `{ lead_id, nome, etapa, temperatura, score_pct, valor_estimado, valor_ponderado }`, ordenada por `valor_ponderado` desc.
- Nova seção `leads_priorizados` na resposta (top 15).

### 4. Risco de churn com tendência
- Migração: `HealthScoreSnapshot { id, cliente_id, score, nivel, mrr_momento, created_at }`, índice em `[cliente_id, created_at]`.
- Em `health-score.ts`, após cada upsert de `HealthScore` (rota individual e em lote), gravar um snapshot best-effort (`.catch(() => {})`, não bloqueia a resposta).
- Nova seção `clientes_em_risco` em `analise-comercial.ts`: busca `HealthScore` com `nivel IN (CRITICO, RISCO)`, junta `Cliente.mensalidade_base` (MRR em risco), busca o snapshot mais antigo com `created_at >= 25 dias atrás` para comparar e calcular `tendencia` (`'piorando' | 'estavel' | 'melhorando' | null` se não houver snapshot antigo o bastante). Ordena por `mrr_momento` desc (prioriza quem tem mais R$ em risco).

## Testes
- Testar com zero histórico de fechamentos (score de lead cai 100% no fallback de probabilidade fixa, sem erro).
- Testar com zero snapshots de Health Score (tendência sempre `null`, sem quebrar).
- Testar projeção de MRR com zero pipeline e zero clientes em risco (mostra só o MRR atual, achatado nos 3 meses).
- Conferir visualmente no navegador antes de considerar concluído (tela já existente, mudança é de dados + novos cards).
