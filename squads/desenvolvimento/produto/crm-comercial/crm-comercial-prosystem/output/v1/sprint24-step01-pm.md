# Sprint 24 — Step 01 — André Vieira (Product Manager)
# Módulo de Metas e Comissões — Core — Escopo e Requisitos

## Contexto

Módulo que fecha o ciclo comercial da Prosystem. Conecta:
- Metas definidas pela supervisão (mensal, por vendedor, por tipo)
- Comissões calculadas automaticamente sobre vendas (Contrato), serviços (ServicoContratado) e indicações
- Recebimentos financeiros que disparam liberação de comissão
- Indicações para parceiros externos com rastreamento de conversão e comissão
- Parceiros cadastrados com regras de comissão padrão

**Integração com módulos existentes:**
- `Contrato` (Sprint 1) — fonte primária de vendas/MRR
- `ServicoContratado` (Sprint 22) — serviços que geram comissão
- `Lead` / `ClienteBase` — cliente indicado
- `User` — vendedores e supervisores

---

## Decisão de escopo (Sprint 24 × Sprint 25)

| Sprint 24 — Core | Sprint 25 — Avançado |
|------------------|----------------------|
| Meta (CRUD + cálculo realizado) | Dashboard Vendedor completo |
| RegraComissao (parametrização) | Dashboard Supervisor completo |
| Comissao (registro + motor de cálculo) | FechamentoMensal |
| Recebimento (registro + disparo de liberação) | Relatórios (4 tipos XLSX) |
| Parceiro (CRUD) | Ranking da equipe |
| IndicacaoParceiro (lançamento + status) | Cron de recálculo automático |

---

## User Stories — Sprint 24

### US-2401 — Cadastro de Parceiros

**Como** SUPERVISAO/CEO/ADMIN  
**Quero** cadastrar empresas parceiras  
**Para** que vendedores possam indicar clientes para elas e ganhar comissão

**Critérios:**
- [ ] CRUD de Parceiro: nome, CNPJ, categoria, produto/serviço, contato, comissão padrão, tipo de comissão padrão, status
- [ ] 15 categorias: TEF, Certificado digital, Contabilidade, Equipamentos, Impressoras, Balanças, E-commerce, Delivery, PBM, Marketing, Telefonia, Internet, Automação comercial, Consultoria, Outro
- [ ] Status: Ativo / Inativo / Em negociação / Suspenso / Bloqueado / Encerrado
- [ ] VENDEDOR: somente visualização dos ativos

---

### US-2402 — Parametrização de Metas

**Como** SUPERVISAO/CEO/ADMIN  
**Quero** criar metas comerciais por vendedor por mês  
**Para** definir expectativas e vincular comissão a performance

**Critérios:**
- [ ] CRUD de Meta: vendedorId, mes (1-12), ano, tipoMeta, valorMeta (para tipos numéricos), quantidadeMeta (para tipos contagem), status
- [ ] 13 tipos de meta: Contratos fechados / MRR novo / Receita de instalação / Receita total recebida / Propostas enviadas / Apresentações realizadas / Leads trabalhados / Leads qualificados / Serviços vendidos / Indicações realizadas / Indicações convertidas / Receita por indicações / Meta personalizada
- [ ] Flags de controle: metaPrincipal, contaParaComissao, contaParaRanking, permiteComissaoSemBaterMeta, exigeRecebimentoParaLiberar, exigeContratoAssinado, exigePagamentoEntrada
- [ ] Valor realizado calculado automaticamente: query sobre Contrato/ServicoContratado/IndicacaoParceiro do período
- [ ] VENDEDOR: somente leitura das suas metas

---

### US-2403 — Parametrização de Regras de Comissão

**Como** SUPERVISAO/CEO/ADMIN  
**Quero** configurar regras de comissão por vendedor e tipo de receita  
**Para** automatizar o cálculo sem depender de planilhas manuais

