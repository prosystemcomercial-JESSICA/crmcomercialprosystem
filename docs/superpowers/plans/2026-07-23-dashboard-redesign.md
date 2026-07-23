# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir as visualizações simples (barras CSS) do Dashboard Executivo por gráficos Recharts reais e animados — tendência de MRR, funil de pipeline, donut de motivos de perda e gauge de temperatura — mantendo a paleta azul institucional e a fonte de dados atual.

**Architecture:** Componentes React novos, isolados em arquivos próprios dentro de `frontend/app/dashboard/`, cada um recebendo dados já buscados pela página principal (sem chamadas de API próprias, exceto o card de MRR que busca a série anual). A página `page.tsx` importa e substitui os blocos visuais antigos por esses componentes, mantendo a mesma estrutura de seções e o mesmo fluxo de `loadData()`.

**Tech Stack:** Next.js App Router (React 19), TypeScript, Recharts 3.8 (já instalado), Tailwind (classes utilitárias já em uso), variáveis CSS de tema (`var(--t-*)`).

## Global Constraints

- Não adicionar dependências novas — usar apenas `recharts` (já em `package.json`).
- Manter as cores semânticas já usadas no arquivo: verde `#16a34a`, vermelho `#dc2626`, âmbar `#d97706`, azul primário `#4B8EC8`/`#2E6EAB`, roxos `#6366F1`/`#7c3aed`/`#8B5CF6`.
- Todo texto/fundo deve usar as variáveis de tema `var(--t-text-primary)`, `var(--t-text-secondary)`, `var(--t-text-muted)`, `var(--t-card-bg)`, `var(--t-card-border)`, `var(--t-primary-light)` — nunca cor hardcoded para texto/fundo (só os acentos de dado/cor semântica podem ser hex fixo, como já é o padrão no arquivo).
- Todo gráfico novo entra com animação (`isAnimationActive`, `animationDuration` 800–1000ms, `animationEasing="ease-out"`).
- Estado vazio tratado em todo componente novo (mensagem "sem dados" em vez de gráfico quebrado), seguindo o padrão já usado em `data.pipeline_funil.every(p => p.count === 0)`.
- Não modificar o backend (`backend/src/routes/dashboard-power.ts` nem `relatorio-comercial.ts`) — ambas as rotas usadas já existem e retornam o formato necessário.

---

## File Structure

- **Create:** `frontend/app/dashboard/components/ChartTooltip.tsx` — tooltip customizado compartilhado pelos 4 gráficos novos.
- **Create:** `frontend/app/dashboard/components/MrrTrendCard.tsx` — card hero de MRR com `AreaChart` de tendência.
- **Create:** `frontend/app/dashboard/components/PipelineFunnelChart.tsx` — funil de pipeline por etapa.
- **Create:** `frontend/app/dashboard/components/TemperaturaGauge.tsx` — gauge radial de temperatura de propostas.
- **Create:** `frontend/app/dashboard/components/MotivosPerdaDonut.tsx` — donut de motivos de perda com legenda interativa.
- **Modify:** `frontend/app/dashboard/page.tsx` — importa os componentes novos, reordena a seção de MRR para o topo, substitui os blocos de barras/proporção pelos componentes novos.
- **Modify:** `frontend/lib/api-client.ts` — nenhuma mudança necessária (`getRelatorioSerieAnual` já existe).

---

### Task 1: ChartTooltip — tooltip customizado compartilhado

**Files:**
- Create: `frontend/app/dashboard/components/ChartTooltip.tsx`

**Interfaces:**
- Produces: `export function ChartTooltip({ active, payload, label, formatter }: { active?: boolean; payload?: any[]; label?: string; formatter?: (value: any, name: string, payload: any) => React.ReactNode }): JSX.Element | null` — componente de tooltip no formato esperado pela prop `content` do Recharts (`<Tooltip content={<ChartTooltip />} />` ou `content={(props) => <ChartTooltip {...props} formatter={...} />}`).

- [ ] **Step 1: Criar o componente**

