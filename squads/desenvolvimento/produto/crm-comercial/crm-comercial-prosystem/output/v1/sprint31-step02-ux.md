# Sprint 31 — Step 02 — Patrícia Moura (UX)
# App Mobile — Wireframes e Fluxos

## Estrutura de Navegação

```
App
├── (auth)
│   └── login.tsx              ← Tela de login
└── (app)
    ├── _layout.tsx            ← Tab Bar bottom (5 tabs)
    ├── index.tsx              ← Home / Dashboard
    ├── leads/
    │   ├── index.tsx          ← Lista de leads
    │   └── [id].tsx           ← Ficha do lead
    ├── funil.tsx              ← Funil kanban
    ├── agenda.tsx             ← Agenda do dia
    └── conversas/
        ├── index.tsx          ← Lista de conversas
        └── [leadId].tsx       ← Thread WA
```

## Tab Bar

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                   CONTEÚDO                          │
│                                                     │
├─────────────────────────────────────────────────────┤
│  🏠 Home  │  👥 Leads  │  📊 Funil  │  📅 Agenda  │  💬 WA [3] │
└─────────────────────────────────────────────────────┘
```

## Tela: Login

```
┌─────────────────────────────┐
│                             │
│         [LOGO]              │
│    CRM Comercial            │
│    ProSystem                │
│                             │
│  ┌─────────────────────┐   │
│  │ E-mail              │   │
│  └─────────────────────┘   │
│  ┌─────────────────────┐   │
│  │ Senha           👁  │   │
│  └─────────────────────┘   │
│                             │
│  ┌─────────────────────┐   │
│  │    ENTRAR           │   │
│  └─────────────────────┘   │
│                             │
│  [🔑 Usar Face ID / Touch]  │  ← aparece após primeiro login
│                             │
└─────────────────────────────┘
```

## Tela: Home / Dashboard

```
┌─────────────────────────────┐
│  Bom dia, Carlos! 👋        │
│  Quarta, 20 de maio         │
├─────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ │
│  │    47    │ │    5     │ │
│  │  Leads   │ │ Ativid.  │ │
│  │  Ativos  │ │   Hoje   │ │
│  └──────────┘ └──────────┘ │
│  ┌──────────┐ ┌──────────┐ │
│  │ 14:30h   │ │   3 🔴   │ │
│  │ Próximo  │ │ WA Não   │ │
│  │ Evento   │ │  Lidas   │ │
│  └──────────┘ └──────────┘ │
├─────────────────────────────┤
│  Atividades para hoje       │
│  ┌─────────────────────┐   │
│  │ 📞 Ligar p/ João S. │   │
│  │ Empresa TechCorp    │   │
│  │ Venceu ontem  🔴    │   │
│  └─────────────────────┘   │
│  ┌─────────────────────┐   │
│  │ 🤝 Visita Ana P.    │   │
│  │ Empresa ABC Store   │   │
│  │ Hoje 15:00          │   │
│  └─────────────────────┘   │
└─────────────────────────────┘
```

## Tela: Lista de Leads

```
┌─────────────────────────────┐
│  Leads           🔍  ⚙️    │
├─────────────────────────────┤
│ [Todos] [Qualif.] [Proposta]│  ← chips filtro etapa
├─────────────────────────────┤
│  ┌─────────────────────┐   │
│  │ João Silva          │   │
│  │ TechCorp  [Proposta]│   │
│  │ ⏰ há 2 dias        │   │
│  └─────────────────────┘   │
│  ┌─────────────────────┐   │
│  │ Maria Santos  🔴    │   │  ← 7d+ sem atividade
│  │ Varejo ABC [Qualif] │   │
│  │ ⏰ há 8 dias        │   │
│  └─────────────────────┘   │
│  ┌─────────────────────┐   │
│  │ Pedro Costa         │   │
│  │ Loja PB [Novo Lead] │   │
│  │ ⏰ há 1 dia         │   │
│  └─────────────────────┘   │
└─────────────────────────────┘
```

## Tela: Ficha do Lead

```
┌─────────────────────────────┐
│  ← João Silva     ✏️ ···   │
│  TechCorp · Qualificação    │
├─────────────────────────────┤
│  📞 Ligar  ✉️ Email  💬 WA │
├─────────────────────────────┤
│ [Dados] [Histórico] [WA]    │
├─────────────────────────────┤
│  📱 +55 11 9 9999-8888      │
│  📧 joao@techcorp.com       │
│  🏢 TechCorp Ltda           │
│  📍 São Paulo, SP           │
│  💰 Valor estimado: R$5.000 │
│                             │
│  Etapa:                     │
│  [Qualificação    ▼]        │
├─────────────────────────────┤
│                        ➕   │  ← FAB Nova Atividade
└─────────────────────────────┘
```

## Tela: Funil

```
┌─────────────────────────────┐
│  Funil Comercial            │
│  → → → → → → (scroll horiz)│
├──────────┬──────────┬───────┤
│ Qualific.│Proposta  │Negoc. │
│  (8)     │  (5)     │  (3)  │
│──────────│──────────│───────│
│┌────────┐│┌────────┐│┌─────┐│
││João S. │││Maria S.│││Pedro││
││TechCorp│││VarejoAB│││LojaPB│
│└────────┘││└────────┘│└─────┘│
│┌────────┐│          │       │
││Ana P.  │││          │       │
││ABCStor.│││          │       │
│└────────┘│          │       │
└──────────┴──────────┴───────┘
```

**Long-press no card → Bottom Sheet:**
```
┌─────────────────────────────┐
│  Mover João Silva para:     │
├─────────────────────────────┤
│  ○ Novo Lead                │
│  ○ Qualificação  ← atual    │
│  ● Apresentação             │  ← toque para mover
│  ○ Proposta Enviada         │
│  ○ Negociação               │
│              [Cancelar]     │
└─────────────────────────────┘
```

## Tela: Agenda

```
┌─────────────────────────────┐
│  Agenda     [◀ hoje ▶]      │
│  Seg Ter Qua Qui Sex        │
│   19  20  21  22  23        │
│              ●              │  ← hoje
├─────────────────────────────┤
│  09:00  Reunião TechCorp    │
│         💻 Online · Meet    │
│         João Silva          │
│                             │
│  14:30  Visita Varejo ABC   │
│         🏢 Presencial       │
│         Maria Santos        │
│                             │
│  (sem mais eventos hoje)    │
├─────────────────────────────┤
│                        ➕   │  ← FAB Novo Evento
└─────────────────────────────┘
```

## Bottom Sheet: Nova Atividade

```
┌─────────────────────────────┐
│  ▬  Nova Atividade          │
├─────────────────────────────┤
│  Tipo:                      │
│  [📞 Ligação] [🤝 Visita] [✉️]│
│                             │
│  Resultado:                 │
│  ┌─────────────────────┐   │
│  │ (textarea)          │   │
│  └─────────────────────┘   │
│                             │
│  Próximo contato:           │
│  [📅 Selecionar data/hora ] │
│                             │
│  [     REGISTRAR     ]      │
└─────────────────────────────┘
```

## Tela: Conversas WhatsApp

```
┌─────────────────────────────┐
│  WhatsApp                   │
├─────────────────────────────┤
│  ┌─────────────────────┐   │
│  │ João Silva    10:32 │   │
│  │ "Qual o prazo..."   │   │
│  │ 🔴 2 não lidas      │   │
│  └─────────────────────┘   │
│  ┌─────────────────────┐   │
│  │ Maria Santos  ontem │   │
│  │ "Você: Ok, pode..." │   │
│  └─────────────────────┘   │
└─────────────────────────────┘
```

## Thread WhatsApp

```
┌─────────────────────────────┐
│  ← João Silva               │
│  TechCorp · Online          │
├─────────────────────────────┤
│                             │
│  [cinza] Oi, qual o prazo   │
│  para implementação?  10:30 │
│                             │
│  Olá João! O prazo é de [azul]│
│  30 dias a partir da         │
│  assinatura.          10:32 │
│                             │
│  [cinza] Ótimo! Podemos     │
│  fechar hoje?         10:33 │
│                             │
├─────────────────────────────┤
│ ┌─────────────────────┐ [→]│
│ │ Escrever mensagem...│    │
│ └─────────────────────┘    │
└─────────────────────────────┘
```

## Design System Mobile

- **Cores:** Mesmas do web (primary #1a56db, success #16a34a, danger #dc2626)
- **Tipografia:** Sistema nativo (SF Pro no iOS, Roboto no Android)
- **Spacing:** NativeWind com escala 4px base
- **Dark mode:** Suportado via NativeWind dark: classes
- **Loading:** Skeleton via shimmer animation
- **Feedback:** Toast via react-native-toast-message
- **Pull-to-refresh:** Nativo via RefreshControl
