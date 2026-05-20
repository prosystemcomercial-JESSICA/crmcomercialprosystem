# Step 05 — Isabela Costa (Frontend Developer)
# Sprint 1: Módulo de Leads — Frontend

## Estrutura Next.js 14

app/(crm)/leads/page.tsx — Lista
app/(crm)/leads/novo/page.tsx — Criar
app/(crm)/leads/[id]/page.tsx — Detalhe

## Componentes implementados

- LeadTable — tabela com filtros persistidos na URL via searchParams
- LeadFilterPanel — filtros colapsáveis com aplicar/limpar
- LeadForm — react-hook-form + zod, 3 seções organizadas
- LeadDetailHeader — status + temperatura + ações rápidas
- ActivityTimeline — histórico cronológico
- ActivityModal — modal de registro rápido
- LossModal — modal de marcar como perdido com validação

## Hooks React Query

- useLeads(filters) — lista com cache 30s, key inclui filtros
- useLead(id) — detalhe
- useCreateLead — mutation com invalidação da lista
- useUpdateLeadStatus — mutation com toast de erro 422 (campos faltando)
- useMarkLeadLost — mutation com confirmação

## Funcionalidades implementadas

- Filtros persistidos na URL (compartilháveis por link)
- StatusBadge com cor por status
- TempBadge com emoji por temperatura
- Próximo contato em vermelho se vencido
- Badge vermelho em leads parados (3+ dias)
- Estado vazio com CTA de cadastrar
- Estado de carregando com skeleton
- Paginação com 25 itens por página
- Vendedor não vê leads de outros (API já filtra, UI reflete)
