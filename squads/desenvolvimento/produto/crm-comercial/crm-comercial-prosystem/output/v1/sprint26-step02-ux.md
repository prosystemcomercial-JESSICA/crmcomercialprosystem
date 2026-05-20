# Sprint 26 — Step 02 — Patrícia Moura (UX Designer)
# Módulo de Agenda — Wireframes e Fluxos

---

## Navegação

```
Sidebar
├── CRM (leads, funil...)
├── Serviços Contratados
├── Metas e Comissões
└── Agenda                    ← nova entrada
      ├── Minha Agenda
      └── Agenda da Equipe    (separador — somente SUPERVISAO+)
```

**Badge de contagem no item "Agenda":**
```
Agenda  [3]   ← eventos de hoje
```

---

## 1. Configurações de Conta — Conexão Google

```
┌──────────────────────────────────────────────────────────────────┐
│ Configurações → Integrações → Google Calendar                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   🔴 Google Calendar não conectado                               │
│                                                                   │
│   Conecte sua conta do Google para:                              │
│   ✓ Criar reuniões com link Google Meet automático               │
│   ✓ Ver sua agenda sincronizada no CRM                           │
│   ✓ Enviar convites automáticos aos leads                        │
│                                                                   │
│              [🔗 Conectar com Google]                            │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

─── Após conectar: ───────────────────────────────────────────────

┌──────────────────────────────────────────────────────────────────┐
│ Google Calendar                                                   │
│ ✅ Conectado como: joao.silva@gmail.com                          │
│ Calendário: joao.silva@gmail.com                                 │
│ Conectado desde: 15/05/2026                                      │
│                                [Desconectar]                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Página: Minha Agenda

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Minha Agenda                               [+ Nova Reunião]              │
├──────────────────────────────────────────────────────────────────────────┤
│ [Lista ▾] [Calendário]   [Tipo ▾] [Lead ▾] [Status ▾]   [Mai/2026 ▾]  │
├────────────────────────┬─────────────────────────────────────────────────┤
│  CALENDÁRIO MENSAL     │  LISTA DE EVENTOS                               │
│                        │                                                  │
│  Mai 2026              │  Hoje — 19/05/2026                              │
│  S  T  Q  Q  S  S  D  │  ┌──────────────────────────────────────────┐  │
│  ─  ─  ─  ─  1  2  3  │  │ 09:00  Apresentação do sistema           │  │
│  4  5  6  7  8  9  10  │  │        Farm. Silva · Reunião             │  │
│ 11 12 13 14 15 16  17  │  │        🟢 João Silva                     │  │
│ 18●19●20 21 22 23  24  │  │        [🎥 Entrar no Meet] [✏️ Editar]   │  │
│ 25 26 27 28 29 30  31  │  └──────────────────────────────────────────┘  │
│                        │  ┌──────────────────────────────────────────┐  │
│  ● = tem eventos       │  │ 14:30  Follow-up contrato                │  │
│                        │  │        Merc. Santos · Follow-up          │  │
│  Legenda:              │  │        🟡 Aguardando confirmação          │  │
│  🔵 Reunião            │  │        [🎥 Entrar no Meet] [✏️ Editar]   │  │
│  🟢 Confirmado         │  └──────────────────────────────────────────┘  │
│  🟡 Agendado           │                                                  │
│  ⚫ Cancelado          │  Amanhã — 20/05/2026                           │
│  🔴 Não compareceu     │  ┌──────────────────────────────────────────┐  │
│                        │  │ 10:00  Demo Farma Pro                    │  │
│                        │  │        Pad. Lima · Demo                  │  │
│                        │  │        🔵 Agendado                       │  │
│                        │  │        [🎥 Entrar no Meet] [✏️ Editar]   │  │
│                        │  └──────────────────────────────────────────┘  │
└────────────────────────┴─────────────────────────────────────────────────┘
```

---

## 3. Modal: Nova Reunião

