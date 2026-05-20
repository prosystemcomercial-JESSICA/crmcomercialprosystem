# Sprint 26 — Step 05 — Isabela Costa (Frontend Developer)
# Módulo de Agenda — Implementação Frontend

---

## 1. Estrutura de arquivos

```
src/
  app/
    agenda/
      page.tsx                    ← Minha Agenda
      equipe/
        page.tsx                  ← Agenda da Equipe (SUPERVISAO+)
  components/
    agenda/
      AgendaPage.tsx              ← container com split layout
      MiniCalendario.tsx          ← grid mensal com dots
      ListaEventos.tsx            ← lista agrupada por data
      EventoCard.tsx              ← card individual de evento
      NovaReuniaoModal.tsx        ← modal de criação/edição
      AgendaLeadTab.tsx           ← aba no drawer do lead
      AgendaEquipePage.tsx        ← view supervisor
      GoogleStatusBanner.tsx      ← banner de conexão Google
  hooks/
    useAgenda.ts
    useGoogleAuth.ts
```

---

## 2. useGoogleAuth.ts

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useGoogleAuthStatus() {
  return useQuery({
    queryKey: ['google-auth-status'],
    queryFn:  () => api.get('/agenda/auth/status').then(r => r.data),
    staleTime: 60_000,
  })
}

export function useDesconectarGoogle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete('/agenda/auth/disconnect').then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['google-auth-status'] }),
  })
}

export function conectarGoogle() {
  window.location.href = '/api/agenda/auth/google'
}
```

---

## 3. useAgenda.ts

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useEventos(filtros: Record<string, string | undefined> = {}) {
  return useQuery({
    queryKey: ['agenda-eventos', filtros],
    queryFn:  () => api.get('/agenda/eventos', { params: filtros }).then(r => r.data),
    staleTime: 60_000,
  })
}

export function useEventosHojeCount() {
  return useQuery({
    queryKey: ['agenda-badge'],
    queryFn:  () => api.get('/agenda/eventos/hoje/count').then(r => r.data.count as number),
    staleTime: 120_000,
    refetchInterval: 120_000,
  })
}

export function useCriarEvento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dados: any) => api.post('/agenda/eventos', dados).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['agenda-eventos'] }),
  })
}

export function useAtualizarEvento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: any }) =>
      api.patch(`/agenda/eventos/${id}`, dados).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda-eventos'] }),
  })
}

export function useCancelarEvento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/agenda/eventos/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['agenda-eventos'] }),
  })
}
```

---

## 4. MiniCalendario.tsx

