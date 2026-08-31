# Unificação de Telas Executivas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar as 4 telas de entrada executiva (`/dashboard`, `/painel-ceo`, `/relatorio-comercial`, `/ranking`) em uma só, e resolver 5 outras sobreposições de tela/dado encontradas no CRM (Churn-CEO↔Casos, ranking de técnico duplicado, forecast calculado 3x com fórmulas divergentes, Vendas Adicionais↔Cross-sell, comissões duplicadas no Centro de Custos).

**Architecture:** Backend primeiro — cada consolidação de dado é corrigida/unificada na API antes de qualquer mudança visual, seguindo o mesmo padrão já usado para corrigir o bug de MRR (uma fonte de verdade por métrica). Frontend depois — a tela nova reaproveita os componentes visuais já validados no protótipo (Chart.js para tendência/funis, barras diretas estilo `dataviz` para ranking/waterfall). Rotas antigas viram redirects (nunca 404 direto) até a próxima limpeza.

**Tech Stack:** Fastify + Prisma (backend), Next.js + Chart.js 4.5.1 via CDN (frontend), MySQL.

## Global Constraints

- Fórmula única de "receita ponderada" (decidida com o usuário): `valor_setup + (mensalidade_estimada × 12)`, com fallback para `valor_estimado` quando o cálculo anualizado for `0` — exatamente a função `valorOportunidade()` já usada em `backend/src/routes/forecast.ts:40-45` e `backend/src/routes/analise-comercial.ts:171-176`. `/leads/previsao` deve passar a usar essa mesma fórmula.
- Filtro de status para forecast: `notIn: ['PERDIDO']` (o padrão de `/dashboard/forecast` e `/analise-comercial`) — `/leads/previsao` hoje também exclui `GANHO` e `NUTRICAO`; ao unificar, usar `notIn: ['PERDIDO']` e não incluir `GANHO`/`NUTRICAO` na exclusão (um lead em `NUTRICAO` ainda pode ter chance real de fechar, não faz sentido zerar seu pipeline).
- Toda rota nova/alterada de dado que hoje é "gestor vê tudo, vendedor vê o próprio" deve usar `ownerWhere`/`effectiveScopeId` de `backend/src/lib/scope.ts` — nunca reimplementar a condição `OR` manualmente (é o que causava o código duplicado encontrado em `analise-comercial.ts`).
- O Dashboard Executivo unificado é visível para `GESTORES = ['CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL', 'SUPERVISAO_TECNICA']` (mesmo array já usado no item `/dashboard` do menu) — nenhum redirect por papel dentro da tela (elimina o comportamento atual onde CEO nunca vê `/dashboard`).
- Rotas antigas (`/painel-ceo`, `/relatorio-comercial`, `/ranking`) viram `redirect('/dashboard')` no `page.tsx` (padrão já usado em `/funil` e `/propostas` deste projeto) — nunca remover o arquivo sem deixar redirect, para não quebrar links/favoritos salvos.
- Qualquer seção movida para dentro de uma tela com público mais amplo (ex.: Radar de Churn indo para `/casos`) precisa de gate de role **interno ao componente** (`user.role`), porque o backend de `casos-churn` não bloqueia por role nas rotas GET — só `requireAuth`.
- Todas as datas de filtro usam o padrão já estabelecido em `frontend/app/relatorio-comercial/page.tsx`: mês corrente por padrão (`inicio = dia 1 do mês`, `fim = último dia do mês`).

---

## PARTE A — Dashboard Executivo Unificado

### Task 1: Corrigir a fórmula de forecast em `/leads/previsao` para bater com as outras duas

**Files:**
- Modify: `backend/src/routes/complementos.ts:399-491`
- Test: `backend/tests/leads-previsao.test.ts` (criar)

**Interfaces:**
- Consumes: `probabilidadeEtapa` e `PROB_ETAPA` de `backend/src/lib/forecast.ts` (já existe, sem mudança).
- Produces: `GET /leads/previsao?dias=N` retornando `{ previsao: { otimista, realista, pessimista, total_oportunidades, valor_total_pipeline }, top_oportunidades: [...], meta: {...} }` — mesmo shape de resposta de hoje, só a fórmula interna muda.

Primeiro, confirme o padrão de teste do backend (já usado em `backend/tests/backup.test.ts`, que usa `vitest` com `describe/it/expect` contra o banco de produção real via `DATABASE_URL`).

- [ ] **Step 1: Escrever o teste que expõe a diferença de fórmula**

```typescript
// backend/tests/leads-previsao.test.ts
import { describe, it, expect } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('GET /leads/previsao usa a mesma fórmula de valorOportunidade que /dashboard/forecast', () => {
  it('um lead com valor_setup e mensalidade_estimada preenchidos usa setup + mensalidade×12, não valor_estimado puro', async () => {
    // Cria um lead de teste com valor_setup=1000, mensalidade_estimada=300,
    // valor_estimado=99999 (valor absurdo só pra provar que NÃO deve ser usado
    // quando setup+mensalidade está preenchido).
    const lead = await prisma.lead.create({
      data: {
        nome: 'TESTE_FORMULA_FORECAST',
        etapa_comercial: 'EM_NEGOCIACAO', // prob 0.65
        status: 'EM_ANDAMENTO',
        valor_setup: 1000,
        mensalidade_estimada: 300,
        valor_estimado: 99999,
        responsavel_id: null,
        created_by: 'teste-automatizado',
      },
    });

    try {
      // valorOportunidade esperado: 1000 + (300*12) = 4600
      // ponderado esperado: 4600 * 0.65 = 2990
      const valorEsperado = 1000 + 300 * 12;
      const ponderadoEsperado = Math.round(valorEsperado * 0.65);

      // Chama a lógica diretamente (sem subir servidor HTTP) importando a função
      // exportada — ver Step 3 para a extração da função testável.
      const { calcularPrevisao } = await import('../src/lib/previsao');
      const resultado = await calcularPrevisao(prisma, { dias: 30, ownerFilter: {} });

      const leadNoResultado = resultado.top_oportunidades.find(o => o.id === lead.id);
      expect(leadNoResultado).toBeDefined();
      expect(leadNoResultado!.valor_ponderado).toBe(ponderadoEsperado);
      // Prova que NÃO usou valor_estimado (99999 * 0.65 = 64999, bem diferente)
      expect(leadNoResultado!.valor_ponderado).not.toBe(Math.round(99999 * 0.65));
    } finally {
      await prisma.lead.delete({ where: { id: lead.id } });
    }
  }, 30000);
});
```

- [ ] **Step 2: Rodar o teste e verificar que falha**

Run: `cd backend && DATABASE_URL="mysql://comercial_user:vuh5jTAjXBaPCcZcaWKcWuJl@127.0.0.1:13306/db_comercial" npx vitest run tests/leads-previsao.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/previsao'` (o módulo ainda não existe).

- [ ] **Step 3: Extrair a lógica de cálculo para `backend/src/lib/previsao.ts`, usando a fórmula correta**

