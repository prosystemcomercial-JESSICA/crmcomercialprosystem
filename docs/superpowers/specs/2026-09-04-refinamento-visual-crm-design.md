# Refinamento Visual do CRM Comercial ProSystem

**Data:** 2026-09-04
**Status:** Aprovado (direção validada via mockups)
**Escopo:** Refatoração visual das telas principais do CRM — conforto e utilidade para uso diário intenso, afastando a aparência de "template de IA".

---

## 1. Contexto e Objetivo

O CRM ProSystem é uma ferramenta operacional de uso diário e intenso (gestor comercial abre às 7h, digita cadastros, consulta listas e responde a alertas o dia todo). O objetivo deste trabalho é **refinar o visual** para que seja **extremo e confortável de usar o dia inteiro** e para que **não pareça um dashboard genérico gerado por IA** — deve comunicar "produto em que uma empresa séria depende há anos".

**Direção escolhida (validada com o usuário via mockups no navegador):** *SaaS Empresarial Maduro* — sóbrio, denso, funcional, com tabelas como protagonistas, hierarquia inconfundível e zero espetáculo/vidual decorativo. Tudo dentro da identidade ProSystem (tokens `--t-*`, 3 temas × claro/escuro), sem substituir o azul institucional.

**Propósito do usuário:** saber rapidamente *"tem algo queimando?"* — lead parado, cliente em risco, atividade atrasada — e trabalhar 8h sem fadiga visual.

---

## 2. Princípios-guia

1. **Usabilidade de 8h sobre espetáculo.** Um dashboard empresarial prioriza organização, densidade, consistência, velocidade e precisão — não animação, gradiente ou ilustração.
2. **Menos efeito visual, mais produto.** Poucas cores, cor de marca bem definida, fundo neutro, sombras discretas, bordas sutis.
3. **Hierarquia inconfundível.** O usuário sabe imediatamente onde olhar primeiro. Um único ponto focal por tela.
4. **Tabelas são protagonistas** em telas de dados (listas, clientes, leads, contratos): busca, filtros, ordenação, paginação, ações, exportação.
5. **Tudo nasce de tokens** `--t-*`. Nunca hex decorativo novo (The No Loose Hex Rule do DESIGN.md). Qualquer mudança propaga para os 3 temas × claro/escuro.
6. **Cor de estado é reservada para estado** (ativo, risco, atraso, sucesso) — nunca decorativa (*The Status Color Reserve Rule*).

---

## 3. O que REMOVER (marcas de template de IA)

| Remover | Substituir por |
|---|---|
| Emoji como ícone (🔍 ⚠️ 🏢 📊 etc.) | Ícone Lucide consistente ou texto claro |
| Avatar redondo colorido em linhas de tabela | Nome em texto com peso, sem bola de cor |
| WhatsApp/floating com bola verde + sombra colorida | Link/ação discreto e consistente |
| Card empilhado à exaustão no dashboard | Tabela + painéis funcionais |
| Gradiente/sombra decorativa sem função | Elevação sutil ou borda |
| Radius exagerado (`rounded-full`/`rounded-2xl` aleatório) | Radius moderado e por papel (6–10px) |
| Pastel de status espalhado (bg-green-100 etc.) | Badge de status reservado para estado real |

**Atenção:** isto NÃO é uma regra de "proibido arredondar". É um critério de *coerência*: o mesmo papel tem sempre a mesma forma, e nada é arredondado por capricho.

---

## 4. O que REFORÇAR (marca de SaaS maduro)

### 4.1 Hierarquia em 3 camadas (peso + cor, não só tamanho)
Classes utilitárias novas em `globals.css`:
- **`.ps-label`** — rótulo de campo/coluna/cabeçalho de métrica: `11px` / 600 / uppercase / `--t-text-muted` / letter-spacing leve.
- **`.ps-valor`** — valor principal (KPI): `22–28px` / 700–800 / `--t-text-primary` / `-0.03em` / `tabular-nums`.
- **`.ps-meta`** — suporte/meta secundária: `12px` / 400–500 / `--t-text-secondary`.

### 4.2 Densidade uniforme
- Grid de espaçamento base 4px (`--space-1..10`).
- **Padding de card uniforme:** `--t-card-pad: 24px` (metricas/paineis) e `16px` (telas de dados densas) — dois níveis *explícitos*.
- Gaps escalados: micro 4 / componente 8–12 / seção 16–20 / área 24+.
- Movê para dentro do `.ps-card` (hoje as telas põem `p-4/p-5` ad-hoc, causando respiro irregular).

