# Sprint 14 — Step 05 — Isabela Costa (Frontend)
# Previsão de Fechamento — Implementação UI

## Estrutura

```
src/app/(dashboard)/forecast/
  page.tsx                    # Tela principal
  configuracoes/
    page.tsx                  # Configurar probabilidades
  _components/
    ForecastCards.tsx         # 3 cards de mês
    ForecastChart.tsx         # BarChart empilhado
    ForecastByVendedor.tsx    # Tabela por vendedor
    PipelineTable.tsx         # Leads do pipeline

src/lib/api/forecast.ts
```

## src/lib/api/forecast.ts

```typescript
export const forecastApi = {
  getForecast: () => fetch('/api/forecast').then(r => r.json()),
  getPipeline: (mes: number, ano: number) =>
    fetch(`/api/forecast/pipeline?mes=${mes}&ano=${ano}`).then(r => r.json()),
  getProbabilidades: () => fetch('/api/forecast/probabilidades').then(r => r.json()),
  salvarProbabilidades: (probabilidades: any[]) =>
    fetch('/api/forecast/probabilidades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ probabilidades }),
    }).then(r => r.json()),
  exportar: (fmt: 'csv' | 'pdf') => window.open(`/api/forecast/export?fmt=${fmt}`, '_blank'),
}
```

## forecast/page.tsx

```tsx
'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { forecastApi } from '@/lib/api/forecast'
import { ForecastCards } from './_components/ForecastCards'
import { ForecastChart } from './_components/ForecastChart'
import { ForecastByVendedor } from './_components/ForecastByVendedor'
import { PipelineTable } from './_components/PipelineTable'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Settings, Download } from 'lucide-react'
import Link from 'next/link'

export default function ForecastPage() {
  const [mesSelecionado, setMesSelecionado] = useState(0) // índice 0,1,2

  const { data: forecast, isLoading } = useQuery({
    queryKey: ['forecast'],
    queryFn: forecastApi.getForecast,
    staleTime: 60_000,
  })

  const mesAtual = forecast?.[mesSelecionado]

  const { data: pipeline } = useQuery({
    queryKey: ['forecast-pipeline', mesAtual?.mes, mesAtual?.ano],
    queryFn: () => forecastApi.getPipeline(mesAtual!.mes, mesAtual!.ano),
    enabled: !!mesAtual,
    staleTime: 60_000,
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Previsão de Fechamento</h1>
          <p className="text-muted-foreground text-sm">Forecast de MRR com base no funil atual</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" asChild title="Configurar probabilidades">
            <Link href="/forecast/configuracoes"><Settings className="w-4 h-4" /></Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><Download className="w-4 h-4 mr-2" />Exportar</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => forecastApi.exportar('csv')}>CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => forecastApi.exportar('pdf')}>PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Calculando previsão...</p>
      ) : forecast ? (
        <>
          <ForecastCards
            meses={forecast}
            selecionado={mesSelecionado}
            onSelect={setMesSelecionado}
          />
          <ForecastChart meses={forecast} />
          <ForecastByVendedor mes={mesAtual!} />
          <PipelineTable leads={pipeline ?? []} mes={mesAtual!} />
        </>
      ) : null}
    </div>
  )
}
```

## _components/ForecastCards.tsx

```tsx
import { cn } from '@/lib/utils'
import { format } from 'date-fns'; import { ptBR } from 'date-fns/locale'

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

export function ForecastCards({
  meses, selecionado, onSelect,
}: { meses: any[]; selecionado: number; onSelect: (i: number) => void }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {meses.map((m, i) => {
        const label = format(new Date(m.ano, m.mes - 1), "MMMM/yy", { locale: ptBR })
        const isSelected = selecionado === i
        return (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={cn(
              'border rounded-xl p-4 text-left space-y-3 transition-all',
              isSelected ? 'border-primary shadow-md bg-primary/5' : 'hover:border-primary/40'
            )}
          >
            <p className="text-sm font-semibold capitalize text-muted-foreground">{label}</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-green-600 flex items-center gap-1">✅ Fechado</span>
                <span className="font-bold text-green-700">{fmt(m.fechado)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-600 flex items-center gap-1">📊 Provável</span>
                <span className="font-semibold">{fmt(m.provavel)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">📈 Otimista</span>
                <span className="text-muted-foreground">{fmt(m.otimista)}</span>
              </div>
              {m.metaMrr > 0 && (
                <div className="pt-1 border-t flex justify-between text-xs text-muted-foreground">
                  <span>Meta</span>
                  <span>{fmt(m.metaMrr)}</span>
                </div>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
```

## _components/ForecastChart.tsx

```tsx
'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'; import { ptBR } from 'date-fns/locale'

function fmtBRL(v: number) {
  return `R$ ${(v / 1000).toFixed(1)}k`
}

export function ForecastChart({ meses }: { meses: any[] }) {
  const data = meses.map(m => ({
    name: format(new Date(m.ano, m.mes - 1), 'MMM/yy', { locale: ptBR }),
    fechado: m.fechado,
    provavel: m.provavel,
    gap: m.metaMrr > 0 ? Math.max(0, m.metaMrr - m.fechado - m.provavel) : 0,
    metaMrr: m.metaMrr,
  }))

  const maxMeta = Math.max(...data.map(d => d.metaMrr), 0)

  return (
    <div>
      <p className="text-sm font-semibold mb-3">Evolução do Forecast</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barSize={48}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={fmtBRL} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number, name: string) => {
            const labels: Record<string, string> = { fechado: 'Fechado', provavel: 'Provável', gap: 'Gap até meta' }
            return [`R$ ${v.toLocaleString('pt-BR')}`, labels[name] ?? name]
          }} />
          <Legend formatter={v => ({ fechado: 'Fechado', provavel: 'Provável', gap: 'Gap até meta' }[v] ?? v)} />
          <Bar dataKey="fechado"  stackId="a" fill="#1d4ed8" radius={[0,0,0,0]} />
          <Bar dataKey="provavel" stackId="a" fill="#93c5fd" radius={[0,0,0,0]} />
          <Bar dataKey="gap"      stackId="a" fill="#e5e7eb" radius={[4,4,0,0]} />
          {maxMeta > 0 && <ReferenceLine y={maxMeta} stroke="#f59e0b" strokeDasharray="6 3" label={{ value: 'Meta', position: 'insideTopRight', fontSize: 11 }} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

## _components/ForecastByVendedor.tsx

```tsx
function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

