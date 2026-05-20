# Sprint 15 — Step 02 — Patrícia Moura (UX)
# Histórico Detalhado — Wireframes

## Localização na UI

A timeline fica em uma **aba "Histórico"** dentro da ficha do lead (drawer lateral ou página /leads/:id). Não é uma tela separada — é integrada ao componente existente de ficha do lead.

```
┌─ Ficha do Lead: Farmácia Exemplo ──────────────────────────────┐
│  [Dados]  [Atividades]  [Propostas]  [Histórico]               │
│                                                                  │
│  HISTÓRICO                    [Exportar PDF]                     │
│  ─────────────────────────────────────────────                  │
│  Filtrar: [Todos] [Etapa] [Proposta] [Atividade] [Anotação]    │
│                                                                  │
│  ┌─ Adicionar anotação ─────────────────────────────────────┐  │
│  │ [Escreva uma nota sobre este lead...              ]       │  │
│  │                                          [Adicionar]      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ●─ 📝 Anotação — há 10 min                                    │
│  │   "Cliente pediu demonstração para semana que vem."          │
│  │   por Ana Lima                                               │
│  │                                                              │
│  ●─ 📋 Proposta criada — 14/05/26 às 14:32                    │
│  │   Proposta #0042 — R$890/mês + R$2.400 instalação           │
│  │   por Ana Lima                                               │
│  │                                                              │
│  ●─ ➡ Etapa alterada — 14/05/26 às 09:11                      │
│  │   De: Qualificação → Para: Proposta Enviada                  │
│  │   por Ana Lima                                               │
│  │                                                              │
│  ●─ ✅ Atividade concluída — 13/05/26 às 17:00                 │
│  │   Ligação realizada — "Apresentação feita, aguardando ok"   │
│  │   por Ana Lima                                               │
│  │                                                              │
│  ●─ 📥 Importado — 10/05/26 às 08:00                          │
│  │   Lead importado via planilha "clientes-maio.csv"            │
│  │   por Sistema                                                │
│  │                                                              │
│  ●─ 🆕 Lead criado — 10/05/26 às 08:00                        │
│     por Sistema (importação)                                    │
└──────────────────────────────────────────────────────────────────┘
```

## Ícones por tipo de evento

| Tipo | Ícone | Cor |
|------|-------|-----|
| lead_criado | 🆕 | verde |
| etapa_alterada | ➡ | azul |
| status_alterado | 🏁 | roxo |
| proposta_criada | 📋 | laranja |
| proposta_aprovada | ✅ | verde |
| atividade_criada | 📅 | cinza |
| atividade_concluida | ✅ | verde |
| anotacao | 📝 | amarelo |
| importacao | 📥 | azul claro |
| campo_alterado | ✏️ | cinza claro |

## UX decisions

- Timeline vertical com linha conectora pontilhada entre eventos
- Data/hora: relativa ("há 2 dias") com tooltip mostrando data exata ao hover
- Filtros em chips multiselect (sem botão de aplicar — reativo)
- Textarea de anotação: colapsa ao clicar fora se vazia; se tem texto, pede confirmação
- Eventos de sistema (importação, criação automática): "por Sistema" em itálico
- De → Para: em eventos de etapa, texto em destaque usando badge com seta
- Exportar PDF: botão no topo direito da aba
- Não há paginação — carrega todos (leads com histórico muito longo são raros no volume atual)
