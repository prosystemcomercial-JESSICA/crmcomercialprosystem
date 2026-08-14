# Perfil SDR — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cadastrar o papel SDR no CRM (Fastify + Prisma + Next.js), com escopo de dados próprio, trava de fechamento, indicador de completude de cadastro, fluxo de distribuição/devolução de leads pela supervisão, taxonomia de motivo de perda e relatórios de desempenho/inteligência de mercado.

**Architecture:** Reaproveita ao máximo a infraestrutura de Leads já existente (`Lead.responsavel_id`/`created_by` para escopo, `LeadHistorico` para trilha de auditoria — nenhuma tabela nova). Adiciona: um novo valor de `cargo` (`'SDR'`), duas rotas novas de distribuição/devolução, um cálculo derivado de completude, uma taxonomia fixa de motivo de perda, e três telas novas de relatório/desempenho.

**Tech Stack:** Fastify, Prisma (MySQL), Zod, Next.js App Router com inline styles (ver `frontend/AGENTS.md` — **NÃO é o Next.js padrão, leia `node_modules/next/dist/docs/` antes de mexer em rotas/params se algo parecer não-convencional**), Recharts para gráficos.

## Global Constraints

- Todo texto de UI em português, seguindo o padrão existente do projeto.
- Nenhuma tabela nova no schema — a trilha de distribuição/devolução usa `LeadHistorico` (já existe, já tem `acao`/`ator_id`/`ator_nome`/`detalhes` JSON), não uma tabela dedicada.
- `LeadHistorico` é expurgado automaticamente após 60 dias (`backend/src/services/automation.service.ts:114`) — qualquer relatório que dependa dele para períodos longos deve documentar essa limitação, não tentar contorná-la nesta spec.
- A rota real de mover lead no kanban visível ao usuário é `PATCH /leads/:id` com o campo `etapa_comercial` (`backend/src/routes/leads.ts:539`) — **não** `funil.ts`/`etapa_funil`/`LeadPerda`, que é usado apenas perifericamente (métricas) pela tela de Pipeline. Toda trava de permissão e toda leitura de "motivo de perda" desta spec mira `etapa_comercial` e o campo `Lead.motivo_perda`, nunca `funil.ts`.
- SDR usa o mesmo mecanismo de escopo do VENDEDOR (`backend/src/lib/scope.ts`, `OWNER_COLUMNS.Lead = ['responsavel_id', 'created_by']`) — não entra em `ROLES_VISAO_TOTAL`. Nenhuma mudança é necessária em `scope.ts`.
- Modelo de posse: visibilidade compartilhada. Um lead criado por um SDR (`created_by`) permanece visível a ele mesmo depois de `responsavel_id` apontar para um vendedor — isso já é o comportamento do `ownerWhere`/`OWNER_COLUMNS` hoje (é um `OR`), nenhuma mudança de lógica é necessária, só validar com teste.

---

### Task 1: Cadastro do cargo SDR (dropdown de criação de usuário)

**Files:**
- Modify: `frontend/app/usuarios/page.tsx:24-31`

**Interfaces:**
- Produces: valor de string `'SDR'` como cargo válido, reconhecido em todo o restante do sistema (tarefas seguintes dependem deste valor existir no dropdown para poder ser testado ponta a ponta).

- [ ] **Step 1: Adicionar SDR ao array CARGOS**

Em `frontend/app/usuarios/page.tsx`, editar o array (linhas 24-31):

```typescript
const CARGOS = [
  { value: 'CEO', label: 'CEO', color: '#7c3aed' },
  { value: 'SUPERVISAO_COMERCIAL', label: 'Supervisão Comercial', color: '#2563eb' },
  { value: 'SUPERVISAO_TECNICA', label: 'Supervisão Técnica', color: '#0891b2' },
  { value: 'TECNICO_SUPORTE', label: 'Técnico Suporte', color: '#d97706' },
  { value: 'TECNICO_IMPLANTACAO', label: 'Técnico de Implantação', color: '#0d9488' },
  { value: 'VENDEDOR', label: 'Vendedor', color: '#16a34a' },
  { value: 'SDR', label: 'SDR (Pré-vendas)', color: '#ea580c' },
];
```

- [ ] **Step 2: Testar manualmente**

Rodar o frontend localmente (`npm run dev` dentro de `frontend/`), abrir `/usuarios`, clicar em "Novo Usuário", confirmar que "SDR (Pré-vendas)" aparece no dropdown de cargo e que salvar um usuário com esse cargo funciona (o backend de `usuarios.ts` já aceita `cargo` como string livre, sem enum — não deve haver erro 400).

- [ ] **Step 3: Commit**

```bash
git add frontend/app/usuarios/page.tsx
git commit -m "feat: adiciona cargo SDR ao cadastro de usuarios"
```

---

### Task 2: Menu e navegação do SDR

**Files:**
- Modify: `frontend/components/dashboard/DashboardLayout.tsx`

**Interfaces:**
- Consumes: nada de tasks anteriores (independente, mas assume que rotas `/sdr/leads-para-distribuir` e `/sdr/desempenho` vão existir — Tasks 5 e 7 criam essas páginas; até lá, os links no menu levam a 404, o que é aceitável durante o desenvolvimento incremental).
- Produces: usuário com `cargo='SDR'` vê no menu: Pipeline Comercial, WhatsApp, Atividades, Agenda, Clientes, Meu Desempenho. Usuário `GESTAO_COMERCIAL` vê adicionalmente "Leads para Distribuir".

