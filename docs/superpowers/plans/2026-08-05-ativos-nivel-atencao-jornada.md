# Nível de Atenção + Carteira por Fase em Ativos — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trazer duas peças do design "Jornada do Cliente" (`docs/superpowers/specs/2026-08-04-jornada-cliente-cs-design.md`) para o módulo Ativos hoje: (1) um **nível de atenção** por cliente (Alto toque / Padrão / Baixo toque) visível e usado para priorizar a fila, e (2) um bloco de **carteira por fase da jornada** no Painel da Supervisão. As duas rodam só com dados já existentes (`Cliente.data_entrada`, `Cliente.mensalidade_base`, `HealthScore.nivel`, `CasoChurn`, `VendaAdicional`) — não dependem do Levantamento de Implantação nem do LTV calculado (peças 4/5 da spec, ainda não implementadas).

**Architecture:** Uma função utilitária de backend (`nivelAtencao(cliente)`) calcula o nível on-the-fly a partir dos campos já carregados — sem novo campo no banco nem job em batch (fica simples o suficiente para calcular por request, dado o volume atual da carteira). Uma segunda função (`faseJornada(cliente)`) deriva a fase seguindo a ordem de prioridade já definida na spec. As duas ficam num módulo compartilhado `backend/src/lib/jornada.ts`, usadas pelas rotas de Ativos já existentes.

**Tech Stack:** Fastify + Prisma (backend), Next.js + React (frontend), MySQL. Sem migração de schema — só leitura de campos existentes.

## Global Constraints

- Não alterar o schema Prisma nesta entrega — tudo calculado a partir de campos existentes.
- Seguir o padrão de cores/badges já usado no kanban (`SAUDE_COR`, badges de `10px` `font-bold` `px-1.5 py-0.5 rounded`).
- Rodar `npx tsc --noEmit` no backend e no frontend antes de cada commit (padrão já seguido nesta sessão).
- Nunca commitar scripts de teste temporários usados para validar contra produção.

---

### Task 1: Função `nivelAtencao` no backend

**Files:**
- Create: `backend/src/lib/jornada.ts`
- Test: manual via script temporário contra produção (não há suíte de testes automatizados no backend para `lib/`)

**Interfaces:**
- Produces: `nivelAtencao(cliente: { data_entrada: Date | null; mensalidade_base: number | null; health_score?: { nivel: string } | null }, percentis: { p80: number; p30: number }): 'ALTO_TOQUE' | 'PADRAO' | 'BAIXO_TOQUE'`
- Produces: `calcularPercentisMensalidade(prisma: PrismaClient): Promise<{ p80: number; p30: number }>` — calcula os percentis 80 e 30 de `mensalidade_base` sobre a base de clientes ATIVA, usado como entrada de `nivelAtencao`.

- [ ] **Step 1: Escrever a função `calcularPercentisMensalidade`**

```typescript
// backend/src/lib/jornada.ts
import { PrismaClient } from '@prisma/client';

export async function calcularPercentisMensalidade(prisma: PrismaClient): Promise<{ p80: number; p30: number }> {
  const valores = await prisma.cliente.findMany({
    where: { situacao: 'ATIVA', mensalidade_base: { not: null, gt: 0 } },
    select: { mensalidade_base: true },
  });
  const nums = valores.map(v => Number(v.mensalidade_base)).sort((a, b) => a - b);
  if (nums.length === 0) return { p80: 0, p30: 0 };
  const idx = (p: number) => Math.min(nums.length - 1, Math.floor((p / 100) * nums.length));
  return { p80: nums[idx(80)], p30: nums[idx(30)] };
}
```

- [ ] **Step 2: Escrever a função `nivelAtencao`**

```typescript
// backend/src/lib/jornada.ts (continuação)
export type NivelAtencao = 'ALTO_TOQUE' | 'PADRAO' | 'BAIXO_TOQUE';

export function nivelAtencao(
  cliente: {
    data_entrada?: Date | string | null;
    mensalidade_base?: number | null;
    health_score?: { nivel: string } | null;
  },
  percentis: { p80: number; p30: number }
): NivelAtencao {
  const nivelSaude = cliente.health_score?.nivel;
  if (nivelSaude === 'RISCO' || nivelSaude === 'CRITICO') return 'ALTO_TOQUE';

  const dataEntrada = cliente.data_entrada ? new Date(cliente.data_entrada) : null;
  const diasDeCasa = dataEntrada ? Math.floor((Date.now() - dataEntrada.getTime()) / 86400000) : null;
  if (diasDeCasa !== null && diasDeCasa < 90) return 'ALTO_TOQUE';

  const mrr = Number(cliente.mensalidade_base || 0);
  if (mrr >= percentis.p80 && percentis.p80 > 0) return 'ALTO_TOQUE';

  const saudavel = nivelSaude === 'SAUDAVEL' || nivelSaude === 'EXCELENTE';
  if (mrr > 0 && mrr <= percentis.p30 && diasDeCasa !== null && diasDeCasa > 180 && saudavel) return 'BAIXO_TOQUE';

  return 'PADRAO';
}
```

