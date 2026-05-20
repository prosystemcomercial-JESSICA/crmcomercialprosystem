# Sprint 24 — Step 02 — Patrícia Moura (UX Designer)
# Módulo de Metas e Comissões — Wireframes e Fluxos

---

## Navegação

```
Sidebar
├── CRM (leads, funil...)
├── Serviços Contratados
└── Metas e Comissões         ← nova entrada
      ├── Meu Dashboard       (vendedor: próprio / supervisor: equipe)
      ├── Minhas Metas
      ├── Minhas Comissões
      ├── Minhas Indicações
      ├── Recebimentos
      ├── ─────────────────── (separador — somente SUPERVISAO+)
      ├── Metas (gestão)
      ├── Regras de Comissão
      ├── Parceiros
      └── Fechamento Mensal
```

---

## 1. Página: Metas (Gestão — SUPERVISAO+)

```
┌──────────────────────────────────────────────────────────────────┐
│ Metas Comerciais                              [+ Nova Meta]     │
├──────────────────────────────────────────────────────────────────┤
│ [Mês/Ano: Mai/2026 ▾]  [Vendedor ▾]  [Status ▾]               │
├──────────┬───────────┬──────────────┬──────────┬───────┬───────┤
│ Vendedor │ Tipo      │ Meta         │ Realizado│  %    │Status │
├──────────┼───────────┼──────────────┼──────────┼───────┼───────┤
│ João     │ Contratos │ 6            │ 4        │ 66%   │ Ativa │
│ João     │ MRR       │ R$ 2.280     │ R$1.520  │ 66%   │ Ativa │
│ Ana      │ Contratos │ 8            │ 8        │ 100% ✅│ Ativa│
└──────────┴───────────┴──────────────┴──────────┴───────┴───────┘
```

**Barra de progresso inline:**
```
João Silva · Contratos · Mai/2026
Meta: 6  Realizado: 4  ████████░░░░  66,7%
```

---

## 2. Drawer: Meta

```
┌── Meta ─────────────────────────────────────────────────────────┐
│ [Identificação][Progresso][Regras de Comissão]        [✕]      │
│ Meta de Contratos — João Silva — Mai/2026                       │
│ Status: [Ativa ▾]                                               │
├──────────────────────────────────────────────────────────────────┤
│ ABA: Identificação                                              │
│ Vendedor: João Silva                                            │
│ Tipo: Contratos fechados                                        │
│ Período: 01/05/2026 a 31/05/2026                               │
│ Meta: [6]  contratos                                            │
│                                                                  │
│ □ Meta principal                                                │
│ □ Conta para comissão                                           │
│ □ Conta para ranking                                            │
│ Permite comissão sem bater meta: [Sim ▾]                       │
│ Exige recebimento para liberar: [Apenas entrada ▾]             │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Página: Regras de Comissão (SUPERVISAO+)

```
┌──────────────────────────────────────────────────────────────────┐
│ Regras de Comissão                          [+ Nova Regra]     │
├──────────────────────────────────────────────────────────────────┤
│ [Vendedor ▾]  [Tipo ▾]  [Status ▾]                            │
├────────────────────┬──────────┬────────────┬──────────┬────────┤
│ Nome               │ Vendedor │ Tipo       │ Base     │ Status │
├────────────────────┼──────────┼────────────┼──────────┼────────┤
│ Comis. instalação  │ Todos    │ Percentual │Inst.receb│ Ativa  │
│ Bonus contrato     │ João     │ Valor fixo │ Por cont.│ Ativa  │
│ Comis. serviços    │ Todos    │ Percentual │ Serv.rec.│ Ativa  │
│ Indicação TEF      │ Todos    │ Valor fixo │ Por indic│ Ativa  │
└────────────────────┴──────────┴────────────┴──────────┴────────┘
```

**Drawer: Nova Regra de Comissão:**
```
┌── Regra de Comissão ─────────────────────────────────────────────┐
│ Nome: [Comissão sobre instalação recebida]                       │
│ Tipo: [Percentual ▾]                                             │
│ Base de cálculo: [Valor da instalação recebida ▾]               │
│ Vendedor: □ Todos  ou  [João Silva ▾]                           │
│                                                                   │
│ Percentual: [5%]         Valor fixo: [R$ ——]                    │
│ Comissão mínima: [R$ ——] Máxima: [R$ ——]                        │
│                                                                   │
│ Calcular sobre: ○ Valor bruto  ○ Valor líquido                  │
│ Considerar desconto: ○ Sim  ○ Não                               │
│                                                                   │
│ Depende de:                                                       │
│ □ Recebimento confirmado                                          │
│ □ Contrato assinado                                              │
│ □ Implantação concluída                                           │
│ □ Aprovação da supervisão                                         │
│                                                                   │
│ Validade: [01/05/2026] até [31/12/2026]                         │
│ Status: [Ativa ▾]                                               │
│                                     [Salvar]  [Cancelar]        │
└───────────────────────────────────────────────────────────────────┘
```

---

## 4. Página: Recebimentos

```
┌──────────────────────────────────────────────────────────────────┐
│ Recebimentos                              [+ Novo Recebimento]  │
├──────────────────────────────────────────────────────────────────┤
│ [Vendedor ▾][Tipo ▾][Status ▾][Período ▾]                     │
│ ⬜ Somente vencidos  ⬜ Somente pendentes  ⬜ Com comissão       │
├──────┬──────────┬─────────────┬────────┬─────────┬────────┬────┤
│ Data │ Cliente  │ Tipo        │Vendido │Recebido │Status  │Com.│
├──────┼──────────┼─────────────┼────────┼─────────┼────────┼────┤
│05/05 │Farm.Silva│ Instalação  │R$1.200 │R$ 600   │Parcial │Prev│
│06/05 │Merc.Stos │ Mensalidade │R$ 380  │R$ 380   │Recebido│Lib.│
│07/05 │Pad.Lima  │ Serviço     │R$ 150  │ —       │Vencido │Ag. │
└──────┴──────────┴─────────────┴────────┴─────────┴────────┴────┘
```

**Chip de status de comissão:**
- Prevista → cinza
- Aguardando → amarelo
- Liberada → verde
- Paga → verde escuro
- Bloqueada → vermelho

---

## 5. Drawer: Recebimento

```
┌── Recebimento ──────────────────────────────────────────────────┐
│ [Geral][Parcelas][Comissão]                          [✕]       │
│ Farmácia Silva · Instalação · João Silva                        │
├──────────────────────────────────────────────────────────────────┤
│ ABA GERAL                                                        │
│ Tipo de receita: [Instalação ▾]                                 │
│ Origem: [Novo cliente ▾]                                        │
│ Valor vendido: R$ 1.200,00                                      │
│ Valor com desconto: R$ 1.000,00                                 │
│ Forma de pagamento: [Entrada + parcelas ▾]                      │
│ Status recebimento: [Parcialmente recebido ▾]                   │
│                                                                  │
│ ABA PARCELAS                                                     │
│ Entrada: R$ 600,00  Vencimento: 05/05/2026  [✅ Recebida]      │
│ Parcela 2: R$ 400,00  Vencimento: 05/06/2026  [⬜ Pendente]    │
│                                                                  │
│ ABA COMISSÃO                                                     │
│ Regra aplicada: Comissão sobre instalação recebida              │
│ Base de cálculo: Valor da instalação recebida                   │
│ Percentual: 5%                                                   │
│ Comissão prevista: R$ 60,00 (sobre R$ 1.200)                   │
│ Comissão liberada: R$ 30,00 (entrada recebida)                  │
│ Status: Parcialmente liberada                                    │
│                            [Liberar comissão] [Bloquear]        │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. Página: Indicações para Parceiros

