# Sprint 18 — Step 05 — Isabela Costa (Frontend)
# Campanhas — UI

## Estrutura de arquivos

```
src/
  app/(dashboard)/campanhas/
    page.tsx                            ← listagem
    nova/
      page.tsx                          ← wizard criar
    [id]/
      page.tsx                          ← detalhe + métricas
    _components/
      CampanhaCard.tsx                  ← card na listagem
      StatusBadge.tsx                   ← badge com cor por status
      CampanhaWizard.tsx                ← wizard 3 passos
      wizard/
        Passo1Config.tsx
        Passo2Segmentacao.tsx
        Passo3Revisao.tsx
      DetalheProgresso.tsx              ← barra de progresso SSE
      DestinatariosTabela.tsx           ← tabela com filtro de status
  lib/api/campanha.ts                   ← fetch helpers
```

## src/lib/api/campanha.ts

```typescript
import { apiFetch } from './client'

export type StatusCampanha = 'RASCUNHO' | 'AGENDADA' | 'ENVIANDO' | 'CONCLUIDA' | 'CANCELADA'
export type StatusDestinatario = 'PENDENTE' | 'ENVIADO' | 'FALHA' | 'SEM_CANAL'

export interface Campanha {
  id: string
  nome: string
  descricao?: string
  canal: 'EMAIL'
  assunto: string
  corpo: string
  status: StatusCampanha
  agendadaPara?: string
  filtroEtapas: string[]
  filtroStatus: string[]
  filtroVendedores: string[]
  totalDestinatarios: number
  totalEnviados: number
  totalFalhas: number
  iniciadaEm?: string
  concluidaEm?: string
  criadoPor: { nome: string }
  createdAt: string
}

export interface Destinatario {
  id: string
  leadId: string
  email?: string
  status: StatusDestinatario
  erro?: string
  enviadoEm?: string
  lead: { nome: string; empresa: string }
}

export interface Preview {
  total: number
  comEmail: number
  semEmail: number
  leads: { id: string; nome: string; empresa: string; email?: string }[]
}

export const campanhaApi = {
  listar: (): Promise<Campanha[]> => apiFetch('/campanhas'),

  criar: (data: Partial<Campanha>): Promise<Campanha> =>
    apiFetch('/campanhas', { method: 'POST', body: JSON.stringify(data) }),

  editar: (id: string, data: Partial<Campanha>): Promise<Campanha> =>
    apiFetch(`/campanhas/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  detalhar: (id: string): Promise<Campanha> => apiFetch(`/campanhas/${id}`),

  preview: (filtros: { filtroEtapas: string[]; filtroStatus: string[]; filtroVendedores: string[] }): Promise<Preview> =>
    apiFetch(
      `/campanhas/preview?filtroEtapas=${encodeURIComponent(JSON.stringify(filtros.filtroEtapas))}&filtroStatus=${encodeURIComponent(JSON.stringify(filtros.filtroStatus))}&filtroVendedores=${encodeURIComponent(JSON.stringify(filtros.filtroVendedores))}`
    ),

  disparar: (id: string, agendadaPara?: string): Promise<{ agendada: boolean }> =>
    apiFetch(`/campanhas/${id}/disparar`, { method: 'POST', body: JSON.stringify({ agendadaPara }) }),

  cancelar: (id: string): Promise<void> =>
    apiFetch(`/campanhas/${id}/cancelar`, { method: 'POST' }),

  destinatarios: (id: string, status?: string): Promise<Destinatario[]> =>
    apiFetch(`/campanhas/${id}/destinatarios${status ? `?status=${status}` : ''}`),
}
```

## src/app/(dashboard)/campanhas/_components/StatusBadge.tsx

```tsx
import { Badge } from '@/components/ui/badge'
import { StatusCampanha } from '@/lib/api/campanha'

const CONFIG: Record<StatusCampanha, { label: string; variant: string; pulse?: boolean }> = {
  RASCUNHO:  { label: 'Rascunho',  variant: 'secondary' },
  AGENDADA:  { label: 'Agendada',  variant: 'outline' },
  ENVIANDO:  { label: 'Enviando',  variant: 'warning', pulse: true },
  CONCLUIDA: { label: 'Concluída', variant: 'success' },
  CANCELADA: { label: 'Cancelada', variant: 'destructive' },
}