- [ ] **Step 1: Adicionar SDR ao array COMERCIAL**

Localizar a definição de `COMERCIAL` em `frontend/components/dashboard/DashboardLayout.tsx` (hoje `const COMERCIAL = ['CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL', 'VENDEDOR'];`) e adicionar `'SDR'`:

```typescript
const COMERCIAL = ['CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL', 'VENDEDOR', 'SDR'];
```

Isso automaticamente dá ao SDR acesso aos itens `/leads` (Pipeline Comercial), `/whatsapp`, `/propostas-comerciais`, `/contratos`, `/campanhas`, `/indicacoes`, `/representantes`, `/ativos`, `/alertas`, `/previsao`, `/nutricao`, `/analise-comercial` — que hoje usam `roles: COMERCIAL`.

**Decisão de escopo**: a spec original pedia acesso restrito (só Pipeline/WhatsApp/Atividades/Agenda/Clientes). Adicionar `SDR` a `COMERCIAL` dá acesso a mais itens do que o estritamente necessário (ex.: Propostas, Contratos, Campanhas). Isso é aceitável — SDR não tem permissão de *escrita* nessas áreas restrita por regra de negócio nova, só herda visibilidade de menu igual ao VENDEDOR. Se a usuária quiser um menu mais enxuto, é um ajuste de um array, não uma mudança estrutural. Prosseguir com essa abordagem simples (reaproveitar `COMERCIAL`) em vez de criar um terceiro array `SDR_MENU` — YAGNI até haver sinal de que é necessário.

- [ ] **Step 2: Adicionar item de menu "Meu Desempenho"**

No grupo `'Performance'` do array `navGroups`, adicionar (a rota só existirá após a Task 7, mas o item de menu pode ser adicionado agora):

```typescript
{ href: '/sdr/desempenho', icon: Target, label: 'Meu Desempenho', roles: ['SDR'] },
```

Confirmar que `Target` já está importado de `lucide-react` no topo do arquivo; se não estiver, adicionar ao import existente (`import { ..., Target } from 'lucide-react';`).

- [ ] **Step 3: Adicionar item de menu "Leads para Distribuir"**

No mesmo grupo `'Performance'` (ou criar um novo grupo `'Prospecção'` antes dele — usar o padrão existente de `NavGroup`), adicionar:

```typescript
{ href: '/sdr/leads-para-distribuir', icon: Send, label: 'Leads para Distribuir', roles: GESTAO_COMERCIAL },
```

Confirmar/importar `Send` de `lucide-react`.

- [ ] **Step 4: Testar manualmente**