```tsx
'use client'
import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

interface MiniCalendarioProps {
  eventos: Array<{ dataInicio: string; tipo: string }>
  mesSelecionado: Date
  onDiaSelecionado: (data: Date) => void
  diaSelecionado?: Date | null
  onMesAnterior: () => void
  onProximoMes: () => void
}

const TIPO_COR: Record<string, string> = {
  REUNIAO: 'bg-blue-500', LIGACAO: 'bg-green-500', VISITA: 'bg-yellow-500',
  APRESENTACAO: 'bg-purple-500', FOLLOW_UP: 'bg-orange-500', DEMO: 'bg-pink-500', OUTRO: 'bg-gray-400',
}

export function MiniCalendario({ eventos, mesSelecionado, onDiaSelecionado, diaSelecionado, onMesAnterior, onProximoMes }: MiniCalendarioProps) {
  const diasComEventos = useMemo(() => {
    const map = new Map<string, string[]>() // "YYYY-MM-DD" → tipos[]
    eventos.forEach(e => {
      const key = e.dataInicio.split('T')[0]
      const tipos = map.get(key) ?? []
      if (!tipos.includes(e.tipo)) tipos.push(e.tipo)
      map.set(key, tipos)
    })
    return map
  }, [eventos])

  const primeiroDia = new Date(mesSelecionado.getFullYear(), mesSelecionado.getMonth(), 1)
  const ultimoDia   = new Date(mesSelecionado.getFullYear(), mesSelecionado.getMonth() + 1, 0)
  const diasOffset  = primeiroDia.getDay() // 0=Dom
  const totalDias   = ultimoDia.getDate()

  const mesLabel = mesSelecionado.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="w-full select-none">
      <div className="flex items-center justify-between mb-3">
        <button onClick={onMesAnterior} className="p-1 rounded hover:bg-accent">‹</button>
        <span className="text-sm font-medium capitalize">{mesLabel}</span>
        <button onClick={onProximoMes}  className="p-1 rounded hover:bg-accent">›</button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-muted-foreground mb-1">
        {['D','S','T','Q','Q','S','S'].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: diasOffset }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: totalDias }).map((_, i) => {
          const dia = i + 1
          const dataKey = `${mesSelecionado.getFullYear()}-${String(mesSelecionado.getMonth() + 1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
          const tipos   = diasComEventos.get(dataKey) ?? []
          const ehHoje  = dataKey === new Date().toISOString().split('T')[0]
          const ehSelecionado = diaSelecionado ? dataKey === diaSelecionado.toISOString().split('T')[0] : false

          return (
            <div
              key={dia}
              onClick={() => onDiaSelecionado(new Date(mesSelecionado.getFullYear(), mesSelecionado.getMonth(), dia))}
              className={cn(
                'flex flex-col items-center justify-start py-1 rounded cursor-pointer text-xs hover:bg-accent',
                ehHoje && 'font-bold text-primary',
                ehSelecionado && 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
            >
              <span>{dia}</span>
              {tipos.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {tipos.slice(0, 3).map((t, ti) => (
                    <span key={ti} className={cn('w-1 h-1 rounded-full', TIPO_COR[t] ?? 'bg-gray-400')} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

---

## 5. EventoCard.tsx

```tsx
'use client'
import { Badge }  from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCancelarEvento } from '@/hooks/useAgenda'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const TIPO_LABEL: Record<string, string> = {
  REUNIAO:'Reunião', LIGACAO:'Ligação', VISITA:'Visita',
  APRESENTACAO:'Apresentação', FOLLOW_UP:'Follow-up', DEMO:'Demo', OUTRO:'Outro',
}
const STATUS_VARIANT: Record<string, 'default'|'secondary'|'destructive'|'outline'> = {
  AGENDADO:'secondary', CONFIRMADO:'default', REALIZADO:'outline',
  CANCELADO:'destructive', REAGENDADO:'secondary', NAO_COMPARECEU:'destructive',
}

interface EventoCardProps {
  evento: any
  onEditar: (evento: any) => void
  compact?: boolean
}

export function EventoCard({ evento, onEditar, compact = false }: EventoCardProps) {
  const cancelar = useCancelarEvento()

  const horaInicio = new Date(evento.dataInicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const horaFim    = new Date(evento.dataFim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="border rounded-lg p-3 bg-card hover:shadow-sm transition-shadow space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{evento.titulo}</p>
          <p className="text-xs text-muted-foreground">
            {horaInicio}–{horaFim}
            {evento.lead && ` · ${evento.lead.nomeEmpresa}`}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[evento.status] ?? 'outline'} className="shrink-0 text-xs">
          {evento.status.replace('_',' ')}
        </Badge>
      </div>

      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
          {TIPO_LABEL[evento.tipo]}
        </span>
        {evento.tipoLocal === 'ONLINE' ? '📍 Google Meet' : '📍 Presencial'}
      </div>

      {!compact && (
        <div className="flex flex-wrap gap-1.5">
          {evento.hangoutLink && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" asChild>
              <a href={evento.hangoutLink} target="_blank" rel="noopener noreferrer">
                🎥 Entrar no Meet
              </a>
            </Button>
          )}
          {evento.status !== 'CANCELADO' && (
            <>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onEditar(evento)}>
                ✏️ Editar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 text-xs text-destructive">❌ Cancelar</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar reunião?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O evento será cancelado no Google Calendar e o lead será notificado.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => cancelar.mutate(evento.id)}
                      className="bg-destructive text-destructive-foreground"
                    >
                      Confirmar cancelamento
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      )}
    </div>
  )
}
```

---

## 6. GoogleStatusBanner.tsx

```tsx
'use client'
import { useGoogleAuthStatus, conectarGoogle } from '@/hooks/useGoogleAuth'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function GoogleStatusBanner() {
  const { data: status, isLoading } = useGoogleAuthStatus()

  if (isLoading) return null

  if (!status?.conectado) {
    return (
      <Alert className="border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20">
        <AlertDescription className="flex items-center justify-between gap-2">
          <span>⚠️ Google Calendar não conectado — o evento será salvo no CRM, mas sem link Meet.</span>
          <Button size="sm" variant="outline" onClick={conectarGoogle}>
            Conectar Google Calendar →
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert className="border-green-300 bg-green-50 dark:bg-green-950/20">
      <AlertDescription>
        ✅ Conexão Google ativa — link Meet será gerado automaticamente
      </AlertDescription>
    </Alert>
  )
}
```

---

## 7. NovaReuniaoModal.tsx

```tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { useCriarEvento, useAtualizarEvento } from '@/hooks/useAgenda'
import { GoogleStatusBanner } from './GoogleStatusBanner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Input }    from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button }   from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label }    from '@/components/ui/label'
import { ComboboxLead } from '@/components/shared/ComboboxLead'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'

const schema = z.object({
  titulo:          z.string().min(3, 'Mínimo 3 caracteres'),
  leadId:          z.string().min(1, 'Selecione um lead ou cliente'),
  tipo:            z.enum(['REUNIAO','LIGACAO','VISITA','APRESENTACAO','FOLLOW_UP','DEMO','OUTRO']),
  status:          z.enum(['AGENDADO','CONFIRMADO','REALIZADO','CANCELADO','REAGENDADO','NAO_COMPARECEU']),
  dataInicio:      z.string().min(1, 'Informe a data/hora de início'),
  dataFim:         z.string().min(1, 'Informe a data/hora de fim'),
  tipoLocal:       z.enum(['ONLINE','PRESENCIAL']),
  descricao:       z.string().optional(),
  convidados:      z.string().optional(), // e-mails separados por vírgula
  lembreteMinutos: z.string(),
})
type FormData = z.infer<typeof schema>

interface NovaReuniaoModalProps {
  open:     boolean
  onClose:  () => void
  leadId?:  string    // pré-preenche se aberto do drawer do lead
  evento?:  any       // modo edição
}

export function NovaReuniaoModal({ open, onClose, leadId, evento }: NovaReuniaoModalProps) {
  const isEditing   = !!evento
  const criar       = useCriarEvento()
  const atualizar   = useAtualizarEvento()
  const [resultado, setResultado] = useState<any>(null)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: evento ? {
      titulo:          evento.titulo,
      leadId:          evento.leadId ?? '',
      tipo:            evento.tipo,
      status:          evento.status,
      dataInicio:      evento.dataInicio?.slice(0, 16) ?? '',
      dataFim:         evento.dataFim?.slice(0, 16) ?? '',
      tipoLocal:       evento.tipoLocal,
      descricao:       evento.descricao ?? '',
      convidados:      (evento.convidados ?? []).join(', '),
      lembreteMinutos: String(evento.lembreteMinutos ?? 30),
    } : {
      tipo:            'REUNIAO',
      status:          'AGENDADO',
      tipoLocal:       'ONLINE',
      lembreteMinutos: '30',
      leadId:          leadId ?? '',
    },
  })

  async function onSubmit(data: FormData) {
    const payload = {
      ...data,
      convidados:      data.convidados ? data.convidados.split(',').map(e => e.trim()).filter(Boolean) : [],
      lembreteMinutos: Number(data.lembreteMinutos),
      dataInicio:      new Date(data.dataInicio).toISOString(),
      dataFim:         new Date(data.dataFim).toISOString(),
    }

    if (isEditing) {
      await atualizar.mutateAsync({ id: evento.id, dados: payload })
      toast.success('Reunião atualizada com sucesso!')
      onClose()
    } else {
      const result = await criar.mutateAsync(payload)
      setResultado(result)
    }
  }

  // Estado pós-criação
  if (resultado) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>✅ Reunião criada!</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {resultado.googleCreated && resultado.evento.hangoutLink && (
              <Alert className="border-green-300 bg-green-50 dark:bg-green-950/20">
                <AlertDescription className="space-y-2">
                  <p>✅ Evento criado no Google Calendar</p>
                  <p className="text-xs font-mono break-all">🎥 {resultado.evento.hangoutLink}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(resultado.evento.hangoutLink)}>
                      Copiar link
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={resultado.evento.hangoutLink} target="_blank" rel="noopener">Abrir Meet</a>
                    </Button>
                    {resultado.evento.htmlLink && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={resultado.evento.htmlLink} target="_blank" rel="noopener">Ver no Google Calendar</a>
                      </Button>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}
            <Button className="w-full" onClick={onClose}>OK</Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Reunião' : 'Nova Reunião'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            <FormField control={form.control} name="titulo" render={({ field }) => (
              <FormItem>
                <FormLabel>Título *</FormLabel>
                <FormControl><Input placeholder="Ex: Apresentação do sistema ProSystem" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="leadId" render={({ field }) => (
              <FormItem>
                <FormLabel>Lead / Cliente *</FormLabel>
                <FormControl>
                  <ComboboxLead value={field.value} onChange={field.onChange} disabled={!!leadId} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="tipo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {['REUNIAO','LIGACAO','VISITA','APRESENTACAO','FOLLOW_UP','DEMO','OUTRO'].map(t => (
                        <SelectItem key={t} value={t}>{t.replace('_',' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {['AGENDADO','CONFIRMADO','REALIZADO','CANCELADO','REAGENDADO','NAO_COMPARECEU'].map(s => (
                        <SelectItem key={s} value={s}>{s.replace('_',' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="dataInicio" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data/hora início *</FormLabel>
                  <FormControl><Input type="datetime-local" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="dataFim" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data/hora fim *</FormLabel>
                  <FormControl><Input type="datetime-local" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="tipoLocal" render={({ field }) => (
              <FormItem>
                <FormLabel>Local</FormLabel>
                <FormControl>
                  <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="ONLINE" id="online" />
                      <Label htmlFor="online">Online (Google Meet)</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="PRESENCIAL" id="presencial" />
                      <Label htmlFor="presencial">Presencial</Label>
                    </div>
                  </RadioGroup>
                </FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="descricao" render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição</FormLabel>
                <FormControl><Textarea rows={3} placeholder="Detalhes sobre a reunião..." {...field} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="convidados" render={({ field }) => (
              <FormItem>
                <FormLabel>Convidados adicionais</FormLabel>
                <FormControl>
                  <Input placeholder="ana@prosystem.com.br, joao@empresa.com" {...field} />
                </FormControl>
                <p className="text-xs text-muted-foreground">E-mails separados por vírgula</p>
              </FormItem>
            )} />

            <FormField control={form.control} name="lembreteMinutos" render={({ field }) => (
              <FormItem>
                <FormLabel>Lembrete</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="0">Sem lembrete</SelectItem>
                    <SelectItem value="5">5 minutos antes</SelectItem>
                    <SelectItem value="10">10 minutos antes</SelectItem>
                    <SelectItem value="15">15 minutos antes</SelectItem>
                    <SelectItem value="30">30 minutos antes</SelectItem>
                    <SelectItem value="60">1 hora antes</SelectItem>
                    <SelectItem value="1440">1 dia antes</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />

            <GoogleStatusBanner />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={criar.isPending || atualizar.isPending}>
                {isEditing ? 'Salvar alterações' : 'Criar Reunião'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

---

## 8. ListaEventos.tsx

```tsx
'use client'
import { useMemo } from 'react'
import { EventoCard } from './EventoCard'

interface ListaEventosProps {
  eventos: any[]
  diaSelecionado?: Date | null
  onEditar: (evento: any) => void
}

export function ListaEventos({ eventos, diaSelecionado, onEditar }: ListaEventosProps) {
  const eventosFiltrados = useMemo(() => {
    if (!diaSelecionado) return eventos
    const dataKey = diaSelecionado.toISOString().split('T')[0]
    return eventos.filter(e => e.dataInicio.startsWith(dataKey))
  }, [eventos, diaSelecionado])

  // agrupa por dia
  const grupos = useMemo(() => {
    const map = new Map<string, any[]>()
    eventosFiltrados.forEach(e => {
      const key = e.dataInicio.split('T')[0]
      const arr = map.get(key) ?? []
      arr.push(e)
      map.set(key, arr)
    })
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [eventosFiltrados])

  const hoje     = new Date().toISOString().split('T')[0]
  const amanha   = new Date(Date.now() + 86_400_000).toISOString().split('T')[0]

  function labelDia(key: string) {
    if (key === hoje)   return `Hoje — ${_fmt(key)}`
    if (key === amanha) return `Amanhã — ${_fmt(key)}`
    return _fmt(key)
  }

  if (grupos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <span className="text-3xl">📅</span>
        <p className="text-sm">Nenhum evento {diaSelecionado ? 'neste dia' : 'no período'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {grupos.map(([key, evs]) => (
        <div key={key}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {labelDia(key)}
          </p>
          <div className="space-y-2">
            {evs.map(e => <EventoCard key={e.id} evento={e} onEditar={onEditar} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

function _fmt(key: string) {
  return new Date(key + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
```

---

## 9. AgendaPage.tsx (página principal)

```tsx
'use client'
import { useState } from 'react'
import { Button }         from '@/components/ui/button'
import { MiniCalendario } from '@/components/agenda/MiniCalendario'
import { ListaEventos }   from '@/components/agenda/ListaEventos'
import { NovaReuniaoModal } from '@/components/agenda/NovaReuniaoModal'
import { useEventos }     from '@/hooks/useAgenda'

export default function AgendaPage() {
  const [mes, setMes]           = useState(new Date())
  const [diaSelecionado, setDia] = useState<Date | null>(null)
  const [modalAberto, setModal] = useState(false)
  const [eventoEditando, setEventoEditando] = useState<any>(null)

  const inicio  = new Date(mes.getFullYear(), mes.getMonth(), 1).toISOString()
  const fim     = new Date(mes.getFullYear(), mes.getMonth() + 1, 0, 23, 59, 59).toISOString()
  const { data: eventos = [], isLoading } = useEventos({ inicio, fim })

  function abrirEdicao(evento: any) {
    setEventoEditando(evento)
    setModal(true)
  }

  function fecharModal() {
    setModal(false)
    setEventoEditando(null)
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Minha Agenda</h1>
        <Button onClick={() => setModal(true)}>+ Nova Reunião</Button>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-6">
        {/* Mini calendário */}
        <div className="border rounded-lg p-4 bg-card h-fit">
          <MiniCalendario
            eventos={eventos}
            mesSelecionado={mes}
            diaSelecionado={diaSelecionado}
            onDiaSelecionado={dia => setDia(d => d?.toISOString() === dia.toISOString() ? null : dia)}
            onMesAnterior={() => setMes(m => new Date(m.getFullYear(), m.getMonth() - 1))}
            onProximoMes={()  => setMes(m => new Date(m.getFullYear(), m.getMonth() + 1))}
          />
          <div className="mt-4 space-y-1 text-xs text-muted-foreground">
            <p className="font-medium mb-1">Legenda:</p>
            {[['bg-blue-500','Reunião'],['bg-green-500','Ligação'],['bg-yellow-500','Visita'],['bg-purple-500','Apresentação'],['bg-orange-500','Follow-up']].map(([cor,label]) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${cor}`} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Lista de eventos */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando...</div>
          ) : (
            <ListaEventos eventos={eventos} diaSelecionado={diaSelecionado} onEditar={abrirEdicao} />
          )}
        </div>
      </div>

      <NovaReuniaoModal
        open={modalAberto}
        onClose={fecharModal}
        evento={eventoEditando}
      />
    </div>
  )
}
```

---

## 10. AgendaLeadTab.tsx — aba no drawer do lead

```tsx
'use client'
import { useState } from 'react'
import { Button }       from '@/components/ui/button'
import { EventoCard }   from '@/components/agenda/EventoCard'
import { NovaReuniaoModal } from '@/components/agenda/NovaReuniaoModal'
import { useEventos }   from '@/hooks/useAgenda'

export function AgendaLeadTab({ leadId }: { leadId: string }) {
  const [modal, setModal]             = useState(false)
  const [eventoEditando, setEditando] = useState<any>(null)

  const { data: todos = [] } = useEventos({ leadId })

  const agora      = new Date()
  const proximos   = todos.filter(e => new Date(e.dataInicio) >= agora && e.status !== 'CANCELADO')
  const realizados = todos.filter(e => new Date(e.dataInicio) <  agora || e.status === 'REALIZADO')

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setModal(true)}>+ Nova Reunião</Button>
      </div>

      {proximos.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Próximas</p>
          <div className="space-y-2">
            {proximos.map(e => (
              <EventoCard key={e.id} evento={e} onEditar={ev => { setEditando(ev); setModal(true) }} compact />
            ))}
          </div>
        </div>
      )}

      {realizados.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Realizadas</p>
          <div className="space-y-2">
            {realizados.map(e => (
              <EventoCard key={e.id} evento={e} onEditar={ev => { setEditando(ev); setModal(true) }} compact />
            ))}
          </div>
        </div>
      )}

      {todos.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma reunião com este lead ainda.</p>
      )}

      <NovaReuniaoModal
        open={modal}
        onClose={() => { setModal(false); setEditando(null) }}
        leadId={leadId}
        evento={eventoEditando}
      />
    </div>
  )
}
```

---

## 11. AgendaEquipePage.tsx (SUPERVISAO+)

```tsx
'use client'
import { useState } from 'react'
import { useEventos }   from '@/hooks/useAgenda'
import { EventoCard }   from '@/components/agenda/EventoCard'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useVendedores } from '@/hooks/useVendedores'

export default function AgendaEquipePage() {
  const [vendedorId, setVendedorId] = useState<string>('')
  const [mes, setMes] = useState(new Date())

  const inicio = new Date(mes.getFullYear(), mes.getMonth(), 1).toISOString()
  const fim    = new Date(mes.getFullYear(), mes.getMonth() + 1, 0, 23, 59, 59).toISOString()
  const { data: eventos = [] } = useEventos({ inicio, fim, vendedorId: vendedorId || undefined })
  const { data: vendedores = [] } = useVendedores()

  const hoje = new Date().toISOString().split('T')[0]
  const eventosHoje = eventos.filter(e => e.dataInicio.startsWith(hoje))

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Agenda da Equipe</h1>
        <div className="flex gap-2">
          <Select value={vendedorId} onValueChange={setVendedorId}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Todos os vendedores" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {vendedores.map((v: any) => (
                <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold mb-3">
          Hoje — {new Date().toLocaleDateString('pt-BR')} ({eventosHoje.length} eventos)
        </p>
        <div className="space-y-2">
          {eventosHoje.length === 0
            ? <p className="text-sm text-muted-foreground">Nenhum evento hoje</p>
            : eventosHoje.map(e => <EventoCard key={e.id} evento={e} onEditar={() => {}} />)
          }
        </div>
      </div>
    </div>
  )
}
```

---

## 12. Sidebar — badge de contagem

```tsx
// Em components/layout/Sidebar.tsx — adicionar ao item Agenda:
import { useEventosHojeCount } from '@/hooks/useAgenda'

function SidebarItemAgenda() {
  const count = useEventosHojeCount().data ?? 0
  return (
    <SidebarItem href="/agenda" icon={CalendarIcon} label="Agenda">
      {count > 0 && (
        <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
          {count}
        </span>
      )}
    </SidebarItem>
  )
}
```

---

## 13. Configurações — Google Calendar (Settings page)

```tsx
// Em app/configuracoes/page.tsx — seção Integrações:
import { useGoogleAuthStatus, useDesconectarGoogle, conectarGoogle } from '@/hooks/useGoogleAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function GoogleCalendarConfig() {
  const { data: status } = useGoogleAuthStatus()
  const desconectar = useDesconectarGoogle()

  if (!status?.conectado) {
    return (
      <Card>
        <CardHeader><CardTitle>Google Calendar</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Não conectado
          </div>
          <p className="text-sm">Conecte sua conta do Google para:</p>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>✓ Criar reuniões com link Google Meet automático</li>
            <li>✓ Ver sua agenda sincronizada no CRM</li>
            <li>✓ Enviar convites automáticos aos leads</li>
          </ul>
          <Button onClick={conectarGoogle} className="gap-2">🔗 Conectar com Google</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle>Google Calendar</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span>Conectado como: <strong>{status.email}</strong></span>
        </div>
        <p className="text-xs text-muted-foreground">
          Conectado desde: {new Date(status.desde).toLocaleDateString('pt-BR')}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => desconectar.mutate()}
          disabled={desconectar.isPending}
        >
          Desconectar
        </Button>
      </CardContent>
    </Card>
  )
}
```

---

## Sprint 26 — STEP 05 PRONTO ✅
