# Sprint 21 — Step 05 — Isabela Costa (Frontend)
# BI Avançado — UI

## Estrutura de arquivos

```
src/
  app/(dashboard)/bi/
    page.tsx                         ← roteador de abas com filtros globais
    _components/
      FiltrosGlobais.tsx             ← período + vendedor
      KpiCards.tsx                   ← 6 cards com delta
      FunilChart.tsx                 ← BarChart horizontal Recharts
      CohortTabela.tsx               ← tabela heatmap
      PerdasCharts.tsx               ← PieChart + BarChart concorrentes
      OrigensTabela.tsx              ← tabela sortable
      ExportarModal.tsx              ← modal xlsx/pdf
  lib/api/bi.ts                      ← fetch helpers
```

## src/lib/api/bi.ts

```typescript
import { apiFetch } from './client'

export interface KpiCard {
  label: string
  valor: number
  delta: number
  tipo: 'numero' | 'moeda' | 'percentual'
}

export interface EtapaFunil {
  etapa: string
  total: number
  conversaoProximaEtapa: number | null
}

export interface LinhaCohort {
  mes: string
  leadsCriados: number
  pctProposta: number
  pctFechado: number
  pctContrato: number
}

export interface AnalisePerdas {
  porMotivo:      { nome: string; total: number }[]
  porEtapa:       { nome: string; total: number }[]
  porConcorrente: { nome: string; total: number }[]
}

export interface LinhaOrigem {
  origem: string
  total: number
  convertidos: number
  taxaConversao: number
  receitaGerada: number
}

function qs(params: object) {
  return new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
  ).toString()
}

export const biApi = {
  kpis:    (p: object): Promise<KpiCard[]>     => apiFetch(`/bi/kpis?${qs(p)}`),
  funil:   (p: object): Promise<EtapaFunil[]>  => apiFetch(`/bi/funil?${qs(p)}`),
  cohort:  (meses = 6): Promise<LinhaCohort[]> => apiFetch(`/bi/cohort?meses=${meses}`),
  perdas:  (p: object): Promise<AnalisePerdas> => apiFetch(`/bi/perdas?${qs(p)}`),
  origens: (p: object): Promise<LinhaOrigem[]> => apiFetch(`/bi/origens?${qs(p)}`),
  exportarXlsx: (secao: string, p: object) =>
    `${process.env.NEXT_PUBLIC_API_URL}/bi/exportar?secao=${secao}&formato=xlsx&${qs(p)}`,
}
```

## src/app/(dashboard)/bi/_components/KpiCards.tsx

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { biApi, KpiCard } from '@/lib/api/bi'
import { TrendingUp, TrendingDown } from 'lucide-react'

function formatValor(card: KpiCard): string {
  if (card.tipo === 'moeda')
    return card.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
  if (card.tipo === 'percentual')
    return `${card.valor.toFixed(1)}%`
  return card.valor.toLocaleString('pt-BR')
}

function DeltaBadge({ delta, tipo }: { delta: number; tipo: string }) {
  const positivo = delta >= 0
  const label = tipo === 'percentual'
    ? `${positivo ? '+' : ''}${delta.toFixed(1)}pp`
    : `${positivo ? '+' : ''}${delta.toFixed(0)}%`

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${positivo ? 'text-green-600' : 'text-red-600'}`}>
      {positivo ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {label}
    </span>
  )
}

export function KpiCards({ filtros }: { filtros: object }) {
  const { data: kpis = [], isLoading } = useQuery({
    queryKey: ['bi-kpis', filtros],
    queryFn: () => biApi.kpis(filtros),
    staleTime: 300_000,
  })

  if (isLoading) return <div className="grid grid-cols-3 gap-4">{[...Array(6)].map((_, i) => (
    <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
  ))}</div>

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {kpis.map((card) => (
        <div key={card.label} className="rounded-lg border border-border p-4 space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{card.label}</p>
          <p className="text-2xl font-bold">{formatValor(card)}</p>
          <DeltaBadge delta={card.delta} tipo={card.tipo} />
          <p className="text-xs text-muted-foreground">vs mês anterior</p>
        </div>
      ))}
    </div>
  )
}
```

## src/app/(dashboard)/bi/_components/FunilChart.tsx

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, LabelList } from 'recharts'
import { biApi } from '@/lib/api/bi'

