# Sprint 22 — Step 02 — Patrícia Moura (UX Designer)
# Módulo de Serviços Contratados — Wireframes e Fluxos

---

## Arquitetura de Navegação

```
Sidebar
├── CRM (leads, funil, propostas...)
└── Serviços Contratados          ← nova entrada no menu
      ├── Serviços                ← lista principal
      ├── Clientes Base           ← base Prosystem
      └── Catálogo de Serviços    ← tipos de serviço (ADMIN+)
```

---

## 1. Página: Lista de Serviços Contratados

```
┌─────────────────────────────────────────────────────────────────┐
│ Serviços Contratados                    [+ Novo Serviço]        │
├─────────────────────────────────────────────────────────────────┤
│ Filtros:                                                        │
│ [Status ▾] [Prioridade ▾] [Tipo ▾] [Técnico ▾] [Período ▾]    │
│ Chips: ⊗ Em execução  ⊗ Alta prioridade                        │
├────┬──────────────────┬────────────┬──────────┬────────┬───────┤
│ Nº │ Cliente          │ Serviço    │ Priorid. │ Status │ Prazo │
├────┼──────────────────┼────────────┼──────────┼────────┼───────┤
│SRV-│ Farmácia Silva   │ Param.     │ 🔴Alta   │ Em     │ 2d    │
│2026│ CNPJ: 12.345...  │ Impressora │          │ exec.  │       │
├────┼──────────────────┼────────────┼──────────┼────────┼───────┤
│SRV-│ Mercado Santos   │ Importação │ 🟡Normal │ Aguard.│ 5d    │
│2026│ CNPJ: 98.765...  │ de tabela  │          │ pgto   │       │
└────┴──────────────────┴────────────┴──────────┴────────┴───────┘
│ Página 1 de 12  [< Anterior]  [Próxima >]                      │
└─────────────────────────────────────────────────────────────────┘
```

**Indicadores de prioridade:**
- 🔴 Crítica / Urgente
- 🟠 Alta
- 🟡 Normal
- 🟢 Baixa

**Status badge colors:**
- Rascunho → cinza
- Lançado → azul
- Aguardando aprovação → amarelo
- Em execução → roxo com pulse
- Concluído → verde
- Cancelado → vermelho
- Aguardando pagamento → laranja

---

## 2. Drawer: ServiçoContratado (9 abas)

```
┌──────────────────────────────────────────────────────────────┐
│ SRV-2026-00001 · Farmácia Silva                 [✕]         │
│ Parametrização de impressora térmica                         │
│ Status: [Em execução ▾]  Prioridade: [Alta ▾]               │
│ Lançado por: João Silva · 19/05/2026 às 09:15               │
├──────────────────────────────────────────────────────────────┤
│[Geral][Comercial][Financeiro][Técnico][Agendamento][Execução]│
│[Histórico][Anexos][Comunicação]                              │
├──────────────────────────────────────────────────────────────┤
│                    CONTEÚDO DA ABA                           │
└──────────────────────────────────────────────────────────────┘
```

---

### Aba 1 — Geral

```
┌─── Cliente ─────────────────────────────────────────────┐
│ Farmácia Silva LTDA                                      │
│ CNPJ: 12.345.678/0001-99                                 │
│ Código Prosystem: 00123                                  │
│ Plano: Farma Pro · Status: Ativo · Segmento: Farmácia   │
│ Responsável: Dr. Carlos Silva · (62) 9 9999-9999        │
└──────────────────────────────────────────────────────────┘

┌─── Solicitante ─────────────────────────────────────────┐
│ Nome: Carlos Silva                                       │
│ Cargo: Proprietário                                      │
│ Tel: (62) 9 9999-9999 · Email: carlos@farmasilva.com    │
│ Responsável autorizado: ✅ Sim                           │
└──────────────────────────────────────────────────────────┘

┌─── Serviço ─────────────────────────────────────────────┐
│ Tipo: Parametrização de impressora térmica               │
│ Categoria: Impressoras                                   │
│ Origem: Cliente solicitou pelo WhatsApp                  │
│ Canal: WhatsApp                                          │
│ Prazo desejado: 22/05/2026                               │
│                                                          │
│ Problema/Necessidade:                                    │
│ Impressora Bematech parou de imprimir após update...     │
│                                                          │
│ Resultado esperado:                                      │
│ Impressora funcionando normalmente no PDV 1 e PDV 2     │
│                                                          │
│ Lojas envolvidas: Matriz                                 │
│ Qtd. máquinas: 2 · Exige acesso remoto: Sim             │
│ Exige parada de operação: Não · Exige backup: Não       │
└──────────────────────────────────────────────────────────┘
```

---

### Aba 2 — Comercial

