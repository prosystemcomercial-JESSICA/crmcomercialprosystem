# Sprint 25 — Step 01 — André Vieira (Product Manager)
# Módulo de Metas e Comissões — Avançado — Escopo e Requisitos

## Contexto

Complementa o core entregue na Sprint 24. Foca na camada de visibilidade e encerramento do ciclo:
- Vendedor acompanha tudo em um dashboard pessoal consolidado
- Supervisor vê toda a equipe em um painel gerencial com 14 KPIs e ranking
- Fechamento Mensal formaliza o pagamento das comissões liberadas
- Relatórios XLSX para exportação de dados gerenciais
- Ranking da equipe em tempo real
- Cron automático para recálculo noturno de metas e identificação de vencimentos

**Dependências da Sprint 24:**
- Tabelas: Meta, RegraComissao, Comissao, Recebimento, IndicacaoParceiro, Parceiro
- Motor de comissão: calcularComissao*, verificarLiberacaoComissoes

---

## Decisão de escopo (Sprint 25)

| Módulo | Entrega |
|--------|---------|
| Dashboard Vendedor | Cards de resumo + 4 gráficos + 4 tabelas detalhadas |
| Dashboard Supervisor | 14 KPIs + ranking da equipe + visão consolidada |
| FechamentoMensal | CRUD + preview de comissões + aprovação + marcar como pago |
| Relatórios XLSX | 4 tipos: metas, comissões, recebimentos, indicações |
| Ranking da equipe | Tabela por período com posições e pontuação |
| Cron avançado | Recálculo noturno + alertas de vencimento |

---

## User Stories — Sprint 25

### US-2501 — Dashboard do Vendedor

**Como** VENDEDOR  
**Quero** um dashboard pessoal consolidado  
**Para** acompanhar meu desempenho, comissões e metas em tempo real

**Critérios:**
- [ ] Cards de resumo:
  - Comissão prevista no mês
  - Comissão liberada no mês
  - Comissão paga acumulada no ano
  - % atingimento da meta principal do mês
  - Total de contratos fechados no mês
  - Total de indicações realizadas no mês
- [ ] Gráfico 1 — Evolução de comissão (BarChart): comissão prevista vs liberada dos últimos 6 meses
- [ ] Gráfico 2 — Atingimento de metas (RadialBarChart ou BarChart horizontal): todas as metas do mês com % de atingimento
- [ ] Gráfico 3 — Recebimentos por tipo (PieChart): Instalação / Mensalidade / Serviço / Indicação / Outro
- [ ] Gráfico 4 — Linha do tempo de comissões (LineChart): comissão acumulada no mês dia a dia
- [ ] Tabela: Últimas comissões previstas (5 registros) com status e valor
- [ ] Tabela: Metas do mês com progresso visual (ProgressoMeta)
- [ ] Tabela: Últimas indicações com status
- [ ] Tabela: Recebimentos pendentes/vencidos com chip de urgência
- [ ] Endpoint: GET /dashboard/vendedor → dados filtrados por userId (VENDEDOR: seus dados)
- [ ] Cache 5min por vendedorId

---

### US-2502 — Dashboard do Supervisor

**Como** SUPERVISAO/CEO/ADMIN  
**Quero** um painel gerencial com visão consolidada da equipe  
**Para** tomar decisões sobre metas, comissões e performance

**Critérios:**
- [ ] 14 KPIs:
  1. Total de comissões previstas no mês
  2. Total de comissões liberadas no mês
  3. Total de comissões pagas no mês
  4. Total de comissões bloqueadas
  5. Receita total recebida no mês
  6. Receita total vencida (inadimplência)
  7. Total de metas ATIVAS
  8. Metas 100% atingidas
  9. Metas abaixo de 50%
  10. Total de indicações no mês
  11. Indicações convertidas
  12. Taxa de conversão de indicações (%)
  13. Total de parceiros ativos
  14. Ticket médio de comissão por vendedor
- [ ] Ranking da equipe: posição, nome, comissão liberada, % meta principal, contratos, indicações convertidas
- [ ] Gráfico: Comissão por vendedor (BarChart horizontal, top 10)
- [ ] Gráfico: Evolução mensal de comissões liberadas (LineChart 12 meses)
- [ ] Gráfico: Distribuição de status de comissões (PieChart)
- [ ] Gráfico: Indicações por parceiro (BarChart)
- [ ] Filtros: mês/ano, vendedor específico
- [ ] Endpoint: GET /dashboard/supervisor → SUPERVISAO/CEO/ADMIN
- [ ] Cache 10min por combinação de filtros

---

### US-2503 — Ranking da Equipe

