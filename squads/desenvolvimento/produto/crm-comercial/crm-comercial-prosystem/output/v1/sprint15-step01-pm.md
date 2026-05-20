# Sprint 15 — Step 01 — André Vieira (PM)
# Histórico Detalhado

## Contexto

O CRM já possui `HistoricoLead` — uma tabela de auditoria que registra automaticamente cada mudança de etapa, criação de proposta, fechamento, etc. O Sprint 15 expõe esse histórico ao usuário como uma timeline visual na ficha do lead, e expande o que é registrado para cobrir também: anotações manuais, atividades concluídas, importação, e contatos registrados.

## User Stories

**US-1501:** Como Vendedor/Supervisora, quero ver a timeline completa de um lead na sua ficha (drawer ou aba), com todos os eventos em ordem cronológica reversa, para entender o histórico completo de interações.

**US-1502:** Como Vendedor, quero adicionar uma anotação manual ao histórico de um lead (nota livre com texto), para registrar informações de conversas que não se encaixam em outros campos.

**US-1503:** Como Supervisora/CEO, quero ver no histórico quem fez cada ação (nome do usuário), para rastrear responsabilidades.

**US-1504:** Como Vendedor, quero filtrar o histórico por tipo de evento (mudança de etapa / proposta / atividade / anotação / importação / sistema), para encontrar rapidamente o evento relevante.

**US-1505:** Como Vendedor/Supervisora, quero ver no histórico as mudanças de valor (de → para) quando a etapa ou o status foi alterado.

**US-1506:** Como CEO/Supervisora, quero exportar o histórico de um lead em PDF para documentação ou compliance.

## Tipos de evento do HistoricoLead

| tipoEvento | Quem dispara |
|------------|-------------|
| `lead_criado` | ao criar lead |
| `etapa_alterada` | ao mover no funil |
| `status_alterado` | fechado / perdido |
| `proposta_criada` | ao criar proposta |
| `proposta_aprovada` | ao aprovar proposta |
| `atividade_criada` | ao registrar atividade |
| `atividade_concluida` | ao concluir atividade |
| `anotacao` | manual pelo usuário |
| `importacao` | via módulo de importação |
| `campo_alterado` | qualquer campo editado |

## Critérios de aceite

- **US-1501:** Timeline na aba "Histórico" da ficha do lead. Cada item: ícone por tipo, data/hora relativa ("há 2 dias"), descrição do evento, usuário responsável.
- **US-1502:** Textarea com botão "Adicionar anotação". Anotação salva como HistoricoLead tipo 'anotacao'. Limite 1000 caracteres.
- **US-1503:** Nome do usuário exibido em cada evento. Eventos de sistema (importação automática) mostram "Sistema".
- **US-1504:** Filtro por tipo no topo da timeline (chips/tags multiselect). "Todos" é o padrão.
- **US-1505:** Eventos de tipo 'etapa_alterada' e 'status_alterado' mostram "De: X → Para: Y" usando valorAnterior/valorNovo.
- **US-1506:** Botão "Exportar PDF" na aba Histórico. PDF com header do lead + timeline completa.

## Campos novos no HistoricoLead

Nenhum — o modelo já possui: `tipoEvento`, `descricao`, `valorAnterior`, `valorNovo`, `usuarioId`. Apenas os eventos faltantes precisam ser disparados nos services existentes.

## Cobertura de eventos a implementar/completar

| Evento | Service que dispara | Já implementado? |
|--------|-------------------|-----------------|
| lead_criado | leads.service.ts | ✅ (Sprint 1) |
| etapa_alterada | leads.service.ts | ✅ (Sprint 3) |
| status_alterado | leads.service.ts | ✅ |
| proposta_criada | proposta.service.ts | ✅ (Sprint 6) |
| proposta_aprovada | proposta.service.ts | ✅ |
| atividade_criada | atividade.service.ts | ✅ (Sprint 5) |
| atividade_concluida | atividade.service.ts | 🔲 adicionar |
| anotacao | novo endpoint | 🔲 novo |
| importacao | importacao.job.ts | 🔲 adicionar |
| campo_alterado | leads.service.ts (PATCH) | 🔲 adicionar |