```tsx
'use client';

import React from 'react';

interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  formatter?: (value: any, name: string, payload: any) => React.ReactNode;
}

export function ChartTooltip({ active, payload, label, formatter }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className="ps-card rounded-lg px-3 py-2 shadow-lg"
      style={{
        background: 'var(--t-card-bg)',
        border: '1px solid var(--t-card-border)',
        minWidth: 140,
      }}
    >
      {label && (
        <p className="text-[11px] font-semibold mb-1.5" style={{ color: 'var(--t-text-primary)' }}>
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: entry.color || entry.fill || 'var(--t-primary)' }}
              />
              <span className="text-[10px] truncate" style={{ color: 'var(--t-text-secondary)' }}>
                {entry.name}
              </span>
            </div>
            <span className="text-[11px] font-bold flex-shrink-0" style={{ color: 'var(--t-text-primary)' }}>
              {formatter ? formatter(entry.value, entry.name, entry.payload) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilação TypeScript**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -i "ChartTooltip"`
Expected: sem saída (nenhum erro no arquivo novo).

- [ ] **Step 3: Commit**

```bash
git add frontend/app/dashboard/components/ChartTooltip.tsx
git commit -m "feat: tooltip customizado compartilhado para os graficos do dashboard"
```

---

### Task 2: MrrTrendCard — hero de MRR com tendência

**Files:**
- Create: `frontend/app/dashboard/components/MrrTrendCard.tsx`

**Interfaces:**
- Consumes: `ChartTooltip` (Task 1); `apiClient.getRelatorioSerieAnual(ano: number)` de `@/lib/api-client` (já existe, retorna `{ data: { data: { ano: number; serie: { mes: string; mrr_ganho: number; mrr_perdido: number; saldo_mrr: number; setup_total: number; fechamentos: number; leads: number; perdidos: number; indicacoes: number }[] } } }`); componente `AnimatedNumber` (definido em `frontend/app/dashboard/page.tsx`, será passado como prop para não duplicar).
- Produces: `export function MrrTrendCard({ mrr, mrrDelta, contratosAtivos, contratosMes, AnimatedNumber, fmt }: { mrr: number; mrrDelta: number; contratosAtivos: number; contratosMes: number; AnimatedNumber: React.ComponentType<{ value: number; prefix?: string; suffix?: string; decimals?: number }>; fmt: (v: number) => string }): JSX.Element`

- [ ] **Step 1: Criar o componente**