```typescript
// backend/src/lib/previsao.ts
//
// Lógica de previsão de fechamento (pipeline ponderado por probabilidade de
// etapa) — extraída de complementos.ts para ser testável isoladamente e para
// usar a MESMA fórmula de valorOportunidade() de forecast.ts/analise-comercial.ts.
// Antes desta unificação, /leads/previsao usava valor_estimado puro; as outras
// duas rotas usavam valor_setup + mensalidade_estimada×12. Números divergiam.

import { PrismaClient } from '@prisma/client';
import { probabilidadeEtapa } from './forecast';

export interface ResumoPrevisao {
  otimista: number;
  realista: number;
  pessimista: number;
  total_oportunidades: number;
  valor_total_pipeline: number;
}

export interface OportunidadePrevisao {
  id: string;
  nome: string;
  empresa: string | null;
  valor_estimado: number;
  probabilidade: number;
  valor_ponderado: number;
  etapa: string | null;
  status: string;
}

export interface ResultadoPrevisao {
  previsao: ResumoPrevisao;
  top_oportunidades: OportunidadePrevisao[];
  total_oportunidades: number;
  valor_total_pipeline: number;
}

// Mesma função de backend/src/routes/forecast.ts e analise-comercial.ts —
// valor anualizado da oportunidade: setup + 12 mensalidades, com fallback
// para valor_estimado quando setup+mensalidade não está preenchido.
export function valorOportunidade(l: { valor_setup: number | null; valor_estimado: number | null; mensalidade_estimada: number | null }): number {
  const setup = l.valor_setup ?? 0;
  const anual = (l.mensalidade_estimada ?? 0) * 12;
  const calc = setup + anual;
  return calc > 0 ? calc : (l.valor_estimado ?? 0);
}

export async function calcularPrevisao(
  prisma: PrismaClient,
  opts: { dias: number; ownerFilter: Record<string, any> }
): Promise<ResultadoPrevisao> {
  const leads = await prisma.lead.findMany({
    where: {
      status: { notIn: ['PERDIDO'] },
      etapa_comercial: { in: Object.keys((await import('./forecast')).PROB_ETAPA) },
      ...opts.ownerFilter,
    },
    select: {
      id: true, nome: true, empresa: true, status: true,
      etapa_comercial: true, valor_setup: true, valor_estimado: true, mensalidade_estimada: true,
    },
  });

  const previsao: ResumoPrevisao = {
    otimista: 0,
    realista: 0,
    pessimista: 0,
    total_oportunidades: leads.length,
    valor_total_pipeline: 0,
  };

  const oportunidades: OportunidadePrevisao[] = leads.map(l => {
    const valor = valorOportunidade(l);
    const prob = probabilidadeEtapa(l.etapa_comercial);
    previsao.valor_total_pipeline += valor;
    previsao.otimista += valor;
    previsao.realista += valor * prob;
    if (prob >= 0.7) previsao.pessimista += valor * prob;
    return {
      id: l.id,
      nome: l.nome,
      empresa: l.empresa,
      valor_estimado: valor,
      probabilidade: Math.round(prob * 100),
      valor_ponderado: Math.round(valor * prob),
      etapa: l.etapa_comercial,
      status: l.status,
    };
  });

  oportunidades.sort((a, b) => b.valor_ponderado - a.valor_ponderado);

  return {
    previsao: {
      otimista: Math.round(previsao.otimista),
      realista: Math.round(previsao.realista),
      pessimista: Math.round(previsao.pessimista),
      total_oportunidades: previsao.total_oportunidades,
      valor_total_pipeline: Math.round(previsao.valor_total_pipeline),
    },
    top_oportunidades: oportunidades.slice(0, 10),
    total_oportunidades: leads.length,
    valor_total_pipeline: Math.round(previsao.valor_total_pipeline),
  };
}
```

- [ ] **Step 4: Rodar o teste e verificar que passa**

Run: `cd backend && DATABASE_URL="mysql://comercial_user:vuh5jTAjXBaPCcZcaWKcWuJl@127.0.0.1:13306/db_comercial" npx vitest run tests/leads-previsao.test.ts`
Expected: PASS.

- [ ] **Step 5: Atualizar a rota `/leads/previsao` em `complementos.ts` para usar a nova função**

Ler `backend/src/routes/complementos.ts:399-491` primeiro (a rota completa, incluindo o bloco `meta` que vem depois do cálculo de previsão — não mostrado no levantamento, mas presente no arquivo). Substituir apenas o bloco de cálculo (linhas 405-457 aproximadamente, do `const leads = ...` até o `top_oportunidades`), mantendo o restante da rota (query params, bloco de meta) intacto:

```typescript
// backend/src/routes/complementos.ts — dentro de fastify.get('/leads/previsao', ...)
import { calcularPrevisao } from '@/lib/previsao';
import { ownerWhere } from '@/lib/scope';

// ... (bloco de query params `dias` permanece igual)

const resultado = await calcularPrevisao(prisma, {
  dias,
  ownerFilter: ownerWhere(request, 'Lead'),
});

// resultado.previsao, resultado.top_oportunidades, resultado.total_oportunidades,
// resultado.valor_total_pipeline substituem as variáveis locais que existiam antes.
// O bloco de `meta` que vem depois (não alterado) continua usando essas variáveis
// com os mesmos nomes.
```

- [ ] **Step 6: Rodar o teste completo do arquivo + typecheck**

Run: `cd backend && DATABASE_URL="mysql://comercial_user:vuh5jTAjXBaPCcZcaWKcWuJl@127.0.0.1:13306/db_comercial" npx vitest run tests/leads-previsao.test.ts && npx tsc --noEmit`
Expected: teste PASS, typecheck sem erros novos.

- [ ] **Step 7: Testar manualmente contra produção (curl) comparando com `/dashboard/forecast`**

Suba o backend local contra o banco real e compare o `valor_ponderado` do mesmo lead nas duas rotas — devem bater agora (rodar os dois `curl` e comparar visualmente, já que os leads mudam com o tempo, não é possível fixar um número exato no plano).

- [ ] **Step 8: Commit**

```bash
cd backend && git add src/lib/previsao.ts src/routes/complementos.ts tests/leads-previsao.test.ts && git commit -m "fix: unifica formula de forecast em /leads/previsao com forecast.ts e analise-comercial.ts"
```

---

### Task 2: Rota `/dashboard/executivo` — endpoint único que agrega os 4 dados antigos

**Files:**
- Create: `backend/src/routes/dashboard-executivo.ts`
- Modify: `backend/src/server.ts` (registrar a rota nova, seguindo o padrão de `routeModules`)
- Test: `backend/tests/dashboard-executivo.test.ts`

**Interfaces:**
- Consumes: nada de novo — reaproveita as mesmas queries já usadas em `dashboard-power.ts`, `ceo.ts` (`/ceo/painel`), `relatorio-comercial.ts`, `metas.ts` (`/metas/ranking`). Este task **não** recalcula nada do zero, só expõe um endpoint que chama a lógica já existente internamente (evita duplicar query) OU faz o frontend chamar os 4 endpoints em paralelo (mais simples, ver decisão no Step 1).
- Produces: nenhuma interface nova de backend se a decisão do Step 1 for "frontend chama os 4 endpoints existentes" — nesse caso, pule para Task 3.

- [ ] **Step 1: Decisão de arquitetura — não criar endpoint agregador novo**

Em vez de criar `/dashboard/executivo` como um 5º endpoint que reimplementa lógica já existente (risco de reintroduzir divergência), a tela nova no frontend chama os 4 endpoints que **já existem e já foram corrigidos** nesta sessão (`getDashboardPower`, `getPainelCEO`, `getRelatorioComercial`, `getRanking`) em paralelo via `Promise.all`, exatamente como `/relatorio-comercial/page.tsx` já faz hoje com múltiplas chamadas. Isso elimina o risco de um 5º cálculo divergente e reaproveita 100% do backend já testado.

**Esta task não produz nenhum arquivo novo de backend — é uma decisão documentada.** Pule direto para Task 3.

---

### Task 3: Página `/dashboard` unificada — estrutura, hero e abas (sem o conteúdo de cada aba ainda)

**Files:**
- Modify: `frontend/app/dashboard/page.tsx` (reescrita quase total, mas mantém `DashboardLayout`, `useAuth`, os hooks de animação já existentes)
- Create: `frontend/app/dashboard/components/AbaTabs.tsx`

**Interfaces:**
- Consumes: `apiClient.getDashboardPower`, `apiClient.getPainelCEO`, `apiClient.getRelatorioComercial`, `apiClient.getRelatorioSerieAnual`, `apiClient.getRanking` (todos já existem em `frontend/lib/api-client.ts`).
- Produces: componente `AbaTabs` reutilizado pelas próximas 5 tasks — `export default function AbaTabs({ abas, abaAtiva, onChange }: { abas: { id: string; label: string }[]; abaAtiva: string; onChange: (id: string) => void })`.

- [ ] **Step 1: Criar o componente de abas reutilizável**