```
┌── Nova Reunião ──────────────────────────────────────────────────────────┐
│                                                                           │
│  Título *                                                                │
│  [Apresentação do sistema Prosystem para Farmácia Silva         ]       │
│                                                                           │
│  Lead / Cliente *                                                        │
│  [🔍 Buscar lead ou cliente...           ]                              │
│  ↓ Farm. Silva — CNPJ 12.345.678/0001-00 ← selecionado                │
│  E-mail do lead: contato@farmasilva.com.br (será convidado)             │
│                                                                           │
│  Tipo              Status                                                 │
│  [Reunião ▾]       [Agendado ▾]                                         │
│                                                                           │
│  Data *            Hora início *    Hora fim *                           │
│  [20/05/2026]      [10:00]          [11:00]                             │
│                                                                           │
│  Local                                                                    │
│  ○ Online (Google Meet)  ○ Presencial                                    │
│  ● Online (Google Meet)  ← selecionado                                  │
│                                                                           │
│  Descrição                                                                │
│  [Apresentação das funcionalidades do sistema Farma Pro...    ]         │
│                                                                           │
│  Convidados adicionais (e-mails, separados por vírgula)                 │
│  [ana.supervisora@prosystem.com.br                            ]         │
│                                                                           │
│  Lembrete                                                                 │
│  [30 minutos antes ▾]                                                   │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │ ✅ Conexão Google ativa — link Meet será gerado           │           │
│  └──────────────────────────────────────────────────────────┘           │
│                                                                           │
│                        [Cancelar]  [Criar Reunião]                      │
└───────────────────────────────────────────────────────────────────────────┘
```

**Estado sem Google conectado:**
```
  ┌──────────────────────────────────────────────────────────┐
  │ ⚠️ Google Calendar não conectado                         │
  │ O evento será salvo no CRM, mas sem link Meet.           │
  │ [Conectar Google Calendar →]                             │
  └──────────────────────────────────────────────────────────┘
```

**Estado após criar:**
```
┌── Reunião criada! ───────────────────────────────────────────┐
│ ✅ Evento criado no Google Calendar                          │
│ 🎥 Link Google Meet:                                         │
│    https://meet.google.com/abc-defg-hij                      │
│    [Copiar link]  [Abrir Meet]                               │
│                                                               │
│ 📧 Convite enviado para: contato@farmasilva.com.br          │
│                              [Ver no Google Calendar] [OK]   │
└───────────────────────────────────────────────────────────────┘
```

---

## 4. Card de Evento (lista)

```
┌──────────────────────────────────────────────────────────────────┐
│ 🔵 20/05 10:00–11:00                              [Agendado]    │
│ Apresentação do sistema Prosystem                                │
│ 👤 Farm. Silva   📍 Google Meet                                  │
│ 🎥 https://meet.google.com/abc-defg-hij                         │
│                                                                   │
│ [🎥 Entrar no Meet]  [✏️ Editar]  [❌ Cancelar]                │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. Aba "Agenda" no Drawer do Lead

```
┌── Lead: Farmácia Silva ──────────────────────────────────────────┐
│ [Dados][Proposta][Contrato][Histórico][Arquivos][Agenda]  [✕]   │
├──────────────────────────────────────────────────────────────────┤
│ ABA AGENDA                          [+ Nova Reunião]            │
│                                                                   │
│ Próximas                                                         │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ 🔵 20/05 10:00  Apresentação Farma Pro   [🎥 Meet] [✏️]   │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│ Realizadas                                                       │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ ✅ 10/04 14:00  Apresentação inicial — Realizado            │  │
│ │ ✅ 02/04 09:00  Primeiro contato — Realizado                │  │
│ └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. Histórico do Lead — entradas automáticas de agenda

```
📅 Reunião agendada — Apresentação do sistema Prosystem
   20/05/2026 10:00–11:00 · Google Meet
   🎥 meet.google.com/abc-defg-hij
   Agendado por João Silva

✏️ Reunião editada — Apresentação do sistema Prosystem
   Horário alterado: 10:00 → 11:00
   Editado por João Silva

❌ Reunião cancelada — Demo produto
   Cancelado por João Silva
```

---

## 7. Agenda da Equipe (SUPERVISAO+)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Agenda da Equipe                            [Vendedor ▾] [Mai/2026 ▾]  │
├──────────────────────────────────────────────────────────────────────────┤
│ Hoje — 19/05/2026                                                        │
│ ┌────────────────────────────────────────────────────────────────────┐  │
│ │ 09:00 João Silva · Farm. Silva · Apresentação · [🎥 Meet]         │  │
│ │ 11:30 Ana Souza · Merc. Santos · Demo · [🎥 Meet]                 │  │
│ │ 14:00 Pedro Lima · Pad. Lima · Follow-up · 📍 Presencial          │  │
│ └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Fluxo OAuth2

```
[Clica "Conectar com Google"]
         ↓
[Redireciona para Google OAuth consent screen]
         ↓
[Usuário autoriza: Calendar + Meet]
         ↓
[Google redireciona para /agenda/auth/google/callback?code=...]
         ↓
[Backend troca code → access_token + refresh_token]
         ↓
[Salva tokens criptografados no banco]
         ↓
[Redireciona para /configuracoes?google=conectado ✅]
```

---

## Sprint 26 — UX PRONTO ✅
