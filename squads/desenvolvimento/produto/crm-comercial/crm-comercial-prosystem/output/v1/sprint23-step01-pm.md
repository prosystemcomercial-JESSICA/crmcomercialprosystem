# Sprint 23 — Step 01 — André Vieira (Product Manager)
# Serviços Contratados Avançado — Escopo e Requisitos

## Contexto

Sprint 23 é a continuação do Sprint 22 (core do módulo Serviços Contratados). Todas as 6 tabelas do banco e a API core já existem. Este sprint adiciona:

1. **Dashboard de Serviços** — 13 KPIs + indicadores comerciais e técnicos
2. **Relatórios** — 5 tipos exportáveis em XLSX
3. **Checklists por tipo de serviço** — listas de verificação vinculadas a ServicoContratado
4. **Campos específicos por subtipo** — formulário extra conforme categoria do serviço
5. **Feriados no cálculo de prazo** — tabela de feriados + cálculo real de dias úteis

---

## User Stories

### US-2301 — Dashboard de Serviços

**Como** SUPERVISAO/CEO/ADMIN/FINANCEIRO  
**Quero** um painel visual com métricas de serviços contratados  
**Para** monitorar desempenho, gargalos e saúde financeira do setor

**KPIs — Bloco 1: Operacional**

| KPI | Cálculo |
|-----|---------|
| Total de serviços no período | COUNT ServicoContratado no range de datas |
| Serviços em aberto | status NOT IN (Concluído, Cancelado, Reprovado) |
| Serviços concluídos | status = Concluído |
| Serviços cancelados | status = Cancelado |
| Tempo médio de conclusão | média (dataConclusaoExecucao - createdAt) em dias |
| Taxa de conclusão | (Concluídos / Total) * 100 |

**KPIs — Bloco 2: Financeiro**

| KPI | Cálculo |
|-----|---------|
| Receita gerada | SUM valorNegociado WHERE status = Concluído |
| Receita pendente | SUM valorNegociado WHERE aguardando pagamento |
| Receita em aberto | SUM valorNegociado WHERE serviços em aberto |
| Taxa de inadimplência | (Em atraso / Total cobrado) * 100 |

**KPIs — Bloco 3: Técnico**

| KPI | Cálculo |
|-----|---------|
| Serviços por técnico | groupBy tecnicoDesignadoId |
| Serviços por setor | groupBy setorResponsavel |
| Média de tempo por técnico | média de execução por tecnico |

**Gráficos:**
- Barras: serviços por categoria de serviço (mês atual)
- Pizza: distribuição por status geral
- Linha: volume de serviços por dia nos últimos 30 dias
- Barras horizontais: produtividade por técnico (concluídos no período)

**Critérios de aceitação:**
- [ ] Filtro por período (início/fim) + filtro por técnico + filtro por setor
- [ ] Cache 10min por combinação de filtros (mesmo padrão Sprint 21)
- [ ] VENDEDOR: sem acesso (403)
- [ ] FINANCEIRO: acessa todos os KPIs
- [ ] TECNICO: acessa somente KPIs dos serviços designados a ele

---

### US-2302 — Relatórios de Serviços (XLSX)

**Como** SUPERVISAO/CEO/ADMIN  
**Quero** exportar 5 tipos de relatório em XLSX  
**Para** análise, reuniões e controle gerencial

| Relatório | Conteúdo |
|-----------|----------|
| Lançados | Todos os serviços no período: nº, cliente, serviço, prioridade, status, lançado por, data |
| Financeiro | Serviços com dados financeiros: valor cobrado, pago, forma, status financeiro, inadimplência |
| Técnico | Serviços com dados técnicos: técnico, setor, complexidade, prazo previsto, tempo real, status |
| Produtividade | Por técnico: qtd total, concluídos, cancelados, tempo médio, receita gerada |
| Gargalos | Serviços há mais de X dias no mesmo status: nº, cliente, status, dias parado, técnico |

**Critérios de aceitação:**
- [ ] GET /servicos/relatorios?tipo=lançados&inicio=2026-05-01&fim=2026-05-31 → XLSX download
- [ ] Arquivo nomeado: `relatorio-{tipo}-{inicio}-{fim}.xlsx`
- [ ] Relatório "gargalos" aceita parâmetro `diasParado` (default: 7)
- [ ] Todas as colunas com cabeçalho em português
- [ ] Cache 5min para a mesma combinação de parâmetros

---

### US-2303 — Checklists por Tipo de Serviço

**Como** TECNICO/SUPERVISAO/ADMIN  
**Quero** ter um checklist de verificação dentro de cada serviço  
**Para** garantir que nenhuma etapa da execução seja esquecida

**Lógica:**
- Cada TipoServico pode ter N itens de checklist padrão cadastrados
- Ao criar um ServicoContratado, os itens do checklist do TipoServico são copiados (snapshot)
- O técnico marca cada item como concluído durante ou após a execução

**Modelos novos:**
- `ChecklistPadrao` — itens padrão por TipoServico (templateId + ordem + descricao)
- `ChecklistItemServico` — cópia do checklist para cada ServicoContratado (snapshot + marcacao)