- [ ] **Step 3: Verificar que compila**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros novos relacionados a `lib/jornada.ts`

- [ ] **Step 4: Testar contra produção com um script temporário**

Criar `backend/test_nivel_atencao.ts` (não commitar):
```typescript
import { PrismaClient } from '@prisma/client';
import { calcularPercentisMensalidade, nivelAtencao } from './src/lib/jornada';

const prisma = new PrismaClient();
async function main() {
  const percentis = await calcularPercentisMensalidade(prisma);
  console.log('Percentis:', percentis);
  const clientes = await prisma.cliente.findMany({
    where: { situacao: 'ATIVA' },
    take: 20,
    include: { health_score: true },
  });
  for (const c of clientes) {
    console.log(c.nome, '|', c.mensalidade_base, '|', c.data_entrada, '|', c.health_score?.nivel, '->', nivelAtencao(c, percentis));
  }
}
main().finally(() => prisma.$disconnect());
```

Run: `cd backend && DATABASE_URL="<connection string>" npx tsx test_nivel_atencao.ts`
Expected: saída com nível calculado por cliente, sem exceções. Conferir manualmente 2-3 linhas (um cliente novo deve sair ALTO_TOQUE, um antigo e barato deve sair BAIXO_TOQUE).

- [ ] **Step 5: Apagar o script de teste**

Run: `rm backend/test_nivel_atencao.ts`

- [ ] **Step 6: Commit**

```bash
git add backend/src/lib/jornada.ts
git commit -m "feat: calculo de nivel de atencao (alto/padrao/baixo toque) por cliente"
```

---

### Task 2: Função `faseJornada` no backend

**Files:**
- Modify: `backend/src/lib/jornada.ts`

**Interfaces:**
- Consumes: nenhuma nova (usa Prisma diretamente)
- Produces: `faseJornada(input: { casoChurnAberto: boolean; casoChurnStatus?: string | null; healthNivel?: string | null; temContrato: boolean; vendaAdicionalRecente: boolean }): FaseJornada`

- [ ] **Step 1: Escrever a função `faseJornada`**

```typescript
// backend/src/lib/jornada.ts (continuação)
export type FaseJornada = 'PRE_VENDA' | 'FECHAMENTO' | 'SAIDA' | 'RISCO' | 'EXPANSAO' | 'USO_CONTINUO';

export function faseJornada(input: {
  casoChurnStatus?: string | null; // status do CasoChurn mais recente, se houver
  healthNivel?: string | null;
  temContrato: boolean; // tem ContratoComercial assinado?
  vendaAdicionalRecente: boolean; // teve VendaAdicional CONFIRMADA nos últimos 90 dias?
}): FaseJornada {
  const ENCERRADOS = ['RECUPERADO', 'PERDIDO', 'SISTEMA_REMOVIDO'];
  const ABERTOS = ['NOVO', 'DIAGNOSTICADO', 'PLANEJADO', 'EXECUTANDO'];

  if (input.casoChurnStatus && ENCERRADOS.includes(input.casoChurnStatus)) return 'SAIDA';
  if ((input.casoChurnStatus && ABERTOS.includes(input.casoChurnStatus)) ||
      input.healthNivel === 'RISCO' || input.healthNivel === 'CRITICO') return 'RISCO';
  if (!input.temContrato) return 'PRE_VENDA';
  if (input.vendaAdicionalRecente) return 'EXPANSAO';
  return 'USO_CONTINUO';
}
```

Nota: esta v1 não distingue Implantação/Treinamento/Primeira Operação (peças 4 do design, ainda sem dado no sistema) — todo cliente com contrato assinado, sem risco e sem expansão recente cai em `USO_CONTINUO`. É uma simplificação deliberada: essas 3 sub-fases só ganham sentido quando o Levantamento de Implantação e o Checklist de Jornada existirem.

- [ ] **Step 2: Verificar que compila**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros novos

- [ ] **Step 3: Commit**

```bash
git add backend/src/lib/jornada.ts
git commit -m "feat: calculo simplificado de fase da jornada por cliente"
```

