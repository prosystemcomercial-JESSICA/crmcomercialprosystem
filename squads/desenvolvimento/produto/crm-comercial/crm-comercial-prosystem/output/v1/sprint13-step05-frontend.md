# Sprint 13 — Step 05 — Isabela Costa (Frontend)
# Ranking Comercial Avançado — Implementação UI

## Estrutura

```
src/app/(dashboard)/ranking/
  page.tsx                    # Redireciona por perfil
  _components/
    RankingTable.tsx          # Tabela principal + linha expandida
    PeriodoTabs.tsx           # Tabs: Mês atual / Mês anterior / Trimestre / Ano
    MetaProgress.tsx          # Barra de progresso de meta
    BadgeList.tsx             # Badges com tooltip
    Sparkline.tsx             # Gráfico linha 6 meses inline
  meu-desempenho/
    page.tsx                  # Visão do Vendedor
  metas/
    page.tsx                  # Configuração de metas

src/lib/api/ranking.ts
```

## src/lib/api/ranking.ts

```typescript
export const rankingApi = {
  getRanking: (periodo: string) =>
    fetch(`/api/ranking?periodo=${periodo}`).then(r => r.json()),

  getMeuDesempenho: () =>
    fetch('/api/ranking/meu-desempenho').then(r => r.json()),

  getMetas: (mes: number, ano: number) =>
    fetch(`/api/ranking/metas?mes=${mes}&ano=${ano}`).then(r => r.json()),

  salvarMetas: (mes: number, ano: number, metas: any[]) =>
    fetch('/api/ranking/metas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes, ano, metas }),
    }).then(r => r.json()),

  exportar: (periodo: string, fmt: 'csv' | 'pdf') => {
    window.open(`/api/ranking/export?periodo=${periodo}&fmt=${fmt}`, '_blank')
  },
}
```

## ranking/page.tsx — redirect por perfil

```tsx
'use client'
import { useAuth } from '@/hooks/useAuth'
import { redirect } from 'next/navigation'
import { RankingPage } from './_components/RankingPage'

export default function Page() {
  const { user } = useAuth()
  if (user?.perfil === 'VENDEDOR') redirect('/ranking/meu-desempenho')
  return <RankingPage />
}
```

## _components/RankingPage.tsx (Supervisão/CEO)

```tsx
'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { rankingApi } from '@/lib/api/ranking'
import { PeriodoTabs } from './PeriodoTabs'
import { RankingTable } from './RankingTable'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Download } from 'lucide-react'
import Link from 'next/link'
import { usePermission } from '@/hooks/usePermission'

export function RankingPage() {
  const [periodo, setPeriodo] = useState('mes-atual')
  const { can } = usePermission()

  const { data, isLoading } = useQuery({
    queryKey: ['ranking', periodo],
    queryFn: () => rankingApi.getRanking(periodo),
    staleTime: 60_000,
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ranking Comercial</h1>
          <p className="text-muted-foreground text-sm">Desempenho comparativo do time de vendas</p>
        </div>
        <div className="flex gap-2">
          {can('gerenciarUsuarios') && (
            <Button variant="outline" asChild>
              <Link href="/ranking/metas">Configurar metas</Link>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><Download className="w-4 h-4 mr-2" />Exportar</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => rankingApi.exportar(periodo, 'csv')}>CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => rankingApi.exportar(periodo, 'pdf')}>PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <PeriodoTabs value={periodo} onChange={setPeriodo} />

      {isLoading ? (
        <p className="text-muted-foreground py-8 text-center">Carregando ranking...</p>
      ) : (
        <RankingTable rows={data?.ranking ?? []} />
      )}
    </div>
  )
}
```

## _components/PeriodoTabs.tsx

