# Sprint 27 — Step 05 — Isabela Costa (Frontend Developer)
# Agenda Avançada + Dashboard de Dia — Implementação Frontend

---

## 1. Estrutura de arquivos

```
src/
  app/
    dashboard/
      page.tsx              ← Dashboard de entrada (semáforo)
    tarefas/
      page.tsx              ← Lista de tarefas
  components/
    dashboard/
      SemaforoDia.tsx       ← Card semáforo com 3 cores
      CardIndicador.tsx     ← Card de KPI
      ProximasReunioesWidget.tsx
      TarefasPendentesWidget.tsx
    agenda/
      ModalStatusTransition.tsx
      ModalRemarcar.tsx
      BulkSelectMode.tsx
      TimelineLead.tsx
    tarefas/
      TarefaCard.tsx
      ModalCriarTarefa.tsx
      FormFiltrosTarefas.tsx
  hooks/
    useDashboardDia.ts
    useTarefas.ts
    useStatusTransitions.ts
```

---

## 2. Hooks — React Query

```typescript
// hooks/useDashboardDia.ts
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useDashboardDia(vendedorId?: string) {
  return useQuery({
    queryKey: ['dashboard-dia', vendedorId],
    queryFn: () => api.get('/dashboard/dia', { params: { vendedorId } }).then(r => r.data),
    staleTime: 300_000, // 5 min
    refetchInterval: 600_000, // 10 min
  })
}

// hooks/useTarefas.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useTarefas(filtros: Record<string, string | undefined> = {}) {
  return useQuery({
    queryKey: ['tarefas', filtros],
    queryFn: () => api.get('/tarefas', { params: filtros }).then(r => r.data),
    staleTime: 120_000,
  })
}

export function useCriarTarefa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dados: any) => api.post('/tarefas', dados).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tarefas'] }),
  })
}

export function useAtualizarTarefa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: any }) =>
      api.patch(`/tarefas/${id}`, dados).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tarefas'] }),
  })
}

export function useBulkAtualizarTarefas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) =>
      api.patch('/tarefas/bulk', { ids, status }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tarefas'] }),
  })
}

// hooks/useStatusTransitions.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useMarcarComoRealizada() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ eventoId, dados }: { eventoId: string; dados: any }) =>
      api.patch(`/agenda/eventos/${eventoId}/realizado`, dados).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda-eventos'] }),
  })
}

export function useRemarcarReuniao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ eventoId, dados }: { eventoId: string; dados: any }) =>
      api.patch(`/agenda/eventos/${eventoId}/remarcar`, dados).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda-eventos'] }),
  })
}

export function useMarcarNaoCompareceu() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ eventoId, dados }: { eventoId: string; dados: any }) =>
      api.patch(`/agenda/eventos/${eventoId}/nao-compareceu`, dados).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda-eventos'] }),
  })
}
```

---

## 3. SemaforoDia.tsx

```tsx
'use client'
import { useDashboardDia } from '@/hooks/useDashboardDia'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const COR_SEMAFORO = {
  'green': { bg: 'bg-green-50 dark:bg-green-950/20', border: 'border-green-300', text: 'text-green-700 dark:text-green-400', icon: '🟢' },
  'yellow': { bg: 'bg-yellow-50 dark:bg-yellow-950/20', border: 'border-yellow-300', text: 'text-yellow-700 dark:text-yellow-400', icon: '🟡' },
  'red': { bg: 'bg-red-50 dark:bg-red-950/20', border: 'border-red-300', text: 'text-red-700 dark:text-red-400', icon: '🔴' },
}

const STATUS_LABEL = {
  'green': 'TUDO OK',
  'yellow': 'ATENÇÃO',
  'red': 'CRÍTICO',
}

const MENSAGEM = {
  'green': 'Você está no caminho certo!',
  'yellow': 'Alguns pontos precisam de atenção',
  'red': 'Ações urgentes necessárias',
}

export function SemaforoDia() {
  const { data: dashboard, isLoading } = useDashboardDia()

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Carregando...</div>
  }

  const { cor, reunioesHoje, reunioesRealizadas, leadsAtivos, propostasAtivas, tarefasAbiertas } = dashboard?.semaforo ?? {}

  const cores = COR_SEMAFORO[cor as keyof typeof COR_SEMAFORO] ?? COR_SEMAFORO.green

  return (
    <Card className={cn('border-2', cores.border, cores.bg)}>
      <CardHeader>
        <CardTitle className="text-2xl font-bold">
          {cores.icon} STATUS DO DIA — {STATUS_LABEL[cor as keyof typeof STATUS_LABEL]}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className={cn('text-lg font-medium', cores.text)}>
          {MENSAGEM[cor as keyof typeof MENSAGEM]}
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>✅ {reunioesRealizadas} reuniões cumpridas</div>
          <div>📈 Leads: {leadsAtivos} ativos</div>
          <div>📅 {reunioesHoje} agendadas hoje</div>
          <div>💼 Propostas: {propostasAtivas} ativas</div>
          <div>⏰ Próxima em {dashboard?.proximasReuniones[0] ? 'em breve' : 'nenhuma'}</div>
          <div>✓ Tarefas: {tarefasAbiertas} pendentes</div>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## 4. CardIndicador.tsx

```tsx
'use client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CardIndicadorProps {
  titulo: string
  valor: number
  subtitulo?: string
  icon: string
  href?: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