**Checklists pré-definidos por categoria:**

*Impressoras:*
1. Verificar modelo e marca da impressora
2. Confirmar driver instalado
3. Confirmar porta de comunicação (USB/Serial/Network)
4. Configurar largura do papel
5. Configurar layout de impressão
6. Imprimir teste de impressão
7. Validar impressão com o cliente

*Importação de dados:*
1. Solicitar arquivo original do cliente
2. Verificar encoding (UTF-8/ANSI)
3. Verificar separadores e delimitadores
4. Mapear campos: campo chave identificado
5. Realizar importação em base de teste
6. Validar registros importados (contagem + amostragem)
7. Realizar importação em produção
8. Confirmar com o cliente

*Comunicação entre lojas:*
1. Confirmar IPs das lojas (matriz e filiais)
2. Verificar VPN ou porta aberta entre lojas
3. Confirmar banco de dados (único ou individual)
4. Configurar servidor central
5. Configurar sincronização
6. Testar envio matriz → filial
7. Testar envio filial → matriz
8. Validar com cliente em operação real

*Troca de CNPJ:*
1. Coletar CNPJ novo e documentos
2. Backup completo da base de dados
3. Alterar CNPJ no cadastro da empresa
4. Atualizar inscrição estadual
5. Atualizar certificado digital
6. Verificar configurações fiscais (NFC-e/NF-e)
7. Emitir nota teste com novo CNPJ
8. Validar com contador do cliente

**Critérios de aceitação:**
- [ ] CRUD de ChecklistPadrao por TipoServico (somente ADMIN/CEO)
- [ ] Ao criar ServicoContratado → snapshot automático dos itens do TipoServico
- [ ] PATCH /servicos/:id/checklist/:itemId → marcar como concluído (TECNICO + SUPERVISAO+ )
- [ ] GET /servicos/:id inclui `checklist` com itens e status de marcação
- [ ] Se TipoServico não tem checklist → campo `checklist: []` no retorno (sem erro)

---

### US-2304 — Campos Específicos por Subtipo

**Como** VENDEDOR/TECNICO/SUPERVISAO  
**Quero** preencher campos adicionais conforme o tipo de serviço  
**Para** capturar informações técnicas específicas de cada categoria

**Modelos por subtipo (JSON armazenado em `ServicoContratado.dadosExtras TEXT`):**

*Impressoras:*
```json
{
  "marcaImpressora": "Bematech",
  "modeloImpressora": "MP-4200 TH",
  "tipoConexao": "USB",
  "portaCom": "COM3",
  "larguraPapel": "80mm",
  "layoutAtual": "Padrão",
  "problemaRelatado": "Não imprime após update"
}
```

*Importação de dados:*
```json
{
  "tipoImportacao": "Tabela de produtos",
  "formatoArquivo": "CSV",
  "encodingArquivo": "UTF-8",
  "campoChave": "codigo_barras",
  "qtdRegistros": 5420,
  "possuiArquivoTeste": true,
  "sistemaOrigem": "Siga"
}
```

*Comunicação entre lojas:*
```json
{
  "qtdLojas": 3,
  "ipMatriz": "192.168.1.1",
  "usaVpn": true,
  "tipoBanco": "Único",
  "sistemaReplicacao": "Prosystem padrão"
}
```

*Troca de CNPJ:*
```json
{
  "cnpjAtual": "12.345.678/0001-99",
  "cnpjNovo": "98.765.432/0001-11",
  "motivoTroca": "Abertura de nova empresa",
  "possuiCertificadoNovo": false,
  "precisaAtualizarFiscal": true
}
```

**Critérios de aceitação:**
- [ ] PATCH /servicos/:id/dados-extras → salva JSON livre no campo `dadosExtras`
- [ ] GET /servicos/:id inclui `dadosExtras` parseado como objeto
- [ ] Frontend: formulário dinâmico por categoria (switch na categoria do tipoServico)
- [ ] Campos não bloqueiam criação do serviço (todos opcionais)

---

### US-2305 — Feriados no Cálculo de Prazo

**Como** ADMIN  
**Quero** cadastrar feriados no sistema  
**Para** que o cálculo de prazo em dias úteis seja preciso

**Modelo novo:** `FeriadoNacional` (data DATE + descricao TEXT + tipo: Nacional/Estadual/Municipal + estado/cidade opcionais)

**Feriados nacionais pré-carregados (2026):**
01/01, 21/02, 22/02, 03/04, 21/04, 01/05, 11/06, 07/09, 12/10, 02/11, 15/11, 25/12

**Critérios de aceitação:**
- [ ] CRUD de FeriadoNacional (somente ADMIN)
- [ ] Função `calcularDataPrevista(inicio, diasUteis)` atualizada: pula sábado, domingo E feriados cadastrados no banco
- [ ] GET /feriados → lista os feriados cadastrados
- [ ] POST /feriados → cadastra novo feriado (ADMIN only)

---

## Sprint 23 — PRONTO PARA UX ✅
