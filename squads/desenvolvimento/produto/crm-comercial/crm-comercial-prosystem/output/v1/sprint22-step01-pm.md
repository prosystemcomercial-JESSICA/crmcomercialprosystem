# Sprint 22 — Step 01 — André Vieira (Product Manager)
# Módulo de Serviços Contratados — Escopo e Requisitos

## Contexto

Módulo completamente novo, paralelo ao CRM de leads. Atende à necessidade de registrar, acompanhar e controlar **serviços avulsos vendidos a clientes da base Prosystem** — parametrização de impressoras, importação de dados, comunicação entre lojas, troca de CNPJ, treinamentos extras, implantações adicionais, etc.

Diferença fundamental: enquanto o CRM gerencia **prospects** (leads → propostas → contratos), este módulo gerencia **execução de serviços** para **clientes já ativos**.

---

## Decisão de escopo (Sprint 22 × Sprint 23)

| Sprint 22 — Core | Sprint 23 — Avançado |
|------------------|----------------------|
| ClienteBase (CRUD + importação CSV) | Dashboard KPIs |
| TipoServico (catálogo) | Relatórios (5 tipos) |
| ServicoContratado (ciclo completo) | Checklists por tipo |
| Abas: Comercial, Financeiro, Técnico, Agendamento, Execução, Histórico, Anexos, Comunicação | Campos específicos por subtipo |
| Novos roles FINANCEIRO e TECNICO | Filtros avançados |

---

## Novos Roles

```
FINANCEIRO — gerencia pagamentos, libera execução
TECNICO — visualiza designados, registra execução
```

Ambos se somam ao enum existente: `VENDEDOR | SUPERVISAO | CEO | ADMIN | FINANCEIRO | TECNICO`

---

## User Stories

### US-2201 — Base de Clientes Prosystem

**Como** SUPERVISAO/CEO/ADMIN  
**Quero** cadastrar e consultar os clientes da base Prosystem  
**Para** vincular serviços a clientes reais

**Critérios de aceitação:**
- [ ] CRUD completo: criar, editar, visualizar, desativar
- [ ] Campos: código, código Prosystem, razão social, nome fantasia, CNPJ, IE, segmento, status, plano atual, responsável, contatos, endereço, dados operacionais (20+ campos booleanos)
- [ ] Importação via CSV (campo separador ponto-e-vírgula, encoding UTF-8)
- [ ] Filtros: status, segmento, plano, cidade, CNPJ, nome
- [ ] VENDEDOR: somente visualização
- [ ] ClienteBase é entidade separada de Lead

**Campos booleanos operacionais:**
possuiServidor, bancounico, bancoPorLoja, comunicacaoEntreLojas, usaSngpc, usaFarmaciaPopular, usaManipulacao, usaBalanca, usaImpressoraEtiqueta, usaImpressoraTermica, usaEmissaoFiscal, usaNfse

---

### US-2202 — Catálogo de Tipos de Serviço

**Como** ADMIN/CEO/SUPERVISAO  
**Quero** cadastrar tipos de serviço parametrizados  
**Para** padronizar os serviços lançados

**Critérios de aceitação:**
- [ ] CRUD de TipoServico: nome, categoria, descrição padrão, valor padrão, cobrado (Sim/Não/Cortesia/A definir)
- [ ] Flags: exigeAprovacao, exigePagamentoAntecipado, exigeDesignacaoTecnica, exigeAgendamento, exigeAnexo, exigeValidacaoCliente
- [ ] Prazo padrão em dias úteis + tempo médio de execução
- [ ] Setor responsável padrão + técnico padrão (opcional)
- [ ] Status: Ativo / Inativo / Restrito
- [ ] Categorias: 15 categorias pré-definidas (Impressoras, Importação de dados, Comunicação entre lojas, Fiscal, Financeiro, Estoque, Treinamento, Implantação adicional, Integrações, Relatórios, Personalização, Conversão de dados, Configuração de módulo, Banco de dados, Outro)

---

### US-2203 — Lançamento de Serviço

**Como** VENDEDOR/SUPERVISAO/CEO/ADMIN  
**Quero** registrar uma solicitação de serviço de um cliente  
**Para** iniciar o ciclo de aprovação e execução