---

### Task 3: Expor nível de atenção no kanban de Ativos

**Files:**
- Modify: `backend/src/routes/ativos.ts:119-160` (rota `GET /ativos/campanhas/:id/contatos`)
- Modify: `frontend/app/ativos/page.tsx:328-335` (card do kanban)

**Interfaces:**
- Consumes: `nivelAtencao`, `calcularPercentisMensalidade` de `backend/src/lib/jornada.ts`
- Produces: cada item de `contatos` no payload de `GET /ativos/campanhas/:id/contatos` ganha o campo `nivel_atencao: 'ALTO_TOQUE' | 'PADRAO' | 'BAIXO_TOQUE'`

- [ ] **Step 1: Buscar `data_entrada` e `health_score` junto com o cliente na rota do kanban**

Em `backend/src/routes/ativos.ts`, na rota `GET /ativos/campanhas/:id/contatos` (linha ~140), adicionar campos ao `select` existente:

```typescript
const clientes = cliIds.length ? await prisma.cliente.findMany({
  where: { id: { in: cliIds } },
  select: {
    id: true, plano: true, telefone: true, telefone1: true, telefone2: true, email: true,
    segmento: true, razao_social: true, nome_fantasia: true, nome: true, contato: true,
    mensalidade_base: true,
    data_entrada: true, // novo
    health_score: { select: { nivel: true } }, // novo
  },
}).catch(() => [] as any[]) : [];
```

- [ ] **Step 2: Calcular e anexar `nivel_atencao` a cada contato enriquecido**

No mesmo arquivo, logo antes do `map` que gera `enriquecidos` (linha ~145), adicionar:

```typescript
import { nivelAtencao, calcularPercentisMensalidade } from '@/lib/jornada';

// ... dentro da rota, antes de montar `enriquecidos`:
const percentis = await calcularPercentisMensalidade(prisma);
```

E dentro do `map`, adicionar ao objeto retornado:

```typescript
const enriquecidos = contatos.map((ct: any) => {
  const cli: any = mapaCli.get(ct.cliente_id) || {};
  return {
    ...ct,
    plano: cli.plano || null,
    cli_telefone: cli.telefone || cli.telefone1 || null,
    cli_telefone2: cli.telefone2 || null,
    cli_email: cli.email || null,
    cli_segmento: cli.segmento || null,
    cli_contato: cli.contato || null,
    cli_razao: cli.razao_social || cli.nome_fantasia || cli.nome || null,
    cli_mensalidade: cli.mensalidade_base || null,
    nivel_atencao: nivelAtencao(cli, percentis), // novo
  };
});
```

- [ ] **Step 3: Verificar que compila**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros novos

- [ ] **Step 4: Testar a rota contra produção**

```bash
cd backend
LOGIN=$(curl -s -X POST https://crmcomercialprosystem-production-945e.up.railway.app/auth/login -H "Content-Type: application/json" -d '{"email":"jessica@prosystemnet.com.br","password":"Prosystem@2024"}')
TOKEN=$(node -e "console.log(JSON.parse(process.argv[1]).data.accessToken)" "$LOGIN")
curl -s "https://crmcomercialprosystem-production-945e.up.railway.app/ativos/campanhas" -H "Authorization: Bearer $TOKEN"
# pega um campanha_id do resultado acima, então:
curl -s "https://crmcomercialprosystem-production-945e.up.railway.app/ativos/campanhas/<ID>/contatos" -H "Authorization: Bearer $TOKEN" | head -c 2000
```

Expected: cada item de `data.contatos` tem o campo `nivel_atencao` preenchido com um dos 3 valores.

- [ ] **Step 5: Adicionar o badge de nível de atenção no card do kanban**

Em `frontend/app/ativos/page.tsx`, dentro do bloco de badges do card (linha ~328-335), adicionar ANTES do badge de saúde:

```tsx
const NIVEL_ATENCAO_LABEL: Record<string, { label: string; bg: string; cor: string }> = {
  ALTO_TOQUE: { label: '🔴 Alto toque', bg: '#fee2e2', cor: '#b91c1c' },
  PADRAO: { label: '🔵 Padrão', bg: '#dbeafe', cor: '#1d4ed8' },
  BAIXO_TOQUE: { label: '⚪ Baixo toque', bg: 'var(--t-content-bg)', cor: 'var(--t-text-muted)' },
};
```

(declarar fora do componente, junto com `SAUDE_COR`/`planoCor` no topo do arquivo)

E no JSX do card (dentro de `<div className="flex flex-wrap gap-1 mt-1">`):