```
┌──────────────────────────────────────────────────────────────────┐
│ Indicações para Parceiros                 [+ Nova Indicação]   │
├──────────────────────────────────────────────────────────────────┤
│ [Parceiro ▾][Status ▾][Vendedor ▾][Período ▾]                 │
├──────┬─────────────┬─────────┬──────────────┬────────┬────────┤
│ Data │ Cliente     │ Parceiro│ Serviço      │ Status │ Comis. │
├──────┼─────────────┼─────────┼──────────────┼────────┼────────┤
│12/05 │Farm. Silva  │ TEF+    │ TEF          │Converti│R$ 50   │
│14/05 │Merc. Santos │ CertBR  │ Cert. digital│Neg.    │ —      │
│15/05 │Pad. Lima    │ ContAss │ Contabilidade│Lançada │ —      │
└──────┴─────────────┴─────────┴──────────────┴────────┴────────┘
```

**Status badges:**
- Lançada → azul
- Em negociação → amarelo
- Convertida → verde ✅
- Não convertida → cinza
- Comissão paga → verde escuro

---

## 7. Modal: Nova Indicação

```
┌── Nova Indicação para Parceiro ─────────────────────────────────┐
│ Passo 1: Cliente                                                │
│ Buscar: [___________________________]                           │
│ ou preencher manualmente:                                       │
│ Razão social: [__________________]  CNPJ: [________________]   │
│ Responsável: [__________]  WhatsApp: [____________]            │
│                                                                  │
│ Passo 2: Parceiro                                               │
│ Parceiro: [TEF+ — TEF ▾]                                       │
│ Serviço indicado: [TEF ▾]                                      │
│                                                                  │
│ Passo 3: Detalhamento                                           │
│ Observação: [____________________________________]              │
│ Valor estimado: R$ [____________]                               │
│                                                                  │
│                          [Cancelar]  [Lançar indicação]        │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8. Página: Parceiros (SUPERVISAO+)

```
┌──────────────────────────────────────────────────────────────────┐
│ Parceiros                                     [+ Novo Parceiro]│
├──────────────────────────────────────────────────────────────────┤
│ [Categoria ▾][Status ▾]                                        │
├──────────────┬─────────────┬──────────┬──────────┬────────────┤
│ Parceiro     │ Categoria   │ Produto  │ Comissão │ Status     │
├──────────────┼─────────────┼──────────┼──────────┼────────────┤
│ TEF+         │ TEF         │ TEF      │ R$ 50    │ Ativo      │
│ CertBR       │ Cert. digit.│ Cert. PF │ 3%       │ Ativo      │
│ ContAss      │ Contabilid. │ Fiscal   │ R$ 80    │ Ativo      │
└──────────────┴─────────────┴──────────┴──────────┴────────────┘
```

---

## Fluxo visual do ciclo de comissão

```
[Venda/Serviço/Indicação] → [Comissão: Prevista]
                                    ↓
                        [Recebimento confirmado]
                                    ↓
                    [Motor verifica regra de comissão]
                                    ↓
                         [Comissão: Liberada]
                                    ↓
                    [Fechamento mensal (Sprint 25)]
                                    ↓
                          [Comissão: Paga]
```

---

## Sprint 24 — UX PRONTO ✅
