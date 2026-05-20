# Sprint 27 — Step 02 — Patrícia Moura (UX Designer)
# Agenda Avançada + Dashboard de Dia — Wireframes e Fluxos

---

## 1. Dashboard Homepage — Semáforo do Dia

```
┌────────────────────────────────────────────────────────────────────────┐
│                    Dashboard — Segunda, 19 de Maio                     │
├────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    STATUS DO DIA — JOÃO SILVA                    │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │                                                                   │  │
│  │         🟢 TUDO OK — Você está no caminho!                      │  │
│  │                                                                   │  │
│  │    ✅ 5 reuniões cumpridas              📈 Leads: 3 avanços      │  │
│  │    📅 2 agendadas para hoje              💼 Propostas: no prazo  │  │
│  │    ⏰ Próxima em 30 minutos              ✓ Tarefas: 5 restantes │  │
│  │                                                                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Cards informativos (4 colunas):                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  │ 📅 Hoje      │  │ 👥 Leads     │  │ 📄 Propostas │  │ ✅ Tarefas   │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤  ├──────────────┤
│  │ 5 eventos    │  │ 12 ativos    │  │ 4 ativas     │  │ 8 pendentes  │
│  │ 2 realizadas │  │ 3 em negocia │  │ 1 em decisão │  │ 3 vencidas   │
│  │ 0 não aparec │  │ 1 em risco   │  │ 2 vencendo   │  │ 5 hoje       │
│  │              │  │              │  │              │  │              │
│  │ [+ Agendar]  │  │ [Ver lista]  │  │ [Ver lista]  │  │ [Ver lista]  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
│                                                                          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Status Transition — Modal de Atualização

```
┌── Marcar como Realizada ────────────────────────────────────────────────┐
│                                                                           │
│  Reunião: Apresentação do sistema Prosystem                             │
│  Lead: Farmácia Silva                                                   │
│  Agendada: 19/05/2026 10:00–11:00                                       │
│  Meet: https://meet.google.com/abc-defg-hij                             │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Status atual: AGENDADO → Novo: REALIZADO                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  Motivo (opcional)                                                       │
│  [Reunião concluída com sucesso ▾]                                      │
│                                                                           │
│  Observações                                                             │
│  [Cliente muito interessado, próximo passo é enviar proposta   ]        │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │ 📋 [Copiar resumo da reunião para Slack]  [Copiar link Meet] │      │
│  └──────────────────────────────────────────────────────────────┘      │
│                                                                           │
│                 [Cancelar]  [Marcar como realizada]                     │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

**Estados alternativos dos botões de ação (no card de evento):**
```
✅ Realizada    │  📅 Remarcar    │  ❌ Cancelada    │  ❌ Não compareceu
```

---

## 3. Modal de Reagendamento

```
┌── Remarcar Reunião ────────────────────────────────────────────────────┐
│                                                                          │
│  Esta é a mesma modal de "Nova Reunião", mas com campos pré-preenchidos:
│                                                                          │
│  Título: Apresentação do sistema Prosystem                             │
│  Lead: Farmácia Silva (fixo, não editável)                             │
│                                                                          │
│  Data anterior: 19/05/2026 10:00–11:00                                 │
│  ↓                                                                       │
│  Nova data: [20/05/2026] [15:00]–[16:00]  ← pré-preenchida             │
│  Motivo do reagendamento: [Solicitado pelo cliente ▾]                  │
│                                                                          │
│                 [Cancelar]  [Remarcar reunião]                         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Checklist de Tarefas — Widget no Sidebar

```
┌─ Agenda de Hoje (colapsável) ─────────────────────────┐
│                                                        │
│  📅 PRÓXIMAS REUNIÕES                   [Expandir]   │
│  ┌────────────────────────────────────────────────┐  │
│  │ 10:00  Apresentação · Farm. Silva   [🎥 Meet] │  │
│  │ 14:30  Follow-up · Merc. Santos              │  │
│  │ 16:00  Demo · Pad. Lima                      │  │
│  └────────────────────────────────────────────────┘  │
│                                                        │
│  ✅ TAREFAS PENDENTES                   [Expandir]   │
│  ┌────────────────────────────────────────────────┐  │
│  │ ☐ Enviar proposta para Farm. Silva  [HOJE]   │  │
│  │ ☐ Follow-up Merc. Santos           [HOJE]   │  │
│  │ ☐ Agendar próxima Demo · Pad. Lima [+2d]    │  │
│  │ ☐ Relatório mensal                 [VENCIDO] │  │
│  │ ☐ Contato com João Silva           [+3d]    │  │
│  └────────────────────────────────────────────────┘  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 5. Página de Tarefas (Nova)

