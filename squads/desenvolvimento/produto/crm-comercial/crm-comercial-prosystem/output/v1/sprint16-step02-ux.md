# Sprint 16 — Step 02 — Patrícia Moura (UX)
# Nutrição / Recontato Futuro — Wireframes

## TELA — /nutricao

```
┌─────────────────────────────────────────────────────────────────┐
│ Nutrição — Recontato Futuro          [Vendedor: Todos ▾] [CSV] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ⚠ VENCIDOS (3)                                                  │
│ ┌───────────────────────────────────────────────────────────────┐│
│ │ 🏢 Farmácia Bom Saúde          Ana Lima       5 dias atraso  ││
│ │    Motivo: Sem orçamento       📅 12/05/26                   ││
│ │                    [Reagendar] [Reativar]                    ││
│ ├───────────────────────────────────────────────────────────────┤│
│ │ 🏢 Padaria do João             Carlos Neto    2 dias atraso  ││
│ │    Motivo: Usando concorrente  📅 15/05/26                   ││
│ │                    [Reagendar] [Reativar]                    ││
│ └───────────────────────────────────────────────────────────────┘│
│                                                                  │
│ 🔔 HOJE (1)                                                     │
│ ┌───────────────────────────────────────────────────────────────┐│
│ │ 🏢 Varejista Norte             Maria Souza    Hoje            ││
│ │    Motivo: Sem interesse       📅 18/05/26                   ││
│ │                    [Reagendar] [Reativar]                    ││
│ └───────────────────────────────────────────────────────────────┘│
│                                                                  │
│ 📆 PRÓXIMOS 7 DIAS (4)                                          │
│ ┌───────────────────────────────────────────────────────────────┐│
│ │ 🏢 Auto Peças Silva            Ana Lima       Em 3 dias       ││
│ │    Motivo: Preço alto          📅 21/05/26                   ││
│ │                    [Reagendar] [Reativar]                    ││
│ │ ...                                                           ││
│ └───────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Card expandido — Reagendar (inline)

```
│ 🏢 Farmácia Bom Saúde          Ana Lima       5 dias atraso  │
│    Motivo: Sem orçamento       📅 12/05/26                   │
│                                                               │
│    Nova data: [25/05/2026    ]   [Confirmar] [Cancelar]      │
```

## Alerta no header (sino)

```
 [🔔 5]   ← badge vermelho com contagem (vencidos + hoje)

 Tooltip ao hover:
 ┌─────────────────────────────┐
 │ Leads para recontato        │
 │ • Farmácia Bom Saúde (venc.)│
 │ • Padaria do João (venc.)   │
 │ • Varejista Norte (hoje)    │
 │ + 2 mais → Ver todos        │
 └─────────────────────────────┘
```

## UX decisions

- 3 seções com cor diferente: vencidos = fundo vermelho claro, hoje = fundo laranja claro, próximos = fundo azul claro
- Reagendar: abre datepicker inline no próprio card (sem modal) — menos fricção
- Reativar: abre dialog de confirmação antes de mudar status (ação irreversível imediata)
- Badge no sino: mostra apenas vencidos + hoje (não inclui futuros)
- Filtro de vendedor: visível para Supervisão/CEO; VENDEDOR não vê o filtro
- Seção vazia oculta (não exibe header de seção vazia)
- Cards: clique na empresa navega para ficha do lead (não abre modal)
