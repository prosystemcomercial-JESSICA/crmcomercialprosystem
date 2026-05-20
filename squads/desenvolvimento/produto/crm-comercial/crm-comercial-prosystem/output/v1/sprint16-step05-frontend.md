# Sprint 16 — Step 05 — Isabela Costa (Frontend)
# Nutrição / Recontato Futuro — Implementação UI

## Estrutura

```
src/app/(dashboard)/nutricao/
  page.tsx
  _components/
    NutricaoSection.tsx     # Seção (Vencidos / Hoje / Próximos)
    NutricaoCard.tsx        # Card individual de lead
    ReagendarInline.tsx     # Datepicker inline no card
    VendedorFiltro.tsx      # Select de vendedor (Supervisão+)

src/components/ui/
  AlertaSino.tsx            # Badge no header com tooltip

src/lib/api/nutricao.ts
```

## src/lib/api/nutricao.ts

```typescript
export const nutricaoApi = {
  getNutricao: (vendedorId?: string) => {
    const qs = vendedorId ? `?vendedorId=${vendedorId}` : ''
    return fetch(`/api/nutricao${qs}`).then(r => r.json())
  },
  getAlerta: () => fetch('/api/nutricao/alerta').then(r => r.json()),
  reativar: (id: string) =>
    fetch(`/api/nutricao/${id}/reativar`, { method: 'POST' }).then(r => r.json()),
  reagendar: (id: string, dataRecontato: string) =>
    fetch(`/api/nutricao/${id}/reagendar`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataRecontato }),
    }).then(r => r.json()),
  exportarCsv: (vendedorId?: string) => {
    const qs = vendedorId ? `?vendedorId=${vendedorId}` : ''
    window.open(`/api/nutricao/export-csv${qs}`, '_blank')
  },
}
```

## nutricao/page.tsx

```tsx
'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { nutricaoApi } from '@/lib/api/nutricao'
import { NutricaoSection } from './_components/NutricaoSection'
import { VendedorFiltro } from './_components/VendedorFiltro'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/usePermission'

export default function NutricaoPage() {
  const [vendedorId, setVendedorId] = useState<string | undefined>()
  const { can } = usePermission()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['nutricao', vendedorId],
    queryFn: () => nutricaoApi.getNutricao(vendedorId),
    staleTime: 60_000,
  })

  const reativarMutation = useMutation({
    mutationFn: (id: string) => nutricaoApi.reativar(id),
    onSuccess: () => { toast.success('Lead reativado!'); qc.invalidateQueries({ queryKey: ['nutricao'] }) },
    onError: () => toast.error('Erro ao reativar lead'),
  })

  const reagendarMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: string }) => nutricaoApi.reagendar(id, data),
    onSuccess: () => { toast.success('Recontato reagendado!'); qc.invalidateQueries({ queryKey: ['nutricao'] }) },
    onError: () => toast.error('Erro ao reagendar'),
  })

  const total = (data?.vencidos?.length ?? 0) + (data?.hoje?.length ?? 0) + (data?.proximos?.length ?? 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Nutrição — Recontato Futuro</h1>
          <p className="text-muted-foreground text-sm">Leads perdidos agendados para recontato · {total} lead{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2 items-center">
          {can('verTodosLeads') && (
            <VendedorFiltro value={vendedorId} onChange={setVendedorId} />
          )}
          <Button variant="outline" size="sm" onClick={() => nutricaoApi.exportarCsv(vendedorId)}>
            <Download className="w-4 h-4 mr-1" />CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando fila de recontato...</p>
      ) : (
        <>
          <NutricaoSection
            titulo="⚠ Vencidos"
            cor="red"
            leads={data?.vencidos ?? []}
            onReativar={id => reativarMutation.mutate(id)}
            onReagendar={(id, data) => reagendarMutation.mutate({ id, data })}
          />
          <NutricaoSection
            titulo="🔔 Hoje"
            cor="orange"
            leads={data?.hoje ?? []}
            onReativar={id => reativarMutation.mutate(id)}
            onReagendar={(id, data) => reagendarMutation.mutate({ id, data })}
          />
          <NutricaoSection
            titulo="📆 Próximos 7 dias"
            cor="blue"
            leads={data?.proximos ?? []}
            onReativar={id => reativarMutation.mutate(id)}
            onReagendar={(id, data) => reagendarMutation.mutate({ id, data })}
          />
          {total === 0 && (
            <p className="text-muted-foreground text-center py-12">Nenhum lead na fila de recontato.</p>
          )}
        </>
      )}
    </div>
  )
}
```

## _components/NutricaoSection.tsx

```tsx
import { NutricaoCard } from './NutricaoCard'
import { cn } from '@/lib/utils'

const COR_CONFIG = {
  red:    { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700'    },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700'   },
}

export function NutricaoSection({
  titulo, cor, leads, onReativar, onReagendar,
}: {
  titulo: string
  cor: 'red' | 'orange' | 'blue'
  leads: any[]
  onReativar: (id: string) => void
  onReagendar: (id: string, data: string) => void
}) {
  if (leads.length === 0) return null
  const c = COR_CONFIG[cor]

  return (
    <div>
      <h2 className={cn('text-sm font-semibold mb-2', c.text)}>
        {titulo} ({leads.length})
      </h2>
      <div className={cn('border rounded-lg divide-y', c.border, c.bg)}>
        {leads.map(lead => (
          <NutricaoCard
            key={lead.id}
            lead={lead}
            cor={cor}
            onReativar={() => onReativar(lead.id)}
            onReagendar={(data) => onReagendar(lead.id, data)}
          />
        ))}
      </div>
    </div>
  )
}
```