```tsx
import { cn } from '@/lib/utils'

const PERIODOS = [
  { value: 'mes-atual',    label: 'Mês atual'     },
  { value: 'mes-anterior', label: 'Mês anterior'  },
  { value: 'trimestre',    label: 'Trimestre'      },
  { value: 'ano',          label: 'Ano'            },
]

export function PeriodoTabs({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-lg border p-1 bg-muted">
      {PERIODOS.map(p => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={cn(
            'px-4 py-1.5 text-sm rounded-md transition-colors',
            value === p.value
              ? 'bg-background shadow-sm font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
```

## _components/RankingTable.tsx

```tsx
'use client'
import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, TrendingUp, TrendingDown } from 'lucide-react'
import { MetaProgress } from './MetaProgress'
import { BadgeList } from './BadgeList'
import { Sparkline } from './Sparkline'
import { useQuery } from '@tanstack/react-query'
import { rankingApi } from '@/lib/api/ranking'
import { cn } from '@/lib/utils'

type SortKey = 'mrr' | 'fechamentos' | 'propostas' | 'taxaConversao' | 'abordados'

export function RankingTable({ rows }: { rows: any[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('mrr')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expanded, setExpanded] = useState<string | null>(null)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...rows].sort((a, b) => {
    const d = a[sortKey] < b[sortKey] ? -1 : a[sortKey] > b[sortKey] ? 1 : 0
    return sortDir === 'asc' ? d : -d
  }).map((r, i) => ({ ...r, posicao: i + 1 }))

  function SortHeader({ k, label }: { k: SortKey; label: string }) {
    const Icon = sortKey === k ? (sortDir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown
    return (
      <th
        className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground"
        onClick={() => toggleSort(k)}
      >
        <span className="flex items-center gap-1">{label}<Icon className="w-3 h-3" /></span>
      </th>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground w-12">#</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Vendedor</th>
            <SortHeader k="mrr"          label="MRR Fechado"   />
            <SortHeader k="fechamentos"  label="Fechamentos"   />
            <SortHeader k="propostas"    label="Propostas"     />
            <SortHeader k="taxaConversao" label="Conversão"    />
            <SortHeader k="abordados"    label="Abordados"     />
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map(row => (
            <>
              <tr
                key={row.vendedorId}
                className="hover:bg-muted/40 cursor-pointer"
                onClick={() => setExpanded(expanded === row.vendedorId ? null : row.vendedorId)}
              >
                <td className="px-4 py-3 text-sm font-bold">
                  {row.posicao === 1 ? '🥇' : row.posicao === 2 ? '🥈' : row.posicao === 3 ? '🥉' : row.posicao}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-sm">{row.nome}</div>
                  <BadgeList badges={row.badges} compact />
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="font-semibold">R$ {row.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</div>
                  <VariacaoChip pct={row.variacaoMrr} />
                </td>
                <td className="px-4 py-3 text-sm font-medium">{row.fechamentos}</td>
                <td className="px-4 py-3 text-sm">{row.propostas}</td>
                <td className="px-4 py-3 text-sm">{row.taxaConversao.toFixed(1)}%</td>
                <td className="px-4 py-3 text-sm">{row.abordados}</td>
              </tr>

              {expanded === row.vendedorId && (
                <tr key={`${row.vendedorId}-expanded`}>
                  <td colSpan={7} className="bg-muted/20 px-6 py-4">
                    <ExpandedRow row={row} />
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function VariacaoChip({ pct }: { pct: number }) {
  if (pct === 0) return null
  const pos = pct > 0
  return (
    <span className={cn('text-xs flex items-center gap-0.5', pos ? 'text-green-600' : 'text-red-500')}>
      {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {pos ? '+' : ''}{pct.toFixed(1)}% vs mês ant.
    </span>
  )
}

function ExpandedRow({ row }: { row: any }) {
  const { data: historico } = useQuery({
    queryKey: ['ranking-historico', row.vendedorId],
    queryFn: () => fetch(`/api/ranking/${row.vendedorId}/historico`).then(r => r.json()),
    staleTime: 300_000,
  })

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-3">
        <BadgeList badges={row.badges} />
        {row.metas ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Metas do mês</p>
            <MetaProgress label="Fechamentos" atual={row.fechamentos} meta={row.metas.fechamentos} />
            <MetaProgress label="MRR"         atual={row.mrr}          meta={row.metas.mrr} prefixo="R$" />
            <MetaProgress label="Propostas"   atual={row.propostas}    meta={row.metas.propostas} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">Meta não configurada para este mês</p>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">MRR — últimos 6 meses</p>
        {historico && <Sparkline data={historico.map((h: any) => h.mrr)} />}
      </div>
    </div>
  )
}
```