```
┌─── Negociação ──────────────────────────────────────────┐
│ Valor padrão: R$ 120,00                                  │
│ Valor negociado: [R$ 100,00        ]                    │
│ Desconto: R$ 20,00 (16,7%)                              │
│ Motivo do desconto: [___________________]               │
│                                                          │
│ Forma de pagamento: [Junto com mensalidade ▾]           │
│                                                          │
│ Observações comerciais: [_____________________]         │
└──────────────────────────────────────────────────────────┘

┌─── Aprovação do Cliente ────────────────────────────────┐
│ Aprovado em: [19/05/2026]                               │
│ Aprovado por (cliente): [Carlos Silva        ]          │
│ Como aprovou: [WhatsApp ▾]                              │
│ Observação: [_________________________________]         │
│                                        [Salvar]         │
└──────────────────────────────────────────────────────────┘
```

---

### Aba 3 — Financeiro

```
┌─── Status Financeiro ───────────────────────────────────┐
│ Status: [Aguardando pagamento ▾]                        │
│                                                          │
│ Valor cobrado: R$ 100,00                                │
│ Data da cobrança: 19/05/2026                            │
│ Data de vencimento: 25/05/2026                          │
│ Data de pagamento: [___/___/______]                     │
│ Valor pago: [R$ ________]                               │
│                                                          │
│ Comprovante: [📎 Selecionar arquivo]                    │
│                                                          │
│ Liberado para execução: □ Não liberado                  │
│ Observações: [________________________________]         │
│                                    [Salvar financeiro]  │
└──────────────────────────────────────────────────────────┘
```

---

### Aba 4 — Técnico

```
┌─── Designação ──────────────────────────────────────────┐
│ Setor responsável: [Suporte ▾]                          │
│ Técnico designado: [Paulo Ribeiro ▾]                    │
│ Complexidade: [Baixa ▾]                                 │
│ Prazo estimado: [2] dias úteis                          │
│ Data prevista: 21/05/2026 (calculada)                   │
└──────────────────────────────────────────────────────────┘

┌─── Status Técnico ──────────────────────────────────────┐
│ Status: [Em execução ▾]                                 │
│ Observações técnicas:                                    │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Conectando via AnyDesk...                          │  │
│ └────────────────────────────────────────────────────┘  │
│                                    [Salvar técnico]     │
└──────────────────────────────────────────────────────────┘
```

---

### Aba 5 — Agendamento

```
┌─── Agendamento ─────────────────────────────────────────┐
│ Data e hora: [19/05/2026] [14:00]                       │
│ Canal: [AnyDesk ▾]                                      │
│ Código de acesso: [123456789       ]                    │
│                                                          │
│ Confirmação do cliente: [Confirmado ▾]                  │
│ Data da confirmação: [19/05/2026]                       │
│ Confirmado por: [Carlos Silva]                           │
│                                                          │
│ Observações: [_________________________________]         │
│                                  [Salvar agendamento]   │
└──────────────────────────────────────────────────────────┘
```

---

### Aba 6 — Execução

```
┌─── Execução ────────────────────────────────────────────┐
│ Início: [19/05/2026] [14:05]                            │
│ Conclusão: [19/05/2026] [15:30]                         │
│                                                          │
│ O que foi executado:                                    │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Reconfigurei a porta USB COM3 do driver Bematech   │  │
│ │ e ajustei o layout de impressão para 80mm...       │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ Pendências: [Nenhuma                        ]           │
│                                                          │
│ Validação pelo cliente:                                 │
│ Data: [19/05/2026]  Quem: [Carlos Silva]               │
│ Como: [WhatsApp ▾]                                      │
│                                                          │
│ Status final: [Concluído com sucesso ▾]                 │
│                                    [Registrar execução] │
└──────────────────────────────────────────────────────────┘
```

---

### Aba 7 — Histórico

```
┌─── Histórico ───────────────────────────────────────────┐
│ [Filtrar por tipo ▾]                    [📄 Exportar]   │
│                                                          │
│ ● 19/05 15:30 · Paulo Ribeiro                           │
│   Status alterado: Em execução → Concluído              │
│                                                          │
│ ● 19/05 14:05 · Paulo Ribeiro                           │
│   Execução iniciada                                      │
│                                                          │
│ ● 19/05 10:00 · João Silva (Vendedor)                   │
│   Técnico designado: Paulo Ribeiro                      │
│                                                          │
│ ● 19/05 09:15 · João Silva (Vendedor)                   │
│   Serviço criado · SRV-2026-00001                       │
└──────────────────────────────────────────────────────────┘
```

---

### Aba 8 — Anexos

```
┌─── Anexos ──────────────────────────────────────────────┐
│ [+ Adicionar anexo]                                     │
│                                                          │
│ 📷 screenshot-antes.png · 2,1 MB · Interno             │
│    Screenshot do erro · Paulo Ribeiro · 19/05 14:10    │
│    [↓ Download]  [🗑 Excluir]                           │
│                                                          │
│ 📷 screenshot-depois.png · 1,8 MB · Todos              │
│    Screenshot após correção · Paulo Ribeiro · 19/05 15:29│
│    [↓ Download]  [🗑 Excluir]                           │
└──────────────────────────────────────────────────────────┘
```

---

### Aba 9 — Comunicação

