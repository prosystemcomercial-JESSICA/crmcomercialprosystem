# Sprint 25 — Step 05 — Isabela Costa (Frontend Developer)
# Metas e Comissões Avançado — Pages e Components

---

## Estrutura de arquivos

```
src/app/(dashboard)/metas-comissoes/
  dashboard/          page.tsx    ← detecta role e renderiza componente correto
  ranking/            page.tsx
  fechamento-mensal/  page.tsx
  relatorios/         page.tsx

src/components/metas-comissoes/
  DashboardVendedor.tsx
  DashboardSupervisor.tsx
  KpiCard.tsx
  RankingTable.tsx
  FechamentoDrawer.tsx
  RelatoriosMCPage.tsx   (componente interno)
```

---

## KpiCard.tsx

```tsx
interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: { valor: number; label: string }
  icon?: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger'
  progress?: number
}

export function KpiCard({ title, value, subtitle, trend, icon, variant = 'default', progress }: KpiCardProps) {
  const variantClass = {
    default: 'border-border',
    success: 'border-green-200 bg-green-50/50',
    warning: 'border-yellow-200 bg-yellow-50/50',
    danger: 'border-red-200 bg-red-50/50'
  }[variant]

  return (
    <div className={`rounded-lg border p-4 space-y-1 ${variantClass}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      {trend && (
        <p className={`text-xs font-medium ${trend.valor >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend.valor >= 0 ? '↑' : '↓'} {Math.abs(trend.valor)}% {trend.label}
        </p>
      )}
      {progress !== undefined && (
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full ${progress >= 100 ? 'bg-green-500' : progress >= 75 ? 'bg-blue-500' : progress >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}
```

---

## DashboardPage — roteador por role (app/metas-comissoes/dashboard/page.tsx)

```tsx
'use client'
import { usePermission } from '@/hooks/usePermission'
import { DashboardVendedor } from '@/components/metas-comissoes/DashboardVendedor'
import { DashboardSupervisor } from '@/components/metas-comissoes/DashboardSupervisor'

export default function DashboardPage() {
  const { can, role } = usePermission()
  // Supervisor vê dashboard da equipe; vendedor vê o próprio
  if (can('verTodasComissoes')) return <DashboardSupervisor />
  return <DashboardVendedor />
}
```

---

## DashboardVendedor.tsx

```tsx
'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend
} from 'recharts'
import { KpiCard } from './KpiCard'
import { ProgressoMeta } from './ProgressoMeta'
import { StatusComissaoBadge } from './StatusComissaoBadge'
import { StatusIndicacaoBadge } from './StatusIndicacaoBadge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, TrendingUp } from 'lucide-react'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const PIE_COLORS = ['#3b82f6','#22c55e','#eab308','#f97316','#94a3b8']

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function DashboardVendedor() {
  const hoje = new Date()
  const [mes, setMes] = useState(String(hoje.getMonth() + 1))
  const [ano] = useState(String(hoje.getFullYear()))

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-vendedor', mes, ano],
    queryFn: () => api.get('/dashboard/vendedor', { params: { mes, ano } }).then(r => r.data),
    staleTime: 30_000
  })

  if (isLoading) return <div className="p-6 text-muted-foreground">Carregando dashboard...</div>
  if (!data) return null

  const { cards, graficos, tabelas } = data

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Meu Dashboard</h1>
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MESES.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}/{ano}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard title="Comissão Prevista" value={fmtBRL(cards.comissaoPrevista)} variant="default" />
        <KpiCard title="Comissão Liberada" value={fmtBRL(cards.comissaoLiberada)} variant="success" />
        <KpiCard title="Comissão Paga (ano)" value={fmtBRL(cards.comissaoPagaAno)} subtitle="acumulado" />
        <KpiCard
          title="Meta Principal"
          value={cards.percentualMetaPrincipal != null ? `${Number(cards.percentualMetaPrincipal).toFixed(1)}%` : '—'}
          progress={cards.percentualMetaPrincipal ?? undefined}
          variant={cards.percentualMetaPrincipal >= 100 ? 'success' : cards.percentualMetaPrincipal >= 75 ? 'default' : 'warning'}
        />
        <KpiCard title="Contratos" value={cards.contratosNoMes} subtitle={`${MESES[parseInt(mes)-1]}/${ano}`} />
        <KpiCard title="Indicações" value={cards.indicacoesNoMes} subtitle={`${MESES[parseInt(mes)-1]}/${ano}`} />
      </div>

      {/* Gráficos — linha 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfico 1 — Evolução comissão */}
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-3">Comissão Prevista vs Liberada</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={graficos.evolucaoComissao}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="mes" tickFormatter={m => MESES[m-1]} className="text-xs" />
              <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} className="text-xs" width={50} />
              <Tooltip formatter={(v: number) => fmtBRL(v)} />
              <Legend />
              <Bar dataKey="prevista" name="Prevista" fill="#94a3b8" radius={[3,3,0,0]} />
              <Bar dataKey="liberada" name="Liberada" fill="#22c55e" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico 2 — Atingimento de metas */}
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-3">Atingimento de Metas</h3>
          {graficos.atingimentoMetas.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-8">Sem metas no período</p>
            : <ResponsiveContainer width="100%" height={200}>
                <BarChart layout="vertical" data={graficos.atingimentoMetas}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} className="text-xs" />
                  <YAxis type="category" dataKey="tipo" width={90} tickFormatter={t => t.split('_').slice(0,2).join(' ')} className="text-xs" />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Bar dataKey="percentual" name="Atingimento" radius={[0,3,3,0]}
                    fill="#3b82f6"
                    label={{ position: 'right', formatter: (v: number) => `${v.toFixed(0)}%`, fontSize: 11 }}
                  />
                </BarChart>
              </ResponsiveContainer>
          }
        </div>
      </div>

      {/* Gráficos — linha 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfico 3 — Recebimentos por tipo */}
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-3">Recebimentos por Tipo</h3>
          {graficos.recebimentosPorTipo.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-8">Sem recebimentos no período</p>
            : <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={graficos.recebimentosPorTipo} dataKey="valor" nameKey="tipo" cx="50%" cy="50%" outerRadius={80} label={({ tipo, percent }) => `${tipo} ${(percent*100).toFixed(0)}%`}>
                    {graficos.recebimentosPorTipo.map((_: any, i: number) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtBRL(v)} />
                </PieChart>
              </ResponsiveContainer>
          }
        </div>

        {/* Gráfico 4 — Comissão acumulada no mês */}
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-3">Comissão Acumulada no Mês</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={graficos.serieTemporal}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="dia" className="text-xs" />
              <YAxis tickFormatter={v => `R$${(v/1000).toFixed(1)}k`} className="text-xs" width={55} />
              <Tooltip formatter={(v: number) => fmtBRL(v)} labelFormatter={d => `Dia ${d}`} />
              <Line type="monotone" dataKey="acumulado" name="Acumulado" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabelas — linha 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Últimas comissões */}
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-3">Últimas Comissões</h3>
          <div className="space-y-2">
            {tabelas.ultimasComissoes.length === 0
              ? <p className="text-xs text-muted-foreground">Nenhuma comissão ainda</p>
              : tabelas.ultimasComissoes.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate max-w-[140px]">{c.regra?.nome ?? 'Manual'}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{fmtBRL(Number(c.valorComissao))}</span>
                    <StatusComissaoBadge status={c.status} />
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* Metas do mês */}
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-3">Metas do Mês</h3>
          <div className="space-y-3">
            {tabelas.metas.length === 0
              ? <p className="text-xs text-muted-foreground">Sem metas cadastradas</p>
              : tabelas.metas.slice(0, 4).map((m: any) => (
                <ProgressoMeta
                  key={m.id}
                  nomeVendedor=""
                  tipoMeta={m.tipoMeta}
                  mes={m.mes}
                  ano={m.ano}
                  meta={Number(m.valorMeta ?? m.quantidadeMeta ?? 0)}
                  realizado={Number(m.valorRealizado ?? m.quantidadeRealizada ?? 0)}
                  percentual={Number(m.percentualAtingido)}
                />
              ))
            }
          </div>
        </div>
      </div>

      {/* Tabelas — linha 4 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Últimas indicações */}
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-3">Últimas Indicações</h3>
          <div className="space-y-2">
            {tabelas.ultimasIndicacoes.length === 0
              ? <p className="text-xs text-muted-foreground">Nenhuma indicação ainda</p>
              : tabelas.ultimasIndicacoes.map((i: any) => (
                <div key={i.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{i.clienteNome}</span>
                    <span className="text-muted-foreground ml-1 text-xs">· {i.parceiro?.nome}</span>
                  </div>
                  <StatusIndicacaoBadge status={i.status} />
                </div>
              ))
            }
          </div>
        </div>

        {/* Recebimentos pendentes */}
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-3">Recebimentos Pendentes / Vencidos</h3>
          <div className="space-y-2">
            {tabelas.recebimentosPendentes.length === 0
              ? <p className="text-xs text-muted-foreground">Nenhum recebimento pendente</p>
              : tabelas.recebimentosPendentes.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {r.statusRecebimento === 'VENCIDO' && <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                    <span className="truncate max-w-[140px]">{r.clienteNome}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{fmtBRL(Number(r.saldoPendente))}</span>
                    <Badge variant={r.statusRecebimento === 'VENCIDO' ? 'destructive' : 'secondary'} className="text-xs">
                      {r.statusRecebimento === 'VENCIDO' ? 'Vencido' : 'Pendente'}
                    </Badge>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## DashboardSupervisor.tsx

```tsx
'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts'
import { KpiCard } from './KpiCard'
import { RankingTable } from './RankingTable'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const PIE_COLORS = ['#22c55e','#eab308','#94a3b8','#ef4444','#a855f7']
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtPct = (v: number) => `${v.toFixed(1)}%`

export function DashboardSupervisor() {
  const hoje = new Date()
  const [mes, setMes] = useState(String(hoje.getMonth() + 1))
  const [ano] = useState(String(hoje.getFullYear()))
  const [vendedorId, setVendedorId] = useState<string>('')

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-supervisor', mes, ano, vendedorId],
    queryFn: () => api.get('/dashboard/supervisor', {
      params: { mes, ano, vendedorId: vendedorId || undefined }
    }).then(r => r.data),
    staleTime: 30_000
  })

  const { data: vendedores = [] } = useQuery({
    queryKey: ['usuarios-vendedores'],
    queryFn: () => api.get('/usuarios?perfil=VENDEDOR').then(r => r.data),
    staleTime: 60_000
  })

  const { data: rankingData = [] } = useQuery({
    queryKey: ['ranking', mes, ano],
    queryFn: () => api.get('/ranking', { params: { mes, ano } }).then(r => r.data),
    staleTime: 30_000
  })

  if (isLoading) return <div className="p-6 text-muted-foreground">Carregando dashboard...</div>
  if (!data) return null

  const { kpis, graficos } = data

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold">Dashboard — Equipe</h1>
        <div className="flex gap-2">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}/{ano}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={vendedorId} onValueChange={setVendedorId}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Todos os vendedores" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos os vendedores</SelectItem>
              {vendedores.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs — 14 cards em 3 linhas */}
      <div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
          <KpiCard title="Com. Prevista" value={fmtBRL(kpis.comissaoPrevista)} />
          <KpiCard title="Com. Liberada" value={fmtBRL(kpis.comissaoLiberada)} variant="success" />
          <KpiCard title="Com. Paga" value={fmtBRL(kpis.comissaoPaga)} variant="success" />
          <KpiCard title="Com. Bloqueada" value={fmtBRL(kpis.comissaoBloqueada)} variant="danger" />
          <KpiCard title="Receita Recebida" value={fmtBRL(kpis.receitaRecebida)} variant="success" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
          <KpiCard title="Inadimplência" value={fmtBRL(kpis.inadimplencia)} variant="danger" />
          <KpiCard title="Metas Ativas" value={kpis.metasAtivas} />
          <KpiCard title="Metas 100% ✅" value={kpis.metas100} variant="success" />
          <KpiCard title="Metas <50% ⚠️" value={kpis.metasAbaixo50} variant="warning" />
          <KpiCard title="Indicações" value={kpis.indicacoesMes} subtitle="no mês" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard title="Indic. Convertidas" value={kpis.indicacoesConvertidas} variant="success" />
          <KpiCard title="Taxa Conversão" value={fmtPct(kpis.taxaConversao)} />
          <KpiCard title="Parceiros Ativos" value={kpis.parceirosAtivos} />
          <KpiCard title="Ticket Médio" value={fmtBRL(kpis.ticketMedio)} subtitle="por vendedor" />
        </div>
      </div>

      {/* Gráficos — linha 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Comissão por vendedor */}
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-3">Comissão por Vendedor</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart layout="vertical" data={graficos.comissaoPorVendedor}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tickFormatter={v => `R$${(v/1000).toFixed(1)}k`} className="text-xs" />
              <YAxis type="category" dataKey="nome" width={80} className="text-xs" />
              <Tooltip formatter={(v: number) => fmtBRL(v)} />
              <Bar dataKey="valor" name="Comissão" fill="#3b82f6" radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Distribuição de status */}
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-3">Distribuição de Status</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={graficos.distribuicaoStatus} dataKey="valor" nameKey="status" cx="50%" cy="50%" outerRadius={85}
                label={({ status, percent }) => `${status.split('_')[0]} ${(percent*100).toFixed(0)}%`}
                labelLine={false}>
                {graficos.distribuicaoStatus.map((_: any, i: number) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => fmtBRL(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráficos — linha 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Evolução 12 meses */}
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-3">Evolução Mensal — Comissões Liberadas</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={graficos.evolucao12m}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="mes" tickFormatter={m => MESES[m-1]} className="text-xs" />
              <YAxis tickFormatter={v => `R$${(v/1000).toFixed(1)}k`} className="text-xs" width={55} />
              <Tooltip formatter={(v: number) => fmtBRL(v)} labelFormatter={m => MESES[m-1]} />
              <Line type="monotone" dataKey="valor" name="Liberadas" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Indicações por parceiro */}
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-3">Indicações por Parceiro</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={graficos.indicacoesPorParceiro}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="nome" className="text-xs" />
              <YAxis allowDecimals={false} className="text-xs" />
              <Tooltip />
              <Bar dataKey="total" name="Indicações" fill="#8b5cf6" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ranking inline */}
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-medium mb-3">Ranking da Equipe — {MESES[parseInt(mes)-1]}/{ano}</h3>
        <RankingTable data={rankingData} showComissao />
      </div>
    </div>
  )
}
```

---

## RankingTable.tsx

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

const MEDAL = ['🥇','🥈','🥉']
const fmtBRL = (v: number | null) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'

interface RankingItem {
  posicao: number
  vendedorId: string
  nomeVendedor: string
  totalPontos: number
  contratosNoMes: number
  mrrNoMes: number
  indicacoesConvertidas: number
  metasAtingidas100: number
  comissaoLiberada: number | null
}

export function RankingTable({ data, showComissao = false }: { data: RankingItem[]; showComissao?: boolean }) {
  if (!data?.length) return <p className="text-sm text-muted-foreground">Nenhum dado de ranking para o período.</p>

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>Vendedor</TableHead>
          <TableHead className="text-right">Pontos</TableHead>
          <TableHead className="text-right">Contratos</TableHead>
          <TableHead className="text-right">MRR</TableHead>
          <TableHead className="text-right">Indic. conv.</TableHead>
          <TableHead className="text-right">Meta >100%</TableHead>
          {showComissao && <TableHead className="text-right">Comissão</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((v) => (
          <TableRow key={v.vendedorId} className={v.posicao <= 3 ? 'bg-muted/30' : ''}>
            <TableCell className="font-medium">
              {MEDAL[v.posicao - 1] ?? v.posicao}
            </TableCell>
            <TableCell className="font-medium">{v.nomeVendedor}</TableCell>
            <TableCell className="text-right">
              <Badge variant="outline">{v.totalPontos} pts</Badge>
            </TableCell>
            <TableCell className="text-right">{v.contratosNoMes}</TableCell>
            <TableCell className="text-right">{fmtBRL(v.mrrNoMes)}</TableCell>
            <TableCell className="text-right">{v.indicacoesConvertidas}</TableCell>
            <TableCell className="text-right">
              {v.metasAtingidas100 > 0
                ? <Badge variant="default" className="bg-green-100 text-green-700 border-0">✅ {v.metasAtingidas100}</Badge>
                : '—'}
            </TableCell>
            {showComissao && (
              <TableCell className="text-right font-medium">{fmtBRL(v.comissaoLiberada)}</TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

---

## RankingPage (app/metas-comissoes/ranking/page.tsx)

```tsx
'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RankingTable } from '@/components/metas-comissoes/RankingTable'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export default function RankingPage() {
  const { can } = usePermission()
  const hoje = new Date()
  const [mes, setMes] = useState(String(hoje.getMonth() + 1))
  const [ano] = useState(String(hoje.getFullYear()))

  const { data: ranking = [], isLoading } = useQuery({
    queryKey: ['ranking', mes, ano],
    queryFn: () => api.get('/ranking', { params: { mes, ano } }).then(r => r.data),
    staleTime: 30_000
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ranking da Equipe</h1>
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MESES.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}/{ano}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="text-xs text-muted-foreground">
        Fórmula: (Contratos × 3) + (MRR ÷ 100) + (Indicações convertidas × 2) + (Metas ≥100% × 5)
      </div>

      {isLoading
        ? <p className="text-muted-foreground text-sm">Calculando ranking...</p>
        : <div className="rounded-md border">
            <RankingTable data={ranking} showComissao={can('verTodasComissoes')} />
          </div>
      }
    </div>
  )
}
```

---

## FechamentoMensalPage + FechamentoDrawer

```tsx
// app/metas-comissoes/fechamento-mensal/page.tsx
'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FechamentoDrawer } from '@/components/metas-comissoes/FechamentoDrawer'
import { Plus, ChevronRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const STATUS_FECHAMENTO: Record<string, { label: string; className: string }> = {
  ABERTO:     { label: 'Aberto',     className: 'bg-blue-100 text-blue-700' },
  EM_REVISAO: { label: 'Em revisão', className: 'bg-yellow-100 text-yellow-700' },
  APROVADO:   { label: 'Aprovado',   className: 'bg-green-100 text-green-700' },
  PAGO:       { label: 'Pago',       className: 'bg-emerald-100 text-emerald-800' },
  CANCELADO:  { label: 'Cancelado',  className: 'bg-gray-100 text-gray-600' },
}

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function FechamentoMensalPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selecionado, setSelecionado] = useState<any>(null)
  const hoje = new Date()

  const { data: fechamentos = [], isLoading } = useQuery({
    queryKey: ['fechamentos'],
    queryFn: () => api.get('/fechamentos').then(r => r.data),
    staleTime: 30_000
  })

  const criarMutation = useMutation({
    mutationFn: () => api.post('/fechamentos', {
      mes: hoje.getMonth() + 1,
      ano: hoje.getFullYear()
    }),
    onSuccess: () => {
      toast({ title: 'Fechamento criado!' })
      qc.invalidateQueries({ queryKey: ['fechamentos'] })
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.response?.data?.message, variant: 'destructive' })
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Fechamento Mensal</h1>
        <Button onClick={() => criarMutation.mutate()} size="sm" disabled={criarMutation.isPending}>
          <Plus className="h-4 w-4 mr-1" />Novo Fechamento
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading
          ? <p className="text-muted-foreground text-sm">Carregando...</p>
          : fechamentos.length === 0
            ? <p className="text-muted-foreground text-sm">Nenhum fechamento ainda. Clique em "Novo Fechamento" para criar o fechamento do mês atual.</p>
            : fechamentos.map((f: any) => {
                const st = STATUS_FECHAMENTO[f.status] ?? { label: f.status, className: 'bg-gray-100 text-gray-600' }
                return (
                  <div
                    key={f.id}
                    className="flex items-center justify-between rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => { setSelecionado(f); setDrawerOpen(true) }}
                  >
                    <div className="space-y-0.5">
                      <div className="font-medium">{MESES[f.mes - 1]}/{f.ano}</div>
                      <div className="text-sm text-muted-foreground">
                        {fmtBRL(Number(f.totalComissoesLiberadas))} · {f.totalVendedores} vendedor{f.totalVendedores !== 1 ? 'es' : ''}
                        {f.dataPagamento && ` · Pago em ${new Date(f.dataPagamento).toLocaleDateString('pt-BR')}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${st.className}`}>{st.label}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                )
              })
        }
      </div>

      <FechamentoDrawer
        open={drawerOpen}
        fechamento={selecionado}
        onClose={() => setDrawerOpen(false)}
        onUpdate={() => qc.invalidateQueries({ queryKey: ['fechamentos'] })}
      />
    </div>
  )
}
```

---

## FechamentoDrawer.tsx

```tsx
'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusComissaoBadge } from './StatusComissaoBadge'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function FechamentoDrawer({ open, fechamento, onClose, onUpdate }: any) {
  const { can } = usePermission()
  const { toast } = useToast()
  const [obs, setObs] = useState('')

  const { data: preview } = useQuery({
    queryKey: ['fechamento-preview', fechamento?.id],
    queryFn: () => api.get(`/fechamentos/${fechamento.id}/preview`).then(r => r.data),
    enabled: open && !!fechamento?.id
  })

  const aprovarMutation = useMutation({
    mutationFn: () => api.patch(`/fechamentos/${fechamento.id}/aprovar`, { observacoes: obs }),
    onSuccess: () => { toast({ title: 'Fechamento aprovado!' }); onUpdate(); onClose() },
    onError: (e: any) => toast({ title: 'Erro', description: e.response?.data?.message, variant: 'destructive' })
  })

  const pagarMutation = useMutation({
    mutationFn: () => api.patch(`/fechamentos/${fechamento.id}/pagar`),
    onSuccess: () => { toast({ title: 'Fechamento marcado como pago! Comissões atualizadas.' }); onUpdate(); onClose() },
    onError: (e: any) => toast({ title: 'Erro', description: e.response?.data?.message, variant: 'destructive' })
  })

  if (!fechamento) return null

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-[600px] sm:w-[680px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Fechamento — {MESES[fechamento.mes - 1]}/{fechamento.ano}</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="preview" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="preview" className="flex-1">Preview</TabsTrigger>
            <TabsTrigger value="comissoes" className="flex-1">Comissões</TabsTrigger>
            <TabsTrigger value="historico" className="flex-1">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="mt-4 space-y-4">
            {preview ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-xs text-muted-foreground">Total a pagar</div>
                    <div className="text-xl font-bold text-green-700">{fmtBRL(preview.totalGeral)}</div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-xs text-muted-foreground">Vendedores</div>
                    <div className="text-xl font-bold">{preview.preview.length}</div>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Comissões</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.preview.map((p: any) => (
                      <TableRow key={p.vendedorId}>
                        <TableCell className="font-medium">{p.nomeVendedor}</TableCell>
                        <TableCell className="text-right">{p.totalComissoes}</TableCell>
                        <TableCell className="text-right font-medium">{fmtBRL(p.totalValor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {fechamento.status === 'ABERTO' && can('aprovarComissao') && (
                  <div className="space-y-2 pt-2">
                    <Textarea
                      placeholder="Observações (opcional)"
                      value={obs}
                      onChange={e => setObs(e.target.value)}
                      rows={2}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={onClose}>Cancelar</Button>
                      <Button onClick={() => aprovarMutation.mutate()} disabled={aprovarMutation.isPending}>
                        {aprovarMutation.isPending ? 'Aprovando...' : 'Aprovar Fechamento'}
                      </Button>
                    </div>
                  </div>
                )}

                {fechamento.status === 'APROVADO' && can('bloquearComissao') && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="w-full" variant="default">Marcar como Pago</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar pagamento</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação marcará {preview.preview.length} comissões como PAGA e não pode ser desfeita.
                          Total: {fmtBRL(preview.totalGeral)}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => pagarMutation.mutate()}>
                          Confirmar Pagamento
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </>
            ) : <p className="text-muted-foreground text-sm">Carregando preview...</p>}
          </TabsContent>

          <TabsContent value="comissoes" className="mt-4">
            <ComissoesFechamento fechamentoId={fechamento.id} mes={fechamento.mes} ano={fechamento.ano} />
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            <StatusTimeline fechamento={fechamento} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

function ComissoesFechamento({ fechamentoId, mes, ano }: { fechamentoId: string; mes: number; ano: number }) {
  const { data: comissoes = [] } = useQuery({
    queryKey: ['comissoes-fechamento', mes, ano],
    queryFn: () => api.get('/comissoes', { params: { status: 'LIBERADA' } }).then(r => r.data),
    staleTime: 30_000
  })
  if (!comissoes.length) return <p className="text-sm text-muted-foreground">Nenhuma comissão liberada no período.</p>
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Vendedor</TableHead>
          <TableHead>Origem</TableHead>
          <TableHead>Regra</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {comissoes.map((c: any) => (
          <TableRow key={c.id}>
            <TableCell>{c.vendedor?.name}</TableCell>
            <TableCell className="text-xs">{c.contratoId ? 'Contrato' : c.servicoId ? 'Serviço' : 'Indicação'}</TableCell>
            <TableCell className="text-xs">{c.regra?.nome ?? 'Manual'}</TableCell>
            <TableCell className="text-right font-medium">{Number(c.valorComissao).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
            <TableCell><StatusComissaoBadge status={c.status} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function StatusTimeline({ fechamento }: { fechamento: any }) {
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const steps = [
    { status: 'ABERTO', label: 'Criado', date: fechamento.createdAt, done: true },
    { status: 'EM_REVISAO', label: 'Em revisão', date: null, done: ['EM_REVISAO','APROVADO','PAGO'].includes(fechamento.status) },
    { status: 'APROVADO', label: 'Aprovado', date: fechamento.dataAprovacao, done: ['APROVADO','PAGO'].includes(fechamento.status) },
    { status: 'PAGO', label: 'Pago', date: fechamento.dataPagamento, done: fechamento.status === 'PAGO' },
  ]
  return (
    <ol className="relative border-l border-muted ml-3 space-y-6 mt-2">
      {steps.map(s => (
        <li key={s.status} className="ml-4">
          <div className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 ${s.done ? 'bg-green-500 border-green-500' : 'bg-muted border-muted-foreground'}`} />
          <p className={`text-sm font-medium ${s.done ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</p>
          {s.date && <p className="text-xs text-muted-foreground">{new Date(s.date).toLocaleDateString('pt-BR')}</p>}
        </li>
      ))}
    </ol>
  )
}
```

---

## RelatoriosPage (app/metas-comissoes/relatorios/page.tsx)

```tsx
'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Download } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const TIPOS = [
  { value: 'metas', label: 'Metas' },
  { value: 'comissoes', label: 'Comissões' },
  { value: 'recebimentos', label: 'Recebimentos' },
  { value: 'indicacoes', label: 'Indicações' },
]

const hoje = new Date()
const primeiroDia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0]

export default function RelatoriosMetasComissoesPage() {
  const { toast } = useToast()
  const [tipo, setTipo] = useState('metas')
  const [inicio, setInicio] = useState(primeiroDia)
  const [fim, setFim] = useState(ultimoDia)
  const [vendedorId, setVendedorId] = useState('')
  const [baixando, setBaixando] = useState(false)

  const { data: vendedores = [] } = useQuery({
    queryKey: ['usuarios-vendedores'],
    queryFn: () => api.get('/usuarios?perfil=VENDEDOR').then(r => r.data),
    staleTime: 60_000
  })

  const baixarRelatorio = async () => {
    try {
      setBaixando(true)
      const resp = await api.get('/metas-comissoes/relatorios', {
        params: { tipo, inicio, fim, vendedorId: vendedorId || undefined },
        responseType: 'blob'
      })
      const url = URL.createObjectURL(new Blob([resp.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `relatorio-${tipo}-${inicio}-${fim}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'Relatório gerado com sucesso!' })
    } catch (e: any) {
      toast({ title: 'Erro ao gerar relatório', variant: 'destructive' })
    } finally {
      setBaixando(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-xl font-semibold">Relatórios — Metas e Comissões</h1>

      <div className="space-y-4 rounded-lg border p-4">
        <div>
          <Label className="text-sm font-medium mb-2 block">Tipo de relatório</Label>
          <RadioGroup value={tipo} onValueChange={setTipo} className="flex flex-wrap gap-4">
            {TIPOS.map(t => (
              <div key={t.value} className="flex items-center gap-2">
                <RadioGroupItem value={t.value} id={t.value} />
                <Label htmlFor={t.value} className="cursor-pointer">{t.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sm mb-1 block">Data inicial</Label>
            <Input type="date" value={inicio} onChange={e => setInicio(e.target.value)} />
          </div>
          <div>
            <Label className="text-sm mb-1 block">Data final</Label>
            <Input type="date" value={fim} onChange={e => setFim(e.target.value)} />
          </div>
        </div>

        <div>
          <Label className="text-sm mb-1 block">Vendedor (opcional)</Label>
          <Select value={vendedorId} onValueChange={setVendedorId}>
            <SelectTrigger className="w-[240px]"><SelectValue placeholder="Todos os vendedores" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos os vendedores</SelectItem>
              {vendedores.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={baixarRelatorio} disabled={baixando} className="w-full">
          <Download className="h-4 w-4 mr-2" />
          {baixando ? 'Gerando XLSX...' : 'Exportar XLSX'}
        </Button>
      </div>

      {/* Preview informativo */}
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-medium mb-2">Preview das colunas — {TIPOS.find(t => t.value === tipo)?.label}</h3>
        <PreviewColunas tipo={tipo} />
      </div>
    </div>
  )
}

function PreviewColunas({ tipo }: { tipo: string }) {
  const COLUNAS: Record<string, string[]> = {
    metas: ['Vendedor','Tipo','Mês/Ano','Meta','Realizado','% Atingido','Status'],
    comissoes: ['Data','Vendedor','Origem','Regra','Valor Base','% Aplicado','Valor Comissão','Status'],
    recebimentos: ['Data','Cliente','CNPJ','Vendedor','Tipo','Vendido','Recebido','Saldo','Status','Com. Prevista','Com. Liberada'],
    indicacoes: ['Data','Vendedor','Cliente','CNPJ','Parceiro','Produto/Serviço','Valor Estimado','Valor Confirmado','Comissão','Status'],
  }
  const cols = COLUNAS[tipo] ?? []
  return (
    <div className="flex flex-wrap gap-1.5">
      {cols.map(c => (
        <span key={c} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{c}</span>
      ))}
    </div>
  )
}
```

---

## Sidebar — atualização final (nav.tsx)

```tsx
// As entradas já foram adicionadas na Sprint 24.
// Adicionar agora as novas entradas exclusivas da Sprint 25:
{ label: 'Ranking da Equipe', href: '/metas-comissoes/ranking', roles: ['VENDEDOR','SUPERVISAO','CEO','ADMIN','FINANCEIRO'] },
{ label: 'Fechamento Mensal', href: '/metas-comissoes/fechamento-mensal', roles: ['SUPERVISAO','CEO','ADMIN'], separator: true },
{ label: 'Relatórios', href: '/metas-comissoes/relatorios', roles: ['SUPERVISAO','CEO','ADMIN','FINANCEIRO'] },
```

---

## Sprint 25 — FRONTEND PRONTO ✅
