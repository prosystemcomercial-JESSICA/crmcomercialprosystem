# Sprint 34 — Step 02 — Patrícia Moura (UX)
# Vínculo Manual WA → Lead — Wireframes e Fluxos

## Layout Principal /conversas

```
╔══════════════════════════════════════════════════════════════════════╗
║  PÁGINA /conversas                                                    ║
╠══════════════════════════════════════════════════════════════════════╣
║  [Todas as Conversas]  [Desconhecidos 🔴 7]  [Arquivadas]           ║
╠═══════════════════════╦══════════════════════════════════════════════╣
║  LISTA (esquerda)     ║  THREAD (direita)                           ║
║  ┌─────────────────┐  ║  ┌────────────────────────────────────────┐ ║
║  │ 🔴 +5511999...  │  ║  │  ⚠️ Lead desconhecido — +5511999...  │ ║
║  │ "Oi, qual o..."  │  ║  │  ┌────────────────────────────────┐  │ ║
║  │ há 2h  ·  4msg  │  ║  │  │ [Vincular Lead] [Criar Lead]   │  │ ║
║  └─────────────────┘  ║  │  │              [Arquivar]        │  │ ║
║  ┌─────────────────┐  ║  │  └────────────────────────────────┘  │ ║
║  │ 🔴 +5527888...  │  ║  │                                        │ ║
║  │ "Preciso de..."  │  ║  │  ┌─── 14/05 ────────────────────────┐  │ ║
║  │ ontem  ·  2msg  │  ║  │  │                                   │  │ ║
║  └─────────────────┘  ║  │  │  [cinza] Oi, qual o preço...    │  │ ║
║                        ║  │  │  10:32                          │  │ ║
║                        ║  │  │                                   │  │ ║
║                        ║  │  │  [azul] Olá! Nosso plano...  →  │  │ ║
║                        ║  │  │                           10:45  │  │ ║
║                        ║  │  └─────────────────────────────────┘  │ ║
║                        ║  └────────────────────────────────────┘ ║
╚═══════════════════════╩══════════════════════════════════════════════╝
```

## Modais

### Modal — Vincular a Lead Existente
```
╔══════════════════════════════════════════════════════╗
║  🔗 Vincular Conversa a Lead Existente               ║
║                                                       ║
║  Número: +55 11 9 9999-8888                          ║
║                                                       ║
║  Buscar lead  [_________________________________]     ║
║               digitando... aguarda 300ms              ║
║                                                       ║
║  ┌──────────────────────────────────────────────┐   ║
║  │ ● João Silva                                  │   ║
║  │   Empresa: TechCorp · Vendedor: Carlos        │   ║
║  │   Tel: (sem telefone) · joao@techcorp.com     │   ║
║  │                                               │   ║
║  │ ● Maria Santos                                │   ║
║  │   Empresa: Varejo ABC · Vendedor: Ana         │   ║
║  │   Tel: +5527999887766                         │   ║
║  └──────────────────────────────────────────────┘   ║
║                                                       ║
║  [Cancelar]                        [Vincular ✓]     ║
╚══════════════════════════════════════════════════════╝
```

### Modal — Criar Novo Lead
```
╔══════════════════════════════════════════════════════╗
║  ➕ Criar Lead a partir do WhatsApp                  ║
║                                                       ║
║  Telefone  [+55 11 9 9999-8888      ] (pré-preen.)  ║
║  Nome*     [_________________________]               ║
║  Empresa   [_________________________]               ║
║  E-mail    [_________________________]               ║
║  Vendedor* [▼ Selecionar vendedor   ]               ║
║                                                       ║
║  [Cancelar]              [Criar Lead e Vincular ✓]  ║
╚══════════════════════════════════════════════════════╝
```

### Modal — Arquivar
```
╔══════════════════════════════════════════════════════╗
║  🗂 Arquivar Conversa                                ║
║                                                       ║
║  Tem certeza que deseja arquivar a conversa com      ║
║  +55 11 9 9999-8888?                                 ║
║                                                       ║
║  Esta conversa não será mais exibida como            ║
║  pendente. Você pode desfazer em "Arquivadas".       ║
║                                                       ║
║  [Cancelar]                        [Arquivar 🗂]    ║
╚══════════════════════════════════════════════════════╝
```

## Sidebar Badge
```
╔══════════════════════════════╗
║  📱 Conversas          [7]  ║  ← badge vermelho apenas para gestão
╚══════════════════════════════╝
```

## Fluxos de Interação

### Fluxo A — Vincular Lead Existente
1. Supervisora clica em conversa desconhecida → abre thread
2. Banner amarelo no topo: "⚠️ Lead desconhecido — +55 11 9..."
3. Clica "Vincular Lead" → modal abre com buscador em foco
4. Digita ≥3 chars → debounce 300ms → lista de resultados aparece
5. Seleciona um lead → botão "Vincular" fica ativo
6. Confirma → loading → toast "✅ Conversa vinculada a João Silva"
7. Conversa some da aba Desconhecidos → aparece na ficha do lead João

### Fluxo B — Criar Novo Lead
1. Clica "Criar Lead" → modal abre com telefone pré-preenchido
2. Nome e Vendedor são obrigatórios (validação inline)
3. Clica "Criar Lead e Vincular" → spinner
4. Sucesso → redireciona para `/leads/:novoId` com toast "Lead criado e conversa vinculada"

### Fluxo C — Arquivar
1. Clica "Arquivar" → modal de confirmação
2. Confirma → conversa some da lista, badge decrementa
3. Na aba "Arquivadas": lista com botão "Restaurar" por item
4. Restaurar → conversa volta para aba Desconhecidos

## Estados de Lista

- **Vazia (Desconhecidos):** "Nenhuma conversa pendente de identificação 🎉"
- **Vazia (Arquivadas):** "Nenhuma conversa arquivada"
- **Loading:** skeleton cards com pulse
- **Erro de API:** toast de erro com botão "Tentar novamente"

## Indicadores Visuais

- Ícone ⚠️ amarelo no card da conversa desconhecida
- Banner no topo da thread: fundo amarelo claro, borda esquerda laranja
- Badge numérico vermelho no sidebar (apenas gestão): atualiza ao vincular/arquivar
- Item selecionado na lista: borda esquerda verde + fundo levemente destacado