```tsx
'use client';

import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, FileCheck2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { ChartTooltip } from './ChartTooltip';

interface SeriePonto {
  mes: string;
  saldo_mrr: number;
}

interface MrrTrendCardProps {
  mrr: number;
  mrrDelta: number;
  contratosAtivos: number;
  contratosMes: number;
  AnimatedNumber: React.ComponentType<{ value: number; prefix?: string; suffix?: string; decimals?: number }>;
  fmt: (v: number) => string;
}

export function MrrTrendCard({ mrr, mrrDelta, contratosAtivos, contratosMes, AnimatedNumber, fmt }: MrrTrendCardProps) {
  const [serie, setSerie] = useState<SeriePonto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const anoAtual = new Date().getFullYear();
    const mesAtual = new Date().getMonth(); // 0-indexed
    apiClient.getRelatorioSerieAnual(anoAtual)
      .then(res => {
        const serieCompleta: { mes: string; saldo_mrr: number }[] = res.data?.data?.serie || [];
        // A rota devolve os 12 meses do ano, incluindo meses futuros (que vêm zerados).
        // Corta no mês atual para não desenhar uma queda artificial pra zero no futuro.
        const acumulado: SeriePonto[] = [];
        let saldoAcumulado = 0;
        serieCompleta.slice(0, mesAtual + 1).forEach(p => {
          saldoAcumulado += p.saldo_mrr;
          acumulado.push({ mes: p.mes, saldo_mrr: saldoAcumulado });
        });
        setSerie(acumulado);
      })
      .catch(() => setSerie([]))
      .finally(() => setLoading(false));
  }, []);

  const temTendencia = !loading && serie.length > 1 && serie.some(p => p.saldo_mrr !== 0);

  return (
    <div className="du-fade-2 grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div className="ps-card rounded-xl p-5 lg:col-span-2 relative overflow-hidden group transition-all duration-200 hover:shadow-md">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(22,163,74,0.10)' }}>
              <DollarSign size={16} style={{ color: '#16a34a' }} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--t-text-muted)' }}>
                MRR Recorrente
              </p>
              <p className="text-2xl font-bold tracking-tight leading-none mt-1" style={{ color: 'var(--t-text-primary)' }}>
                <AnimatedNumber value={mrr} prefix="R$ " />
              </p>
            </div>
          </div>
          {mrrDelta !== undefined && (
            <span
              className="flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0"
              style={{
                background: mrrDelta >= 0 ? 'rgba(22,163,74,0.10)' : 'rgba(220,38,38,0.10)',
                color: mrrDelta >= 0 ? '#16a34a' : '#dc2626',
              }}
            >
              {mrrDelta >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
              {Math.abs(mrrDelta)}%
            </span>
          )}
        </div>

        {temTendencia ? (
          <div className="h-24 mt-3 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'var(--t-text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip content={<ChartTooltip formatter={(v) => fmt(Number(v))} />} />
                <Area
                  type="monotone"
                  dataKey="saldo_mrr"
                  name="Saldo MRR acumulado"
                  stroke="#16a34a"
                  strokeWidth={2}
                  fill="url(#mrrGradient)"
                  isAnimationActive
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-[11px] mt-3" style={{ color: 'var(--t-text-secondary)' }}>
            {loading ? 'Carregando tendência…' : 'Sem histórico suficiente para exibir tendência.'}
          </p>
        )}
      </div>

      <div className="ps-card rounded-xl p-5 flex flex-col justify-center transition-all duration-200 hover:shadow-md">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mb-3" style={{ background: 'rgba(75,142,200,0.10)' }}>
          <FileCheck2 size={16} style={{ color: '#4B8EC8' }} />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--t-text-muted)' }}>
          Contratos Ativos
        </p>
        <p className="text-2xl font-bold tracking-tight leading-none" style={{ color: 'var(--t-text-primary)' }}>
          <AnimatedNumber value={contratosAtivos} />
        </p>
        <p className="text-[11px] mt-1.5" style={{ color: 'var(--t-text-secondary)' }}>
          +{contratosMes} este mês
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilação TypeScript**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -i "MrrTrendCard"`
Expected: sem saída.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/dashboard/components/MrrTrendCard.tsx
git commit -m "feat: card hero de MRR com grafico de tendencia no dashboard"
```

---

### Task 3: PipelineFunnelChart — funil de pipeline por etapa

**Files:**
- Create: `frontend/app/dashboard/components/PipelineFunnelChart.tsx`

**Interfaces:**
- Consumes: `ChartTooltip` (Task 1); tipo `{ etapa: string; count: number; valor: number }[]` (mesmo formato de `DashboardPower['pipeline_funil']`, já definido em `page.tsx`); `ETAPA_LABEL` (mapa de labels, já definido em `page.tsx`, será passado como prop); `fmt` (formatter de moeda).
- Produces: `export function PipelineFunnelChart({ pipelineFunil, etapaLabel, fmt }: { pipelineFunil: { etapa: string; count: number; valor: number }[]; etapaLabel: Record<string, string>; fmt: (v: number) => string }): JSX.Element`

- [ ] **Step 1: Criar o componente**

```tsx
'use client';

import React from 'react';
import { FunnelChart, Funnel, Cell, LabelList, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartTooltip } from './ChartTooltip';

interface PipelineFunnelChartProps {
  pipelineFunil: { etapa: string; count: number; valor: number }[];
  etapaLabel: Record<string, string>;
  fmt: (v: number) => string;
}

const FUNNEL_COLORS = ['#4B8EC8', '#2E6EAB', '#1A4E82', '#6366F1', '#8B5CF6', '#7C3AED'];

