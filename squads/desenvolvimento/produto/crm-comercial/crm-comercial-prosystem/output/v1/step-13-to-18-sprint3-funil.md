# Sprint 3 — Funil Comercial
# Todos os 6 steps executados

## Step 13 — André Vieira (PM)
5 user stories: visualizar kanban, drag-and-drop com validação, filtros por vendedor, drawer de detalhes, alertas visuais

## Step 14 — Patrícia Moura (UX)
Wireframes: Board kanban 10 colunas com scroll horizontal | Card compacto com temperatura/valor/dias | Drawer lateral | Modal de campos obrigatórios

## Step 15 — Daniel Mendes (Tech Lead)
Endpoints: GET /api/funil (agrupado por etapa) | PATCH /api/funil/:id/etapa | GET /api/funil/stats
Reutiliza modelo Lead + etapaFieldsRequired do Sprint 1

## Step 16 — Felipe Santos (Backend)
FunilService.getFunil: agrupa por etapa, calcula flags (followupVencido, leadParado, propostoVencendo), ordena vencidos primeiro
FunilService.moverEtapa: delega ao LeadsService.alterarEtapa (validação já existente)

## Step 17 — Isabela Costa (Frontend)
FunilBoard com DnD Kit | FunilCard draggable com bordas visuais | EtapaModal para campos obrigatórios | LeadDrawer lateral

## Step 18 — Rodrigo Almeida (QA)
15/15 aprovados — HOMOLOGADO

## Nenhum bug encontrado