## _components/MetaProgress.tsx

```tsx
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

export function MetaProgress({
  label, atual, meta, prefixo = '',
}: { label: string; atual: number; meta: number; prefixo?: string }) {
  const pct = meta > 0 ? Math.min(Math.round((atual / meta) * 100), 100) : 0
  const over = meta > 0 && atual >= meta

  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('font-medium', over ? 'text-green-600' : '')}>
          {prefixo}{atual.toLocaleString('pt-BR')} / {prefixo}{meta.toLocaleString('pt-BR')} — {pct}%{over && ' ✓'}
        </span>
      </div>
      <Progress value={pct} className={cn('h-2', over && '[&>div]:bg-green-500')} />
    </div>
  )
}
```

## _components/BadgeList.tsx

```tsx
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const BADGE_META: Record<string, { emoji: string; label: string; desc: string }> = {
  'campiao':    { emoji: '🥇', label: 'Campeão do Mês',  desc: '1º lugar em MRR no mês' },
  'meta-batida':{ emoji: '🎯', label: 'Meta Batida',      desc: 'Atingiu 100% da meta de fechamentos' },
  'maior-deal': { emoji: '💎', label: 'Maior Deal',       desc: 'Lead fechado com maior potencial do mês' },
  'em-chamas':  { emoji: '🔥', label: 'Em Chamas',        desc: '3+ fechamentos na última semana' },
  'crescimento':{ emoji: '📈', label: 'Crescimento',      desc: 'MRR maior que o mês anterior' },
}

export function BadgeList({ badges, compact }: { badges: string[]; compact?: boolean }) {
  if (badges.length === 0) return null

  return (
    <div className="flex gap-1 flex-wrap">
      {badges.map(b => {
        const meta = BADGE_META[b]
        if (!meta) return null
        return (
          <Tooltip key={b}>
            <TooltipTrigger asChild>
              <span className="text-base cursor-default select-none">{meta.emoji}</span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-semibold text-xs">{meta.label}</p>
              <p className="text-xs text-muted-foreground">{meta.desc}</p>
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
```

## _components/Sparkline.tsx

```tsx
'use client'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'

export function Sparkline({ data }: { data: number[] }) {
  const chartData = data.map((v, i) => ({ i, v }))
  const trend = data[data.length - 1] >= data[0]

  return (
    <ResponsiveContainer width="100%" height={60}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={trend ? '#16a34a' : '#dc2626'}
          strokeWidth={2}
          dot={false}
        />
        <Tooltip
          formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR')}`, 'MRR']}
          labelFormatter={() => ''}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

## meu-desempenho/page.tsx (Vendedor)