**Critérios:**
- [ ] CRUD de RegraComissao: nome, tipoComissao (Percentual/Valor fixo/Percentual por faixa/Valor fixo por faixa/Mista/Manual/Sem comissão), vendedorId (nullable → aplica a todos), aplicarParaTodos
- [ ] Base de cálculo (13 opções conforme spec)
- [ ] Campos de valor: percentual, valorFixo, comissaoMinima, comissaoMaxima
- [ ] Condições: dependeRecebimento, dependeContratoAssinado, dependeImplantacaoConcluida, dependeAprovacaoSupervisao, calculaSobreValorBruto, considerarDesconto
- [ ] Período de validade: dataInicio, dataFim
- [ ] Status: Ativa / Inativa / Em teste / Encerrada / Aguardando aprovação / Cancelada
- [ ] Apenas 1 regra ativa por vendedor por base de cálculo (validação no service)

---

### US-2404 — Registro de Comissão (motor automático)

**Como** sistema (automático)  
**Quero** calcular e registrar comissão toda vez que uma venda/serviço/indicação for criada  
**Para** que vendedores vejam comissão prevista em tempo real

**Critérios:**
- [ ] Ao criar Contrato → `calcularComissaoContrato(contratoId)` → cria registro Comissao com status "Prevista"
- [ ] Ao criar ServicoContratado com lancadoPorId → `calcularComissaoServico(servicoId)` → cria Comissao
- [ ] Ao marcar IndicacaoParceiro como "Convertida" → `calcularComissaoIndicacao(indicacaoId)` → cria Comissao
- [ ] Motor busca RegraComissao ativa do vendedor (ou global) pela base de cálculo aplicável
- [ ] Status inicial: Prevista → muda para Liberada quando condições da regra são satisfeitas
- [ ] Motor de liberação automática: ao registrar Recebimento com status "Recebido", verifica regras vinculadas e libera comissões pendentes

---

### US-2405 — Recebimentos

**Como** FINANCEIRO/SUPERVISAO/CEO/ADMIN  
**Quero** registrar recebimentos vinculados a contratos e serviços  
**Para** controlar o que foi recebido e disparar liberação de comissão

**Critérios:**
- [ ] CRUD de Recebimento: vendedorId, clienteNome, clienteCNPJ, tipoReceita (Instalação/Mensalidade/Serviço/Upgrade/Indicação/Outro), origemReceita, valorVendido, valorRecebido, saldoPendente, formaPagamento, statusRecebimento
- [ ] Vinculação opcional: contratoId (FK) ou servicoId (FK)
- [ ] Campos de parcela: qtdParcelas, valorEntrada, dataVencimentoEntrada, entradaRecebida, parcelaAtual, valorParcela, proximoVencimento
- [ ] Campos de comissão: comissaoPrevista, comissaoLiberada, comissaoPaga, statusComissao, dataLiberacaoComissao
- [ ] Ao salvar Recebimento com statusRecebimento = "Recebido" → disparar `verificarLiberacaoComissoes(recebimentoId)`
- [ ] VENDEDOR: vê somente os seus recebimentos (vendedorId = userId)

---

### US-2406 — Indicações para Parceiros

**Como** VENDEDOR/SUPERVISAO/CEO/ADMIN  
**Quero** lançar indicações de clientes para empresas parceiras  
**Para** registrar o esforço comercial e ganhar comissão quando a venda acontecer

**Critérios:**
- [ ] CRUD de IndicacaoParceiro: vendedorId, parceiroId, clienteNome, clienteCNPJ, clienteLeadId (optional), clienteBaseId (optional), segmento, responsavelNome, telefone, whatsapp, email, produtoServico, observacao
- [ ] Comissão da indicação: tipoComissao (herdado do Parceiro ou customizado), percentual, valorFixo, comissaoPrevista, comissaoConfirmada, comissaoLiberada, comissaoPaga
- [ ] Status (10 estados): Lançada → Enviada ao parceiro → Aguardando retorno → Parceiro entrou em contato → Cliente em negociação → Convertida → Não convertida → Cancelada → Comissão liberada → Comissão paga
- [ ] Validação: parceiroConfirmouRecebimento, clienteFechouComParceiro, aprovadoPorId, dataAprovacao
- [ ] Ao marcar "Convertida" → calcula comissão automaticamente
- [ ] VENDEDOR: vê e lança somente as suas indicações

---

## Adição sugerida (eficiência): Cron de verificação

- Cron diário (à meia-noite): verifica Recebimentos com `proximoVencimento < hoje` e status ≠ Recebido → marca como "Vencido"
- Cron diário: recalcula `valorRealizado` nas Metas ativas do mês corrente

---

## Sprint 24 — PRONTO PARA UX ✅