Com um usuário de teste `cargo='SDR'` logado, confirmar que o menu lateral mostra Pipeline Comercial, WhatsApp, Atividades, Agenda, Clientes, Meu Desempenho — e NÃO mostra Usuários, Configurações, Auditoria, Painel do CEO, Relatório Comercial, Comissões, Metas (essas usam `GESTORES`/`GESTAO_COMERCIAL`/`SO_CEO`, que não incluem SDR).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/dashboard/DashboardLayout.tsx
git commit -m "feat: adiciona SDR ao menu comercial e cria itens Meu Desempenho / Leads para Distribuir"
```

---

### Task 3: Trava de fechamento — SDR não pode marcar lead como ACEITO/FECHADO

**Files:**
- Modify: `backend/src/routes/leads.ts` (dois pontos: `PATCH /leads/:id` em torno da linha 539, e `POST /leads/:id/fechar` em torno da linha 894)
- Test: `backend/src/routes/__tests__/leads-sdr-trava.test.ts` (novo — confirmar primeiro qual framework de teste o projeto usa; ver Step 1)

**Interfaces:**
- Consumes: `(request as any).user.role` (já populado pelo middleware de auth existente — mesmo padrão usado em `podeVerTudo`/`requireGestor` de `backend/src/lib/scope.ts`).
- Produces: função exportada `bloqueadoParaFecharSeSDR(role: string | undefined, etapaAlvo: string | undefined): boolean` em um novo arquivo `backend/src/lib/sdr-restricoes.ts`, reutilizável pelas duas rotas.

- [ ] **Step 1: Confirmar o framework/padrão de teste do projeto**

Rodar `Grep` por `describe(` ou `it(` dentro de `backend/src` para achar um teste existente e copiar exatamente o padrão de setup (import de app Fastify de teste, mocks de Prisma, etc.) antes de escrever o teste novo. Se não houver nenhum teste automatizado no backend hoje, pular a criação de teste automatizado nesta task e validar manualmente via curl no Step 5 — não introduzir um framework de teste novo isoladamente para uma trava pequena.

- [ ] **Step 2: Criar a função de checagem**

Criar `backend/src/lib/sdr-restricoes.ts`:

```typescript
// Etapas de fechamento que um SDR não pode atribuir a um lead — fechamento é
// sempre ação do vendedor/closer. SDR qualifica até QUALIFICADO e a supervisão
// distribui o lead para um vendedor fechar (ver rota /leads/:id/distribuir).
export const ETAPAS_BLOQUEADAS_PARA_SDR = ['ACEITO', 'FECHADO', 'CONTRATO_ASSINADO', 'CONTRATO_EM_ANDAMENTO'];

export function bloqueadoParaFecharSeSDR(role: string | undefined, etapaAlvo: string | undefined | null): boolean {
  if ((role || '').toUpperCase() !== 'SDR') return false;
  if (!etapaAlvo) return false;
  return ETAPAS_BLOQUEADAS_PARA_SDR.includes(etapaAlvo);
}
```

(A lista reaproveita os mesmos códigos de `ETAPAS_FECHAMENTO` já definidos inline em `leads.ts:581` — ver Step 3, que também sugere consolidar essa duplicação.)

- [ ] **Step 3: Aplicar a trava em `PATCH /leads/:id`**

Em `backend/src/routes/leads.ts`, adicionar o import no topo:

```typescript
import { bloqueadoParaFecharSeSDR } from '@/lib/sdr-restricoes';
```

Dentro do handler `fastify.patch('/leads/:id', ...)`, logo após `const user = (request as any).user;` (linha 551) e antes do `try {` (linha 552), adicionar:

```typescript
    if (bloqueadoParaFecharSeSDR(user?.role, body.data.etapa_comercial)) {
      return reply.status(403).send({ status: 'error', message: 'SDR não pode fechar leads — encaminhe para um vendedor.' });
    }
```

- [ ] **Step 4: Aplicar a trava em `POST /leads/:id/fechar`**

No mesmo arquivo, dentro do handler `fastify.post('/leads/:id/fechar', ...)` (linha 894), logo após `const user = (request as any).user;` (linha 896) e antes da validação do body, adicionar:

```typescript
    if ((user?.role || '').toUpperCase() === 'SDR') {
      return reply.status(403).send({ status: 'error', message: 'SDR não pode fechar leads — encaminhe para um vendedor.' });
    }
```

(Rota mais simples: sempre fecha como `ACEITO`, então não precisa checar etapa alvo — qualquer SDR chamando essa rota é bloqueado.)

- [ ] **Step 5: Testar manualmente via curl**

Com um token de usuário `role='SDR'` (gerar via login de teste ou JWT manual com o `JWT_SECRET` de dev), rodar:

```bash
curl -X PATCH http://localhost:3333/leads/<id-de-um-lead-de-teste> \
  -H "Authorization: Bearer <token-sdr>" -H "Content-Type: application/json" \
  -d '{"etapa_comercial":"ACEITO"}'
```

Esperado: HTTP 403, `{"status":"error","message":"SDR não pode fechar leads — encaminhe para um vendedor."}`.

Repetir com `etapa_comercial: "QUALIFICADO"` — esperado: HTTP 200, sucesso (SDR pode mover até QUALIFICADO).

Repetir a chamada em `POST /leads/:id/fechar` com o mesmo token SDR — esperado: HTTP 403.

- [ ] **Step 6: Commit**

```bash
git add backend/src/lib/sdr-restricoes.ts backend/src/routes/leads.ts
git commit -m "feat: impede SDR de fechar leads (ACEITO/FECHADO) via PATCH e /fechar"
```

---

### Task 4: Indicador de completude de cadastro do lead

**Files:**
- Create: `backend/src/lib/lead-completude.ts`
- Modify: `backend/src/routes/leads.ts` (rotas `GET /leads` linha ~374, `GET /leads/kanban` linha ~414, `GET /leads/:id` linha ~483 — expor `completude_pct` no payload)
- Modify: `frontend/app/leads/page.tsx` (badge de completude na listagem e no detalhe do lead)

**Interfaces:**
- Produces: `calcularCompletude(lead: LeadCompletudeInput): number` — retorna inteiro 0-100.
- Consumes (frontend): campo `completude_pct` presente em cada objeto lead retornado pelas rotas GET acima.

- [ ] **Step 1: Criar a função de cálculo**

Criar `backend/src/lib/lead-completude.ts`:

```typescript
export interface LeadCompletudeInput {
  telefone?: string | null;
  responsavel_telefone?: string | null;
  email?: string | null;
  responsavel_email?: string | null;
  segmento?: string | null;
  cidade?: string | null;
  qtd_lojas?: number | null;
  sistema_atual?: string | null;
  responsavel_nome?: string | null;
  temperatura?: string | null;
  probabilidade?: number | null;
  observacoes_comerciais?: string | null;
}

// 9 critérios, pesos iguais. "concorrente_atual" da spec original foi descartado
// em favor de reaproveitar sistema_atual (já cobre a mesma informação — ver
// docs/superpowers/specs/2026-08-14-perfil-sdr-design.md, Bloco 4).
export function calcularCompletude(lead: LeadCompletudeInput): number {
  const criterios = [
    !!(lead.telefone || lead.responsavel_telefone),
    !!(lead.email || lead.responsavel_email),
    !!lead.segmento,
    !!lead.cidade,
    !!lead.qtd_lojas,
    !!lead.sistema_atual,
    !!lead.responsavel_nome,
    !!(lead.temperatura && lead.temperatura !== 'FRIO') || !!lead.probabilidade,
    !!lead.observacoes_comerciais,
  ];
  const preenchidos = criterios.filter(Boolean).length;
  return Math.round((preenchidos / criterios.length) * 100);
}
```

- [ ] **Step 2: Escrever teste unitário**

Confirmar o padrão de teste do projeto (mesmo Step 1 da Task 3 — se não houver framework, validar manualmente). Se houver, criar `backend/src/lib/__tests__/lead-completude.test.ts`:

```typescript
import { calcularCompletude } from '../lead-completude';

test('lead vazio retorna 0%', () => {
  expect(calcularCompletude({})).toBe(0);
});

test('lead com todos os 9 campos retorna 100%', () => {
  expect(calcularCompletude({
    telefone: '11999999999', email: 'a@a.com', segmento: 'Farmácia',
    cidade: 'Curitiba', qtd_lojas: 2, sistema_atual: 'Concorrente X',
    responsavel_nome: 'João', temperatura: 'QUENTE', observacoes_comerciais: 'Dor: suporte lento',
  })).toBe(100);
});

test('lead com metade dos campos fica perto de 50%', () => {
  const pct = calcularCompletude({
    telefone: '11999999999', email: 'a@a.com', segmento: 'Farmácia', cidade: 'Curitiba',
  });
  expect(pct).toBeGreaterThan(0);
  expect(pct).toBeLessThan(60);
});
```

- [ ] **Step 3: Rodar o teste e confirmar que passa**

Rodar o comando de teste do projeto (confirmar em `backend/package.json` script `test`; se não existir, rodar `npx ts-node` num script ad-hoc chamando a função e validar manualmente os 3 casos acima).

- [ ] **Step 4: Expor `completude_pct` nas rotas de leitura de leads**

Em `backend/src/routes/leads.ts`, importar no topo:

```typescript
import { calcularCompletude } from '@/lib/lead-completude';
```

Em `GET /leads` (linha ~374) e `GET /leads/kanban` (linha ~414): localizar onde os leads são serializados/retornados na resposta (`reply.send(...)`) e mapear cada lead adicionando `completude_pct: calcularCompletude(lead)` antes de enviar. Mesma coisa em `GET /leads/:id` (linha ~483), aplicando ao objeto único retornado.

Não é necessário persistir o valor — é sempre recalculado on-the-fly a partir dos campos já carregados na query existente (nenhuma mudança de `select`/`include` é necessária, os campos usados no cálculo já fazem parte do model `Lead` completo).

- [ ] **Step 5: Badge de completude no frontend — listagem**

Em `frontend/app/leads/page.tsx`, localizar onde cada card de lead é renderizado no kanban (por volta da linha 1122, onde `etapa_comercial` já é lido do lead) e adicionar um badge pequeno mostrando `${lead.completude_pct}%`, com cor condicional:

```typescript
const corCompletude = (pct: number) => pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';
```

Renderizar como um `<span>` com `background: corCompletude(lead.completude_pct)`, texto branco, `border-radius: 999px`, `padding: 2px 8px`, `font-size: 11px` — seguindo o padrão de badges já usado em outros pontos da mesma tela (procurar um badge existente no arquivo para copiar o estilo exato, já que o projeto usa inline styles, não Tailwind).

- [ ] **Step 6: Badge de completude no frontend — detalhe do lead**

No painel de detalhe do lead (mesma tela, seção onde o lead selecionado é exibido em detalhe, próximo à linha 1377/1434 mencionada no mapeamento de `etapa_comercial`), adicionar o mesmo badge, maior, próximo ao nome do lead.

- [ ] **Step 7: Testar manualmente**

Abrir `/leads`, confirmar que todo card do kanban mostra um badge de %, que a cor muda conforme a faixa, e que o detalhe do lead também mostra o badge. Criar um lead novo só com nome (mínimo obrigatório) e confirmar que aparece ~0-11%; editar preenchendo os outros campos e confirmar que o % sobe ao salvar.

- [ ] **Step 8: Commit**

```bash
git add backend/src/lib/lead-completude.ts backend/src/routes/leads.ts frontend/app/leads/page.tsx
git commit -m "feat: indicador de completude de cadastro do lead (badge %)"
```

---

### Task 5: Taxonomia de motivo de perda

**Files:**
- Modify: `frontend/app/leads/page.tsx` (modal de perda, em torno das linhas 697-726 mapeadas na investigação)

**Interfaces:**
- Produces: `Lead.motivo_perda` passa a ser preenchido com um dos valores fixos da taxonomia (ou `"OUTRO: <texto livre>"` quando o usuário escolhe "Outro"), em vez de texto totalmente livre.

**Nota importante**: a investigação confirmou que a tela real de Pipeline usa `PATCH /leads/:id` com `motivo_perda` como texto livre (não a tabela `LeadPerda`/rota `funil.ts`, que é periférica). Esta task muda **apenas o frontend** — não há mudança de schema, `motivo_perda` já é `String? @db.Text`, aceita qualquer valor.

- [ ] **Step 1: Localizar o modal de perda atual**

Ler `frontend/app/leads/page.tsx` em torno das linhas 697-726 (onde `setShowPerda(true)` e `confirmPerda` são definidos) para entender a estrutura atual do input de motivo (hoje provavelmente um `<textarea>` ou `<input>` de texto livre).

- [ ] **Step 2: Adicionar dropdown de taxonomia fixa**

Substituir (ou complementar, se o modal já tiver mais de um campo) o input de motivo por um `<select>` com as opções:

```typescript
const MOTIVOS_PERDA = [
  { value: 'PRECO', label: 'Preço' },
  { value: 'JA_TEM_FORNECEDOR', label: 'Já tem fornecedor' },
  { value: 'SEM_ORCAMENTO', label: 'Sem orçamento' },
  { value: 'TIMING', label: 'Timing não é agora' },
  { value: 'SEM_INTERESSE', label: 'Sem interesse' },
  { value: 'FUNCIONALIDADE_AUSENTE', label: 'Funcionalidade ausente' },
  { value: 'OUTRO', label: 'Outro' },
];
```

Quando `OUTRO` for selecionado, exibir um `<textarea>` adicional obrigatório para detalhar. Ao confirmar, montar o valor final enviado em `motivo_perda`:

```typescript
const motivoFinal = perdaMotivoSelecionado === 'OUTRO'
  ? `OUTRO: ${perdaTextoOutro.trim()}`
  : MOTIVOS_PERDA.find(m => m.value === perdaMotivoSelecionado)?.label || perdaMotivoSelecionado;
```

Manter a validação existente (motivo obrigatório antes de confirmar o PATCH) — se `OUTRO` selecionado, exigir também que `perdaTextoOutro` não esteja vazio.

- [ ] **Step 3: Testar manualmente**

Abrir `/leads`, arrastar um card de teste para a coluna "Perdido", confirmar que o modal mostra o dropdown com as 7 opções, que selecionar "Outro" revela o campo de texto extra, e que o `motivo_perda` salvo no lead reflete o valor esperado (conferir via `GET /leads/:id` ou na ficha do lead após salvar).

- [ ] **Step 4: Commit**

```bash
git add frontend/app/leads/page.tsx
git commit -m "feat: taxonomia fixa de motivo de perda no modal de Pipeline Comercial"
```

---

### Task 6: Distribuição e devolução de leads (supervisão ↔ SDR)

**Files:**
- Modify: `backend/src/routes/leads.ts` (novas rotas, próximas às rotas de atribuição existentes em torno da linha 227-296)
- Create: `frontend/app/sdr/leads-para-distribuir/page.tsx`

**Interfaces:**
- Consumes: `calcularCompletude` (Task 4), `bloqueadoParaFecharSeSDR` não se aplica aqui (distribuição não é fechamento).
- Produces: rotas `POST /leads/:id/distribuir-sdr`, `POST /leads/:id/devolver-sdr`, `GET /leads/prontos-para-distribuir`. Nomeadas com sufixo `-sdr`/prefixo distinto das rotas já existentes `POST /leads/atribuir` e `POST /leads/distribuir` (linha 227 e 260) para não colidir — aquelas são bulk/round-robin de leads sem responsável; estas são o fluxo específico SDR→supervisão→vendedor com histórico de motivo.

- [ ] **Step 1: Criar a rota de distribuição**

Em `backend/src/routes/leads.ts`, próximo às rotas de atribuição existentes (após a linha 296), adicionar:

```typescript
  // ── Distribuição SDR → Vendedor (com trilha em LeadHistorico) ─────────────
  fastify.post('/leads/:id/distribuir-sdr', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = z.object({ para_usuario_id: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: 'Informe para_usuario_id' });
    const ator = (request as any).user;

    const lead = await prisma.lead.findUnique({ where: { id }, select: { id: true, nome: true, responsavel_id: true } });
    if (!lead) return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });

    const vend: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, nome FROM UsuarioCRM WHERE id = ? AND status = 'ATIVO' LIMIT 1`, body.data.para_usuario_id
    ).catch(() => []);
    if (!vend.length) return reply.status(404).send({ status: 'error', message: 'Vendedor não encontrado ou inativo' });

    await prisma.lead.update({
      where: { id },
      data: { responsavel_id: vend[0].id, vendedor_nome: vend[0].nome, atribuido_em: new Date(), atribuicao_vista: false },
    });

    await prisma.$executeRawUnsafe(
      `INSERT INTO LeadHistorico (id, lead_id, lead_nome, acao, etapa_anterior, etapa_destino, ator_id, ator_nome, detalhes)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      randomUUID(), id, lead.nome, 'DISTRIBUICAO_SDR', null, null,
      ator?.id || null, ator?.nome || 'Sistema',
      JSON.stringify({ de_usuario_id: lead.responsavel_id || null, para_usuario_id: vend[0].id, para_usuario_nome: vend[0].nome }),
    ).catch(() => {});

    return reply.send({ status: 'success', data: { lead_id: id, vendedor: vend[0].nome } });
  });
