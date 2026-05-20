# Step 03 — Daniel Mendes (Tech Lead)
# Sprint 1: Módulo de Leads — Arquitetura e Modelagem

## Schema Prisma — Modelo Lead

Entidades: Lead, HistoricoLead
Relacionamentos: Lead → User (vendedor/supervisora/criadoPor), Lead → Atividade, Lead → Proposta, Lead → HistoricoLead

## Campos críticos do modelo Lead

- codigo: Int autoincrement (código amigável exibido na UI)
- etapaFunil: String enum das 10 etapas
- temperatura: String (quente/morno/frio/desqualificado)
- status: String (novo/em-atendimento/qualificado/.../fechado/perdido)
- vendedorId: FK para User (com índice)
- dataProximoContato: DateTime (base dos alertas de follow-up)
- dataUltimoContato: DateTime (base dos alertas de lead parado)
- diasNaEtapaAtual: Int (base dos alertas de lead parado na etapa)

## Endpoints

GET    /api/leads                 — Lista com filtros e paginação
POST   /api/leads                 — Criar lead
GET    /api/leads/:id             — Detalhe
PATCH  /api/leads/:id             — Editar dados
PATCH  /api/leads/:id/status      — Mudar etapa/status (valida campos obrigatórios)
PATCH  /api/leads/:id/perda       — Marcar como perdido
GET    /api/leads/:id/historico   — Timeline de alterações
POST   /api/leads/:id/atividades  — Registrar atividade
GET    /api/leads/exportar        — CSV (supervisao/ceo)

## Autorização por role

- Vendedor: lê/edita apenas seus leads. Sem export.
- Supervisão: lê/edita todos. Export permitido.
- CEO/Admin: acesso total.

## Índices criados

vendedorId, status, etapaFunil, temperatura, dataProximoContato,
dataUltimoContato, segmento, origem, cidade+estado

## Regra de validação na API

Endpoint PATCH /api/leads/:id/status deve validar campos obrigatórios
por etapa antes de aceitar a transição (retorna 422 com lista de campos faltando).