```
┌─── Comunicação com o cliente ───────────────────────────┐
│ [+ Registrar mensagem]                                  │
│                                                          │
│ 19/05 15:35 · João Silva → Carlos Silva                 │
│ Canal: WhatsApp                                         │
│ Serviço concluído! Impressora configurada ✅            │
│ Resposta recebida: Sim (15:36) - "Perfeito, obrigado"  │
│ ────────────────────────────────────────────────────    │
│ 19/05 09:20 · João Silva → Carlos Silva                 │
│ Canal: WhatsApp                                         │
│ Recebemos sua solicitação. Prazo: até 21/05 ✓          │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Página: Base de Clientes Prosystem

```
┌─────────────────────────────────────────────────────────────────┐
│ Base de Clientes Prosystem          [+ Novo Cliente] [📤 CSV]  │
├─────────────────────────────────────────────────────────────────┤
│ Busca: [_______________] [Status ▾] [Segmento ▾] [Plano ▾]    │
├──────────────────┬────────────┬────────┬────────┬──────────────┤
│ Cliente          │ CNPJ       │ Plano  │ Status │ Serviços     │
├──────────────────┼────────────┼────────┼────────┼──────────────┤
│ Farmácia Silva   │ 12.345...  │ FarmaPro│ Ativo  │ 3 abertos   │
│ Mercado Santos   │ 98.765...  │ Pro    │ Ativo  │ 1 aberto    │
│ Padaria Lima     │ 11.222...  │ Basic  │ Inativo│ —           │
└──────────────────┴────────────┴────────┴────────┴──────────────┘
```

**Drawer do Cliente:**
```
┌── ClienteBase ──────────────────────────────────────────────────┐
│ [Dados][Contato][Endereço][Operacional][Serviços]               │
│ Farmácia Silva LTDA                               [✕]          │
│ Código: 00123 · Cod. Prosystem: PRO-123                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Página: Catálogo de Tipos de Serviço

```
┌─────────────────────────────────────────────────────────────────┐
│ Catálogo de Serviços                         [+ Novo Tipo]     │
├────────────────────┬────────────┬────────┬──────────┬──────────┤
│ Serviço            │ Categoria  │ Valor  │ Cobrado  │ Status   │
├────────────────────┼────────────┼────────┼──────────┼──────────┤
│ Param. impressora  │ Impressoras│R$120   │ Sim      │ Ativo    │
│ Import. de tabela  │ Importação │R$80    │ Sim      │ Ativo    │
│ Comunicação lojas  │ Com. Lojas │R$350   │ Sim      │ Ativo    │
│ Troca de CNPJ      │ Cadastrais │R$200   │ Sim      │ Ativo    │
│ Treinamento PDV    │ Treinamento│R$150   │ Sim      │ Ativo    │
└────────────────────┴────────────┴────────┴──────────┴──────────┘
```

---

## 5. Formulário Novo Serviço (modal ou página)

```
┌── Novo Serviço ─────────────────────────────────────────────────┐
│ Passo 1: Cliente                                                │
│                                                                 │
│ Buscar cliente: [__________________________________]           │
│                 [Farmácia Silva — CNPJ 12.345...]  ✓           │
│                                                                 │
│ Loja solicitante: [Matriz ▾]                                   │
│                                                                 │
│ Passo 2: Serviço                                               │
│ Tipo de serviço: [Parametrização de impressora térmica ▾]      │
│ Categoria: Impressoras (auto)                                  │
│ Valor padrão: R$ 120,00 (auto)                                 │
│                                                                 │
│ Origem: [Cliente solicitou pelo WhatsApp ▾]                    │
│ Canal: [WhatsApp ▾]                                            │
│ Prioridade: [Normal ▾]                                         │
│                                                                 │
│ Passo 3: Detalhamento                                          │
│ Solicitante: [Carlos Silva]  Cargo: [Proprietário ▾]          │
│ Tel: [________]  WhatsApp: [________]  Email: [___________]   │
│ Responsável autorizado: [Sim ▾]                                │
│                                                                 │
│ Problema/Necessidade:                                           │
│ [_____________________________________________________________] │
│                                                                 │
│ Resultado esperado:                                             │
│ [_____________________________________________________________] │
│                                                                 │
│ Prazo desejado pelo cliente: [___/___/______]                   │
│                                                                 │
│ Observações: [_____________________________________________]    │
│                                                                 │
│                          [Salvar rascunho]  [Lançar serviço]  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Sidebar — novo item

```
Sidebar (após BI):
├── 📊 BI Avançado
├── 🔧 Serviços Contratados   ← novo
│     ├── Serviços
│     ├── Clientes Base
│     └── Catálogo
└── ...
```

Badge de contador nos itens do menu para serviços pendentes de ação.

---

## Design tokens reutilizados

- shadcn/ui Sheet (drawer) — mesmo padrão LeadDrawer
- shadcn/ui Tabs — mesmas abas
- react-hook-form + zodResolver — todos os formulários
- @tanstack/react-query — dados e invalidação
- shadcn/ui Badge, AlertDialog, Select, Input, Textarea, Button
- Tailwind utility classes existentes

---

## Sprint 22 — UX PRONTO ✅
