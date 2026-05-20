# Sprint 15 — Step 05 — Isabela Costa (Frontend)
# Histórico Detalhado — Implementação UI

## Estrutura

O componente de histórico é uma **aba** dentro do componente de ficha do lead existente. Adiciona-se a aba "Histórico" às abas já existentes [Dados, Atividades, Propostas].

```
src/app/(dashboard)/leads/_components/
  LeadDrawer.tsx              # Já existe — adicionar aba Histórico
  historico/
    HistoricoTab.tsx          # Container da aba
    HistoricoTimeline.tsx     # Lista de eventos
    HistoricoItem.tsx         # Item individual da timeline
    HistoricoFiltros.tsx      # Chips de filtro
    AnotacaoForm.tsx          # Textarea + botão adicionar

src/lib/api/historico.ts
```

## src/lib/api/historico.ts

```typescript
export const historicoApi = {
  getHistorico: (leadId: string, tipos?: string[]) => {
    const qs = tipos?.length ? `?tipos=${tipos.join(',')}` : ''
    return fetch(`/api/leads/${leadId}/historico${qs}`).then(r => r.json())
  },

  addAnotacao: (leadId: string, texto: string) =>
    fetch(`/api/leads/${leadId}/historico/anotacao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
    }).then(r => { if (!r.ok) throw new Error(); return r.json() }),

  exportarPdf: (leadId: string) =>
    window.open(`/api/leads/${leadId}/historico/export-pdf`, '_blank'),
}
```

## historico/HistoricoTab.tsx

```tsx
'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { historicoApi } from '@/lib/api/historico'
import { HistoricoFiltros } from './HistoricoFiltros'
import { HistoricoTimeline } from './HistoricoTimeline'
import { AnotacaoForm } from './AnotacaoForm'
import { Button } from '@/components/ui/button'
import { FileText } from 'lucide-react'
import { toast } from 'sonner'

export function HistoricoTab({ leadId }: { leadId: string }) {
  const [tipos, setTipos] = useState<string[]>([])
  const qc = useQueryClient()

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ['historico', leadId, tipos],
    queryFn: () => historicoApi.getHistorico(leadId, tipos.length ? tipos : undefined),
    staleTime: 30_000,
  })

  const mutation = useMutation({
    mutationFn: (texto: string) => historicoApi.addAnotacao(leadId, texto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['historico', leadId] })
      toast.success('Anotação adicionada!')
    },
    onError: () => toast.error('Erro ao adicionar anotação'),
  })

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-between">
        <HistoricoFiltros value={tipos} onChange={setTipos} />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => historicoApi.exportarPdf(leadId)}
          className="gap-1 text-muted-foreground"
        >
          <FileText className="w-4 h-4" />
          PDF
        </Button>
      </div>

      <AnotacaoForm onSubmit={mutation.mutate} loading={mutation.isPending} />

      {isLoading ? (
        <p className="text-muted-foreground text-sm py-4 text-center">Carregando histórico...</p>
      ) : historico.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4 text-center">Nenhum evento encontrado.</p>
      ) : (
        <HistoricoTimeline items={historico} />
      )}
    </div>
  )
}
```

## historico/HistoricoFiltros.tsx

```tsx
import { cn } from '@/lib/utils'

const FILTROS = [
  { value: 'etapa_alterada',    label: 'Etapa'      },
  { value: 'proposta_criada',   label: 'Proposta'   },
  { value: 'atividade_concluida', label: 'Atividade' },
  { value: 'anotacao',          label: 'Anotação'   },
  { value: 'importacao',        label: 'Importação' },
  { value: 'campo_alterado',    label: 'Campo'      },
]