```

- [ ] **Step 2: Criar a rota de devolução**

Logo após, no mesmo arquivo:

```typescript
  fastify.post('/leads/:id/devolver-sdr', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = z.object({ motivo: z.string().min(5, 'Descreva o motivo (mínimo 5 caracteres)') }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ status: 'error', message: body.error.issues[0]?.message || 'Motivo obrigatório' });
    const ator = (request as any).user;

    const lead = await prisma.lead.findUnique({ where: { id }, select: { id: true, nome: true, created_by: true, responsavel_id: true } });
    if (!lead) return reply.status(404).send({ status: 'error', message: 'Lead não encontrado' });

    await prisma.lead.update({
      where: { id },
      data: { responsavel_id: lead.created_by, atribuido_em: new Date(), atribuicao_vista: false },
    });

    await prisma.$executeRawUnsafe(
      `INSERT INTO LeadHistorico (id, lead_id, lead_nome, acao, etapa_anterior, etapa_destino, ator_id, ator_nome, detalhes)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      randomUUID(), id, lead.nome, 'DEVOLUCAO_SDR', null, null,
      ator?.id || null, ator?.nome || 'Sistema',
      JSON.stringify({ de_usuario_id: lead.responsavel_id || null, para_usuario_id: lead.created_by, motivo: body.data.motivo }),
    ).catch(() => {});

    await prisma.leadObservacao.create({
      data: {
        lead_id: id, tipo: 'SISTEMA',
        descricao: `Lead devolvido pela supervisão: ${body.data.motivo}`,
        created_by: ator?.id || 'system', created_by_name: ator?.nome || 'Sistema',
      },
    });

    return reply.send({ status: 'success', data: { lead_id: id, devolvido_para: lead.created_by } });
  });
```

- [ ] **Step 3: Criar a rota de leads prontos para distribuir**

```typescript
  fastify.get('/leads/prontos-para-distribuir', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const leads = await prisma.lead.findMany({
      where: { etapa_comercial: 'QUALIFICADO', deleted_at: null },
      orderBy: { created_at: 'asc' },
    });
    const data = leads.map(l => ({ ...l, completude_pct: calcularCompletude(l) }));
    return reply.send({ status: 'success', data });
  });
```

Nota: `'QUALIFICADO'` deve bater exatamente com a chave de coluna real cadastrada em `KanbanColuna` no ambiente de produção (a coluna é dinâmica/configurável, conforme comentário em `leads.ts:58-60`). Antes de considerar esta task concluída, confirmar via `SELECT DISTINCT etapa_comercial FROM Lead` ou a tabela `KanbanColuna` qual é o valor exato usado em produção para a etapa de qualificação — se for diferente (ex.: `'QUALIFICADO_SDR'` ou outro nome customizado), ajustar a constante aqui.

- [ ] **Step 4: Criar a página de distribuição no frontend**

Criar `frontend/app/sdr/leads-para-distribuir/page.tsx` seguindo o padrão de outras páginas do projeto (`DashboardLayout` como wrapper, `apiClient` para chamadas — ver `frontend/lib/api-client.ts` para adicionar os métodos `getLeadsProntosParaDistribuir()`, `distribuirLeadSdr(id, vendedorId)`, `devolverLeadSdr(id, motivo)` seguindo o padrão dos métodos existentes como `updateLead`).

Estrutura da tela:
- Tabela/lista com: nome da empresa, nome do SDR (`created_by`, resolver nome via `UsuarioCRM` — ver como outras telas já resolvem nome de usuário a partir de id, provavelmente um mapa carregado uma vez), badge de completude (Task 4), temperatura, tempo desde `updated_at`.
- Por linha: botão "Distribuir" abrindo um seletor de vendedor ativo (reaproveitar a mesma listagem de vendedores usada em `/leads/atribuir` no frontend, se já existir um componente/hook para isso) e botão "Devolver" abrindo um campo de texto para motivo (mínimo 5 caracteres, replicando a validação do backend no frontend antes de enviar).

- [ ] **Step 5: Testar manualmente**

Criar 2-3 leads de teste com `etapa_comercial='QUALIFICADO'` (via PATCH direto ou movendo no kanban), abrir `/sdr/leads-para-distribuir` logado como `SUPERVISAO_COMERCIAL`, confirmar que aparecem na lista com completude correta, distribuir um para um vendedor de teste (confirmar que `responsavel_id` muda e que o vendedor recebe o alerta de atribuição — sininho já existente via `atribuicao_vista=false`), devolver outro com um motivo (confirmar que volta para o SDR original e que aparece uma observação de sistema no lead).

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/leads.ts frontend/app/sdr/leads-para-distribuir/page.tsx frontend/lib/api-client.ts
git commit -m "feat: distribuicao e devolucao de leads qualificados (supervisao <-> SDR)"
```

---

### Task 7: Painel de desempenho do SDR

**Files:**
- Create: `backend/src/routes/sdr.ts`
- Modify: `backend/src/server.ts` (ou onde as rotas são registradas — confirmar o padrão de registro de plugins de rota do projeto antes de editar)
- Create: `frontend/app/sdr/desempenho/page.tsx`

**Interfaces:**
- Consumes: `LeadHistorico` (para contar `DISTRIBUICAO_SDR` da Task 6), `Atividade`, `Lead`.
- Produces: `GET /sdr/desempenho?data_inicio=&data_fim=&sdr_id=` retornando o objeto de métricas descrito no Step 2.

- [ ] **Step 1: Confirmar o padrão de registro de rotas**

Ler `backend/src/server.ts` (ou arquivo equivalente de bootstrap) para ver como os outros arquivos de `backend/src/routes/*.ts` são importados e registrados (`fastify.register(...)`), e replicar exatamente o mesmo padrão para o novo arquivo `sdr.ts`.

- [ ] **Step 2: Criar a rota de desempenho**

Criar `backend/src/routes/sdr.ts`:

```typescript
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { getUser, podeVerTudo } from '@/lib/scope';

export default async function sdrRoutes(fastify: FastifyInstance) {
  const prisma = new PrismaClient();

  fastify.get('/sdr/desempenho', async (request, reply) => {
    const user = getUser(request);
    const q = request.query as { data_inicio?: string; data_fim?: string; sdr_id?: string };

    // SDR só vê o próprio; gestor pode filtrar por sdr_id ou ver agregado geral.
    let sdrId: string | null;
    if (!podeVerTudo(user)) {
      sdrId = user?.id || '__no_user__';
    } else {
      sdrId = q.sdr_id || null;
    }

    const dataInicio = q.data_inicio ? new Date(q.data_inicio) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const dataFim = q.data_fim ? new Date(q.data_fim) : new Date();

    const whereLead: any = { created_at: { gte: dataInicio, lte: dataFim }, deleted_at: null };
    if (sdrId) whereLead.created_by = sdrId;

    const leadsCadastrados = await prisma.lead.count({ where: whereLead });
    const leadsQualificados = await prisma.lead.count({ where: { ...whereLead, etapa_comercial: 'QUALIFICADO' } });
    const vendasOriginadas = await prisma.lead.count({ where: { ...whereLead, etapa_comercial: { in: ['ACEITO', 'FECHADO'] } } });

    const whereAtiv: any = { created_at: { gte: dataInicio, lte: dataFim } };
    if (sdrId) whereAtiv.created_by = sdrId;

    const tentativas = await prisma.atividade.count({ where: { ...whereAtiv, tipo: { in: ['LIGACAO', 'WHATSAPP', 'EMAIL'] } } });
    const contatosEfetivos = await prisma.atividade.count({ where: { ...whereAtiv, tipo: { in: ['LIGACAO', 'WHATSAPP', 'EMAIL'] }, status: 'REALIZADA' } });
    const reunioesAgendadas = await prisma.atividade.count({ where: { ...whereAtiv, tipo: 'REUNIAO' } });
    const reunioesRealizadas = await prisma.atividade.count({ where: { ...whereAtiv, tipo: 'REUNIAO', status: 'REALIZADA' } });

    // Leads distribuídos: via LeadHistorico (acao='DISTRIBUICAO_SDR'), filtrando pelo
    // lead cujo created_by é o SDR em questão. LeadHistorico é expurgado após 60 dias
    // (backend/src/services/automation.service.ts) — para períodos além disso, este
    // número fica subestimado. Documentar essa limitação na UI (tooltip/nota de rodapé).
    const leadsDistribuidos: any[] = sdrId
      ? await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) as c FROM LeadHistorico h
           JOIN \`Lead\` l ON l.id = h.lead_id
           WHERE h.acao = 'DISTRIBUICAO_SDR' AND l.created_by = ? AND h.created_at BETWEEN ? AND ?`,
          sdrId, dataInicio, dataFim
        ).catch(() => [{ c: 0 }])
      : await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) as c FROM LeadHistorico h
           WHERE h.acao = 'DISTRIBUICAO_SDR' AND h.created_at BETWEEN ? AND ?`,
          dataInicio, dataFim
        ).catch(() => [{ c: 0 }]);
    const totalDistribuidos = Number(leadsDistribuidos[0]?.c || 0);

    const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 1000) / 10 : 0;

    return reply.send({
      status: 'success',
      data: {
        periodo: { data_inicio: dataInicio.toISOString(), data_fim: dataFim.toISOString() },
        funil: {
          leads_cadastrados: leadsCadastrados,
          tentativas_contato: tentativas,
          contatos_efetivos: contatosEfetivos,
          leads_qualificados: leadsQualificados,
          reunioes_agendadas: reunioesAgendadas,
          reunioes_realizadas: reunioesRealizadas,
          leads_distribuidos: totalDistribuidos,
          vendas_originadas: vendasOriginadas,
        },
        taxas: {
          taxa_contato: pct(contatosEfetivos, tentativas),
          taxa_qualificacao: pct(leadsQualificados, leadsCadastrados),
          taxa_comparecimento: pct(reunioesRealizadas, reunioesAgendadas),
          conversao_distribuido_venda: pct(vendasOriginadas, totalDistribuidos),
        },
      },
    });
  });
}
```

- [ ] **Step 3: Registrar a rota**

Em `backend/src/server.ts` (ou equivalente), adicionar o registro seguindo o padrão confirmado no Step 1, ex.:

```typescript
import sdrRoutes from './routes/sdr';
// ...
fastify.register(sdrRoutes);
```

- [ ] **Step 4: Testar a rota manualmente via curl**

```bash
curl http://localhost:3333/sdr/desempenho -H "Authorization: Bearer <token-sdr-de-teste>"
```

Esperado: HTTP 200 com o objeto `funil`/`taxas` populado a partir dos leads/atividades de teste criados nas tasks anteriores.

- [ ] **Step 5: Criar a página de desempenho no frontend**

Criar `frontend/app/sdr/desempenho/page.tsx`: cards de KPI (um por métrica do `funil`) + um funil visual simples (barras horizontais proporcionais, sem necessidade de biblioteca externa — ou reaproveitar Recharts `BarChart` seguindo o padrão já usado em `frontend/app/ltv/page.tsx`, que já importa `ResponsiveContainer`/`BarChart`/etc). Seletor de período (data_inicio/data_fim) no topo.

- [ ] **Step 6: Testar manualmente**

Logado como SDR de teste, abrir `/sdr/desempenho`, confirmar que os números batem com os dados de teste criados. Logado como `SUPERVISAO_COMERCIAL`, confirmar que consegue ver o desempenho agregado (sem `sdr_id`) e filtrado por um SDR específico.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/sdr.ts backend/src/server.ts frontend/app/sdr/desempenho/page.tsx
git commit -m "feat: painel de desempenho do SDR (funil de prospeccao e taxas)"
```

---

### Task 8: Sensor de Mercado + seção comparativa de SDRs no Relatório Comercial

**Files:**
- Modify: `backend/src/routes/relatorio-comercial.ts`
- Modify: `frontend/app/relatorio-comercial/page.tsx`

**Interfaces:**
- Consumes: `Lead.motivo_perda` (Task 5, agora com taxonomia fixa), `Lead.sistema_atual`, rota `GET /sdr/desempenho` (Task 7, reaproveitada com loop por SDR).

- [ ] **Step 1: Ler a estrutura atual de `relatorio-comercial.ts`**

Ler o arquivo completo para entender o padrão de rota/resposta já usado (`RelatorioComercial` model, campos `propostas_total`, `por_vendedor`, etc.) e seguir a mesma convenção de nomenclatura/estrutura JSON na resposta nova, em vez de inventar um formato diferente.

- [ ] **Step 2: Adicionar rota de sensor de mercado**

Na mesma rota ou em uma nova `GET /relatorio-comercial/sensor-mercado?data_inicio=&data_fim=`, dentro de `backend/src/routes/relatorio-comercial.ts`, com `requireGestor` obrigatório:

```typescript
  fastify.get('/relatorio-comercial/sensor-mercado', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const q = request.query as { data_inicio?: string; data_fim?: string };
    const dataInicio = q.data_inicio ? new Date(q.data_inicio) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const dataFim = q.data_fim ? new Date(q.data_fim) : new Date();

    const perdidos = await prisma.lead.findMany({
      where: { etapa_comercial: 'PERDIDO', updated_at: { gte: dataInicio, lte: dataFim }, deleted_at: null },
      select: { motivo_perda: true, sistema_atual: true },
    });

    const objecoes: Record<string, number> = {};
    const concorrentes: Record<string, number> = {};
    for (const l of perdidos) {
      const motivo = (l.motivo_perda || 'Não informado').split(':')[0].trim();
      objecoes[motivo] = (objecoes[motivo] || 0) + 1;
      if (l.sistema_atual) concorrentes[l.sistema_atual] = (concorrentes[l.sistema_atual] || 0) + 1;
    }

    return reply.send({
      status: 'success',
      data: {
        periodo: { data_inicio: dataInicio.toISOString(), data_fim: dataFim.toISOString() },
        objecoes: Object.entries(objecoes).sort((a, b) => b[1] - a[1]).map(([motivo, total]) => ({ motivo, total })),
        concorrentes: Object.entries(concorrentes).sort((a, b) => b[1] - a[1]).map(([nome, total]) => ({ nome, total })),
      },
    });
  });
```

- [ ] **Step 3: Adicionar seção comparativa de SDRs**

Nova rota `GET /relatorio-comercial/sdrs?data_inicio=&data_fim=` que lista todos os usuários `cargo='SDR'` ativos e, para cada um, chama a mesma lógica de cálculo da Task 7 (extrair a lógica de `sdr.ts` Step 2 para uma função compartilhada `calcularDesempenhoSdr(prisma, sdrId, dataInicio, dataFim)` em `backend/src/lib/sdr-desempenho.ts`, reaproveitada tanto por `GET /sdr/desempenho` quanto por esta rota — refatorar a Task 7 para extrair essa função em vez de duplicar a query).

```typescript
  fastify.get('/relatorio-comercial/sdrs', async (request, reply) => {
    if (!requireGestor(request, reply)) return;
    const q = request.query as { data_inicio?: string; data_fim?: string };
    const dataInicio = q.data_inicio ? new Date(q.data_inicio) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const dataFim = q.data_fim ? new Date(q.data_fim) : new Date();

    const sdrs: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, nome FROM UsuarioCRM WHERE cargo = 'SDR' AND status = 'ATIVO' ORDER BY nome ASC`
    ).catch(() => []);

    const resultado = [];
    for (const s of sdrs) {
      const desempenho = await calcularDesempenhoSdr(prisma, s.id, dataInicio, dataFim);
      resultado.push({ sdr_id: s.id, sdr_nome: s.nome, ...desempenho });
    }

    return reply.send({ status: 'success', data: resultado });
  });
```

- [ ] **Step 4: Refatorar Task 7 para extrair a função compartilhada**

Mover a lógica de cálculo do Step 2 da Task 7 (de `backend/src/routes/sdr.ts`) para `backend/src/lib/sdr-desempenho.ts`, exportando `calcularDesempenhoSdr(prisma, sdrId: string | null, dataInicio: Date, dataFim: Date)`. Atualizar `backend/src/routes/sdr.ts` para importar e chamar essa função em vez de ter a lógica inline.

- [ ] **Step 5: Seção no frontend**

Em `frontend/app/relatorio-comercial/page.tsx`, adicionar duas novas seções seguindo o padrão visual já existente na página (cards + tabelas): "Sensor de Mercado" (gráfico de barras de objeções + lista de concorrentes mais mencionados) e "Desempenho por SDR" (tabela comparativa: nome, leads cadastrados, taxa de qualificação, leads distribuídos, vendas originadas).

- [ ] **Step 6: Testar manualmente**

Abrir `/relatorio-comercial` logado como `SUPERVISAO_COMERCIAL`/CEO, confirmar que as duas seções novas aparecem com dados consistentes com os leads/perdas de teste criados nas tasks anteriores.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/relatorio-comercial.ts backend/src/lib/sdr-desempenho.ts backend/src/routes/sdr.ts frontend/app/relatorio-comercial/page.tsx
git commit -m "feat: sensor de mercado e comparativo de SDRs no relatorio comercial"
```

---

## Nota final de escopo

Esta spec não inclui (ver `docs/superpowers/specs/2026-08-14-perfil-sdr-design.md`, seção "Fora de escopo"): lead scoring automático, cadência de follow-up automatizada, reativação/nutrição de leads antigos. Se, após o uso real do perfil SDR, ficar claro que a limitação dos 60 dias de expurgo de `LeadHistorico` (usada para "leads distribuídos" nas Tasks 7/8) está distorcendo relatórios de período longo, a solução é uma tabela de agregação mensal separada (snapshot), não desligar o expurgo — isso é uma decisão de produto para revisitar depois, não algo a resolver preventivamente aqui.