```tsx
{c.nivel_atencao && c.nivel_atencao !== 'PADRAO' && (
  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
    style={{ background: NIVEL_ATENCAO_LABEL[c.nivel_atencao].bg, color: NIVEL_ATENCAO_LABEL[c.nivel_atencao].cor }}>
    {NIVEL_ATENCAO_LABEL[c.nivel_atencao].label}
  </span>
)}
```

Nota: só mostra o badge quando NÃO é "Padrão" — evita poluir visualmente a maioria dos cards (que ficam padrão), destacando só quem precisa de atenção diferenciada, para cima ou para baixo.

- [ ] **Step 6: Ordenar a fila priorizando Alto toque**

No mesmo arquivo, onde os `itens` de cada coluna são filtrados (linha ~310), adicionar ordenação:

```tsx
const ORDEM_NIVEL: Record<string, number> = { ALTO_TOQUE: 0, PADRAO: 1, BAIXO_TOQUE: 2 };
const itens = contatos.filter(c => c.etapa === et.id
  && (!termo || (c.cliente_nome || '').toLowerCase().includes(termo) || String(c.cliente_codigo || '').includes(termo)))
  .sort((a, b) => (ORDEM_NIVEL[a.nivel_atencao] ?? 1) - (ORDEM_NIVEL[b.nivel_atencao] ?? 1));
```

- [ ] **Step 7: Rodar o frontend localmente e verificar visualmente**

Run: `cd frontend && npm run dev`, abrir `/ativos`, aba "Minhas filas / Kanban", conferir que os cards mostram o badge quando aplicável e que a ordenação prioriza Alto toque.

- [ ] **Step 8: Verificar que compila**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros novos

- [ ] **Step 9: Commit**

```bash
git add backend/src/routes/ativos.ts frontend/app/ativos/page.tsx
git commit -m "feat: nivel de atencao (alto/padrao/baixo toque) visivel e priorizado na fila de Ativos"
```

---

### Task 4: Bloco "Carteira por fase" no Painel da Supervisão

**Files:**
- Modify: `backend/src/routes/ativos.ts:774-841` (rota `GET /ativos/painel`)
- Modify: `frontend/app/ativos/page.tsx:376-410` (bloco "Painel da Supervisão")

**Interfaces:**
- Consumes: `faseJornada` de `backend/src/lib/jornada.ts`
- Produces: `GET /ativos/painel` retorna novo campo `data.carteira_por_fase: Record<FaseJornada, number>`

- [ ] **Step 1: Calcular a fase de cada cliente da carteira ativa dentro da rota do painel**

Em `backend/src/routes/ativos.ts`, na rota `GET /ativos/painel` (linha 774), após o bloco que já busca `campanhas` e `contatos` (linha ~776-777), adicionar:

```typescript
import { faseJornada } from '@/lib/jornada';

// ... dentro da rota, após buscar contatos:
const clienteIdsUnicos = [...new Set(contatos.map(c => c.cliente_id))];
const [clientesCarteira, casosAbertosOuEncerrados, vendasRecentes] = await Promise.all([
  prisma.cliente.findMany({
    where: { id: { in: clienteIdsUnicos } },
    select: { id: true },
  }),
  prisma.casoChurn.findMany({
    where: { clienteId: { in: clienteIdsUnicos } },
    orderBy: { created_at: 'desc' },
    select: { clienteId: true, status: true },
  }),
  prisma.vendaAdicional.findMany({
    where: {
      cliente_id: { in: clienteIdsUnicos },
      status: 'CONFIRMADA',
      created_at: { gte: new Date(Date.now() - 90 * 86400000) },
    },
    select: { cliente_id: true },
  }),
]);

const healthScores = await prisma.healthScore.findMany({
  where: { cliente_id: { in: clienteIdsUnicos } },
  select: { cliente_id: true, nivel: true },
});
const healthMap = new Map(healthScores.map(h => [h.cliente_id, h.nivel]));
const casoMaisRecentePorCliente = new Map<string, string>();
for (const caso of casosAbertosOuEncerrados) {
  if (!casoMaisRecentePorCliente.has(caso.clienteId)) casoMaisRecentePorCliente.set(caso.clienteId, caso.status);
}
const vendaRecenteSet = new Set(vendasRecentes.map(v => v.cliente_id));

const carteira_por_fase: Record<string, number> = {
  PRE_VENDA: 0, FECHAMENTO: 0, SAIDA: 0, RISCO: 0, EXPANSAO: 0, USO_CONTINUO: 0,
};
for (const cli of clientesCarteira) {
  const fase = faseJornada({
    casoChurnStatus: casoMaisRecentePorCliente.get(cli.id) || null,
    healthNivel: healthMap.get(cli.id) || null,
    temContrato: true, // todo cliente na fila de Ativos já é cliente ativo com contrato
    vendaAdicionalRecente: vendaRecenteSet.has(cli.id),
  });
  carteira_por_fase[fase] = (carteira_por_fase[fase] || 0) + 1;
}
```

