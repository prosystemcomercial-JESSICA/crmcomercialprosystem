# Sprint 8 — Módulo de Perdidos — 10/10 HOMOLOGADO

## Arquitetura
View sobre leads com status = 'perdido'. Sem nova tabela.
Campos adicionados ao Lead: motivoPerda, concorrenteEscolhido, classificacaoPerda, podeRecontatar, dataRecontato

## Endpoints
GET /api/perdidos — lista com filtros por motivo, concorrente, segmento, vendedor, período
GET /api/perdidos/analise — agrupamento por motivo e concorrente (para gráfico CEO)
PATCH /api/perdidos/:leadId/reativar — move lead de volta ao funil + registra histórico

## Funcionalidades
- Análise de perdas com gráfico de barras (reutiliza Recharts)
- Reativar lead: seleciona etapa de destino + observação
- Leads com recontato futuro vencido aparecem destacados

## 10/10 aprovados — sem bugs