### 4.3 Tabelas protagonistas
- Toolbar funcional: busca + filtros + exportar + ações em lote.
- Código/identificadores em monospace; grupos/segmento como texto secundário.
- **`font-variant-numeric: tabular-nums`** em todo número dinâmico (mata o "tremulo" de MRR/pipeline).
- Zebra-hover discreta; cabeçalho de coluna sutil; linhas clicáveis com cursor.

### 4.4 Números estáveis (anti-fadiga)
Aplicar `tabular-nums` globalmente em `.ps-valor`, `.ps-kpi-number` e células numéricas de tabela.

### 4.5 Estados completos
- hover/active/focus/disabled consistentes em todo controle.
- Press feedback `scale(0.97)` em botões/cards interativos.
- Curvas de motion: `cubic-bezier(0.23,1,0.32,1)` para entrada; duração < 300ms; nunca `ease-in` puro.

### 4.6 Status só para estado
Reutilizar `StatusBadge` com ponto indicador; mapear hex `#16a34a/#dc2626` de deltas para tokens semânticos `color-mix`, para não estourar no dark mode.

---

## 5. Implementação — Fases

### Fase 1 — Fundação (tokens + componentes utilitários)
1. `globals.css`:
   - Tokens de espaçamento (`--space-*`), `--t-card-pad`.
   - Classes `.ps-label`, `.ps-valor`, `.ps-meta`.
   - `tabular-nums` para `.ps-valor`, `.ps-kpi-number`, células numéricas.
   - Curvas de motion + press feedback global.
   - Padding padrão no `.ps-card`.
2. Componentes utilitários existentes passam a usar os novos tokens/semântica:
   - `StatCard` (title→`.ps-label`, valor→`.ps-valor` tabular, delta→tokens `color-mix`).
   - `PageHeader`, `StatusBadge` (ponto indicador), `Button` (press feedback, radius moderado).
3. Sem mudança de lógica em nenhuma tela — elas herdam o benefício automaticamente.
4. Regressão visual nos 3 temas × claro/escuro.

### Fase 2+ — Aplicação tela a tela (ordem de prioridade)
1. **Dashboard Executivo** — tabela + painéis no lugar de empilhamento de cards; delta/status tokenizados; tabular-nums.
2. **Relatório Comercial** — mesma trilha, hierarquia de números de KPI.
3. **Leads / SDR / Funil** — tabelas densas com toolbar.
4. **Clientes / Contratos** — remover emojis/avatars/WhatsApp-bola; tabela protagonista.
5. **Demais telas** — aplicação progressiva na mesma trilha.

A cada tela: remover emoji-como-ícone, avatar redondo, hex decorativo, shadow colorida.

---

## 6. Verificação

- **Visual:** screenshots via `agent-browser`/`webapp-testing` do antes/depois, nos 3 temas × claro/escuro, por tela.
- **Squint test:** a hierarquia deve continuar lendo de olhos semi-fechados — nada salta agressivamente.
- **Swap test:** trocar fonte/layout padrão não deve alterar a percepção (não dependemos de uma fonte/sombra para parecer "profissional").
- **Token test:** ler os tokens usados deve remeter ao mundo ProSystem (concessionária/operação), não a qualquer produto.
- Funcional: `npm run lint`, `npm run build` no `frontend/`; testes e2e existentes (`npm run test:e2e`) não devem quebrar.

---

## 7. Critérios de "pronto" por tela

- [ ] Nenhum hex decorativo novo — só `var(--t-*)`.
- [ ] Zero emoji usado como ícone.
- [ ] Números dinâmicos com `tabular-nums`.
- [ ] Estados hover/active/focus/disabled presentes em controles interativos.
- [ ] Espaçamento no grid de 4px; padding de card padrão (`24px`/`16px`).
- [ ] Regressão visual OK nos 3 temas × claro/escuro.
- [ ] Squint test passa (hierarquia clara).

---

## 8. Fora de escopo (não fazer)

- Não substituir o azul institucional / paleta ProSystem.
- Não mudar a arquitetura, layout estrutural (sidebar/topbar) ou a stack.
- Não adicionar nova família tipográfica (manter Inter).
- Não refatorar lógica de negócio das telas.