**Como** SUPERVISAO/CEO/ADMIN  
**Quero** ver o ranking dos vendedores por período  
**Para** reconhecer os melhores e motivar a equipe

**Critérios:**
- [ ] Endpoint: GET /ranking?mes=:mes&ano=:ano
- [ ] Ranking computa: contratos fechados (peso 3) + MRR fechado (peso 1 por R$ 100) + indicações convertidas (peso 2) + metas atingidas acima de 100% (bônus peso 5)
- [ ] Campos por posição: posição, vendedor, totalPontos, contratosNoMes, mrrNoMes, indicacoesConvertidas, metasAtingidas, comissaoLiberada
- [ ] Empate: desempate por comissaoLiberada (maior primeiro)
- [ ] VENDEDOR vê o ranking completo mas sem valores de comissão dos colegas
- [ ] Cache 10min por mês/ano

---

### US-2504 — Fechamento Mensal

**Como** SUPERVISAO/CEO/ADMIN  
**Quero** formalizar o fechamento e pagamento de comissões ao final de cada mês  
**Para** marcar comissões como pagas e gerar comprovante de pagamento

**Critérios:**
- [ ] Nova tabela: FechamentoMensal (id, mes, ano, criadoPorId, status, totalComissoesLiberadas, totalVendedores, dataAprovacao, aprovadoPorId, dataPagamento, paidById, observacoes, createdAt, updatedAt)
- [ ] Status: ABERTO → EM_REVISAO → APROVADO → PAGO
- [ ] Endpoint: POST /fechamentos → cria fechamento do mês (se não existir); lista todas as comissões LIBERADAS do mês
- [ ] Endpoint: GET /fechamentos/:id → retorna fechamento com lista de comissões por vendedor agrupadas
- [ ] Endpoint: GET /fechamentos/:id/preview → retorna detalhamento por vendedor: nome, qtd comissões, total a pagar
- [ ] Endpoint: PATCH /fechamentos/:id/aprovar → muda status para APROVADO; registra aprovadoPorId e dataAprovacao
- [ ] Endpoint: PATCH /fechamentos/:id/pagar → muda status para PAGO; atualiza Comissao.status = PAGA + dataPagamento para todas as comissões LIBERADAS do fechamento; registra dataPagamento
- [ ] Endpoint: GET /fechamentos → lista fechamentos paginados (mes/ano/status)
- [ ] VENDEDOR: vê apenas o resumo do próprio fechamento (total a receber por mês)

---

### US-2505 — Relatórios XLSX

**Como** SUPERVISAO/CEO/ADMIN  
**Quero** exportar relatórios em XLSX  
**Para** análise offline e apresentação para gestão

**Critérios:**
- [ ] Endpoint: GET /metas-comissoes/relatorios?tipo=:tipo&inicio=:inicio&fim=:fim&vendedorId=:optional
- [ ] 4 tipos:
  - `metas` → colunas: Vendedor, Tipo, Mês/Ano, Meta, Realizado, % Atingido, Status
  - `comissoes` → colunas: Data, Vendedor, Origem, Regra, Valor Base, % Aplicado, Valor Comissão, Status
  - `recebimentos` → colunas: Data, Cliente, CNPJ, Vendedor, Tipo, Vendido, Recebido, Saldo, Status, Comissão Prevista, Comissão Liberada
  - `indicacoes` → colunas: Data, Vendedor, Cliente, Parceiro, Produto, Valor Estimado, Valor Confirmado, Comissão, Status
- [ ] Buffer XLSX server-side via `xlsx` package (padrão Sprint 23)
- [ ] Cache 5min por combinação de params
- [ ] Cabeçalho em português, datas formatadas dd/MM/yyyy, valores em BRL

---

### US-2506 — Cron Avançado

**Como** sistema  
**Quero** processos automáticos noturnos  
**Para** manter dados atualizados sem intervenção manual

**Critérios:**
- [ ] Cron 00:05 (já existe na Sprint 24) — marca Recebimentos VENCIDOS
- [ ] Cron 00:10 (já existe na Sprint 24) — recalcula metas ATIVAS do mês corrente
- [ ] Cron NOVO 00:15 — verificar comissões AGUARDANDO_RECEBIMENTO onde o recebimento associado já está RECEBIDO → libera automaticamente
- [ ] Cron NOVO 06:00 — envia (via log/fila) alerta para comissões BLOQUEADAS há mais de 7 dias sem movimentação (statusAlerta para Sprint futura)
- [ ] Cron NOVO 00:20 — para FechamentoMensal ABERTO do mês anterior: calcular `totalComissoesLiberadas` e `totalVendedores` automaticamente

---

## Sprint 25 — PRONTO PARA UX ✅
