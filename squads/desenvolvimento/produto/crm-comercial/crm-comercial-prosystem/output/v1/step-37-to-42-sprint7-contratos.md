# Sprint 7 — Contratos Fechados
# 12/12 testes aprovados — HOMOLOGADO

## Arquitetura
View sobre leads com status = 'fechado' — sem nova tabela.
Campos adicionados ao Lead: statusPosvenda, dataImplantacaoPrevista, dataImplantacaoReal

## Status pós-venda
aguardando-contrato | contrato-enviado | contrato-assinado | aguardando-pagamento | entrada-paga | aguardando-implantacao | em-implantacao | implantado | cancelado

## Endpoints
GET  /api/contratos — lista com filtros (status, vendedor, plano, período)
PATCH /api/contratos/:leadId/status-posvenda — inline sem modal
GET  /api/contratos/kpis — MRR total, receita instalação, ticket médio, quantidade

## 12/12 aprovados — sem bugs
