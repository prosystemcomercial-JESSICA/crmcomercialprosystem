# Sprint 4 — Dashboard Geral
# Todos os 6 steps executados

## Step 19 — André Vieira (PM)
5 user stories: dashboard do vendedor, supervisão, CEO, filtros de período, gráficos

## Step 20 — Patrícia Moura (UX)
3 layouts distintos por perfil: Vendedor (KPIs do dia + follow-ups), Supervisão (gargalos + ranking), CEO (executivo + origem + perdas)

## Step 21 — Daniel Mendes (Tech Lead)
7 endpoints analíticos sobre dados existentes. Sem nova tabela.
Cache de 5 minutos nos endpoints de dashboard.

## Step 22 — Felipe Santos (Backend)
dashboard.service.ts com queries paralelas (Promise.all) para performance
groupBy do Prisma para ranking e motivos de perda
Cache implementado com node-cache 5 min TTL

## Step 23 — Isabela Costa (Frontend)
Roteamento por perfil → DashboardVendedor | DashboardSupervisao | DashboardCeo
Recharts: FunilChart (barras), OrigemChart (pizza), MrrLineChart (linha), PerdaChart (barras)
KpiCard com valor, variação percentual em relação ao período anterior e ícone

## Step 24 — Rodrigo Almeida (QA)
12/12 aprovados — HOMOLOGADO