export function ForecastByVendedor({ mes }: { mes: any }) {
  if (!mes?.porVendedor?.length) return null

  return (
    <div>
      <p className="text-sm font-semibold mb-2">Por Vendedor</p>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              {['Vendedor', 'Fechado', 'Provável', 'Otimista'].map(h => (
                <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {mes.porVendedor.map((v: any) => (
              <tr key={v.vendedorId}>
                <td className="px-4 py-2 text-sm font-medium">{v.nome}</td>
                <td className="px-4 py-2 text-sm text-green-600">{fmt(v.fechado)}</td>
                <td className="px-4 py-2 text-sm">{fmt(v.provavel)}</td>
                <td className="px-4 py-2 text-sm text-muted-foreground">{fmt(v.otimista)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

## _components/PipelineTable.tsx

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const ETAPA_LABEL: Record<string, string> = {
  'primeiro-contato':      'Primeiro Contato',
  'qualificacao':          'Qualificação',
  'apresentacao-agendada': 'Apresentação Agendada',
  'proposta-enviada':      'Proposta Enviada',
  'negociacao':            'Negociação',
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export function PipelineTable({ leads, mes }: { leads: any[]; mes: any }) {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const PER_PAGE = 10
  const totalPages = Math.ceil(leads.length / PER_PAGE)
  const visible = leads.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  if (!leads.length) return (
    <div>
      <p className="text-sm font-semibold mb-2">Pipeline — {mes.mes}/{mes.ano}</p>
      <p className="text-muted-foreground text-sm py-6 text-center">Nenhum lead no pipeline para este período.</p>
    </div>
  )

  return (
    <div>
      <p className="text-sm font-semibold mb-2">Pipeline — {mes.mes}/{mes.ano} ({leads.length} leads)</p>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              {['Lead', 'Etapa', 'Vendedor', 'Potencial', 'Prob.', 'Valor Pond.'].map(h => (
                <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((l: any) => (
              <tr
                key={l.id}
                className="hover:bg-muted/40 cursor-pointer"
                onClick={() => router.push(`/leads/${l.id}`)}
              >
                <td className="px-4 py-2 text-sm font-medium">{l.nomeEmpresa}</td>
                <td className="px-4 py-2">
                  <Badge variant="outline" className="text-xs">{ETAPA_LABEL[l.etapaFunil] ?? l.etapaFunil}</Badge>
                </td>
                <td className="px-4 py-2 text-sm text-muted-foreground">{l.vendedorNome}</td>
                <td className="px-4 py-2 text-sm">{fmt(l.potencialMensalidade)}</td>
                <td className="px-4 py-2 text-sm">{(l.probabilidade * 100).toFixed(0)}%</td>
                <td className="px-4 py-2 text-sm font-semibold text-blue-700">{fmt(l.valorPonderado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="px-4 py-2 border-t flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>›</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

## forecast/configuracoes/page.tsx

```tsx
'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { forecastApi } from '@/lib/api/forecast'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

const ETAPA_LABEL: Record<string, string> = {
  'primeiro-contato':      'Primeiro Contato',
  'qualificacao':          'Qualificação',
  'apresentacao-agendada': 'Apresentação Agendada',
  'proposta-enviada':      'Proposta Enviada',
  'negociacao':            'Negociação',
}

export default function ForecastConfigPage() {
  const [form, setForm] = useState<Array<{ etapa: string; probabilidade: number }>>([])
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['forecast-probs'],
    queryFn: forecastApi.getProbabilidades,
  })

  useEffect(() => { if (data) setForm(data) }, [data])

  const mutation = useMutation({
    mutationFn: () => forecastApi.salvarProbabilidades(form),
    onSuccess: () => {
      toast.success('Probabilidades salvas!')
      qc.invalidateQueries({ queryKey: ['forecast'] })
    },
  })

  function setProb(etapa: string, valor: string) {
    const num = Math.min(100, Math.max(0, Number(valor) || 0)) / 100
    setForm(prev => prev.map(p => p.etapa === etapa ? { ...p, probabilidade: num } : p))
  }

  return (
    <div className="p-6 max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Probabilidades por Etapa</h1>
      <p className="text-sm text-muted-foreground">Define o peso de cada etapa no cálculo do MRR Provável.</p>

      {isLoading ? <p className="text-muted-foreground">Carregando...</p> : (
        <Card className="divide-y">
          {form.map(p => (
            <div key={p.etapa} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm">{ETAPA_LABEL[p.etapa] ?? p.etapa}</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={Math.round(p.probabilidade * 100)}
                  onChange={e => setProb(p.etapa, e.target.value)}
                  className="h-8 w-20 text-sm text-right"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          ))}
          <div className="px-4 py-3 flex items-center gap-3">
            <p className="text-xs text-muted-foreground">
              ⚠ Leads nas etapas Fechado e Perdido não entram no forecast.
            </p>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} size="sm" className="ml-auto">
              {mutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
```