```tsx
'use client'
import { useQuery } from '@tanstack/react-query'
import { rankingApi } from '@/lib/api/ranking'
import { Card } from '@/components/ui/card'
import { MetaProgress } from '../_components/MetaProgress'
import { BadgeList } from '../_components/BadgeList'
import { Sparkline } from '../_components/Sparkline'
import { format } from 'date-fns'; import { ptBR } from 'date-fns/locale'

export default function MeuDesempenhoPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['meu-desempenho'],
    queryFn: rankingApi.getMeuDesempenho,
    staleTime: 60_000,
  })

  if (isLoading) return <p className="p-6 text-muted-foreground">Carregando...</p>

  const mesAtual = format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })
  const posLabel = data?.posicao === 1 ? '🥇 1º' : data?.posicao === 2 ? '🥈 2º' : `${data?.posicao}º`

  return (
    <div className="p-6 space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold">Meu Desempenho — {mesAtual}</h1>

      <Card className="p-4 flex items-center gap-4">
        <div className="text-4xl font-bold text-primary">{posLabel}</div>
        <div>
          <p className="text-sm text-muted-foreground">no time ({data?.totalNoTime} vendedores)</p>
          <BadgeList badges={data?.badges ?? []} />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <p className="text-sm font-semibold">Metas do mês</p>
        {data?.metas ? (
          <>
            <MetaProgress label="Fechamentos" atual={data.fechamentos} meta={data.metas.fechamentos} />
            <MetaProgress label="MRR"         atual={data.mrr}          meta={data.metas.mrr} prefixo="R$" />
            <MetaProgress label="Propostas"   atual={data.propostas}    meta={data.metas.propostas} />
            <MetaProgress label="Abordados"   atual={data.abordados}    meta={data.metas.abordados} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground italic">Meta não configurada para este mês.</p>
        )}
      </Card>

      <Card className="p-4 space-y-2">
        <p className="text-sm font-semibold">MRR — últimos 6 meses</p>
        {data?.historico && <Sparkline data={data.historico.map((h: any) => h.mrr)} />}
        <div className="flex justify-between text-xs text-muted-foreground px-1">
          {data?.historico?.map((h: any, i: number) => (
            <span key={i}>{String(h.mes).padStart(2,'0')}/{String(h.ano).slice(-2)}</span>
          ))}
        </div>
      </Card>
    </div>
  )
}
```

## metas/page.tsx (Configuração de metas)

```tsx
'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rankingApi } from '@/lib/api/ranking'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'; import { ptBR } from 'date-fns/locale'

export default function MetasPage() {
  const hoje   = new Date()
  const [mes,  setMes]  = useState(hoje.getMonth() + 1)
  const [ano,  setAno]  = useState(hoje.getFullYear())
  const [form, setForm] = useState<any[]>([])
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['metas', mes, ano],
    queryFn: () => rankingApi.getMetas(mes, ano),
  })

  useEffect(() => { if (data?.metas) setForm(data.metas) }, [data])

  const mutation = useMutation({
    mutationFn: () => rankingApi.salvarMetas(mes, ano, form),
    onSuccess: () => {
      toast.success('Metas salvas!')
      qc.invalidateQueries({ queryKey: ['ranking'] })
    },
  })

  function navMes(delta: number) {
    const d = new Date(ano, mes - 1 + delta)
    setMes(d.getMonth() + 1)
    setAno(d.getFullYear())
  }

  function setField(vendedorId: string, campo: string, valor: string) {
    setForm(prev => prev.map(m =>
      m.vendedorId === vendedorId ? { ...m, [campo]: Number(valor) || 0 } : m
    ))
  }

  const mesLabel = format(new Date(ano, mes - 1), "MMMM 'de' yyyy", { locale: ptBR })

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <h1 className="text-2xl font-bold">Configurar Metas</h1>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navMes(-1)}><ChevronLeft /></Button>
        <span className="font-semibold capitalize w-40 text-center">{mesLabel}</span>
        <Button variant="ghost" size="icon" onClick={() => navMes(1)}><ChevronRight /></Button>
      </div>

      {isLoading ? <p className="text-muted-foreground">Carregando...</p> : (
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                {['Vendedor', 'Fechamentos', 'MRR (R$)', 'Propostas', 'Abordados'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {form.map(m => (
                <tr key={m.vendedorId}>
                  <td className="px-4 py-3 text-sm font-medium">{m.nome}</td>
                  {(['fechamentos', 'mrr', 'propostas', 'abordados'] as const).map(campo => (
                    <td key={campo} className="px-4 py-2">
                      <Input
                        type="number"
                        min={0}
                        value={m[campo]}
                        onChange={e => setField(m.vendedorId, campo, e.target.value)}
                        className="h-8 w-28 text-sm"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t flex justify-end">
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : 'Salvar metas'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
```