export function StatusBadge({ status }: { status: StatusCampanha }) {
  const cfg = CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1.5`}>
      {cfg.pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
        </span>
      )}
      <Badge variant={cfg.variant as any}>{cfg.label}</Badge>
    </span>
  )
}
```

## src/app/(dashboard)/campanhas/_components/CampanhaCard.tsx

```tsx
'use client'

import Link from 'next/link'
import { Mail, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Campanha, campanhaApi } from '@/lib/api/campanha'
import { StatusBadge } from './StatusBadge'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { usePermission } from '@/hooks/usePermission'

export function CampanhaCard({ campanha }: { campanha: Campanha }) {
  const qc = useQueryClient()
  const { can } = usePermission()

  const cancelarMutation = useMutation({
    mutationFn: () => campanhaApi.cancelar(campanha.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campanhas'] }),
  })

  const podeCancelar = can('gerenciarCampanhas') &&
    ['AGENDADA', 'ENVIANDO'].includes(campanha.status)

  return (
    <div className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted/40 transition-colors">
      <Mail className="h-5 w-5 text-muted-foreground shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{campanha.nome}</p>
          <StatusBadge status={campanha.status} />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          E-mail · {campanha.totalDestinatarios} destinatários
          {campanha.agendadaPara &&
            ` · agendada ${new Date(campanha.agendadaPara).toLocaleString('pt-BR')}`}
          {campanha.status === 'CONCLUIDA' &&
            ` · ${campanha.totalEnviados} enviados · ${campanha.totalFalhas} falhas`}
          {' · '}Criada por {campanha.criadoPor.nome}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/campanhas/${campanha.id}`}>Ver</Link>
        </Button>
        {podeCancelar && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={() => cancelarMutation.mutate()}
            disabled={cancelarMutation.isPending}
            title="Cancelar campanha"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
```

## src/app/(dashboard)/campanhas/_components/wizard/Passo2Segmentacao.tsx

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { campanhaApi } from '@/lib/api/campanha'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

const ETAPAS = ['qualificacao', 'proposta', 'negociacao', 'fechado']
const STATUS_OPTS = ['ativo', 'aguardando', 'perdido', 'recontato_futuro']

interface Filtros {
  filtroEtapas: string[]
  filtroStatus: string[]
  filtroVendedores: string[]
}

interface Props {
  value: Filtros
  onChange: (f: Filtros) => void
  vendedores: { id: string; nome: string }[]
}

export function Passo2Segmentacao({ value, onChange, vendedores }: Props) {
  const [debouncedFiltros, setDebouncedFiltros] = useState(value)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedFiltros(value), 500)
    return () => clearTimeout(t)
  }, [value])

  const { data: preview } = useQuery({
    queryKey: ['campanha-preview', debouncedFiltros],
    queryFn: () => campanhaApi.preview(debouncedFiltros),
    staleTime: 10_000,
  })

  function toggleItem(key: keyof Filtros, item: string) {
    const arr = value[key] as string[]
    onChange({
      ...value,
      [key]: arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item],
    })
  }

  return (
    <div className="space-y-5">
      {/* Etapas */}
      <div>
        <Label className="text-sm font-semibold">Etapa do funil</Label>
        <div className="flex flex-wrap gap-3 mt-2">
          {ETAPAS.map((e) => (
            <label key={e} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={value.filtroEtapas.includes(e)}
                onCheckedChange={() => toggleItem('filtroEtapas', e)}
              />
              <span className="text-sm capitalize">{e}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Status */}
      <div>
        <Label className="text-sm font-semibold">Status do lead</Label>
        <div className="flex flex-wrap gap-3 mt-2">
          {STATUS_OPTS.map((s) => (
            <label key={s} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={value.filtroStatus.includes(s)}
                onCheckedChange={() => toggleItem('filtroStatus', s)}
              />
              <span className="text-sm">{s.replace('_', ' ')}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Vendedores */}
      {vendedores.length > 0 && (
        <div>
          <Label className="text-sm font-semibold">Vendedor responsável</Label>
          <div className="flex flex-wrap gap-3 mt-2">
            {vendedores.map((v) => (
              <label key={v.id} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={value.filtroVendedores.includes(v.id)}
                  onCheckedChange={() => toggleItem('filtroVendedores', v.id)}
                />
                <span className="text-sm">{v.nome}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Prévia */}
      {preview && (
        <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
          <p className="font-medium">📊 Prévia: {preview.total} leads correspondem aos filtros</p>
          {preview.semEmail > 0 && (
            <p className="text-yellow-600">
              ⚠️ {preview.semEmail} lead{preview.semEmail > 1 ? 's' : ''} sem e-mail (será{preview.semEmail > 1 ? 'ão' : ''} ignorado{preview.semEmail > 1 ? 's' : ''} no envio)
            </p>
          )}
        </div>
      )}
    </div>
  )
}
```

## src/app/(dashboard)/campanhas/[id]/_components/DetalheProgresso.tsx

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Progress } from '@/components/ui/progress'