## _components/NutricaoCard.tsx

```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ReagendarInline } from './ReagendarInline'
import { format } from 'date-fns'; import { ptBR } from 'date-fns/locale'
import { RefreshCw, CalendarIcon } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

function diasLabel(dias: number): string {
  if (dias === 0) return 'Hoje'
  if (dias < 0) return `${Math.abs(dias)} dias atraso`
  return `Em ${dias} dias`
}

export function NutricaoCard({
  lead, cor, onReativar, onReagendar,
}: {
  lead: any
  cor: 'red' | 'orange' | 'blue'
  onReativar: () => void
  onReagendar: (data: string) => void
}) {
  const [reagendando, setReagendando] = useState(false)
  const dataFormatada = format(new Date(lead.dataRecontato), 'dd/MM/yy', { locale: ptBR })

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/leads/${lead.id}`}
            className="font-medium text-sm hover:underline"
          >
            🏢 {lead.nomeEmpresa}
          </Link>
          {lead.motivoPerda && (
            <p className="text-xs text-muted-foreground">Motivo: {lead.motivoPerda}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-medium">{lead.vendedorNome}</p>
          <p className="text-xs text-muted-foreground">📅 {dataFormatada} · {diasLabel(lead.diasAtraso)}</p>
        </div>
      </div>

      {reagendando ? (
        <ReagendarInline
          onConfirm={(data) => { onReagendar(data); setReagendando(false) }}
          onCancel={() => setReagendando(false)}
        />
      ) : (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReagendando(true)}
            className="h-7 text-xs gap-1"
          >
            <CalendarIcon className="w-3 h-3" />Reagendar
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50">
                <RefreshCw className="w-3 h-3" />Reativar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reativar lead?</AlertDialogTitle>
                <AlertDialogDescription>
                  {lead.nomeEmpresa} voltará para a etapa Qualificação com status Ativo.
                  O histórico anterior será mantido.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onReativar}>Reativar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  )
}
```

## _components/ReagendarInline.tsx

```tsx
'use client'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function ReagendarInline({
  onConfirm, onCancel,
}: { onConfirm: (data: string) => void; onCancel: () => void }) {
  const hoje = new Date().toISOString().split('T')[0]
  const [data, setData] = useState('')

  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        min={hoje}
        value={data}
        onChange={e => setData(e.target.value)}
        className="h-7 text-xs w-36"
      />
      <Button
        size="sm"
        className="h-7 text-xs"
        onClick={() => data && onConfirm(data)}
        disabled={!data}
      >
        Confirmar
      </Button>
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
        Cancelar
      </Button>
    </div>
  )
}
```

## _components/VendedorFiltro.tsx

```tsx
'use client'
import { useQuery } from '@tanstack/react-query'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function VendedorFiltro({
  value, onChange,
}: { value: string | undefined; onChange: (v: string | undefined) => void }) {
  const { data } = useQuery({
    queryKey: ['users', 'vendedores'],
    queryFn: () => fetch('/api/users?perfil=VENDEDOR').then(r => r.json()),
    staleTime: 300_000,
  })

  return (
    <Select value={value ?? 'todos'} onValueChange={v => onChange(v === 'todos' ? undefined : v)}>
      <SelectTrigger className="h-8 w-40 text-sm">
        <SelectValue placeholder="Todos vendedores" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos vendedores</SelectItem>
        {data?.items?.map((v: any) => (
          <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

## src/components/ui/AlertaSino.tsx (integrado ao Header existente)

```tsx
'use client'
import { useQuery } from '@tanstack/react-query'
import { nutricaoApi } from '@/lib/api/nutricao'
import { Bell } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import Link from 'next/link'

export function AlertaSino() {
  const { data } = useQuery({
    queryKey: ['alerta-nutricao'],
    queryFn: nutricaoApi.getAlerta,
    refetchInterval: 5 * 60 * 1000, // re-fetch a cada 5 min
    staleTime: 60_000,
  })

  const total = data?.total ?? 0

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href="/nutricao" className="relative">
          <Bell className="w-5 h-5 text-muted-foreground hover:text-foreground" />
          {total > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5">
              {total > 99 ? '99+' : total}
            </span>
          )}
        </Link>
      </TooltipTrigger>
      {total > 0 && (
        <TooltipContent className="space-y-1 max-w-xs" side="bottom">
          <p className="font-semibold text-xs">Leads para recontato</p>
          {data?.leads?.map((l: any) => (
            <p key={l.id} className="text-xs">
              • {l.nomeEmpresa} {l.diasAtraso < 0 ? `(${Math.abs(l.diasAtraso)}d atraso)` : '(hoje)'}
            </p>
          ))}
          {total > 5 && <p className="text-xs text-muted-foreground">+ {total - 5} mais</p>}
        </TooltipContent>
      )}
    </Tooltip>
  )
}
```

## Integração no Header existente

```tsx
// src/components/layout/Header.tsx — adicionar:
import { AlertaSino } from '@/components/ui/AlertaSino'

// Dentro do header:
<div className="flex items-center gap-3">
  <AlertaSino />
  {/* ... resto do header */}
</div>
```
