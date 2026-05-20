# Sprint 19 — Step 02 — Patrícia Moura (UX)
# Integrações — Wireframes

## Action bar na ficha do lead

```
┌─ Ficha do Lead: Farmácia Exemplo ──────────────────────────────────┐
│  [Dados]  [Atividades]  [Propostas]  [Histórico]  [Arquivos]        │
│                                                                      │
│  ┌── Ações rápidas ─────────────────────────────────────────────┐  │
│  │  [💬 WhatsApp]   [📞 Registrar ligação]   [✉ Enviar e-mail] │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  (conteúdo da aba ativa)                                            │
└─────────────────────────────────────────────────────────────────────┘
```

## Modal — Enviar WhatsApp

```
┌─ Enviar WhatsApp ───────────────────────────────────────────────────┐
│                                                                      │
│  Para: Farmácia Exemplo  (+55 11 99999-0000)                        │
│                                                                      │
│  Template:                                                           │
│  [saudacao_vendedor                                             ▾]  │
│                                                                      │
│  Prévia da mensagem:                                                 │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Olá, *João Silva*! 😊                                        │  │
│  │ Aqui é a *Ana Lima* da ProSystem.                            │  │
│  │ Tudo bem? Gostaria de conversar sobre                        │  │
│  │ soluções para a *Farmácia Exemplo*.                          │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ⚠️  WhatsApp Business usa templates aprovados pelo Meta.           │
│                                                                      │
│  [Cancelar]                          [💬 Enviar mensagem]           │
└─────────────────────────────────────────────────────────────────────┘
```

## Modal — Registrar Ligação

```
┌─ Registrar Ligação ─────────────────────────────────────────────────┐
│                                                                      │
│  Lead: Farmácia Exemplo                                             │
│                                                                      │
│  Data e hora *                                                       │
│  [19/05/2026          ]  [14:35   ]                                 │
│                                                                      │
│  Duração (minutos)                                                   │
│  [5                  ]                                               │
│                                                                      │
│  Resultado *                                                         │
│  [Conectou — agendou retorno                                    ▾]  │
│   ○ Conectou — agendou retorno                                      │
│   ○ Conectou — sem interesse                                        │
│   ○ Não atendeu                                                      │
│   ○ Caixa postal                                                     │
│                                                                      │
│  Notas (opcional)                                                    │
│  [Cliente demonstrou interesse na solução de PDV...           ]      │
│                                                                      │
│  [Cancelar]                             [Salvar ligação]            │
└─────────────────────────────────────────────────────────────────────┘
```

## Configurações > Integrações

```
┌─ Configurações — Integrações ───────────────────────────────────────┐
│                                                                      │
│  ┌── WhatsApp Business ──────────────────────────────────────────┐  │
│  │  Phone Number ID *                                            │  │
│  │  [1234567890                                              ]   │  │
│  │                                                               │  │
│  │  Access Token *                                               │  │
│  │  [••••••••••••••••••••••••••••••••           👁]             │  │
│  │                                                               │  │
│  │  Template padrão                                              │  │
│  │  [saudacao_vendedor                                      ]   │  │
│  │                                                               │  │
│  │                              [Testar conexão]  [Salvar]      │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌── E-mail (SMTP) ──────────────────────────────────────────────┐  │
│  │  Servidor *          Porta *        [✓] TLS/SSL               │  │
│  │  [smtp.gmail.com ]   [587     ]                               │  │
│  │                                                               │  │
│  │  Usuário *                                                    │  │
│  │  [crm@prosystem.com.br                                   ]   │  │
│  │                                                               │  │
│  │  Senha *                                                      │  │
│  │  [••••••••••••                                    👁]         │  │
│  │                                                               │  │
│  │  Remetente padrão                                             │  │
│  │  [CRM ProSystem <crm@prosystem.com.br>               ]       │  │
│  │                                                               │  │
│  │                              [Testar conexão]  [Salvar]      │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Log de Mensagens — /configuracoes/log-mensagens

```
┌─ Log de Mensagens ─────────────────────────────────────────────────┐
│  [Todos ▾]  [WhatsApp]  [E-mail]    Período: [Últimos 7 dias ▾]   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 💬 WhatsApp · Farmácia Exemplo · +55 11 99999-0000          │   │
│  │    saudacao_vendedor · ✅ Enviado · há 5 min · Ana Lima     │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ ✉ E-mail · Black Friday 2026 (campanha)                    │   │
│  │    drogaria@central.com · ✅ Enviado · há 2h               │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ 💬 WhatsApp · Pet Shop Amigo · +55 11 00000-0000           │   │
│  │    saudacao_vendedor · ❌ Falha: invalid phone · há 3h     │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

## Extensão das Campanhas — canal WhatsApp

```
// No wizard de campanha (Passo 1 — Canal):
[📧 E-mail     ○]
[💬 WhatsApp   ○]   ← novo canal disponível

// Se WhatsApp selecionado:
Template WhatsApp *
[saudacao_vendedor                                               ▾]
(variáveis: {nome}, {empresa}, {vendedor} — interpoladas como params do template)
```

## UX decisions

- Action bar de ações rápidas visível em todas as abas da ficha do lead
- Modal WhatsApp: mostra prévia real da mensagem com variáveis resolvidas antes do envio
- Campos sensíveis (token, senha) com toggle 👁 show/hide; nunca exibidos em texto claro por padrão
- "Testar conexão" envia mensagem de teste para número/e-mail interno e retorna feedback inline
- Ligação registrada aparece imediatamente no Histórico (aba Histórico) com ícone 📞
- Log de mensagens: somente SUPERVISAO/CEO/ADMIN; acesso via Configurações
- Campanha WhatsApp: assunto substituído por "Template", campo corpo oculto (template definido no Meta)