interface ProgressoData {
  status: string
  totalDestinatarios: number
  totalEnviados: number
  totalFalhas: number
}

export function DetalheProgresso({ campanhaId, statusInicial }: { campanhaId: string; statusInicial: string }) {
  const [dados, setDados] = useState<ProgressoData | null>(null)

  useEffect(() => {
    if (!['ENVIANDO', 'AGENDADA'].includes(statusInicial)) return

    const es = new EventSource(
      `${process.env.NEXT_PUBLIC_API_URL}/campanhas/${campanhaId}/progresso`,
      { withCredentials: true }
    )

    es.onmessage = (e) => {
      const d: ProgressoData = JSON.parse(e.data)
      setDados(d)
      if (['CONCLUIDA', 'CANCELADA'].includes(d.status)) es.close()
    }

    return () => es.close()
  }, [campanhaId, statusInicial])

  if (!dados) return null

  const pct = dados.totalDestinatarios > 0
    ? Math.round(((dados.totalEnviados + dados.totalFalhas) / dados.totalDestinatarios) * 100)
    : 0

  return (
    <div className="space-y-2 p-4 bg-muted rounded-lg">
      <div className="flex justify-between text-sm">
        <span>{pct}% concluído</span>
        <span>{dados.totalEnviados} enviados · {dados.totalFalhas} falhas · {dados.totalDestinatarios} total</span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  )
}
```

## src/app/(dashboard)/campanhas/page.tsx

```tsx
'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { campanhaApi, StatusCampanha } from '@/lib/api/campanha'
import { CampanhaCard } from './_components/CampanhaCard'
import { usePermission } from '@/hooks/usePermission'
import { useState } from 'react'

const FILTROS: { label: string; value: StatusCampanha | 'TODAS' }[] = [
  { label: 'Todas', value: 'TODAS' },
  { label: 'Rascunho', value: 'RASCUNHO' },
  { label: 'Agendada', value: 'AGENDADA' },
  { label: 'Enviando', value: 'ENVIANDO' },
  { label: 'Concluída', value: 'CONCLUIDA' },
]

export default function CampanhasPage() {
  const [filtro, setFiltro] = useState<StatusCampanha | 'TODAS'>('TODAS')
  const { can } = usePermission()

  const { data: campanhas = [] } = useQuery({
    queryKey: ['campanhas'],
    queryFn: campanhaApi.listar,
    staleTime: 30_000,
    refetchInterval: 15_000, // refetch automático para atualizar status
  })

  const filtradas = filtro === 'TODAS'
    ? campanhas
    : campanhas.filter((c) => c.status === filtro)

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Campanhas</h1>
        {can('gerenciarCampanhas') && (
          <Button asChild>
            <Link href="/campanhas/nova">+ Nova campanha</Link>
          </Button>
        )}
      </div>

      {/* Filtro de status */}
      <div className="flex gap-2 flex-wrap">
        {FILTROS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className={`px-3 py-1 rounded-full text-sm border transition-colors
              ${filtro === f.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-muted'
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtradas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma campanha encontrada.
          </p>
        ) : (
          filtradas.map((c) => <CampanhaCard key={c.id} campanha={c} />)
        )}
      </div>
    </div>
  )
}
```

## Atualizar usePermission hook

```typescript
// src/hooks/usePermission.ts — adicionar:
gerenciarCampanhas: ['SUPERVISAO', 'CEO', 'ADMIN'],
```

## Adicionar rota no menu lateral

```tsx
// Em src/components/Sidebar.tsx — adicionar após Nutrição:
{ href: '/campanhas', label: 'Campanhas', icon: <Mail className="h-4 w-4" /> }
```