**Critérios de aceitação:**
- [ ] Número da solicitação gerado automaticamente (formato: SRV-YYYY-NNNNN)
- [ ] Vinculação ao ClienteBase (busca por CNPJ, razão social, código)
- [ ] Tipo de serviço selecionado do catálogo
- [ ] Origem da solicitação (8 opções) + canal de entrada (7 opções)
- [ ] Prioridade: Baixa / Normal / Alta / Urgente / Crítica
- [ ] Dados do solicitante: nome, cargo, telefone, WhatsApp, e-mail, é responsável autorizado
- [ ] Descrição livre: problema/necessidade + resultado esperado
- [ ] Salvar como rascunho ou lançar diretamente
- [ ] Status inicial: Rascunho → Lançado

---

### US-2204 — Aba Comercial

**Como** SUPERVISAO/CEO/ADMIN  
**Quero** registrar a negociação comercial do serviço  
**Para** formalizar valor, desconto e condições de pagamento

**Critérios de aceitação:**
- [ ] Valor padrão pré-preenchido do TipoServico
- [ ] Valor negociado (editável), desconto (R$ e %), motivo do desconto
- [ ] Forma de pagamento: Pix / Boleto / Cartão de crédito / Cartão débito / Junto com mensalidade / Crédito em conta / Cortesia / A combinar
- [ ] Aprovação do cliente: campo de data + quem aprovou + como aprovou (WhatsApp/E-mail/Assinatura/Verbal)
- [ ] Observações comerciais
- [ ] SUPERVISAO pode aprovar cortesia (até limite configurado)
- [ ] CEO/ADMIN aprovam qualquer desconto

---

### US-2205 — Aba Financeiro

**Como** FINANCEIRO/SUPERVISAO/CEO/ADMIN  
**Quero** controlar o status de pagamento do serviço  
**Para** liberar ou bloquear execução com base no pagamento

**Critérios de aceitação:**
- [ ] Status financeiro: Aguardando cobrança / Cobrança enviada / Aguardando pagamento / Pago / Isento / Cortesia / Parcelado / Pago parcialmente / Em atraso / Cancelado
- [ ] Data de cobrança + data de vencimento + data de pagamento
- [ ] Valor cobrado + valor pago
- [ ] Comprovante de pagamento (upload de arquivo)
- [ ] Liberado para execução: checkbox + data liberação + quem liberou
- [ ] Observações financeiras
- [ ] FINANCEIRO: full acesso à aba
- [ ] VENDEDOR: somente leitura do status

---

### US-2206 — Aba Técnica (Designação)

**Como** SUPERVISAO/CEO/ADMIN  
**Quero** designar um técnico e acompanhar o status técnico  
**Para** garantir que o serviço será executado no prazo

**Critérios de aceitação:**
- [ ] Setor responsável: Comercial / Suporte / Implantação / Desenvolvimento / Financeiro / Fiscal / Diretoria / Técnico externo
- [ ] Técnico designado: lista de usuários com role TECNICO (+ outros roles)
- [ ] Complexidade: Baixa / Média / Alta / Muito alta / Crítica
- [ ] Status técnico: Aguardando designação / Designado / Analisando / Em execução / Aguardando cliente / Aguardando informação / Aguardando desenvolvimento / Aguardando terceiro / Aguardando agendamento / Agendado / Suspenso / Reaberto / Parcialmente concluído / Concluído / Cancelado / Não será executado / Transferido
- [ ] Prazo estimado de conclusão (dias úteis) + data prevista calculada
- [ ] Observações técnicas
- [ ] TECNICO: edita status e observações apenas dos serviços designados a ele

---

### US-2207 — Aba Agendamento

**Como** SUPERVISAO/TECNICO/ADMIN  
**Quero** agendar a execução do serviço com o cliente  
**Para** garantir disponibilidade das partes

**Critérios de aceitação:**
- [ ] Data e hora do agendamento
- [ ] Canal: AnyDesk / TeamViewer / Zoom / Google Meet / Teams / Telefone / Presencial / WhatsApp
- [ ] Código de acesso remoto (se aplicável)
- [ ] Confirmação do cliente: Sim / Não / Aguardando / Recusou
- [ ] Data da confirmação + quem confirmou no cliente
- [ ] Observações do agendamento
- [ ] Requer exige agendamento = true no TipoServico para mostrar aba

---

### US-2208 — Aba Execução

**Como** TECNICO/SUPERVISAO/ADMIN  
**Quero** registrar o que foi executado e o resultado  
**Para** formalizar a conclusão do serviço

