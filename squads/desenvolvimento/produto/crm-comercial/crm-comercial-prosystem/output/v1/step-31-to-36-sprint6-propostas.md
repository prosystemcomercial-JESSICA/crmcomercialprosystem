# Sprint 6 — Módulo de Propostas
# 16/16 testes aprovados — HOMOLOGADO

## Modelo Prisma: Proposta
Campos principais: numero (autoincrement), leadId, vendedorId, planoOfertado, valorInstalacaoOriginal, percentualDesconto, valorInstalacaoFinal, valorMensalidade, validade, status, dataEnvio, proximoFollowup
Status: rascunho | enviada | em-negociacao | aprovada | reprovada | vencida | cancelada

## Regra crítica: Aprovar Proposta
1. Valida status (enviada ou em-negociacao)
2. Atualiza proposta → aprovada
3. Move lead para "fechado" via LeadsService.alterarEtapa (com dados de implantação)
4. Registra HistoricoLead tipoEvento: proposta_aprovada

## Alerta automático
Cron job a cada hora: verifica propostas com validade < agora + 2 dias → cria alerta no lead

## PropostaForm
Cálculo automático de valorInstalacaoFinal = valorOriginal - (valorOriginal * desconto / 100)

## 16/16 aprovados — sem bugs
