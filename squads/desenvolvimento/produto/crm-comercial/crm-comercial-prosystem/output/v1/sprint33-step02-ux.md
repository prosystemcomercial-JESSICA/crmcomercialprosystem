# Sprint 33 — Step 02 — Patrícia Moura (UX)
# Softphone Integrado — Wireframes

## SoftphoneWidget — Estados

### Estado: Idle (sem chamada)
```
[Invisível / não renderizado]
```

### Estado: Discando
```
╔═══════════════════════════════════════╗  ← fixo, canto inferior direito
║  📞 Discando...                        ║
║  João Silva · +55 11 9 9999-8888      ║
║  ⏱️ 00:03  [🔇 Mudo]  [📵 Cancelar]  ║
╚═══════════════════════════════════════╝
```

### Estado: Em Chamada
```
╔═══════════════════════════════════════╗
║  📞 Em chamada                  [—]  ║  ← botão minimizar
║  João Silva · +55 11 9 9999-8888      ║
║  ⏱️ 02:47                             ║
║  [🔇 Mudo]       [📵 Encerrar]       ║
╚═══════════════════════════════════════╝
```

### Estado: Minimizado
```
╔══════════════════════════╗  ← barra fina no rodapé direito
║ 📞 João Silva · 02:47  ▲ ║
╚══════════════════════════╝
```

### Estado: Encerrada → Drawer de resultado
```
╔═══════════════════════════════════════════╗
║  ✅ Chamada encerrada — 03:12            ║
╚═══════════════════════════════════════════╝

Drawer lateral (abre automaticamente):
┌──────────────────────────────────────────┐
│  📝 Registrar resultado da chamada        │
│  ─────────────────────────────────────── │
│  Lead: João Silva (TechCorp)             │
│  Duração: 3 min 12 seg ·  ✅ Atendida   │
│                                           │
│  Resultado:                               │
│  ┌─────────────────────────────────────┐ │
│  │ Ex: Cliente pediu proposta até...   │ │
│  └─────────────────────────────────────┘ │
│                                           │
│  Próximo contato:                         │
│  [📅 Selecionar data/hora]               │
│                                           │
│  [Pular]          [💾 Salvar Atividade]  │
└──────────────────────────────────────────┘
```

## Botão "Ligar" na Ficha do Lead

```
┌──────────────────────────────────────────────┐
│  João Silva                                  │
│  TechCorp · Qualificação                     │
├──────────────────────────────────────────────┤
│  [📞 Ligar]  [✉️ E-mail]  [💬 WhatsApp]     │  ← botão existente + ação nova
└──────────────────────────────────────────────┘
```

## Aba Chamadas — Ficha do Lead

```
┌──────────────────────────────────────────────┐
│ [Dados] [Histórico] [Propostas] [WA] [Chams] │
├──────────────────────────────────────────────┤
│  20/05 10:32  ✅ Atendida  3min 12s          │
│  "Cliente pediu proposta até sexta"          │
│  ⚫ [▶ Ouvir gravação]                       │
│  ─────────────────────────────────────────── │
│  19/05 15:10  ❌ Não atendida  —             │
│  ─────────────────────────────────────────── │
│  18/05 09:45  📵 Ocupado  —                 │
└──────────────────────────────────────────────┘
```

## Painel Supervisora — Chamadas em Andamento

```
┌──────────────────────────────────────────────┐
│  📞 Chamadas em andamento (2)                │
├──────────────────────────────────────────────┤
│  Carlos Silva → João (TechCorp)  02:47 🟢    │
│  Ana Souza → Pedro (Varejo ABC)  00:33 🟢    │
└──────────────────────────────────────────────┘
```

## Tela de Configuração SIP (Admin)

```
┌──────────────────────────────────────────────┐
│  ⚙️ Configuração do Softphone                │
├──────────────────────────────────────────────┤
│  SIP Host      [sip.minha-empresa.com.br  ]  │
│  SIP User      [crm_user                  ]  │
│  SIP Password  [••••••••••••••            ]  │
│  SIP Port      [5060                      ]  │
│  STUN Server   [stun:stun.l.google.com:...]  │
│  Codec         [▼ G.711 (PCMU/PCMA)      ]  │
│  Gravação      [◉ Ativada  ○ Desativada  ]  │
│                                              │
│  [Testar Conexão]    [💾 Salvar]             │
│                                              │
│  Último teste: ✅ Conectado · 20/05 08:30   │
└──────────────────────────────────────────────┘
```

## Fluxo Completo de Chamada

```
[Botão Ligar] → [Widget: Discando] → [SIP INVITE enviado]
     ↓                                      ↓
[Microfone autorizado]           [180 Ringing → ringback tone]
                                            ↓
                                 [200 OK → Em chamada]
                                 [Cronômetro inicia]
                                            ↓
                           [Vendedor clica Encerrar]
                           [BYE SIP enviado]
                                            ↓
                      [Widget: Encerrada · duração calculada]
                      [Drawer abre automaticamente]
                                            ↓
                 [Vendedor preenche resultado + próximo contato]
                 [Salvar → POST /atividades]
                 [HistoricoLead: ligacao_softphone]
```