const CORES = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7']

const LABEL_ETAPA: Record<string, string> = {
  qualificacao: 'Qualificação',
  proposta:     'Proposta',
  negociacao:   'Negociação',
  fechado:      'Fechado',
}

export function FunilChart({ filtros }: { filtros: object }) {
  const { data: etapas = [] } = useQuery({
    queryKey: ['bi-funil', filtros],
    queryFn: () => biApi.funil(filtros),
    staleTime: 300_000,
  })

  const dados = etapas.map((e, i) => ({
    ...e,
    etapaLabel: LABEL_ETAPA[e.etapa] ?? e.etapa,
    fill: CORES[i % CORES.length],
  }))

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={dados} layout="vertical" margin={{ left: 16, right: 60 }}>
          <XAxis type="number" hide />
          <YAxis dataKey="etapaLabel" type="category" width={100} tick={{ fontSize: 13 }} />
          <Tooltip formatter={(v: any) => [`${v} leads`, 'Total']} />
          <Bar dataKey="total" radius={[0, 4, 4, 0]}>
            {dados.map((e, i) => <Cell key={i} fill={e.fill} />)}
            <LabelList dataKey="total" position="right" style={{ fontSize: 13, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Percentuais entre etapas */}
      <div className="flex flex-col gap-1 pl-[116px]">
        {etapas.map((e, i) =>
          e.conversaoProximaEtapa !== null ? (
            <p key={i} className="text-xs text-muted-foreground">
              ↓ {e.conversaoProximaEtapa}% avançaram para {LABEL_ETAPA[etapas[i + 1]?.etapa] ?? ''}
            </p>
          ) : null
        )}
      </div>

      <p className="text-xs text-muted-foreground text-right">
        Taxa total: {etapas[0]?.total > 0 && etapas[etapas.length - 1]?.total > 0
          ? `${((etapas[etapas.length - 1].total / etapas[0].total) * 100).toFixed(1)}%`
          : '—'}
      </p>
    </div>
  )
}
```

## src/app/(dashboard)/bi/_components/CohortTabela.tsx

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { biApi, LinhaCohort } from '@/lib/api/bi'

function heatmapCor(pct: number): string {
  if (pct >= 50) return 'bg-green-100 text-green-800'
  if (pct >= 25) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
}

export function CohortTabela() {
  const { data: rows = [] } = useQuery({
    queryKey: ['bi-cohort'],
    queryFn: () => biApi.cohort(6),
    staleTime: 300_000,
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left">
            <th className="p-2 border border-border bg-muted">Mês</th>
            <th className="p-2 border border-border bg-muted">Leads</th>
            <th className="p-2 border border-border bg-muted">→ Proposta</th>
            <th className="p-2 border border-border bg-muted">→ Fechado</th>
            <th className="p-2 border border-border bg-muted">→ Contrato</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.mes}>
              <td className="p-2 border border-border font-medium">{r.mes}</td>
              <td className="p-2 border border-border text-center">{r.leadsCriados}</td>
              <td className={`p-2 border border-border text-center ${heatmapCor(r.pctProposta)}`}>{r.pctProposta}%</td>
              <td className={`p-2 border border-border text-center ${heatmapCor(r.pctFechado)}`}>{r.pctFechado}%</td>
              <td className={`p-2 border border-border text-center ${heatmapCor(r.pctContrato)}`}>{r.pctContrato}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground mt-2">🟢 ≥50% · 🟡 25–49% · 🔴 &lt;25%</p>
    </div>
  )
}
```

## src/app/(dashboard)/bi/_components/PerdasCharts.tsx

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { biApi } from '@/lib/api/bi'

const CORES_PIE = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899']