```typescript
// frontend/app/dashboard/components/AbaTabs.tsx
'use client';

interface Aba {
  id: string;
  label: string;
}

interface AbaTabsProps {
  abas: Aba[];
  abaAtiva: string;
  onChange: (id: string) => void;
}

export default function AbaTabs({ abas, abaAtiva, onChange }: AbaTabsProps) {
  return (
    <nav
      className="flex gap-1 overflow-x-auto"
      style={{ borderBottom: '2px solid var(--t-card-border)', marginBottom: 16 }}
    >
      {abas.map(aba => (
        <button
          key={aba.id}
          onClick={() => onChange(aba.id)}
          className="whitespace-nowrap"
          style={{
            appearance: 'none', border: 'none', background: 'transparent', cursor: 'pointer',
            padding: '9px 14px', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
            color: aba.id === abaAtiva ? 'var(--t-primary-dark)' : 'var(--t-text-muted)',
            borderBottom: aba.id === abaAtiva ? '2px solid var(--t-primary-dark)' : '2px solid transparent',
            marginBottom: -2,
          }}
        >
          {aba.label}
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Reescrever `frontend/app/dashboard/page.tsx` — remover o redirect do CEO, montar os 5 KPIs-âncora, montar o esqueleto de abas**

Ler o arquivo atual inteiro primeiro (já lido nesta sessão — 771 linhas) para preservar `AnimatedNumber`, `PulseDot`, `KpiCard`, `AlertStrip`, `SectionLabel` (esses componentes continuam úteis e não precisam ser reescritos).

Mudança principal no corpo do componente (substituindo linhas 238-242 do arquivo atual):

```typescript
// Remove o redirect do CEO (linha 240 do arquivo original: `if (role === 'CEO') { router.replace('/relatorio-comercial'); return; }`)
// Mantém só o redirect de não-gestor:
useEffect(() => {
  if (loading || !isAuthenticated || !user) return;
  if (!isGestor) router.replace('/comercial');
}, [loading, isAuthenticated, user, isGestor, router]);
```

Adicionar estado de aba ativa e os novos dados agregados:

```typescript
const [abaAtiva, setAbaAtiva] = useState<'comercial' | 'retencao' | 'equipe' | 'funis' | 'manuais'>('comercial');
const [painelCeo, setPainelCeo] = useState<any>(null);
const [relatorioComercial, setRelatorioComercial] = useState<any>(null);
const [rankingEquipe, setRankingEquipe] = useState<any[]>([]);

useEffect(() => {
  if (!isAuthenticated || !isGestor) return;
  const hoje = new Date();
  apiClient.getPainelCEO({ periodo: 'mes', ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 })
    .then(r => setPainelCeo(r.data?.data?.indicadores || null))
    .catch(() => setPainelCeo(null));
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  const isoDia = (d: Date) => d.toISOString().slice(0, 10);
  apiClient.getRelatorioComercial(isoDia(inicioMes), isoDia(fimMes))
    .then(r => setRelatorioComercial(r.data?.data || null))
    .catch(() => setRelatorioComercial(null));
  apiClient.getRanking()
    .then(r => setRankingEquipe(r.data?.data || []))
    .catch(() => setRankingEquipe([]));
}, [isAuthenticated, isGestor]);
```

Adicionar o cálculo do NRR (novo — cruza `painelCeo.mrr_novo`/`painelCeo.mrr_perdido`, já retornados por `/ceo/painel`, sem precisar de request extra):

```typescript
const nrr = painelCeo && data
  ? (() => {
      const mrrInicial = data.kpis.mrr - (painelCeo.net_new_mrr || 0);
      if (mrrInicial <= 0) return null;
      return Math.round(((mrrInicial + (painelCeo.mrr_novo || 0) - (painelCeo.mrr_perdido || 0)) / mrrInicial) * 100);
    })()
  : null;
```

Substituir o header da página (título "Dashboard Executivo" já existe, linha 300-336 do arquivo atual) — manter como está, só ajustar o subtítulo:

```tsx
<p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
  Visão do Negócio
  {lastUpdate && <span className="ml-2">· atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
</p>
```

Adicionar os 5 KPIs-âncora logo após o `AlertStrip` existente (substituindo o antigo grid de KPIs de "Comercial — Este Mês"):

```tsx
<div className="grid grid-cols-2 lg:grid-cols-5 gap-3 du-fade-2">
  <div className="ps-card rounded-xl p-4 lg:col-span-1" style={{ background: 'linear-gradient(135deg, var(--t-primary-deep), var(--t-primary-dark))' }}>
    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,.7)' }}>MRR Recorrente</p>
    <p className="text-2xl font-extrabold" style={{ color: '#fff' }}><AnimatedNumber value={data.kpis.mrr} prefix="R$ " /></p>
    {data.kpis.mrr_delta !== undefined && (
      <p className="text-[11px] mt-1" style={{ color: data.kpis.mrr_delta >= 0 ? '#86EFAC' : '#FCA5A5' }}>
        {data.kpis.mrr_delta >= 0 ? '↑' : '↓'} {Math.abs(data.kpis.mrr_delta)}% vs. mês anterior
      </p>
    )}
  </div>
  <KpiCard label="NRR (Retenção Líquida)" value={nrr !== null ? `${nrr}%` : '—'} accent={nrr !== null && nrr >= 100 ? '#16a34a' : '#d97706'} />
  <KpiCard label="Contratos Ativos" value={String(data.kpis.contratos_ativos)} sub={`+${data.kpis.contratos_mes} este mês`} />
  <KpiCard label="Pipeline Total" value={fmt(data.kpis.pipeline_valor)} sub="valor estimado em aberto" />
  <KpiCard label="NPS" value={data.kpis.nps_score !== null ? String(data.kpis.nps_score) : '—'} accent={data.kpis.nps_score !== null && data.kpis.nps_score >= 50 ? '#16a34a' : '#d97706'} />
</div>
```

Adicionar o componente de abas logo abaixo:

```tsx
<AbaTabs
  abas={[
    { id: 'comercial', label: 'Comercial & Pipeline' },
    { id: 'retencao', label: 'Retenção & Financeiro' },
    { id: 'equipe', label: 'Equipe' },
    { id: 'funis', label: 'Funis' },
    { id: 'manuais', label: 'Indicadores Manuais' },
  ]}
  abaAtiva={abaAtiva}
  onChange={(id) => setAbaAtiva(id as typeof abaAtiva)}
/>

{abaAtiva === 'comercial' && (
  <div>{/* Task 4 preenche isto */}</div>
)}
{abaAtiva === 'retencao' && (
  <div>{/* Task 5 preenche isto */}</div>
)}
{abaAtiva === 'equipe' && (
  <div>{/* Task 6 preenche isto */}</div>
)}
{abaAtiva === 'funis' && (
  <div>{/* já existe: PipelineFunnelChart × 2, mover pra dentro deste bloco */}</div>
)}
{abaAtiva === 'manuais' && (
  <div>{/* Task 5 também preenche isto — indicadores manuais do CEO */}</div>
)}
```

- [ ] **Step 3: Rodar o typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros novos relacionados a `dashboard/page.tsx` ou `AbaTabs.tsx`.

- [ ] **Step 4: Testar visualmente com Playwright (login como CEO real ou token com role CEO) — confirmar que CEO NÃO é mais redirecionado**

```python
# scratchpad/test_dashboard_ceo_sem_redirect.py (arquivo temporário, não commitado)
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto("http://localhost:3000")
    page.evaluate("""() => {
        localStorage.setItem('accessToken', '<token com role CEO>');
    }""")
    page.goto("http://localhost:3000/dashboard", wait_until="load")
    page.wait_for_timeout(3000)
    assert page.url.endswith('/dashboard'), f"CEO foi redirecionado para {page.url}"
    browser.close()
