# Step 04 — Felipe Santos (Backend Developer)
# Sprint 1: Módulo de Leads — Backend

## Estrutura de arquivos
src/modules/leads/
  leads.routes.ts — rotas
  leads.controller.ts — handlers
  leads.service.ts — regras de negócio
  leads.schema.ts — validações Zod
  leads.types.ts — tipos TypeScript
  leads.constants.ts — enums

## Validações críticas implementadas

1. createLeadSchema: obrigatório whatsapp + segmento + origem + vendedorId + (empresa OU responsável)
2. etapaFieldsRequired: mapa de campos obrigatórios por etapa — validado no PATCH /status
3. Autorização por role: vendedor vê/edita só seus leads
4. Histórico automático em toda alteração de etapa, status, vendedor

## Endpoints implementados
GET    /api/leads               — filtros: status, segmento, temperatura, parados, followupVencido, search, page, limit
POST   /api/leads               — cria + registra histórico "lead_criado"
GET    /api/leads/:id           — detalhe + historico + propostas count
PATCH  /api/leads/:id           — edita + registra histórico de alterações
PATCH  /api/leads/:id/status    — valida campos obrigatórios da etapa → 422 se faltando
PATCH  /api/leads/:id/perda     — valida motivo+obs+recontato → move para perdido
GET    /api/leads/:id/historico — timeline de eventos
POST   /api/leads/:id/atividades — cria atividade + atualiza dataUltimoContato + dataProximoContato
GET    /api/leads/exportar      — CSV (403 para vendedor)

## Regras de negócio implementadas

- Vendedor não vê leads de outros (filtro automático no service)
- Transição de etapa valida campos obrigatórios (retorna 422 + lista de campos faltando)
- Toda alteração registra no HistoricoLead automaticamente
- dataUltimoContato atualizado automaticamente ao registrar atividade
- Leads parados = dataUltimoContato < agora - 3 dias
