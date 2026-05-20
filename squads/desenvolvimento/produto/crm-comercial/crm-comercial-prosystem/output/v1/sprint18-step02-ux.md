# Sprint 18 — Step 02 — Patrícia Moura (UX)
# Campanhas — Wireframes

## Página principal — /campanhas

```
┌─ Campanhas ──────────────────────────────────────────────────────────┐
│  Campanhas                                    [+ Nova campanha]      │
│                                                                       │
│  [Todas ▾]  [Rascunho]  [Agendada]  [Enviando]  [Concluída]         │
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │ 📧 Black Friday 2026                   ● Agendada             │   │
│  │    E-mail · 342 destinatários · 19/05 às 10:00                │   │
│  │    Criada por: Ana Lima                         [Ver] [✕]     │   │
│  ├───────────────────────────────────────────────────────────────┤   │
│  │ 📧 Follow-up Qualificados               ● Concluída           │   │
│  │    E-mail · 87 enviados · 3 falhas · concluída há 2 dias      │   │
│  │    Criada por: Carlos Neto                      [Ver]         │   │
│  ├───────────────────────────────────────────────────────────────┤   │
│  │ 📧 Proposta Especial Farmácias          ● Rascunho            │   │
│  │    E-mail · 0 destinatários (sem segmento definido)           │   │
│  │    Criada por: Ana Lima              [Editar] [Ver] [🗑]      │   │
│  └───────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

## Drawer de criação — "Nova campanha" (3 passos)

### Passo 1 — Configuração

```
┌─ Nova Campanha (1/3) ─ Configuração ────────────────────────────────┐
│                                                                       │
│  Nome *                                                               │
│  [Black Friday 2026                                               ]   │
│                                                                       │
│  Descrição (opcional)                                                 │
│  [Campanha de promoção para leads qualificados                    ]   │
│                                                                       │
│  Canal *                                                              │
│  [📧 E-mail                                                      ▾]  │
│                                                                       │
│  Assunto do e-mail *                                                  │
│  [Oferta especial para {empresa} — só até sexta!                  ]   │
│                                                                       │
│  Mensagem *                                                           │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │ Olá, {nome}!                                                │     │
│  │                                                             │     │
│  │ Temos uma proposta exclusiva para a {empresa}...            │     │
│  │                                                             │     │
│  │ Att, {vendedor}                                             │     │
│  └─────────────────────────────────────────────────────────────┘     │
│  Variáveis: {nome}  {empresa}  {vendedor}                            │
│                                                                       │
│                           [Cancelar]  [Próximo →]                    │
└──────────────────────────────────────────────────────────────────────┘
```

### Passo 2 — Segmentação

```
┌─ Nova Campanha (2/3) ─ Segmentação ─────────────────────────────────┐
│                                                                       │
│  Etapa do funil                                                       │
│  [✓ Qualificação]  [✓ Proposta]  [ Negociação]  [ Fechado]          │
│                                                                       │
│  Status do lead                                                       │
│  [✓ ativo]  [✓ aguardando]  [ perdido]  [ recontato futuro]         │
│                                                                       │
│  Vendedor responsável (opcional)                                      │
│  [Todos os vendedores                                            ▾]  │
│                                                                       │
│  ─────────────────────────────────────────────────────────────────   │
│                                                                       │
│  📊 Prévia: 342 leads correspondem aos filtros                       │
│     ⚠️  18 leads sem e-mail cadastrado (serão ignorados no envio)    │
│                                                                       │
│  [Ver lista completa de destinatários ↗]                            │
│                                                                       │
│                    [← Anterior]  [Próximo →]                         │
└──────────────────────────────────────────────────────────────────────┘
```

### Passo 3 — Agendamento e revisão

```
┌─ Nova Campanha (3/3) ─ Revisão e Disparo ───────────────────────────┐
│                                                                       │
│  ✅ Black Friday 2026                                                 │
│     Canal: E-mail                                                     │
│     Assunto: Oferta especial para {empresa} — só até sexta!          │
│     Destinatários: 342 leads (324 com e-mail, 18 sem e-mail)        │
│                                                                       │
│  Agendar para (opcional):                                            │
│  [19/05/2026          ] [10:00    ]  ← deixe vazio para envio imediato│
│                                                                       │
│  ─────────────────────────────────────────────────────────────────   │
│                                                                       │
│  [Salvar rascunho]    [← Anterior]    [🚀 Disparar agora]           │
└──────────────────────────────────────────────────────────────────────┘
```

## Página de detalhe — /campanhas/:id

```
┌─ Black Friday 2026 ─────────────────────────────── ● Enviando ──────┐
│  E-mail · 342 destinatários · iniciada às 10:01                     │
│                                                                       │
│  ████████████████████░░░░░░░░░  68% · 234/342 enviados · 3 falhas   │
│                                                                       │
│  ─── Destinatários ─────────────────────────────────────────────── │
│  [Todos ▾]  [Enviados]  [Falhas]  [Pendentes]  [Sem canal]          │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ ✅ Farmácia Exemplo — contato@farmex.com.br · há 2 min         │  │
│  │ ✅ Drogaria Central — drogaria@central.com · há 2 min          │  │
│  │ ❌ Distribuidora ABC — falha: SMTP timeout · há 1 min          │  │
│  │ ⏳ Clínica Saúde Total — aguardando                            │  │
│  │ — Pet Shop Amigo — sem e-mail cadastrado                       │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  [← Voltar]                                        [✕ Cancelar]     │
└──────────────────────────────────────────────────────────────────────┘
```

## UX decisions

- Wizard 3 passos: Configuração → Segmentação → Revisão (breadcrumb no topo)
- Prévia de destinatários atualizada em tempo real ao mudar filtros (debounce 500ms, GET /campanhas/preview)
- Envio exibe progresso via SSE (mesmo padrão do Sprint 12 — importação)
- Status badge com cores: rascunho=cinza, agendada=azul, enviando=amarelo pulsante, concluída=verde, cancelada=vermelho
- VENDEDOR: somente a página de listagem, em modo read-only, filtrada pelos seus leads; botão "Nova campanha" oculto
- Ícone do canal: 📧 para e-mail (base para Sprint 19 adicionar 💬 WhatsApp, 📞 telefonia)
- Destinatários sem e-mail aparecem na lista com "—" e legenda "sem canal" — não bloqueiam a campanha