export function PipelineFunnelChart({ pipelineFunil, etapaLabel, fmt }: PipelineFunnelChartProps) {
  const temDados = pipelineFunil.some(p => p.count > 0);

  const data = pipelineFunil.map((p, i) => ({
    name: etapaLabel[p.etapa] || p.etapa,
    value: p.count,
    valorMonetario: p.valor,
    fill: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
    // Taxa de conversão em relação à etapa anterior (só faz sentido a partir da 2ª etapa).
    taxaConversao: i === 0 || pipelineFunil[i - 1].count === 0
      ? null
      : Math.round((p.count / pipelineFunil[i - 1].count) * 100),
  }));

  return (
    <div className="ps-card rounded-xl p-5">
      <p className="text-xs font-semibold mb-4" style={{ color: 'var(--t-text-primary)' }}>Pipeline por Etapa</p>
      {temDados ? (
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <FunnelChart>
              <Tooltip
                content={
                  <ChartTooltip
                    formatter={(_value, _name, payload) =>
                      `${payload.value} lead${payload.value !== 1 ? 's' : ''} · ${fmt(payload.valorMonetario)}${payload.taxaConversao !== null ? ` · ${payload.taxaConversao}% conv.` : ''}`
                    }
                  />
                }
              />
              <Funnel
                dataKey="value"
                data={data}
                isAnimationActive
                animationDuration={900}
                animationEasing="ease-out"
              >
                <LabelList
                  position="right"
                  dataKey="name"
                  fill="var(--t-text-primary)"
                  fontSize={11}
                  fontWeight={600}
                />
                {data.map((entry, i) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-xs text-center py-6" style={{ color: 'var(--t-text-secondary)' }}>Nenhum lead ativo no funil</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilação TypeScript**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -i "PipelineFunnelChart"`
Expected: sem saída.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/dashboard/components/PipelineFunnelChart.tsx
git commit -m "feat: funil visual de pipeline por etapa no dashboard"
```

---

### Task 4: TemperaturaGauge — gauge radial de temperatura de propostas

**Files:**
- Create: `frontend/app/dashboard/components/TemperaturaGauge.tsx`

**Interfaces:**
- Consumes: tipo `{ quente: { count: number }; morno: { count: number }; frio: { count: number } }` (subconjunto de `DashboardPower['pipeline_propostas']`, já definido em `page.tsx`).
- Produces: `export function TemperaturaGauge({ quente, morno, frio }: { quente: number; morno: number; frio: number }): JSX.Element`

- [ ] **Step 1: Criar o componente**

```tsx
'use client';

import React from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { ChartTooltip } from './ChartTooltip';

interface TemperaturaGaugeProps {
  quente: number;
  morno: number;
  frio: number;
}

export function TemperaturaGauge({ quente, morno, frio }: TemperaturaGaugeProps) {
  const total = quente + morno + frio;
  if (total === 0) return null;

  const data = [
    { name: 'Quente', value: quente, fill: '#dc2626' },
    { name: 'Morno', value: morno, fill: '#d97706' },
    { name: 'Frio', value: frio, fill: '#2563eb' },
  ];

  return (
    <div className="mt-4" style={{ height: 140 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="30%"
          outerRadius="100%"
          data={data}
          startAngle={180}
          endAngle={0}
          barCategoryGap={4}
        >
          <RadialBar
            dataKey="value"
            background={{ fill: 'var(--t-card-border)' }}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
          />
          <Legend
            iconType="circle"
            iconSize={8}
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            formatter={(value: string) => {
              const item = data.find(d => d.name === value);
              return <span style={{ color: 'var(--t-text-muted)', fontSize: 10, fontWeight: 600 }}>{value} {item?.value ?? 0}</span>;
            }}
          />
          <Tooltip content={<ChartTooltip />} />
        </RadialBarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilação TypeScript**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -i "TemperaturaGauge"`
Expected: sem saída.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/dashboard/components/TemperaturaGauge.tsx
git commit -m "feat: gauge radial de temperatura de propostas no dashboard"
```

---

### Task 5: MotivosPerdaDonut — donut de motivos de perda com legenda interativa

**Files:**
- Create: `frontend/app/dashboard/components/MotivosPerdaDonut.tsx`

**Interfaces:**
- Consumes: `ChartTooltip` (Task 1); tipo `{ motivo: string; total: number; valor_total: number; pct: number }[]` (mesmo formato de `DashboardPower['ranking_motivos_perda']`, já definido em `page.tsx`); `fmt`.
- Produces: `export function MotivosPerdaDonut({ motivos, fmt }: { motivos: { motivo: string; total: number; valor_total: number; pct: number }[]; fmt: (v: number) => string }): JSX.Element`

- [ ] **Step 1: Criar o componente**

```tsx
'use client';

import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartTooltip } from './ChartTooltip';

interface MotivosPerdaDonutProps {
  motivos: { motivo: string; total: number; valor_total: number; pct: number }[];
  fmt: (v: number) => string;
}

const DONUT_COLORS = ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2'];

export function MotivosPerdaDonut({ motivos, fmt }: MotivosPerdaDonutProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (!motivos || motivos.length === 0) return null;

  const data = motivos.map((m, i) => ({
    name: m.motivo,
    value: m.total,
    valorMonetario: m.valor_total,
    pct: m.pct,
    fill: DONUT_COLORS[i % DONUT_COLORS.length],
  }));

  return (
    <div className="ps-card rounded-xl p-5">
      <p className="text-xs font-semibold mb-4" style={{ color: 'var(--t-text-primary)' }}>Principais motivos de perda</p>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div style={{ width: 160, height: 160, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                content={
                  <ChartTooltip
                    formatter={(_v, _n, payload) => `${payload.value}× · ${fmt(payload.valorMonetario)} · ${payload.pct}%`}
                  />
                }
              />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={44}
                outerRadius={70}
                paddingAngle={2}
                isAnimationActive
                animationDuration={900}
                animationEasing="ease-out"
              >
                {data.map((entry, i) => (
                  <Cell
                    key={entry.name}
                    fill={entry.fill}
                    opacity={activeIndex === null || activeIndex === i ? 1 : 0.35}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 w-full space-y-2 min-w-0">
          {data.map((entry, i) => (
            <div
              key={entry.name}
              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors"
              style={{ background: activeIndex === i ? 'var(--t-primary-light)' : 'transparent' }}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.fill }} />
                <span className="text-xs font-medium truncate" style={{ color: 'var(--t-text-primary)' }}>{entry.name}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs font-semibold" style={{ color: '#dc2626' }}>{entry.value}×</span>
                <span className="text-[10px] font-semibold px-1.5 py-px rounded" style={{ background: 'rgba(220,38,38,0.08)', color: '#b91c1c' }}>
                  {entry.pct}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilação TypeScript**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -i "MotivosPerdaDonut"`
Expected: sem saída.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/dashboard/components/MotivosPerdaDonut.tsx
git commit -m "feat: donut interativo de motivos de perda no dashboard"
```

---

### Task 6: Integrar os componentes novos em page.tsx

**Files:**
- Modify: `frontend/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `MrrTrendCard` (Task 2), `PipelineFunnelChart` (Task 3), `TemperaturaGauge` (Task 4), `MotivosPerdaDonut` (Task 5) — todos de `./components/*`.

- [ ] **Step 1: Adicionar os imports dos componentes novos**

No topo de `frontend/app/dashboard/page.tsx`, após os imports existentes (linha 15, após o bloco `from 'lucide-react'`):

```tsx
import { MrrTrendCard } from './components/MrrTrendCard';
import { PipelineFunnelChart } from './components/PipelineFunnelChart';
import { TemperaturaGauge } from './components/TemperaturaGauge';
import { MotivosPerdaDonut } from './components/MotivosPerdaDonut';
```

- [ ] **Step 2: Inserir o MrrTrendCard logo após o Alert Strip, antes dos KPIs Comercial**

Localizar o bloco (linha 367-373):

```tsx
            {/* ── Alertas ──────────────────────────────────────── */}
            {totalAlertas > 0 && (
              <div className="du-fade-1">
                <AlertStrip alertas={data.alertas} />
              </div>
            )}

            {/* ── KPIs Comercial ───────────────────────────────── */}
```

Inserir entre os dois blocos:

```tsx
            {/* ── Alertas ──────────────────────────────────────── */}
            {totalAlertas > 0 && (
              <div className="du-fade-1">
                <AlertStrip alertas={data.alertas} />
              </div>
            )}

            {/* ── Hero MRR ─────────────────────────────────────── */}
            <MrrTrendCard
              mrr={data.kpis.mrr}
              mrrDelta={data.kpis.mrr_delta}
              contratosAtivos={data.kpis.contratos_ativos}
              contratosMes={data.kpis.contratos_mes}
              AnimatedNumber={AnimatedNumber}
              fmt={fmt}
            />

            {/* ── KPIs Comercial ───────────────────────────────── */}
```

- [ ] **Step 3: Substituir a barra de proporção quente/morno/frio pelo TemperaturaGauge**

Localizar o bloco de "Proportion bar" (linhas 475-499, dentro do bloco "Pipeline de Propostas"):

```tsx
                  {/* Proportion bar */}
                  {(() => {
                    const total = data.pipeline_propostas.quente.count + data.pipeline_propostas.morno.count + data.pipeline_propostas.frio.count;
                    if (total === 0) return null;
                    const pctQ = Math.round((data.pipeline_propostas.quente.count / total) * 100);
                    const pctM = Math.round((data.pipeline_propostas.morno.count / total) * 100);
                    const pctF = 100 - pctQ - pctM;
                    return (
                      <div className="mt-4">
                        <div className="flex rounded-full overflow-hidden h-1.5 gap-px">
                          {pctQ > 0 && <div className="transition-all duration-700" style={{ width: `${pctQ}%`, background: '#dc2626' }} />}
                          {pctM > 0 && <div className="transition-all duration-700" style={{ width: `${pctM}%`, background: '#d97706' }} />}
                          {pctF > 0 && <div className="transition-all duration-700" style={{ width: `${pctF}%`, background: '#2563eb' }} />}
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                          {[{ c: '#dc2626', l: `Quente ${pctQ}%` }, { c: '#d97706', l: `Morno ${pctM}%` }, { c: '#2563eb', l: `Frio ${pctF}%` }].map(({ c, l }) => (
                            <div key={l} className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full" style={{ background: c }} />
                              <span className="text-[10px] font-medium" style={{ color: 'var(--t-text-muted)' }}>{l}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
```

Substituir por:

```tsx
                  {/* Distribuição por temperatura */}
                  <TemperaturaGauge
                    quente={data.pipeline_propostas.quente.count}
                    morno={data.pipeline_propostas.morno.count}
                    frio={data.pipeline_propostas.frio.count}
                  />
```

- [ ] **Step 4: Substituir o bloco "Pipeline por etapa" (barras horizontais) pelo PipelineFunnelChart**

Localizar o bloco completo (linhas 507-545):

```tsx
              {/* Pipeline por etapa */}
              <div className="ps-card rounded-xl p-5">
                <p className="text-xs font-semibold mb-4" style={{ color: 'var(--t-text-primary)' }}>Pipeline por Etapa</p>
                <div className="space-y-3.5">
                  {data.pipeline_funil.map((p, i) => {
                    const widthPct = maxPipelineVal > 0 ? (p.valor / maxPipelineVal) * 100 : 0;
                    const colors = ['#4B8EC8', '#2E6EAB', '#1A4E82', '#6366F1', '#8B5CF6', '#7C3AED'];
                    const color = colors[i % colors.length];
                    return (
                      <div key={p.etapa}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium" style={{ color: 'var(--t-text-primary)' }}>
                            {ETAPA_LABEL[p.etapa] || p.etapa}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold" style={{ color }}>{fmt(p.valor)}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: `${color}12`, color }}>
                              {p.count}
                            </span>
                          </div>
                        </div>
                        <div className="w-full rounded-full h-1.5" style={{ background: 'var(--t-card-border)' }}>
                          <div
                            className="h-1.5 rounded-full transition-all duration-700"
                            style={{
                              width: `${Math.max(widthPct, p.valor > 0 ? 3 : 0)}%`,
                              background: color,
                              transitionDelay: `${i * 60}ms`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {data.pipeline_funil.every(p => p.count === 0) && (
                    <p className="text-xs text-center py-6" style={{ color: 'var(--t-text-secondary)' }}>Nenhum lead ativo no funil</p>
                  )}
                </div>
              </div>
```

Substituir por:

```tsx
              {/* Pipeline por etapa */}
              <PipelineFunnelChart
                pipelineFunil={data.pipeline_funil}
                etapaLabel={ETAPA_LABEL}
                fmt={fmt}
              />
```

- [ ] **Step 5: Substituir a lista de motivos de perda pelo MotivosPerdaDonut**

Localizar o bloco (linhas 616-648, dentro da seção "Análise de Perdas"):

```tsx
                {data.ranking_motivos_perda?.length > 0 && (
                  <div className="ps-card rounded-xl p-5">
                    <p className="text-xs font-semibold mb-4" style={{ color: 'var(--t-text-primary)' }}>Principais motivos de perda</p>
                    <div className="space-y-3">
                      {data.ranking_motivos_perda.map((item, i) => (
                        <div key={item.motivo}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                                style={{ background: i === 0 ? '#dc2626' : i === 1 ? '#ef4444' : '#f87171' }}>
                                {i + 1}
                              </span>
                              <span className="text-xs font-medium truncate" style={{ color: 'var(--t-text-primary)' }}>{item.motivo}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                              <span className="text-xs font-semibold" style={{ color: '#dc2626' }}>{item.total}×</span>
                              <span className="text-xs" style={{ color: 'var(--t-text-secondary)' }}>{fmt(item.valor_total)}</span>
                              <span className="text-[10px] font-semibold px-1.5 py-px rounded" style={{ background: 'rgba(220,38,38,0.08)', color: '#b91c1c' }}>
                                {item.pct}%
                              </span>
                            </div>
                          </div>
                          <div className="w-full rounded-full h-1" style={{ background: 'rgba(220,38,38,0.08)' }}>
                            <div
                              className="h-1 rounded-full transition-all duration-700"
                              style={{ width: `${item.pct}%`, background: '#dc2626', transitionDelay: `${i * 80}ms` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
```

Substituir por:

```tsx
                <MotivosPerdaDonut motivos={data.ranking_motivos_perda} fmt={fmt} />
```

- [ ] **Step 6: Remover o card de MRR da seção "Financeiro, Contratos & Base"**

Localizar dentro do bloco "Financeiro & Base" (linhas 788-797):

```tsx
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <KpiCard
                          label="MRR Recorrente" value={fmt(data.kpis.mrr)} rawValue={data.kpis.mrr}
                          sub={`${data.kpis.contratos_ativos} contratos ativos`}
                          icon={DollarSign} delta={data.kpis.mrr_delta} accent="#16a34a" pulse={temMrr} animate
                        />
                        <KpiCard
                          label="Contratos Ativos" value={fmtNum(data.kpis.contratos_ativos)}
                          sub={`+${data.kpis.contratos_mes} este mês`} icon={FileCheck2} accent="#4B8EC8"
                        />
```

Substituir por (remove os cards de MRR e Contratos Ativos, que agora estão no topo — mantém NPS e Tickets num grid de 2 colunas em vez de 4):

```tsx
                      <div className="grid grid-cols-2 gap-3">
```

E ajustar o `temDados`/`temMrr` já calculado no início da IIFE (linha 755) — como o card de MRR não é mais renderizado aqui, `temMrr` continua útil só para o cálculo de `temDados`, então **não precisa remover essa linha**, apenas deixar de referenciar `temMrr`/`data.kpis.mrr`/`data.kpis.mrr_delta` nos JSX removidos acima (já feito no Step 6).

- [ ] **Step 7: Rodar o dev server e verificar visualmente**

Run: `cd frontend && npm run dev`

Abrir `http://localhost:3000/dashboard` no navegador (autenticado como gestor). Verificar:
- Card de MRR aparece no topo, com gráfico de área desenhando ao carregar.
- Funil de pipeline aparece com as barras coloridas afuniladas, tooltip ao passar o mouse.
- Gauge de temperatura aparece na seção de Pipeline de Propostas.
- Donut de motivos de perda aparece (se houver leads perdidos no mês), com hover na legenda destacando a fatia.
- Seção "Financeiro, Contratos & Base" não mostra mais o card de MRR duplicado.
- Trocar o filtro de vendedor recarrega os gráficos sem erro no console.

- [ ] **Step 8: Verificar compilação TypeScript completa**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -v "app/perdidos\|.next/dev"`
Expected: sem saída.

- [ ] **Step 9: Commit**

```bash
git add frontend/app/dashboard/page.tsx
git commit -m "feat: integra graficos Recharts no dashboard executivo, MRR em destaque no topo"
```

---

## Self-Review

**Spec coverage:**
- Hero de MRR com tendência → Task 2 + Task 6 Step 2. ✅
- Funil de pipeline visual → Task 3 + Task 6 Step 4. ✅
- Gauge de temperatura → Task 4 + Task 6 Step 3. ✅
- Donut de motivos de perda → Task 5 + Task 6 Step 5. ✅
- Tooltip customizado compartilhado → Task 1, consumido por Tasks 2-5. ✅
- MRR sai da seção colapsável, fica só no topo → Task 6 Step 6. ✅
- Nenhuma mudança de backend → confirmado, todas as tasks são frontend-only. ✅
- Paleta e variáveis de tema mantidas → todos os componentes usam `var(--t-*)` para texto/fundo e os hex já estabelecidos para acentos. ✅

**Placeholder scan:** nenhum "TBD"/"TODO" — todos os steps têm código completo.

**Type consistency:** `fmt: (v: number) => string`, `AnimatedNumber` como `React.ComponentType`, e os tipos de `pipeline_funil`/`ranking_motivos_perda`/`pipeline_propostas` usados nos componentes novos batem exatamente com os tipos já declarados em `DashboardPower` (`page.tsx:18-55`), verificados por leitura direta do arquivo antes de escrever o plano.