const CORES = {
  default: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200',
  success: 'bg-green-50 dark:bg-green-950/20 border-green-200',
  warning: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200',
  danger: 'bg-red-50 dark:bg-red-950/20 border-red-200',
}

export function CardIndicador({ titulo, valor, subtitulo, icon, href, variant = 'default' }: CardIndicadorProps) {
  return (
    <Card className={cn('border', CORES[variant])}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">{titulo}</p>
            <p className="text-3xl font-bold mt-1">{valor}</p>
            {subtitulo && <p className="text-xs text-muted-foreground mt-1">{subtitulo}</p>}
          </div>
          <span className="text-2xl">{icon}</span>
        </div>
        {href && <Button size="sm" variant="outline" className="w-full mt-2" asChild><a href={href}>Ver</a></Button>}
      </CardContent>
    </Card>
  )
}
```

---

## 5. Dashboard Page

```tsx
'use client'
import { useDashboardDia } from '@/hooks/useDashboardDia'
import { SemaforoDia } from '@/components/dashboard/SemaforoDia'
import { CardIndicador } from '@/components/dashboard/CardIndicador'
import { ProximasReunioesWidget } from '@/components/dashboard/ProximasReunioesWidget'
import { TarefasPendentesWidget } from '@/components/dashboard/TarefasPendentesWidget'