- [ ] **Step 2: Incluir `carteira_por_fase` na resposta**

No `return reply.send(...)` já existente da rota (linha ~840), adicionar o campo:

```typescript
return reply.send({ status: 'success', data: { filas, ranking_tecnicos, totais, carteira_por_fase } });
```

- [ ] **Step 3: Verificar que compila**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros novos

- [ ] **Step 4: Testar a rota contra produção**

```bash
cd backend
curl -s "https://crmcomercialprosystem-production-945e.up.railway.app/ativos/painel" -H "Authorization: Bearer $TOKEN" | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  console.log(JSON.parse(d).data.carteira_por_fase);
});
"
```

Expected: objeto com as 6 chaves de fase e contagens que somam ao total de clientes únicos na carteira das campanhas ativas.

- [ ] **Step 5: Adicionar o bloco visual no frontend**

Em `frontend/app/ativos/page.tsx`, dentro do bloco "Painel da Supervisão" (após o bloco "Filas por vendedor", linha ~410, antes do bloco "Saúde da carteira por técnico"), adicionar:

```tsx
const FASE_LABEL: Record<string, { label: string; cor: string }> = {
  PRE_VENDA: { label: 'Pré-venda', cor: '#6366f1' },
  FECHAMENTO: { label: 'Fechamento', cor: '#8b5cf6' },
  USO_CONTINUO: { label: 'Uso Contínuo', cor: '#417ABC' },
  EXPANSAO: { label: 'Expansão', cor: '#16a34a' },
  RISCO: { label: 'Risco', cor: '#d97706' },
  SAIDA: { label: 'Saída', cor: '#dc2626' },
};
```

(declarar junto com `NIVEL_ATENCAO_LABEL` da Task 3, no topo do arquivo)

```tsx
{painel.carteira_por_fase && (
  <div className="rounded-xl border p-5" style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)' }}>
    <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--t-text-primary)' }}>🗺️ Carteira por fase da jornada</h2>
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      {Object.entries(FASE_LABEL).map(([fase, { label, cor }]) => (
        <div key={fase} className="rounded-lg p-3 text-center" style={{ background: 'var(--t-content-bg)', border: `1px solid ${cor}33` }}>
          <p className="text-xl font-bold" style={{ color: cor }}>{painel.carteira_por_fase[fase] ?? 0}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--t-text-muted)' }}>{label}</p>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 6: Rodar o frontend localmente e verificar visualmente**

Run: `cd frontend && npm run dev`, abrir `/ativos`, aba "Painel da Supervisão", conferir que o bloco aparece com números coerentes.

- [ ] **Step 7: Verificar que compila**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros novos

- [ ] **Step 8: Commit**

```bash
git add backend/src/routes/ativos.ts frontend/app/ativos/page.tsx
git commit -m "feat: bloco Carteira por Fase da Jornada no Painel da Supervisao de Ativos"
```

---

## Self-Review Notes

- **Cobertura da spec:** esta entrega cobre só as Peças 1 (fases, versão simplificada sem sub-fases de onboarding) e 3 (nível de CS) do design. Peças 2 (touchpoints detalhados), 4 (Levantamento de Implantação) e 5 (LTV/portfólio) ficam para planos futuros — dependem de novos models Prisma (`ChecklistJornada`, `LevantamentoImplantacao`, `CustoServirSegmento`, campo `ltv_calculado`), fora do escopo desta entrega "sem migração de schema".
- **Consistência de tipos:** `NivelAtencao` e `FaseJornada` são usados de forma idêntica em `lib/jornada.ts`, `routes/ativos.ts` e implicitamente no frontend (strings literais que devem bater com os valores do enum) — conferir ao implementar que os labels do frontend (`NIVEL_ATENCAO_LABEL`, `FASE_LABEL`) cobrem exatamente as mesmas chaves que o backend produz.
- **Risco assumido:** o cálculo de `nivelAtencao` roda a cada request (sem cache/batch). Para o volume atual da carteira (dezenas a poucas centenas de clientes por campanha) isso é aceitável; se a base crescer muito, revisar para um campo `Cliente.nivel_atencao` recalculado em batch, como a spec original já previa.