export function HistoricoFiltros({
  value, onChange,
}: { value: string[]; onChange: (v: string[]) => void }) {
  function toggle(tipo: string) {
    onChange(value.includes(tipo) ? value.filter(v => v !== tipo) : [...value, tipo])
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => onChange([])}
        className={cn(
          'px-2.5 py-0.5 rounded-full text-xs border transition-colors',
          value.length === 0
            ? 'bg-primary text-white border-primary'
            : 'border-muted text-muted-foreground hover:border-primary/50'
        )}
      >
        Todos
      </button>
      {FILTROS.map(f => (
        <button
          key={f.value}
          onClick={() => toggle(f.value)}
          className={cn(
            'px-2.5 py-0.5 rounded-full text-xs border transition-colors',
            value.includes(f.value)
              ? 'bg-primary text-white border-primary'
              : 'border-muted text-muted-foreground hover:border-primary/50'
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
```

## historico/AnotacaoForm.tsx

```tsx
'use client'
import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

export function AnotacaoForm({
  onSubmit, loading,
}: { onSubmit: (texto: string) => void; loading: boolean }) {
  const [texto, setTexto] = useState('')
  const MAX = 1000

  function handleSubmit() {
    if (!texto.trim()) return
    onSubmit(texto.trim())
    setTexto('')
  }

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
      <Textarea
        placeholder="Escreva uma nota sobre este lead..."
        value={texto}
        onChange={e => setTexto(e.target.value.slice(0, MAX))}
        rows={2}
        className="resize-none text-sm bg-background"
      />
      {texto.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{texto.length}/{MAX}</span>
          <Button size="sm" onClick={handleSubmit} disabled={loading || !texto.trim()}>
            {loading ? 'Salvando...' : 'Adicionar anotação'}
          </Button>
        </div>
      )}
    </div>
  )
}
```

## historico/HistoricoTimeline.tsx

```tsx
import { HistoricoItem } from './HistoricoItem'

export function HistoricoTimeline({ items }: { items: any[] }) {
  return (
    <div className="relative space-y-0">
      {/* Linha vertical conectora */}
      <div className="absolute left-3.5 top-4 bottom-4 w-px bg-border" />
      {items.map((item, i) => (
        <HistoricoItem key={item.id} item={item} isLast={i === items.length - 1} />
      ))}
    </div>
  )
}
```

## historico/HistoricoItem.tsx

```tsx
import { formatDistanceToNow, format } from 'date-fns'; import { ptBR } from 'date-fns/locale'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const TIPO_CONFIG: Record<string, { emoji: string; cor: string }> = {
  lead_criado:         { emoji: '🆕', cor: 'text-green-600'  },
  etapa_alterada:      { emoji: '➡', cor: 'text-blue-600'   },
  status_alterado:     { emoji: '🏁', cor: 'text-purple-600' },
  proposta_criada:     { emoji: '📋', cor: 'text-orange-600' },
  proposta_aprovada:   { emoji: '✅', cor: 'text-green-600'  },
  atividade_criada:    { emoji: '📅', cor: 'text-gray-500'   },
  atividade_concluida: { emoji: '✅', cor: 'text-green-600'  },
  anotacao:            { emoji: '📝', cor: 'text-yellow-600' },
  importacao:          { emoji: '📥', cor: 'text-sky-600'    },
  campo_alterado:      { emoji: '✏️', cor: 'text-gray-400'   },
}

const ETAPA_LABEL: Record<string, string> = {
  'primeiro-contato':      'Primeiro Contato',
  'qualificacao':          'Qualificação',
  'apresentacao-agendada': 'Apresentação Agendada',
  'proposta-enviada':      'Proposta Enviada',
  'negociacao':            'Negociação',
  'fechado':               'Fechado',
  'perdido':               'Perdido',
}

export function HistoricoItem({ item, isLast }: { item: any; isLast: boolean }) {
  const cfg = TIPO_CONFIG[item.tipoEvento] ?? { emoji: '•', cor: 'text-muted-foreground' }
  const data = new Date(item.createdAt)
  const relativa = formatDistanceToNow(data, { locale: ptBR, addSuffix: true })
  const absoluta = format(data, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  const autor = item.usuario?.nome ?? 'Sistema'

  return (
    <div className={cn('relative flex gap-4 pb-6', isLast && 'pb-0')}>
      {/* Dot */}
      <div className="relative z-10 flex-shrink-0 w-7 h-7 rounded-full bg-background border-2 border-border flex items-center justify-center text-sm">
        {cfg.emoji}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 pt-0.5 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground cursor-default">{relativa}</span>
            </TooltipTrigger>
            <TooltipContent>{absoluta}</TooltipContent>
          </Tooltip>
          <span className={cn('text-xs font-semibold', cfg.cor)}>
            {item.tipoEvento.replace(/_/g, ' ')}
          </span>
        </div>

        <p className="text-sm">{item.descricao}</p>

        {/* De → Para (etapa/status alterado) */}
        {item.valorAnterior && item.valorNovo && (item.tipoEvento === 'etapa_alterada' || item.tipoEvento === 'status_alterado') && (
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline">{ETAPA_LABEL[item.valorAnterior] ?? item.valorAnterior}</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="outline" className="border-primary text-primary">
              {ETAPA_LABEL[item.valorNovo] ?? item.valorNovo}
            </Badge>
          </div>
        )}

        {/* De → Para (campo alterado) */}
        {item.valorAnterior !== null && item.valorNovo !== null && item.tipoEvento === 'campo_alterado' && (
          <p className="text-xs text-muted-foreground">
            <span className="line-through">{item.valorAnterior || '—'}</span>
            {' → '}
            <span className="text-foreground">{item.valorNovo || '—'}</span>
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          por {autor === 'Sistema' ? <em>Sistema</em> : autor}
        </p>
      </div>
    </div>
  )
}
```

## Integração no LeadDrawer existente

```tsx
// Em LeadDrawer.tsx (ou LeadPage.tsx) — adicionar à lista de abas:
import { HistoricoTab } from './historico/HistoricoTab'

// Dentro do Tabs component:
<TabsList>
  <TabsTrigger value="dados">Dados</TabsTrigger>
  <TabsTrigger value="atividades">Atividades</TabsTrigger>
  <TabsTrigger value="propostas">Propostas</TabsTrigger>
  <TabsTrigger value="historico">Histórico</TabsTrigger>  {/* NOVO */}
</TabsList>

<TabsContent value="historico">
  <HistoricoTab leadId={lead.id} />
</TabsContent>
```