```
┌────────────────────────────────────────────────────────────────────┐
│ Tarefas                             [+ Nova Tarefa]                │
├────────────────────────────────────────────────────────────────────┤
│ [Todas ▾] [Status ▾] [Prioridade ▾] [Vencimento ▾]   [Mai/2026 ▾] │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🟥 ALTA PRIORIDADE                                               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ☐ Relatório mensal                    [VENCIDO]  2 dias   │  │
│  │   Farm. Silva · Proposta #001 · Atribuído: Você           │  │
│  │   [✏️ Editar] [❌ Cancelar] [✅ Concluir rápido]           │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ☐ Contato urgente com Merc. Santos    [HOJE]             │  │
│  │   Merc. Santos · Sem vínculo · Atribuído: Você           │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  🟨 MÉDIA PRIORIDADE                                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ☐ Enviar proposta para Farm. Silva    [HOJE]             │  │
│  │   Farm. Silva · Proposta #002 · Atribuído: Ana Souza     │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ☐ Agendar próxima Demo com Pad. Lima  [+2d]              │  │
│  │   Pad. Lima · Demo · Atribuído: Você                      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  🟦 BAIXA PRIORIDADE                                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ☐ Follow-up com João Silva            [+7d]              │  │
│  │   João Silva · Lead · Atribuído: Você                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  [Marcar como concluídas] [Selecionar múltiplas]                 │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## 6. Bulk Edit — Marcar Múltiplas Reuniões

```
Modo normal da página Agenda:
[Lista ▾] [Calendário]   [Tipo ▾] [Lead ▾] [Status ▾]

↓ (usuário clica em "Modo seleção")

Modo seleção:
[Modo seleção: ON]  [✅ Realizada] [❌ Não apareceu] [📅 Remarcar]
                    Selecionadas: 0
┌────────────────────────────────────────────────────────────────┐
│ ☐ 09:00  Apresentação do sistema · Farm. Silva                │
├────────────────────────────────────────────────────────────────┤
│ ☐ 14:30  Follow-up contrato · Merc. Santos                    │
├────────────────────────────────────────────────────────────────┤
│ ☐ 10:00  Demo Farma Pro · Pad. Lima                           │
└────────────────────────────────────────────────────────────────┘

Após selecionar 2:
[Modo seleção: ON]  [✅ Realizada (2)] [❌ Não apareceu (2)] [📅 Remarcar]
                    Selecionadas: 2

Modal após clicar "✅ Realizada (2)":
┌── Marcar 2 reuniões como realizadas ───────────────────────────┐
│                                                                  │
│  Observações (aplicadas a ambas)                               │
│  [Reuniões realizadas com sucesso ▬▬▬▬▬▬▬▬▬▬]                  │
│                                                                  │
│                [Cancelar]  [Confirmar (2)]                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

Feedback:
✅ 2 reuniões atualizadas como realizada!
```

---

## 7. Timeline do Lead (Nova Aba)

```
┌── Lead: Farmácia Silva ────────────────────────────────────────┐
│ [Dados][Proposta][Contrato][Histórico][Timeline] [✕]          │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔄 Ordenar por [Data ↓] [Tipo ▾]                             │
│                                                                 │
│  ────────────────────────────────────────────────────────────  │
│                                                                 │
│  📅 19/05 10:00  Reunião concluída                             │
│     Apresentação do sistema Prosystem — REALIZADO              │
│     🎥 meet.google.com/abc                                     │
│     💬 Cliente muito interessado                               │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  📝 19/05 09:30  Proposta enviada                              │
│     Proposta #001 — R$ 15.000/mês — Ativa                     │
│     [Ver proposta]                                              │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ✅ 18/05 14:00  Tarefa concluída                              │
│     Preparação apresentação — Conclusão de João Silva          │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  💼 17/05 16:00  Contato estabelecido                          │
│     Qualificação feita · Histórico: contato qualificado        │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  📅 17/05 10:00  Reunião agendada                              │
│     Apresentação inicial — REALIZADO                           │
│     📝 Histórico: [Expandir para mais detalhes]                │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  📞 16/05  Primeira conversa                                   │
│     WhatsApp · Atendimento iniciado                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Relatório XLSX — Mockup de Planilha

```
AGENDA — MAIO 2026

Resumo Geral
Total agendado:     25 reuniões
Total realizado:    23 reuniões
Taxa conclusão:     92%
Não compareceu:     2 (8%)
Remarcadas:         3 (12%)
Canceladas:         0 (0%)
Tempo médio agendado: 5 dias

Por vendedor:
João Silva      | 8 reuniões | 7 realizadas (87.5%) | 0 não-show
Ana Souza       | 9 reuniões | 9 realizadas (100%)  | 0 não-show
Pedro Lima      | 8 reuniões | 7 realizadas (87.5%) | 1 não-show

Detalhe:
Data      | Vendedor   | Lead            | Tipo         | Status    | Duração (dias)
19/05     | João Silva | Farm. Silva     | Apresentação | Realizado | 5
19/05     | Ana Souza  | Merc. Santos    | Follow-up    | Realizado | 3
20/05     | Pedro Lima | Pad. Lima       | Demo         | Agendado  | —
18/05     | Ana Souza  | Loja Central    | Ligação      | Cancelada | 1
...
```

---

## 9. Notificações Inteligentes — Toast Exemplos

```
┌─────────────────────────────────────────────────────────┐
│ ⏰ Reunião em 10 minutos: Apresentação · Farm. Silva     │
│ [Abrir meet]  [Descartar]                               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 📋 Registre a reunião: Follow-up · Merc. Santos         │
│ [✅ Realizada]  [❌ Não apareceu]  [Descartar]          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 🔴 Tarefa vencida: Enviar proposta Farm. Silva          │
│ [Concluir]  [Estender prazo]                            │
└─────────────────────────────────────────────────────────┘
```

---

## Sprint 27 — UX PRONTO ✅
