# Sprint 16 — Step 01 — André Vieira (PM)
# Nutrição / Recontato Futuro

## Contexto

Quando um lead é marcado como "Perdido" com `podeRecontatar = sim` e uma `dataRecontato`, ele entra na fila de nutrição. O módulo de Recontato Futuro gerencia essa fila: exibe quais leads devem ser recontactados hoje/esta semana, envia alertas automáticos ao vendedor responsável, e permite reagendar ou reativar o lead diretamente da tela.

## User Stories

**US-1601:** Como Vendedor, quero ver a lista de leads para recontato (agendados para hoje e próximos 7 dias), para não perder oportunidades de recuperação.

**US-1602:** Como Vendedor, quero reativar um lead da fila de recontato (mudar de Perdido → Ativo, voltando para a etapa Qualificação) sem perder o histórico anterior.

**US-1603:** Como Vendedor, quero reagendar um recontato (mudar a dataRecontato), caso o lead não esteja pronto ainda.

**US-1604:** Como Vendedor/Supervisora, quero receber alertas no sistema (badge no ícone de sino) quando houver leads para recontato vencidos ou de hoje.

**US-1605:** Como Supervisora/CEO, quero ver a fila de nutrição de todos os vendedores, filtrada por vendedor e período.

**US-1606:** Como Supervisora/CEO, quero exportar a fila de recontato em CSV.

## Regras de negócio

- Lead entra na fila de nutrição quando: `status = 'perdido'` AND `podeRecontatar = 'sim'` AND `dataRecontato IS NOT NULL`
- "Vencido": `dataRecontato < hoje`
- "Hoje": `dataRecontato = hoje`
- "Próximos 7 dias": `dataRecontato > hoje AND dataRecontato <= hoje + 7 dias`
- Reativar lead: muda `status → 'ativo'`, `etapaFunil → 'qualificacao'`, zera `motivoPerda`, `dataRecontato`, `podeRecontatar`; registra HistoricoLead tipo 'status_alterado' com descricao "Reativado da fila de nutrição"
- Reagendar: só atualiza `dataRecontato`; lead permanece com status='perdido'
- Alertas: cron job existente (já roda a cada hora) — estender para verificar leads de nutrição vencidos/hoje

## Critérios de aceite

- **US-1601:** Página /nutricao com 3 seções: Vencidos (vermelho), Hoje (laranja), Próximos 7 dias (azul). Cada card: lead, empresa, motivo perda, data recontato, vendedor.
- **US-1602:** Botão "Reativar" em cada card; confirmação antes de mudar status.
- **US-1603:** Botão "Reagendar" com datepicker inline; salva nova data sem confirmação.
- **US-1604:** Badge numérico no ícone de alerta no header (vencidos + hoje); tooltip lista até 5 leads.
- **US-1605:** Filtros de vendedor e período no topo; VENDEDOR vê apenas os seus.
- **US-1606:** Botão Exportar CSV com campos: empresa, motivo, data recontato, vendedor, dias em atraso.

## Acesso

| Perfil | Acesso |
|--------|--------|
| VENDEDOR | Vê apenas seus próprios leads de nutrição |
| SUPERVISAO | Vê todos + filtros + export |
| CEO | Vê todos + filtros + export |
| ADMIN | Igual CEO |
