# Sprint 20 — Step 02 — Patrícia Moura (UX)
# Inbound WhatsApp — Wireframes

## Sidebar — badge de notificação

```
┌─ Menu lateral ──────────────────────────────┐
│  🏠 Dashboard                               │
│  👥 Leads                                   │
│  📊 Funil                                   │
│  💬 Conversas            ← [3] badge vermelho│
│  📅 Atividades                              │
│  ...                                         │
└──────────────────────────────────────────────┘
```

## Página /conversas — lista de conversas

```
┌─ Conversas ─────────────────────────────────────────────────────────┐
│  Conversas WhatsApp                    [Vendedor: Todos ▾]          │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ 🟢 Farmácia Exemplo                              há 5 min     │ │
│  │    João Silva · "Oi, queria saber mais sobre o sistema..."     │ │
│  │    Ana Lima                                    [2 não lidas]  │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │    Drogaria Central                             há 2h         │ │
│  │    Ana Lima · "Perfeito, vou aguardar a proposta"             │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │    Clínica Saúde Total                          há 1 dia      │ │
│  │    Carlos Neto · "Ok, obrigado pelo retorno"                  │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

## Aba "Conversas" na ficha do lead — thread

```
┌─ Ficha do Lead: Farmácia Exemplo ──────────────────────────────────┐
│  [Dados] [Atividades] [Propostas] [Histórico] [Arquivos] [Conversas]│
│                                                                      │
│  ┌── Thread WhatsApp ─────────────────────────────────────────────┐ │
│  │                                                                │ │
│  │  19/05 10:01                                                   │ │
│  │                                                                │ │
│  │  ┌──────────────────────────────┐                             │ │
│  │  │ Olá, João! Aqui é Ana Lima   │ ← ENVIADO (azul, direita)  │ │
│  │  │ da ProSystem. Tudo bem?      │                             │ │
│  │  │                    10:01 ✓✓ │                             │ │
│  │  └──────────────────────────────┘                             │ │
│  │                                                                │ │
│  │         ┌──────────────────────────────────────┐             │ │
│  │         │ Oi! Sim, tudo bem. Queria saber mais  │ ← RECEBIDO │ │
│  │         │ sobre o sistema de gestão de farmácia  │   (cinza)  │ │
│  │         │                           10:15       │             │ │
│  │         └──────────────────────────────────────┘             │ │
│  │                                                                │ │
│  │         ┌──────────────────────────────────────┐             │ │
│  │         │ 📎 proposta-farma.pdf                 │             │ │
│  │         │ Documento · toque para baixar          │             │ │
│  │         │                           10:16       │             │ │
│  │         └──────────────────────────────────────┘             │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ✅ Dentro da janela de 24h — pode responder com texto livre        │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Digite sua mensagem...                                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  [Enviar]                                                            │
│                                                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │
│  Fora da janela de 24h → [Usar template ▾]                          │
└──────────────────────────────────────────────────────────────────────┘
```

## Estados da caixa de resposta

```
Estado 1 — Dentro da janela de 24h:
  [Digite sua mensagem...                              ] [Enviar →]
  ✅ Janela aberta até 19/05 às 22:15

Estado 2 — Fora da janela:
  ⚠️ Janela de 24h expirada. Use um template aprovado.
  [saudacao_vendedor                                 ▾] [Enviar template]

Estado 3 — Lead desconhecido (sem leadId):
  ⚠️ Número não vinculado a nenhum lead. [Vincular lead]
  (resposta bloqueada até vincular)
```

## Tipos de mensagem recebida

```
Texto:    "Mensagem de texto normal"
Imagem:   🖼 [Imagem · toque para ver]
Áudio:    🎵 [Áudio · 0:23 · toque para ouvir]
Documento:📎 [nome-do-arquivo.pdf · Documento]
Outros:   💬 [Tipo de mídia não suportado]
```

## UX decisions

- Thread estilo WhatsApp Web: outbound (azul) à direita, inbound (cinza) à esquerda
- Scroll automático para o final ao abrir e ao receber nova mensagem
- Timestamp relativo na lista de conversas ("há 5 min"), absoluto dentro da thread
- Notificação: badge vermelho no sidebar atualizado via SSE; som opcional (fora de escopo)
- Janela de 24h: calculada no frontend a partir de `ultimaMensagemRecebidaEm` do lead
- Mídia: exibida como card com ícone + nome + link de download (media_id via endpoint proxy); não carregada automaticamente
- Lead desconhecido: aparece na lista com "Número: +55 11 9xxxx-xxxx" e aviso; sem aba Conversas na ficha até ser vinculado
- Aba "Conversas" é a 6ª aba na ficha do lead; reordena as abas existentes