export default function DashboardPage() {
  const { data: dashboard } = useDashboardDia()
  const { semaforo = {} } = dashboard ?? {}

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* Semáforo */}
      <SemaforoDia />

      {/* Cards de indicadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CardIndicador
          titulo="Hoje"
          valor={semaforo.reunioesHoje ?? 0}
          subtitulo={`${semaforo.reunioesRealizadas ?? 0} realizadas`}
          icon="📅"
          href="/agenda"
          variant={semaforo.reunioesRealizadas === semaforo.reunioesHoje ? 'success' : 'default'}
        />
        <CardIndicador
          titulo="Leads"
          valor={semaforo.leadsAtivos ?? 0}
          subtitulo={`${semaforo.leadsEmRisco ?? 0} em risco`}
          icon="👥"
          href="/leads"
          variant={semaforo.leadsEmRisco ?? 0 > 0 ? 'warning' : 'success'}
        />
        <CardIndicador
          titulo="Propostas"
          valor={semaforo.propostasAtivas ?? 0}
          subtitulo={`${semaforo.propostasVencendo7d ?? 0} vencendo`}
          icon="📄"
          href="/propostas"
          variant={semaforo.propostasVencendo7d ?? 0 > 0 ? 'warning' : 'success'}
        />
        <CardIndicador
          titulo="Tarefas"
          valor={semaforo.tarefasAbiertas ?? 0}
          subtitulo={`${semaforo.tarefasVencidas ?? 0} vencidas`}
          icon="✅"
          href="/tarefas"
          variant={semaforo.tarefasVencidas ?? 0 > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* Widgets laterais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProximasReunioesWidget />
        <TarefasPendentesWidget />
      </div>
    </div>
  )
}
```

---

## 6. ModalStatusTransition.tsx

```tsx
'use client'
import { useState } from 'react'
import { useMarcarComoRealizada, useMarcarNaoCompareceu, useRemarcarReuniao } from '@/hooks/useStatusTransitions'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface ModalStatusTransitionProps {
  evento: any
  open: boolean
  onClose: () => void
  acao: 'realizado' | 'remarcar' | 'nao-compareceu'
}

export function ModalStatusTransition({ evento, open, onClose, acao }: ModalStatusTransitionProps) {
  const [observacoes, setObservacoes] = useState('')
  const [novaData, setNovaData] = useState('')
  const [novaHora, setNovaHora] = useState('')

  const marcarRealizado = useMarcarComoRealizada()
  const remarcar = useRemarcarReuniao()
  const marcarNaoCompareceu = useMarcarNaoCompareceu()

  async function handleSubmit() {
    try {
      if (acao === 'realizado') {
        await marcarRealizado.mutateAsync({ eventoId: evento.id, dados: { observacoes } })
        toast.success('Reunião marcada como realizada ✅')
      } else if (acao === 'remarcar') {
        await remarcar.mutateAsync({ eventoId: evento.id, dados: { novaData, novaHora, motivo: observacoes } })
        toast.success('Reunião remarcada 📅')
      } else if (acao === 'nao-compareceu') {
        await marcarNaoCompareceu.mutateAsync({ eventoId: evento.id, dados: { motivo: observacoes, tentoouContato: true } })
        toast.success('Reunião marcada como não compareceu ❌')
      }
      onClose()
    } catch (err) {
      toast.error('Erro ao atualizar reunião')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {acao === 'realizado' ? '✅ Marcar como Realizada' : acao === 'remarcar' ? '📅 Remarcar' : '❌ Não Compareceu'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>{evento.titulo}</strong></p>
            <p>{evento.lead?.nomeEmpresa}</p>
            <p>{new Date(evento.dataInicio).toLocaleString('pt-BR')}</p>
          </div>

          {acao === 'remarcar' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Nova data</Label>
                  <Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Nova hora</Label>
                  <Input type="time" value={novaHora} onChange={(e) => setNovaHora(e.target.value)} />
                </div>
              </div>
            </>
          )}

          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} placeholder="Detalhes da ação..." />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={marcarRealizado.isPending || remarcar.isPending || marcarNaoCompareceu.isPending}>
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

---

## 7. TarefaCard.tsx

```tsx
'use client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

const PRIORIDADE_COR = {
  'ALTA': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  'MEDIA': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'BAIXA': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
}

interface TarefaCardProps {
  tarefa: any
  selected?: boolean
  onSelect?: (id: string) => void
  onEdit?: (tarefa: any) => void
  onConcluir?: (id: string) => void
}

export function TarefaCard({ tarefa, selected, onSelect, onEdit, onConcluir }: TarefaCardProps) {
  const vencida = tarefa.dataVencimento && new Date(tarefa.dataVencimento) < new Date() && tarefa.status === 'ABERTA'

  return (
    <Card className={cn('border', vencida ? 'border-red-300 bg-red-50 dark:bg-red-950/20' : '')}>
      <CardContent className="p-3 flex items-start gap-3">
        {onSelect && (
          <Checkbox checked={selected} onCheckedChange={() => onSelect(tarefa.id)} className="mt-1" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="font-medium text-sm break-words">{tarefa.titulo}</p>
            <Badge className={PRIORIDADE_COR[tarefa.prioridade as keyof typeof PRIORIDADE_COR]}>
              {tarefa.prioridade}
            </Badge>
          </div>
          {tarefa.lead && <p className="text-xs text-muted-foreground">{tarefa.lead.nomeEmpresa}</p>}
          {tarefa.dataVencimento && (
            <p className={cn('text-xs mt-1', vencida ? 'text-red-600 font-semibold' : 'text-muted-foreground')}>
              {new Date(tarefa.dataVencimento).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
        <div className="flex gap-1">
          {onConcluir && tarefa.status === 'ABERTA' && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onConcluir(tarefa.id)}>
              ✓
            </Button>
          )}
          {onEdit && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onEdit(tarefa)}>
              ✏️
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## 8. TarefasPage

```tsx
'use client'
import { useState } from 'react'
import { useTarefas, useBulkAtualizarTarefas } from '@/hooks/useTarefas'
import { TarefaCard } from '@/components/tarefas/TarefaCard'
import { ModalCriarTarefa } from '@/components/tarefas/ModalCriarTarefa'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function TarefasPage() {
  const [filtroStatus, setFiltroStatus] = useState<string>('')
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('')
  const [modalAberta, setModal] = useState(false)
  const [tarefaSelecionada, setTarefaSelecionada] = useState<any>(null)
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())

  const { data: tarefas = [] } = useTarefas({ status: filtroStatus, prioridade: filtroPrioridade })
  const bulkAtualizar = useBulkAtualizarTarefas()

  const tarefasFiltradas = tarefas
    .filter((t: any) => !filtroStatus || t.status === filtroStatus)
    .filter((t: any) => !filtroPrioridade || t.prioridade === filtroPrioridade)

  function handleSelect(id: string) {
    const nova = new Set(selecionadas)
    if (nova.has(id)) nova.delete(id); else nova.add(id)
    setSelecionadas(nova)
  }

  async function handleBulkConcluir() {
    await bulkAtualizar.mutateAsync({ ids: Array.from(selecionadas), status: 'CONCLUIDA' })
    setSelecionadas(new Set())
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tarefas</h1>
        <Button onClick={() => setModal(true)}>+ Nova Tarefa</Button>
      </div>

      <div className="flex gap-2">
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Todos status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            <SelectItem value="ABERTA">Aberta</SelectItem>
            <SelectItem value="CONCLUIDA">Concluída</SelectItem>
            <SelectItem value="CANCELADA">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Todas prioridades" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas</SelectItem>
            <SelectItem value="ALTA">Alta</SelectItem>
            <SelectItem value="MEDIA">Média</SelectItem>
            <SelectItem value="BAIXA">Baixa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selecionadas.size > 0 && (
        <div className="flex items-center gap-2 p-2 bg-primary/10 rounded">
          <span className="text-sm">{selecionadas.size} selecionadas</span>
          <Button size="sm" onClick={handleBulkConcluir}>Marcar como concluída</Button>
        </div>
      )}

      <div className="space-y-2">
        {tarefasFiltradas.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhuma tarefa</p>
        ) : (
          tarefasFiltradas.map((t: any) => (
            <TarefaCard
              key={t.id}
              tarefa={t}
              selected={selecionadas.has(t.id)}
              onSelect={handleSelect}
              onEdit={(tarefa) => { setTarefaSelecionada(tarefa); setModal(true) }}
            />
          ))
        )}
      </div>

      <ModalCriarTarefa open={modalAberta} onClose={() => { setModal(false); setTarefaSelecionada(null) }} tarefa={tarefaSelecionada} />
    </div>
  )
}
```

---

## 9. TimelineLead.tsx (Aba Timeline no Drawer)

```tsx
'use client'
import { Card, CardContent } from '@/components/ui/card'

interface TimelineLeadProps {
  leadId: string
  eventos: any[]
  propostas: any[]
  historico: any[]
}

export function TimelineLead({ leadId, eventos = [], propostas = [], historico = [] }: TimelineLeadProps) {
  // mescla tudo e ordena por data
  const items = [
    ...eventos.map(e => ({ type: 'evento', date: new Date(e.dataInicio), data: e })),
    ...propostas.map(p => ({ type: 'proposta', date: new Date(p.dataCriacao), data: p })),
    ...historico.map(h => ({ type: 'historico', date: new Date(h.createdAt), data: h })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Sem histórico</p>
      ) : (
        items.map((item, idx) => (
          <Card key={`${item.type}-${idx}`}>
            <CardContent className="p-3 text-sm space-y-1">
              {item.type === 'evento' && (
                <>
                  <p className="font-medium">📅 {item.data.titulo}</p>
                  <p className="text-xs text-muted-foreground">{item.data.dataInicio.split('T')[0]} · {item.data.status}</p>
                </>
              )}
              {item.type === 'proposta' && (
                <>
                  <p className="font-medium">📝 Proposta #{item.data.id}</p>
                  <p className="text-xs text-muted-foreground">R$ {item.data.valorTotal} · {item.data.status}</p>
                </>
              )}
              {item.type === 'historico' && (
                <>
                  <p className="font-medium">{item.data.descricao?.split('\n')[0]}</p>
                  <p className="text-xs text-muted-foreground">{item.data.createdAt?.split('T')[0]}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
```

---

## Sprint 27 — STEP 05 PRONTO ✅