function DonutCard({ titulo, dados }: { titulo: string; dados: { nome: string; total: number }[] }) {
  const total = dados.reduce((s, d) => s + d.total, 0)
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{titulo}</p>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie data={dados} dataKey="total" nameKey="nome" innerRadius={40} outerRadius={70}>
            {dados.map((_, i) => <Cell key={i} fill={CORES_PIE[i % CORES_PIE.length]} />)}
          </Pie>
          <Tooltip formatter={(v: any) => [`${v} (${Math.round((v/total)*100)}%)`, '']} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PerdasCharts({ filtros }: { filtros: object }) {
  const { data } = useQuery({
    queryKey: ['bi-perdas', filtros],
    queryFn: () => biApi.perdas(filtros),
    staleTime: 300_000,
  })
  if (!data) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <DonutCard titulo="Motivo de perda" dados={data.porMotivo} />
      <DonutCard titulo="Etapa de perda"  dados={data.porEtapa} />
      <div className="space-y-2">
        <p className="text-sm font-semibold">Concorrentes</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data.porConcorrente} layout="vertical">
            <XAxis type="number" hide />
            <YAxis dataKey="nome" type="category" width={90} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="total" fill="#6366f1" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

## src/app/(dashboard)/bi/page.tsx

```tsx
'use client'

import { useState } from 'react'
import { usePermission } from '@/hooks/usePermission'
import { redirect } from 'next/navigation'
import { FiltrosGlobais } from './_components/FiltrosGlobais'
import { KpiCards }       from './_components/KpiCards'
import { FunilChart }     from './_components/FunilChart'
import { CohortTabela }   from './_components/CohortTabela'
import { PerdasCharts }   from './_components/PerdasCharts'
import { OrigensTabela }  from './_components/OrigensTabela'
import { ExportarModal }  from './_components/ExportarModal'
import { Button }         from '@/components/ui/button'
import { Download }       from 'lucide-react'

type Aba = 'kpis' | 'funil' | 'cohort' | 'perdas' | 'origens'
const ABAS: { id: Aba; label: string }[] = [
  { id: 'kpis',    label: 'KPIs' },
  { id: 'funil',   label: 'Funil' },
  { id: 'cohort',  label: 'Cohort' },
  { id: 'perdas',  label: 'Perdas' },
  { id: 'origens', label: 'Origens' },
]

export default function BiPage() {
  const { can } = usePermission()
  if (!can('verBI')) redirect('/')

  const agora = new Date()
  const [aba, setAba] = useState<Aba>('kpis')
  const [exportarAberto, setExportarAberto] = useState(false)
  const [filtros, setFiltros] = useState({
    inicio:     new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString().slice(0, 10),
    fim:        new Date(agora.getFullYear(), agora.getMonth() + 1, 0).toISOString().slice(0, 10),
    vendedorId: undefined as string | undefined,
  })

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">BI Avançado</h1>
        <Button variant="outline" size="sm" onClick={() => setExportarAberto(true)}>
          <Download className="h-4 w-4 mr-1" /> Exportar
        </Button>
      </div>

      <FiltrosGlobais filtros={filtros} onChange={setFiltros} />

      {/* Abas */}
      <div className="flex gap-1 border-b border-border">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors
              ${aba === a.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Conteúdo da aba */}
      <div>
        {aba === 'kpis'    && <KpiCards filtros={filtros} />}
        {aba === 'funil'   && <FunilChart filtros={filtros} />}
        {aba === 'cohort'  && <CohortTabela />}
        {aba === 'perdas'  && <PerdasCharts filtros={filtros} />}
        {aba === 'origens' && <OrigensTabela filtros={filtros} />}
      </div>

      <ExportarModal
        open={exportarAberto}
        onClose={() => setExportarAberto(false)}
        secao={aba}
        filtros={filtros}
      />
    </div>
  )
}
```

## Atualizar usePermission

```typescript
// src/hooks/usePermission.ts:
verBI: ['SUPERVISAO', 'CEO', 'ADMIN'],
```

## Adicionar ao Sidebar

```tsx
{ href: '/bi', label: 'BI Avançado', icon: <BarChart2 className="h-4 w-4" /> }
// Ocultar se !can('verBI')
```