**Critérios de aceitação:**
- [ ] Data e hora de início / conclusão da execução
- [ ] Descrição do que foi executado (campo texto rico)
- [ ] Pendências encontradas durante execução
- [ ] Validação do cliente: campo data + quem validou + como validou
- [ ] Status final: Concluído com sucesso / Concluído com ressalvas / Parcialmente executado / Não executado / Cancelado pelo cliente / Requer retorno
- [ ] Se "Requer retorno": novo agendamento vinculado
- [ ] Ao marcar Concluído → status geral → Concluído (automático)

---

### US-2209 — Aba Histórico

**Como** qualquer role autenticado  
**Quero** ver o histórico completo de eventos do serviço  
**Para** rastrear tudo que aconteceu

**Critérios de aceitação:**
- [ ] Eventos automáticos (20+ tipos): criado, status alterado, técnico designado, agendado, execução iniciada, concluído, pagamento registrado, aprovação recebida, arquivo anexado, mensagem enviada, etc.
- [ ] Mesmo padrão do HistoricoLead: autor, timestamp, campo_alterado, valor_anterior, valor_novo, descricao
- [ ] Filtro por tipo de evento
- [ ] Exportar histórico como PDF

---

### US-2210 — Aba Anexos

**Como** qualquer role autenticado  
**Quero** anexar arquivos ao serviço  
**Para** guardar comprovantes, contratos e screenshots

**Critérios de aceitação:**
- [ ] Mesmo engine do Sprint 17 (ArquivoUploadModal, ArquivoItem)
- [ ] Categorias de anexo: Comprovante de pagamento / Contrato / Proposta / Screenshot do erro / Screenshot do antes / Screenshot do depois / Manual / Documento do cliente / Outro
- [ ] Visibilidade: Todos / Somente interno (oculto do VENDEDOR)
- [ ] VENDEDOR: não vê anexos marcados "Somente interno"

---

### US-2211 — Aba Comunicação

**Como** VENDEDOR/SUPERVISAO/CEO/ADMIN  
**Quero** registrar mensagens enviadas ao cliente sobre o serviço  
**Para** ter histórico de comunicação no contexto do serviço

**Critérios de aceitação:**
- [ ] Registrar mensagem: texto + canal (WhatsApp / E-mail / Ligação / Reunião) + data/hora
- [ ] Quem enviou + para quem (nome do contato no cliente)
- [ ] Listagem em ordem cronológica
- [ ] Marcar como "resposta recebida": data + resumo da resposta

---

### US-2212 — Listagem e filtros de Serviços

**Como** qualquer role autenticado  
**Quero** ver todos os serviços com filtros avançados  
**Para** acompanhar o andamento de todas as demandas

**Critérios de aceitação:**
- [ ] Tabela paginada (20 por página) com: nº, cliente, serviço, prioridade, status, técnico, prazo, valor
- [ ] Filtros: status geral, prioridade, tipo de serviço, categoria, técnico, setor, data de lançamento (range), data de conclusão (range), cliente
- [ ] Chips de filtro ativos acima da lista
- [ ] VENDEDOR: vê somente serviços que ele lançou
- [ ] TECNICO: vê somente serviços designados a ele
- [ ] FINANCEIRO: vê todos, foco nas abas financeiras
- [ ] SUPERVISAO/CEO/ADMIN: vê todos

---

## Status flow (23 estados)

```
Rascunho
  └─► Lançado
        └─► Aguardando análise comercial
              ├─► Aguardando orçamento
              │     └─► Orçamento enviado
              │           ├─► Aguardando aprovação do cliente
              │           │     ├─► Aprovado pelo cliente
              │           │     └─► Reprovado pelo cliente
              │           └─► (skip se cortesia/incluso)
              └─► (direto se valor já definido)
Aprovado pelo cliente
  └─► Aguardando pagamento
        └─► Pagamento confirmado
              └─► Aguardando designação técnica
                    └─► Designado ao técnico
                          └─► Agendado
                                └─► Em execução
                                      ├─► Aguardando cliente
                                      ├─► Aguardando informação
                                      ├─► Aguardando desenvolvimento
                                      ├─► Aguardando terceiro
                                      └─► Concluído
Cancelado (em qualquer ponto)
Reaberto (após Concluído ou Cancelado)
```

---

## Numeração dos serviços

Formato: `SRV-2026-00001`
- Prefixo SRV + ano 4 dígitos + sequencial 5 dígitos
- Sequencial global (não por cliente)
- Não reutilizável após cancelamento

---

## Sprint 22 — PRONTO PARA UX ✅