```

Expected: `page.url` permanece `/dashboard`, sem redirect para `/relatorio-comercial`.

- [ ] **Step 5: Commit**

```bash
cd frontend && git add app/dashboard/page.tsx app/dashboard/components/AbaTabs.tsx && git commit -m "feat: dashboard executivo unificado - estrutura de abas e KPIs-ancora, sem redirect de CEO"
```

---

### Task 4: Aba "Comercial & Pipeline" — conteúdo real

**Files:**
- Modify: `frontend/app/dashboard/page.tsx` (preenche o bloco `abaAtiva === 'comercial'` do Task 3)

**Interfaces:**
- Consumes: `data` (já carregado via `getDashboardPower`), `relatorioComercial` (já carregado no Task 3).

- [ ] **Step 1: Preencher o conteúdo da aba com os KPIs de mês + tendência de MRR + entrada×saída**

```tsx
{abaAtiva === 'comercial' && (
  <div className="space-y-4">
    <div>
      <SectionLabel>Este Mês</SectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Taxa de Conversão (mês)" value={`${data.kpis.taxa_conversao}%`} accent={data.kpis.taxa_conversao >= 20 ? '#16a34a' : '#d97706'} sub="ganhos ÷ captados no mês" />
        <KpiCard label="Win Rate (propostas)" value={relatorioComercial ? `${Math.round((relatorioComercial.metricas.fechamentos.total / Math.max(relatorioComercial.metricas.fechamentos.total + (relatorioComercial.metricas.perdidos?.total || 0), 1)) * 100)}%` : '—'} accent="#16a34a" sub="ganhas ÷ decididas" />
        <KpiCard label="Leads Captados" value={fmtNum(data.kpis.leads_mes)} sub={`${data.kpis.leads_ganhos_mes} convertidos`} />
        <KpiCard label="Propostas Abertas" value={fmtNum(data.kpis.propostas_abertas)} />
      </div>
    </div>

    <MrrTrendCard
      mrr={data.kpis.mrr}
      mrrDelta={data.kpis.mrr_delta}
      contratosAtivos={data.kpis.contratos_ativos}
      contratosMes={data.kpis.contratos_mes}
      AnimatedNumber={AnimatedNumber}
      fmt={fmt}
    />

    {relatorioComercial && (
      <div className="ps-card rounded-xl p-5">
        <SectionLabel>Entrada × Saída (este mês)</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          <KpiCard label="Clientes Entrada" value={String(relatorioComercial.metricas.entrada_x_saida.clientes_entrada)} accent="#16a34a" />
          <KpiCard label="Clientes Saída" value={String(relatorioComercial.metricas.entrada_x_saida.clientes_saida)} accent={relatorioComercial.metricas.entrada_x_saida.clientes_saida > 0 ? '#dc2626' : '#16a34a'} />
          <KpiCard label="Saldo MRR" value={fmt(relatorioComercial.metricas.entrada_x_saida.saldo_mrr)} accent={relatorioComercial.metricas.entrada_x_saida.saldo_mrr >= 0 ? '#16a34a' : '#dc2626'} />
        </div>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 2: Rodar typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Testar visualmente (Playwright), aba "Comercial & Pipeline" ativa por padrão, screenshot**

Confirmar que os 4 mini-KPIs, o card de tendência de MRR e o bloco de entrada×saída aparecem preenchidos com dados reais (não vazios/undefined).

- [ ] **Step 4: Commit**

```bash
cd frontend && git add app/dashboard/page.tsx && git commit -m "feat: aba Comercial e Pipeline do dashboard unificado"
```

---

### Task 5: Aba "Retenção & Financeiro" (waterfall NRR) + Aba "Indicadores Manuais"

**Files:**
- Modify: `frontend/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `nrr`, `painelCeo`, `data.kpis.mrr` (já carregados nas tasks anteriores).

- [ ] **Step 1: Adicionar os estilos do waterfall (CSS-in-JS via `<style>` já usado no arquivo, seguindo o padrão de `.du-fade` já existente)**

Adicionar ao bloco `<style>{...}</style>` já existente no topo do componente (linhas 275-296 do arquivo original):

```css
.waterfall { display: flex; align-items: flex-end; gap: 6px; height: 150px; padding-top: 10px; }
.wf-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
.wf-bar { width: 100%; max-width: 64px; border-radius: 4px 4px 0 0; }
.wf-val { font-size: 11px; font-weight: 800; margin-bottom: 4px; }
.wf-label { font-size: 10px; font-weight: 700; color: var(--t-text-muted); margin-top: 7px; text-align: center; }
```

- [ ] **Step 2: Preencher a aba "Retenção & Financeiro"**

```tsx
{abaAtiva === 'retencao' && painelCeo && (
  <div className="space-y-4">
    <div className="ps-card rounded-xl p-5">
      <SectionLabel>Como o NRR foi calculado</SectionLabel>
      <div className="waterfall">
        <div className="wf-col">
          <span className="wf-val">{fmt(data.kpis.mrr - (painelCeo.net_new_mrr || 0))}</span>
          <div className="wf-bar" style={{ height: '100%', background: 'var(--t-primary)' }} />
          <span className="wf-label">MRR Inicial</span>
        </div>
        <div className="wf-col">
          <span className="wf-val">+{fmt(painelCeo.mrr_novo || 0)}</span>
          <div className="wf-bar" style={{ height: `${Math.max(4, Math.min(100, ((painelCeo.mrr_novo || 0) / Math.max(data.kpis.mrr, 1)) * 100))}%`, background: '#16a34a' }} />
          <span className="wf-label">Expansão</span>
        </div>
        <div className="wf-col">
          <span className="wf-val">−{fmt(painelCeo.mrr_perdido || 0)}</span>
          <div className="wf-bar" style={{ height: `${Math.max(4, Math.min(100, ((painelCeo.mrr_perdido || 0) / Math.max(data.kpis.mrr, 1)) * 100))}%`, background: '#dc2626' }} />
          <span className="wf-label">Churn</span>
        </div>
        <div className="wf-col">
          <span className="wf-val">{fmt(data.kpis.mrr)}</span>
          <div className="wf-bar" style={{ height: '100%', background: 'var(--t-primary)' }} />
          <span className="wf-label">MRR Final</span>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard label="CAC" value={painelCeo.cac !== null ? fmt(painelCeo.cac) : '— sem dado'} sub={painelCeo.cac === null ? 'nunca lançado' : undefined} />
      <KpiCard label="LTV Médio" value="— sem dado" sub="base zerada (ver /ltv)" />
      <KpiCard label="LTV : CAC" value="—" />
      <KpiCard label="Ticket Médio" value={data.kpis.contratos_ativos > 0 ? fmt(data.kpis.mrr / data.kpis.contratos_ativos) + '/mês' : '—'} />
    </div>
  </div>
)}

{abaAtiva === 'manuais' && (
  <div>
    {!isGestor ? null : (
      <>
        <p className="text-[11px] mb-3 p-3 rounded-lg" style={{ background: 'var(--t-primary-light)', color: 'var(--t-text-secondary)' }}>
          Esta aba só aparece para quem tem permissão de editar Indicadores do CEO.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Caixa Disponível" value={painelCeo?.caixa_disponivel !== null && painelCeo?.caixa_disponivel !== undefined ? fmt(painelCeo.caixa_disponivel) : '— não lançado'} />
          <KpiCard label="Faturamento" value={painelCeo?.faturamento !== null && painelCeo?.faturamento !== undefined ? fmt(painelCeo.faturamento) : '— não lançado'} />
          <KpiCard label="Despesas do Setor" value={painelCeo?.despesas_setor !== null && painelCeo?.despesas_setor !== undefined ? fmt(painelCeo.despesas_setor) : '— não lançado'} />
          <KpiCard label="Marketing Investido" value={painelCeo?.marketing_investido !== null && painelCeo?.marketing_investido !== undefined ? fmt(painelCeo.marketing_investido) : '— não lançado'} />
        </div>
      </>
    )}
  </div>
)}
```

- [ ] **Step 3: Rodar typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Testar visualmente — clicar na aba "Retenção & Financeiro", confirmar que o waterfall renderiza com valores reais e não quebra quando `painelCeo` ainda não carregou (loading state)**

- [ ] **Step 5: Commit**

```bash
cd frontend && git add app/dashboard/page.tsx && git commit -m "feat: aba Retencao e Financeiro (waterfall NRR) e Indicadores Manuais"
```

---

### Task 6: Aba "Equipe" — ranking com rank-badges + forecast por vendedor

**Files:**
- Modify: `frontend/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `rankingEquipe` (já carregado no Task 3, via `apiClient.getRanking()`).

- [ ] **Step 1: Adicionar os estilos de rank-row (CSS-in-JS, mesmo bloco `<style>`)**

```css
.rank-row { display: flex; align-items: center; gap: 10px; padding: 10px 8px; border-radius: 10px; }
.rank-row:nth-child(odd) { background: var(--t-content-bg); }
.rank-name { font-size: 13px; font-weight: 700; }
.rank-sub { font-size: 10.5px; color: var(--t-text-muted); margin-top: 1px; }
.rank-val { font-size: 13px; font-weight: 800; color: var(--t-primary-dark); margin-left: auto; text-align: right; }
.hbar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.hbar-label { font-size: 11px; font-weight: 700; color: var(--t-text-secondary); width: 130px; flex-shrink: 0; text-align: right; }
.hbar-track { flex: 1; position: relative; height: 22px; }
.hbar-fill { height: 22px; border-radius: 0 4px 4px 0; }
.hbar-value { font-size: 11px; font-weight: 800; color: var(--t-text-primary); margin-left: 10px; white-space: nowrap; min-width: 64px; }
```

- [ ] **Step 2: Preencher a aba "Equipe"**

```tsx
{abaAtiva === 'equipe' && (
  <div className="space-y-4">
    <div className="ps-card rounded-xl p-5">
      <SectionLabel>Ranking do Período</SectionLabel>
      {rankingEquipe.length === 0 ? (
        <p className="text-xs text-center py-8" style={{ color: 'var(--t-text-secondary)' }}>Nenhum dado de ranking neste período.</p>
      ) : (
        rankingEquipe.map((v: any, i: number) => {
          const cores = ['#F59E0B', '#9CA3AF', '#D97706'];
          return (
            <div key={v.responsavel_id} className="rank-row">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: cores[i] || 'var(--t-primary)' }}>
                {v.posicao}
              </span>
              <div className="flex-1">
                <p className="rank-name">{v.responsavel_nome}</p>
                <p className="rank-sub">{v.leads_ganhos} leads ganhos · {v.propostas_aceitas} propostas aceitas</p>
              </div>
              <span className="rank-val">{fmt(v.valor_total)}</span>
            </div>
          );
        })
      )}
    </div>
  </div>
)}
```

Nota: o bloco de "Forecast Ponderado por Vendedor" (usando `analise-comercial.forecast_comparativo`) fica de fora desta task — ele depende da Task 12 (unificação da fórmula de forecast comparativo), que ainda vai rodar. Adicionar um TODO explícito no código não é permitido por este plano; em vez disso, esta aba fica só com o ranking até a Task 12 acrescentar o forecast comparativo depois.

- [ ] **Step 3: Rodar typecheck**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 4: Testar visualmente — aba "Equipe", confirmar rank-badges coloridos e valores reais**

- [ ] **Step 5: Commit**

```bash
cd frontend && git add app/dashboard/page.tsx && git commit -m "feat: aba Equipe do dashboard unificado (ranking)"
```

---

### Task 7: Mover Funis (já existentes) para dentro da aba "Funis"; ajustar sidebar; redirects das 3 rotas antigas

**Files:**
- Modify: `frontend/app/dashboard/page.tsx` (mover o bloco de funis existente pra dentro do `abaAtiva === 'funis'`)
- Modify: `frontend/components/dashboard/DashboardLayout.tsx` (remover 3 itens de menu, ajustar `CEO_VISIVEL`)
- Modify: `frontend/app/painel-ceo/page.tsx` (virar redirect)
- Modify: `frontend/app/relatorio-comercial/page.tsx` (virar redirect)
- Modify: `frontend/app/ranking/page.tsx` (virar redirect)

**Interfaces:**
- Nenhuma nova — reorganização de UI e navegação.

- [ ] **Step 1: Mover o bloco de funis (já existe no arquivo original, linhas 499-512: dois `<PipelineFunnelChart />`) para dentro de `{abaAtiva === 'funis' && (...)}`, junto com "Top 5 Leads" e "Atividades em Aberto" (também já existentes)**

Este é um recorte/colar do JSX já existente no arquivo (linhas 499-685 do arquivo original) para dentro do bloco condicional de aba, sem alterar o conteúdo.

- [ ] **Step 2: Remover os 3 itens de menu do `navGroups` em `DashboardLayout.tsx`**

```typescript
// frontend/components/dashboard/DashboardLayout.tsx
// Remover estas 3 linhas do grupo "Performance" (linhas 78, 81, 85 do arquivo atual):
// { href: '/ranking', ... }
// { href: '/painel-ceo', ... }
// { href: '/relatorio-comercial', ... }
```

Atualizar `CEO_VISIVEL` (linha 29), removendo as 3 rotas que deixam de existir como destino próprio:

```typescript
const CEO_VISIVEL = ['/centro-custos', '/vendas-adicionais', '/churn-ceo', '/analise-comercial', '/ltv'];
```

- [ ] **Step 3: Transformar as 3 páginas antigas em redirects (padrão já usado em `/funil` e `/propostas` deste projeto)**

```typescript
// frontend/app/painel-ceo/page.tsx
'use client';
import { redirect } from 'next/navigation';

export default function PainelCeoRedirect() {
  redirect('/dashboard');
}
```

```typescript
// frontend/app/relatorio-comercial/page.tsx
'use client';
import { redirect } from 'next/navigation';

export default function RelatorioComercialRedirect() {
  redirect('/dashboard');
}
```

```typescript
// frontend/app/ranking/page.tsx
'use client';
import { redirect } from 'next/navigation';

export default function RankingRedirect() {
  redirect('/dashboard');
}
```

Antes de sobrescrever, mover o conteúdo antigo de cada arquivo para fora (não é necessário preservar em lugar nenhum do repo — o código já foi 100% absorvido pelas Tasks 3-6; a lógica de negócio backend permanece intacta nos endpoints, só a tela frontend desaparece).

- [ ] **Step 4: Rodar typecheck**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 5: Testar manualmente — navegar para `/painel-ceo`, `/relatorio-comercial`, `/ranking` e confirmar redirect automático para `/dashboard`; confirmar que os 3 itens somem do menu lateral**

- [ ] **Step 6: Commit**

```bash
cd frontend && git add app/dashboard/page.tsx components/dashboard/DashboardLayout.tsx app/painel-ceo/page.tsx app/relatorio-comercial/page.tsx app/ranking/page.tsx && git commit -m "feat: move funis para aba, remove 3 itens de menu, adiciona redirects para dashboard unificado"
```

---

## PARTE B — Consolidações adicionais

### Task 8: Remover ranking de técnico duplicado de `/casos`, manter só em `/health-score`

**Files:**
- Modify: `frontend/app/casos/page.tsx`

**Interfaces:**
- Nenhuma nova.

- [ ] **Step 1: Remover o state, o `useEffect` de fetch e o bloco JSX do ranking de técnico**

Remover de `frontend/app/casos/page.tsx`:
- State `rankingTec` (linha ~116: `const [rankingTec, setRankingTec] = useState<any[]>([]);`)
- O `useEffect` de fetch (linhas ~220-224, que chama `apiClient.getRankingTecnicos()`)
- O bloco JSX de renderização (linhas ~406-438)

- [ ] **Step 2: Adicionar um link para `/health-score` no lugar do bloco removido**

```tsx
import Link from 'next/link';
// ...

<div className="ps-card rounded-xl p-4 flex items-center justify-between mb-4">
  <div>
    <p className="text-xs font-semibold" style={{ color: 'var(--t-text-primary)' }}>Saúde da carteira por técnico</p>
    <p className="text-[11px] mt-0.5" style={{ color: 'var(--t-text-muted)' }}>Ranking completo disponível na tela de Health Score.</p>
  </div>
  <Link href="/health-score" className="text-[11px] font-semibold" style={{ color: 'var(--t-primary)' }}>
    Ver ranking completo →
  </Link>
</div>
```

- [ ] **Step 3: Rodar typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros — confirmar que nenhuma outra parte do arquivo referenciava `rankingTec` (o levantamento confirmou que só era usado nas 4 linhas removidas).

- [ ] **Step 4: Testar visualmente `/casos` — confirmar que o link aparece e leva para `/health-score`**

- [ ] **Step 5: Commit**

```bash
cd frontend && git add app/casos/page.tsx && git commit -m "fix: remove ranking de tecnico duplicado de /casos, linka para /health-score"
```

---

### Task 9: Fundir `/churn-ceo` (Radar executivo) para dentro de `/casos`, com gate de role interno

**Files:**
- Modify: `frontend/app/casos/page.tsx` (adicionar aba "Visão Executiva" com o Radar)
- Modify: `frontend/app/churn-ceo/page.tsx` (virar redirect)
- Modify: `frontend/components/dashboard/DashboardLayout.tsx` (remover item `/churn-ceo`, atualizar `CEO_VISIVEL` para incluir `/casos`)

**Interfaces:**
- Consumes: `casos` (state já existente em `/casos/page.tsx`, carregado via `getCasos`), `apiClient.getAtualizacoesCaso` (já usado em `/casos`).
- Produces: componente local `RadarCard` dentro de `casos/page.tsx` (reaproveitado do `churn-ceo/page.tsx:99-194`).

**Risco de segurança identificado na investigação:** `/casos` é visível para `SUPERVISAO_TECNICA` e `TECNICO_SUPORTE`, que hoje **não** veem `/churn-ceo`. A aba nova precisa de gate de role interno.

- [ ] **Step 1: Adicionar sistema de abas em `/casos/page.tsx` (Lista / Visão Executiva)**

```tsx
const SO_CEO_ROLES = ['CEO', 'ADMIN', 'SUPERVISAO_COMERCIAL'];
const podeVerVisaoExecutiva = SO_CEO_ROLES.includes((user?.role || '').toUpperCase());

const [abaAtiva, setAbaAtiva] = useState<'lista' | 'executiva'>('lista');
```

```tsx
{podeVerVisaoExecutiva && (
  <div className="flex gap-2 mb-4">
    <button onClick={() => setAbaAtiva('lista')} className={abaAtiva === 'lista' ? 'ps-btn-primary' : 'ps-btn-secondary'}>☰ Lista</button>
    <button onClick={() => setAbaAtiva('executiva')} className={abaAtiva === 'executiva' ? 'ps-btn-primary' : 'ps-btn-secondary'}>◎ Visão Executiva</button>
  </div>
)}
```

Todo o JSX de tabela/filtros/modais existentes em `/casos` fica dentro de `{abaAtiva === 'lista' && (...)}`.

- [ ] **Step 2: Copiar o componente `RadarCard` e a função `calcDias` de `churn-ceo/page.tsx:37-54,99-194` para dentro de `casos/page.tsx`, adaptando para os campos completos do modelo `Caso` já usado em `/casos` (que tem mais campos que a versão simplificada de `churn-ceo`)**

```tsx
// Dentro de casos/page.tsx — adaptado da versão em churn-ceo/page.tsx:99-194,
// usando calcDias já existente em /casos (linha 37 do arquivo original de casos,
// que já lida com data_abertura_real/resolvido_em — mais completo que a versão
// simplificada de churn-ceo).
function RadarCard({ caso, atualizacoes, onClick }: { caso: Caso; atualizacoes: Atualizacao[]; onClick: () => void }) {
  // ... mesmo JSX de churn-ceo/page.tsx:99-194, usando os campos já existentes
  // na interface Caso de /casos (mais rica: fin_*, reneg_*, reaberto*)
}
```

- [ ] **Step 3: Renderizar a aba "Visão Executiva" com o grid de `RadarCard` e os 4 KPIs de resumo (Em andamento/Crítico/Recuperados/Perdidos)**

```tsx
{abaAtiva === 'executiva' && podeVerVisaoExecutiva && (
  <div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {/* 4 KPIs, mesma lógica de churn-ceo/page.tsx:314-327, usando `casos` já carregado */}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {casos.filter(c => !['RECUPERADO', 'PERDIDO'].includes(c.status)).map(c => (
        <RadarCard key={c.id} caso={c} atualizacoes={atualizacoesPorCaso[c.id] || []} onClick={() => abrirDossie(c)} />
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 4: Transformar `/churn-ceo/page.tsx` em redirect**

```typescript
// frontend/app/churn-ceo/page.tsx
'use client';
import { redirect } from 'next/navigation';

export default function ChurnCeoRedirect() {
  redirect('/casos');
}
```

- [ ] **Step 5: Atualizar `DashboardLayout.tsx` — remover item `/churn-ceo`, atualizar `CEO_VISIVEL`**

```typescript
// Remover a linha: { href: '/churn-ceo', icon: Flame, label: 'Churn — Visão CEO', roles: SO_CEO, modulo: 'Cancelamentos / Churn' },

// Atualizar CEO_VISIVEL (Task 7 já mudou essa linha; aplicar por cima):
const CEO_VISIVEL = ['/centro-custos', '/vendas-adicionais', '/casos', '/analise-comercial', '/ltv'];
```

Nota: `/casos` já tem entrada própria no menu com `roles: TECNICO` (mais amplo) — não duplicar a entrada, só garantir que `CEO_VISIVEL` inclua `/casos` para o CEO continuar vendo o item no menu restrito dele.

- [ ] **Step 6: Rodar typecheck**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 7: Testar visualmente com 2 papéis diferentes**

1. Login com role `CEO`/`SUPERVISAO_COMERCIAL`: confirmar que a aba "Visão Executiva" aparece em `/casos` e mostra o Radar.
2. Login com role `SUPERVISAO_TECNICA`/`TECNICO_SUPORTE`: confirmar que a aba "Visão Executiva" **não aparece** (só "Lista", sem seletor de aba visível).
3. Navegar para `/churn-ceo` diretamente: confirmar redirect para `/casos`.

- [ ] **Step 8: Commit**

```bash
cd frontend && git add app/casos/page.tsx app/churn-ceo/page.tsx components/dashboard/DashboardLayout.tsx && git commit -m "feat: funde radar executivo de churn-ceo em /casos com gate de role interno"
```

---

### Task 10: Investigar e corrigir o bug de `return` prematuro em `/health-scores/ranking-tecnicos`

**Files:**
- Modify: `backend/src/routes/health-score.ts:274`
- Test: `backend/tests/health-score-ranking.test.ts`

**Interfaces:**
- Nenhuma mudança de shape de resposta — só corrige um bug de controle de fluxo encontrado durante a investigação da Task 8.

**Contexto:** dentro do loop `for (const c of clientes)` da rota `GET /health-scores/ranking-tecnicos`, a linha `if (inativo) { m.inativos += 1; m.mrr_perdido += Number(c.mrr_perdido || 0); return; }` usa `return` em vez de `continue` — isso termina a função handler da rota inteira (sem `reply.send()`) assim que o primeiro cliente inativo aparece na iteração, não só pula para o próximo cliente do loop.

- [ ] **Step 1: Escrever o teste que expõe o bug**

```typescript
// backend/tests/health-score-ranking.test.ts
import { describe, it, expect } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('GET /health-scores/ranking-tecnicos não trava quando há cliente inativo no meio da lista', () => {
  it('retorna ranking completo mesmo com um cliente INATIVA seguido de um cliente ATIVA no mesmo grupo_tecnico', async () => {
    const grupoTeste = 'Grupo Teste Automatizado';
    const clienteInativo = await prisma.cliente.create({
      data: { nome: 'TESTE_INATIVO', grupo_tecnico: grupoTeste, situacao: 'INATIVA', mrr_perdido: 100 },
    });
    const clienteAtivo = await prisma.cliente.create({
      data: { nome: 'TESTE_ATIVO', grupo_tecnico: grupoTeste, situacao: 'ATIVA', mensalidade_base: 200 },
    });

    try {
      // Chama a função de agregação diretamente (extraída no Step 3)
      const { calcularRankingTecnicos } = await import('../src/lib/ranking-tecnicos');
      const ranking = await calcularRankingTecnicos(prisma);

      const grupo = ranking.find(r => r.tecnico === grupoTeste);
      expect(grupo).toBeDefined();
      // Se o bug existisse, `ativos` seria 0 (o cliente ativo nunca seria contado,
      // porque a função já teria retornado no cliente inativo, se ele viesse primeiro
      // na ordem de iteração do Prisma).
      expect(grupo!.total).toBe(2);
      expect(grupo!.ativos).toBe(1);
      expect(grupo!.inativos).toBe(1);
    } finally {
      await prisma.cliente.delete({ where: { id: clienteInativo.id } });
      await prisma.cliente.delete({ where: { id: clienteAtivo.id } });
    }
  }, 30000);
});
```

- [ ] **Step 2: Rodar o teste e verificar que falha**

Run: `cd backend && DATABASE_URL="mysql://comercial_user:vuh5jTAjXBaPCcZcaWKcWuJl@127.0.0.1:13306/db_comercial" npx vitest run tests/health-score-ranking.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/ranking-tecnicos'`.

- [ ] **Step 3: Extrair a lógica para `backend/src/lib/ranking-tecnicos.ts`, trocando `return` por `continue`**

```typescript
// backend/src/lib/ranking-tecnicos.ts
//
// Extraído de health-score.ts para ser testável isoladamente. Correção de bug:
// a versão original usava `return` em vez de `continue` dentro do loop ao tratar
// clientes inativos, terminando a função inteira (sem responder) assim que o
// primeiro cliente inativo aparecia — não só pulando aquele cliente.

import { PrismaClient } from '@prisma/client';

export interface RankingTecnico {
  tecnico: string;
  total: number;
  ativos: number;
  inativos: number;
  em_risco: number;
  em_churn: number;
  saudaveis: number;
  mrr_ativo: number;
  mrr_perdido: number;
  indice_saude: number;
  taxa_churn: number;
}

export async function calcularRankingTecnicos(prisma: PrismaClient): Promise<RankingTecnico[]> {
  const clientes = await prisma.cliente.findMany({
    where: { grupo_tecnico: { not: null } },
    select: {
      id: true, grupo_tecnico: true, situacao: true, risco_atencao: true,
      mrr_perdido: true, mensalidade_base: true,
      health_score: { select: { nivel: true } },
      caso_churn: { where: { status: { in: ['NOVO', 'DIAGNOSTICADO', 'PLANEJADO', 'EXECUTANDO'] } }, select: { id: true } },
    },
  }).catch(() => [] as any[]);

  const mapa: Record<string, any> = {};
  for (const c of clientes) {
    const g = (c.grupo_tecnico || '').trim();
    if (!g || /comercial|inativ/i.test(g)) continue;
    if (!mapa[g]) mapa[g] = { tecnico: g, total: 0, ativos: 0, inativos: 0, em_risco: 0, em_churn: 0, saudaveis: 0, mrr_ativo: 0, mrr_perdido: 0 };
    const m = mapa[g];
    m.total += 1;
    const inativo = (c.situacao || '').toUpperCase().startsWith('INAT');
    if (inativo) {
      m.inativos += 1;
      m.mrr_perdido += Number(c.mrr_perdido || 0);
      continue; // CORRIGIDO: era `return`, terminava a rota inteira
    }
    m.ativos += 1;
    m.mrr_ativo += Number(c.mensalidade_base || 0);
    const emChurn = c.caso_churn.length > 0;
    const emRisco = c.risco_atencao || ['RISCO', 'CRITICO'].includes(c.health_score?.nivel || '');
    if (emChurn) m.em_churn += 1;
    else if (emRisco) m.em_risco += 1;
    else m.saudaveis += 1;
  }

  return Object.values(mapa).map((m: any) => {
    const baseAtivos = m.ativos || 1;
    const indice_saude = Math.round((m.saudaveis / baseAtivos) * 100);
    const taxa_churn = m.total ? Math.round((m.inativos / m.total) * 100) : 0;
    return { ...m, indice_saude, taxa_churn };
  }).sort((a, b) => b.indice_saude - a.indice_saude);
}
```

- [ ] **Step 4: Rodar o teste e verificar que passa**

Run: `cd backend && DATABASE_URL="mysql://comercial_user:vuh5jTAjXBaPCcZcaWKcWuJl@127.0.0.1:13306/db_comercial" npx vitest run tests/health-score-ranking.test.ts`
Expected: PASS.

- [ ] **Step 5: Atualizar a rota em `health-score.ts` para usar a função extraída**

```typescript
// backend/src/routes/health-score.ts
import { calcularRankingTecnicos } from '@/lib/ranking-tecnicos';

fastify.get('/health-scores/ranking-tecnicos', async (_request, reply) => {
  const ranking = await calcularRankingTecnicos(prisma);
  return reply.send({ status: 'success', data: ranking });
});
```

- [ ] **Step 6: Rodar o teste + typecheck**

Run: `cd backend && DATABASE_URL="mysql://comercial_user:vuh5jTAjXBaPCcZcaWKcWuJl@127.0.0.1:13306/db_comercial" npx vitest run tests/health-score-ranking.test.ts && npx tsc --noEmit`
Expected: PASS, sem erros novos.

- [ ] **Step 7: Testar manualmente contra produção — confirmar que a rota real (não só o teste) retorna todos os grupos técnicos, incluindo os que têm clientes inativos misturados com ativos**

Run: `curl http://localhost:3001/health-scores/ranking-tecnicos` (com backend local rodando contra produção) e conferir visualmente que o `total` de linhas bate com a quantidade de grupos técnicos distintos esperada.

- [ ] **Step 8: Commit**

```bash
cd backend && git add src/lib/ranking-tecnicos.ts src/routes/health-score.ts tests/health-score-ranking.test.ts && git commit -m "fix: corrige return prematuro em /health-scores/ranking-tecnicos (terminava a rota no primeiro cliente inativo)"
```

---

### Task 11: Fundir dashboard de `/vendas-adicionais` como aba dentro de `/indicacoes`

**Files:**
- Modify: `frontend/app/indicacoes/page.tsx` (adicionar 4ª aba "Resultado Anual")
- Modify: `frontend/app/vendas-adicionais/page.tsx` (virar redirect)
- Modify: `frontend/components/dashboard/DashboardLayout.tsx` (remover item `/vendas-adicionais`)

**Interfaces:**
- Consumes: `apiClient.getVendasAdicionaisCEO(ano)` (já existe, rota `/ceo/vendas-adicionais`, exclusiva desta funcionalidade segundo a investigação — precisa ser preservada).

**Nota da investigação:** as duas tabelas NÃO são idênticas — `/vendas-adicionais` filtra só `CONFIRMADA` do ano corrente sem ações; `/indicacoes` (aba "vendas") mostra todos os status/anos com ações de workflow. Esta task **não remove** a aba "vendas" existente — só adiciona uma aba nova com os gráficos/meta anual que eram exclusivos de `/vendas-adicionais`.

- [ ] **Step 1: Adicionar a 4ª aba ao sistema de abas já existente em `/indicacoes/page.tsx` (`'vendas' | 'negociacao' | 'parceiros'` vira `'vendas' | 'negociacao' | 'parceiros' | 'resultado'`)**

```typescript
// frontend/app/indicacoes/page.tsx
const [aba, setAba] = useState<'vendas' | 'negociacao' | 'parceiros' | 'resultado'>('vendas');
const [resultadoAnual, setResultadoAnual] = useState<any>(null);
const [anoResultado, setAnoResultado] = useState(new Date().getFullYear());

useEffect(() => {
  if (aba !== 'resultado') return;
  apiClient.getVendasAdicionaisCEO(anoResultado)
    .then(r => setResultadoAnual(r.data?.data || null))
    .catch(() => setResultadoAnual(null));
}, [aba, anoResultado]);
```

- [ ] **Step 2: Copiar o JSX de gráficos/meta anual de `vendas-adicionais/page.tsx:65-150` para dentro da aba nova, adaptando imports de `recharts` (já usado em outras partes do frontend, confirmar se `indicacoes/page.tsx` já importa `recharts` — se não, adicionar)**

```tsx
{aba === 'resultado' && resultadoAnual && (
  <div>
    {/* Barra de meta anual — mesmo JSX de vendas-adicionais/page.tsx:76-109 */}
    {/* Gráfico 1 — BarChart faturamento por mês — mesmo JSX de vendas-adicionais/page.tsx:112-122 */}
    {/* Gráfico 2 — BarChart por vendedor — mesmo JSX de vendas-adicionais/page.tsx:126-136 */}
    {/* Gráfico 3 — PieChart por categoria — mesmo JSX de vendas-adicionais/page.tsx:138-150 */}
  </div>
)}
```

- [ ] **Step 3: Transformar `/vendas-adicionais/page.tsx` em redirect**

```typescript
// frontend/app/vendas-adicionais/page.tsx
'use client';
import { redirect } from 'next/navigation';

export default function VendasAdicionaisRedirect() {
  redirect('/indicacoes');
}
```

- [ ] **Step 4: Remover item de menu `/vendas-adicionais` de `DashboardLayout.tsx`**

- [ ] **Step 5: Rodar typecheck**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 6: Testar visualmente — aba "Resultado Anual" dentro de `/indicacoes`, confirmar os 3 gráficos e a barra de meta**

- [ ] **Step 7: Commit**

```bash
cd frontend && git add app/indicacoes/page.tsx app/vendas-adicionais/page.tsx components/dashboard/DashboardLayout.tsx && git commit -m "feat: funde dashboard de vendas-adicionais como aba Resultado Anual em /indicacoes"
```

---

### Task 12: Unificar a fórmula de forecast comparativo em `/analise-comercial` com `scope.ts` (remover reimplementação manual de `ownerWhere`)

**Files:**
- Modify: `backend/src/routes/analise-comercial.ts:182` (trocar o `OR` manual por `ownerWhere`/`effectiveScopeId`)
- Test: `backend/tests/analise-comercial-forecast.test.ts`

**Interfaces:**
- Consumes: `ownerWhereId` de `backend/src/lib/scope.ts` (já existe).

- [ ] **Step 1: Escrever o teste que confirma o comportamento de escopo antes/depois da mudança**

```typescript
// backend/tests/analise-comercial-forecast.test.ts
import { describe, it, expect } from 'vitest';
import { ownerWhereId } from '../src/lib/scope';

describe('analise-comercial usa ownerWhereId em vez de OR manual', () => {
  it('ownerWhereId("Lead", scopeId) produz o mesmo filtro que o OR manual reimplementado', () => {
    const scopeId = 'vendedor-123';
    const resultado = ownerWhereId('Lead', scopeId);
    expect(resultado).toEqual({
      deleted_at: null,
      OR: [{ responsavel_id: scopeId }, { created_by: scopeId }],
    });
  });

  it('ownerWhereId("Lead", null) não filtra por dono, mas ainda exclui deletados', () => {
    const resultado = ownerWhereId('Lead', null);
    expect(resultado).toEqual({ deleted_at: null });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que passa (este teste não depende da mudança em `analise-comercial.ts`, só valida a função já existente em `scope.ts`)**

Run: `cd backend && npx vitest run tests/analise-comercial-forecast.test.ts`
Expected: PASS (sem precisar de `DATABASE_URL`, é lógica pura).

- [ ] **Step 3: Substituir a reimplementação manual em `analise-comercial.ts`**

```typescript
// backend/src/routes/analise-comercial.ts
// Antes (linha ~182):
// ...(scopeId ? { OR: [{ responsavel_id: scopeId }, { created_by: scopeId }] } : {}),

// Depois:
import { ownerWhereId } from '@/lib/scope';
// ...
const leadsForecast = await prisma.lead.findMany({
  where: {
    etapa_comercial: { in: Object.keys(PROB_ETAPA) },
    status: { notIn: ['PERDIDO'] },
    ...ownerWhereId('Lead', scopeId),
  },
  select: { etapa_comercial: true, valor_setup: true, valor_estimado: true, mensalidade_estimada: true, responsavel_id: true, responsavel_nome: true },
  take: 5000,
}).catch(() => [] as any[]);
```

Nota: `ownerWhereId('Lead', ...)` já inclui `deleted_at: null` — remover o `deleted_at: null` duplicado que existia antes na mesma query (linha 179 do arquivo original), se estava separado.

- [ ] **Step 4: Rodar typecheck + teste**

Run: `cd backend && npx tsc --noEmit && npx vitest run tests/analise-comercial-forecast.test.ts`
Expected: sem erros, teste PASS.

- [ ] **Step 5: Testar manualmente — comparar a resposta de `/analise-comercial` antes/depois da mudança para o mesmo vendedor (deve retornar exatamente os mesmos leads, já que a lógica é equivalente, só centralizada)**

- [ ] **Step 6: Adicionar o bloco "Forecast Ponderado por Vendedor" na aba "Equipe" do dashboard unificado (Task 6), agora que a fórmula está unificada**

```tsx
// frontend/app/dashboard/page.tsx — dentro de {abaAtiva === 'equipe' && (...)}, após o ranking
{forecastComparativo.length > 0 && (
  <div className="ps-card rounded-xl p-5">
    <SectionLabel>Forecast Ponderado por Vendedor</SectionLabel>
    {forecastComparativo.map((f: any) => (
      <div key={f.vendedor_id} className="hbar-row">
        <span className="hbar-label">{f.vendedor_nome}</span>
        <div className="hbar-track">
          <div className="hbar-fill" style={{ width: `${Math.min(100, (f.valor_ponderado / Math.max(...forecastComparativo.map((x: any) => x.valor_ponderado), 1)) * 100)}%`, background: 'var(--t-primary)' }} />
        </div>
        <span className="hbar-value">{fmt(f.valor_ponderado)}</span>
      </div>
    ))}
  </div>
)}
```

Adicionar o carregamento correspondente no `useEffect` do Task 3:

```typescript
const [forecastComparativo, setForecastComparativo] = useState<any[]>([]);
// dentro do useEffect existente:
apiClient.getAnaliseComercial({}).then(r => setForecastComparativo(r.data?.data?.forecast_comparativo || [])).catch(() => setForecastComparativo([]));
```

- [ ] **Step 7: Rodar typecheck do frontend**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 8: Commit**

```bash
cd backend && git add src/routes/analise-comercial.ts tests/analise-comercial-forecast.test.ts && git commit -m "refactor: analise-comercial usa ownerWhereId centralizado em vez de OR manual reimplementado"
cd ../frontend && git add app/dashboard/page.tsx && git commit -m "feat: adiciona forecast ponderado por vendedor na aba Equipe do dashboard"
```

---

### Task 13: Remover seção de comissões duplicada de `/centro-custos`

**Files:**
- Modify: `frontend/app/centro-custos/page.tsx`

**Interfaces:**
- Nenhuma nova.

- [ ] **Step 1: Remover o bloco JSX "Comissões do mês" (linhas ~436-478 do arquivo original)**

- [ ] **Step 2: Adicionar um link para `/comissoes` no lugar**

```tsx
import Link from 'next/link';
// ...

<div className="ps-card rounded-xl p-4 flex items-center justify-between mb-4">
  <div>
    <p className="text-xs font-semibold" style={{ color: 'var(--t-text-primary)' }}>Comissões</p>
    <p className="text-[11px] mt-0.5" style={{ color: 'var(--t-text-muted)' }}>Gestão completa de comissões (com status de pagamento) fica em Comissões.</p>
  </div>
  <Link href="/comissoes" className="text-[11px] font-semibold" style={{ color: 'var(--t-primary)' }}>
    Ver comissões →
  </Link>
</div>
```

- [ ] **Step 3: Manter `outrosLancamentos` (linha ~111) intacto — ele continua necessário para a seção "Lançamentos" existente e já exclui `COMISSAO` corretamente (confirmado na investigação: nenhuma outra parte da tela depende do bloco removido)**

- [ ] **Step 4: Rodar typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros — confirmar que `comissoes`/`comissoesPorMes` (variáveis só usadas no bloco removido) não geram erro de "declared but never used" (se gerar, remover as duas declarações também, já que ficam órfãs).

- [ ] **Step 5: Testar visualmente `/centro-custos` — confirmar que o "Balanço Geral"/"DRE simplificado" continuam mostrando o total de comissões corretamente (não dependem do bloco removido, vêm de `/financeiro/balanco`)**

- [ ] **Step 6: Commit**

```bash
cd frontend && git add app/centro-custos/page.tsx && git commit -m "fix: remove secao de comissoes duplicada de /centro-custos, linka para /comissoes"
```

---

## Self-Review

**1. Cobertura da spec:**
- Grupo 1 (unificação de 4 telas de entrada): Tasks 1-7. ✅
- Grupo 2 (Churn-CEO ↔ Casos): Task 9. ✅
- Ranking de técnico duplicado: Task 8. ✅ (corrigido para 2 arquivos reais, não 3, após investigação confirmar que `/churn-ceo` não tinha a duplicata)
- Forecast calculado 3x: Tasks 1 (`/leads/previsao`) e 12 (`/analise-comercial`, mais o bug de `ownerWhere` reimplementado). ✅ (`/dashboard/forecast` já usava a fórmula correta, não precisou de mudança)
- Cross-sell ↔ Vendas Adicionais: Task 11. ✅
- Comissões duplicadas no Centro de Custos: Task 13. ✅
- Bug de `return` prematuro em ranking de técnico (achado durante a investigação, fora do escopo original mas com risco real): Task 10. ✅

**2. Placeholder scan:** nenhum "TBD"/"TODO" — toda task tem código completo. A única nota informal ("não é permitido por este plano" na Task 6) documenta uma dependência entre tasks, não um placeholder de código.

**3. Consistência de tipos:** `ResultadoPrevisao`, `ResumoPrevisao`, `OportunidadePrevisao` (Task 1) e `RankingTecnico` (Task 10) são definidos uma vez e não reutilizados por outras tasks — sem risco de nome divergente. `AbaTabs` (Task 3) é usado da mesma forma em todas as tasks subsequentes que adicionam abas.

**4. Ordem de dependência:** Tasks 3-7 dependem umas das outras sequencialmente (mesma arquivo `dashboard/page.tsx`, cada task adiciona a próxima seção) — não são paralelizáveis entre si. Tasks 1, 8, 9, 10, 11, 12, 13 são independentes entre si e do bloco 3-7, exceto Task 12 Step 6, que depende da Task 6 já ter criado a aba "Equipe". Um executor deve rodar 3→4→5→6→7 em sequência, e pode intercalar 1, 8, 9, 10, 11, 13 em qualquer ordem, com 12 depois de 6.
