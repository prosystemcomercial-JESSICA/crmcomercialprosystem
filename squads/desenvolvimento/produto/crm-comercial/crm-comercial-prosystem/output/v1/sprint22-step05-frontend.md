# Sprint 22 — Step 05 — Isabela Costa (Frontend)
# Módulo de Serviços Contratados — Implementação UI

---

## src/lib/api/servico.ts

```typescript
import { api } from '../api'

export const listarServicos      = (params?: Record<string, any>) => api.get('/servicos', { params }).then(r => r.data)
export const obterServico        = (id: string) => api.get(`/servicos/${id}`).then(r => r.data)
export const criarServico        = (data: any) => api.post('/servicos', data).then(r => r.data)
export const atualizarStatus     = (id: string, statusGeral: string) => api.patch(`/servicos/${id}/status`, { statusGeral }).then(r => r.data)
export const atualizarComercial  = (id: string, data: any) => api.patch(`/servicos/${id}/comercial`, data).then(r => r.data)
export const atualizarFinanceiro = (id: string, data: any) => api.patch(`/servicos/${id}/financeiro`, data).then(r => r.data)
export const atualizarTecnico    = (id: string, data: any) => api.patch(`/servicos/${id}/tecnico`, data).then(r => r.data)
export const atualizarAgendamento = (id: string, data: any) => api.patch(`/servicos/${id}/agendamento`, data).then(r => r.data)
export const registrarExecucao   = (id: string, data: any) => api.patch(`/servicos/${id}/execucao`, data).then(r => r.data)
export const registrarComunicacao = (id: string, data: any) => api.post(`/servicos/${id}/comunicacao`, data).then(r => r.data)
export const marcarResposta      = (comId: string, data: any) => api.patch(`/servicos/comunicacao/${comId}/resposta`, data).then(r => r.data)

export const uploadAnexoServico = (servicoId: string, file: File, categoria: string, visibilidade: string) => {
  const fd = new FormData()
  fd.append('arquivo', file)
  fd.append('categoria', categoria)
  fd.append('visibilidade', visibilidade)
  return api.post(`/servicos/${servicoId}/anexos`, fd).then(r => r.data)
}
export const excluirAnexoServico = (anexoId: string) => api.delete(`/servicos/anexos/${anexoId}`).then(r => r.data)
export const downloadUrlAnexoServico = (anexoId: string) => `/api/servicos/anexos/${anexoId}/download`

export const listarClientesBase  = (params?: any) => api.get('/clientes-base', { params }).then(r => r.data)
export const obterClienteBase    = (id: string) => api.get(`/clientes-base/${id}`).then(r => r.data)
export const criarClienteBase    = (data: any) => api.post('/clientes-base', data).then(r => r.data)
export const editarClienteBase   = (id: string, data: any) => api.put(`/clientes-base/${id}`, data).then(r => r.data)

export const listarTiposServico  = (params?: any) => api.get('/tipos-servico', { params }).then(r => r.data)
export const criarTipoServico    = (data: any) => api.post('/tipos-servico', data).then(r => r.data)
export const editarTipoServico   = (id: string, data: any) => api.put(`/tipos-servico/${id}`, data).then(r => r.data)
```

---

## src/app/(dashboard)/servicos/page.tsx

```tsx
'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listarServicos } from '@/lib/api/servico'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, X } from 'lucide-react'
import { ServicoDrawer } from '@/components/servicos/ServicoDrawer'
import { NovoServicoModal } from '@/components/servicos/NovoServicoModal'
import { PrioridadeBadge } from '@/components/servicos/PrioridadeBadge'
import { StatusServicoBadge } from '@/components/servicos/StatusServicoBadge'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const PRIORIDADE_ORDEM = ['Crítica', 'Urgente', 'Alta', 'Normal', 'Baixa']

export default function ServicosPage() {
  const [filtros, setFiltros] = useState<Record<string, string>>({})
  const [page, setPage] = useState(1)
  const [servicoSelecionado, setServicoSelecionado] = useState<string | null>(null)
  const [novoOpen, setNovoOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['servicos', filtros, page],
    queryFn: () => listarServicos({ ...filtros, page }),
    staleTime: 30_000,
  })

  function setFiltro(key: string, value: string) {
    setFiltros(prev => value ? { ...prev, [key]: value } : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key)))
    setPage(1)
  }

  function removerFiltro(key: string) { setFiltro(key, '') }

  const chipsAtivos = Object.entries(filtros).filter(([, v]) => v)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Serviços Contratados</h1>
          <p className="text-sm text-muted-foreground">Serviços avulsos solicitados por clientes da base Prosystem</p>
        </div>
        <Button onClick={() => setNovoOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Novo Serviço
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <Select onValueChange={v => setFiltro('statusGeral', v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            {['Rascunho','Lançado','Aguardando análise comercial','Aguardando orçamento',
              'Orçamento enviado','Aguardando aprovação do cliente','Aprovado pelo cliente',
              'Reprovado pelo cliente','Aguardando pagamento','Pagamento confirmado',
              'Aguardando designação técnica','Designado ao técnico','Agendado',
              'Em execução','Aguardando cliente','Aguardando informação','Concluído','Cancelado','Reaberto']
              .map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select onValueChange={v => setFiltro('prioridade', v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            {PRIORIDADE_ORDEM.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Chips de filtros ativos */}
      {chipsAtivos.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {chipsAtivos.map(([k, v]) => (
            <Badge key={k} variant="secondary" className="flex items-center gap-1">
              {v}
              <button onClick={() => removerFiltro(k)}><X className="w-3 h-3" /></button>
            </Badge>
          ))}
        </div>
      )}

      {/* Tabela */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left p-3">Nº</th>
              <th className="text-left p-3">Cliente</th>
              <th className="text-left p-3">Serviço</th>
              <th className="text-left p-3">Prioridade</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Técnico</th>
              <th className="text-left p-3">Data</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
            )}
            {data?.servicos?.map((s: any) => (
              <tr
                key={s.id}
                className="border-t hover:bg-muted/50 cursor-pointer"
                onClick={() => setServicoSelecionado(s.id)}
              >
                <td className="p-3 font-mono text-xs">{s.numero}</td>
                <td className="p-3">
                  <div className="font-medium">{s.clienteBase.nomeFantasia || s.clienteBase.razaoSocial}</div>
                  <div className="text-xs text-muted-foreground">{s.clienteBase.cnpj}</div>
                </td>
                <td className="p-3">
                  <div>{s.tipoServico.nome}</div>
                  <div className="text-xs text-muted-foreground">{s.tipoServico.categoria}</div>
                </td>
                <td className="p-3"><PrioridadeBadge prioridade={s.prioridade} /></td>
                <td className="p-3"><StatusServicoBadge status={s.statusGeral} /></td>
                <td className="p-3 text-sm">{s.tecnicoDesignado?.nome ?? '—'}</td>
                <td className="p-3 text-xs text-muted-foreground">
                  {format(new Date(s.createdAt), 'dd/MM/yy', { locale: ptBR })}
                </td>
              </tr>
            ))}
            {!isLoading && data?.servicos?.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhum serviço encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <span className="flex items-center text-sm">Página {page} de {data.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
        </div>
      )}

      {servicoSelecionado && (
        <ServicoDrawer
          servicoId={servicoSelecionado}
          onClose={() => setServicoSelecionado(null)}
        />
      )}

      <NovoServicoModal open={novoOpen} onClose={() => setNovoOpen(false)} />
    </div>
  )
}
```

---

## src/components/servicos/PrioridadeBadge.tsx

```tsx
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const CONFIG: Record<string, { label: string; className: string }> = {
  Crítica:  { label: '🔴 Crítica', className: 'bg-red-100 text-red-800 border-red-200' },
  Urgente:  { label: '🔴 Urgente', className: 'bg-red-100 text-red-800 border-red-200' },
  Alta:     { label: '🟠 Alta',    className: 'bg-orange-100 text-orange-800 border-orange-200' },
  Normal:   { label: '🟡 Normal',  className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  Baixa:    { label: '🟢 Baixa',   className: 'bg-green-100 text-green-800 border-green-200' },
}

export function PrioridadeBadge({ prioridade }: { prioridade: string }) {
  const cfg = CONFIG[prioridade] ?? { label: prioridade, className: '' }
  return <Badge variant="outline" className={cn('text-xs font-medium', cfg.className)}>{cfg.label}</Badge>
}
```

---

## src/components/servicos/StatusServicoBadge.tsx

```tsx
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const MAP: Record<string, string> = {
  'Rascunho':                      'bg-gray-100 text-gray-600',
  'Lançado':                       'bg-blue-100 text-blue-700',
  'Aguardando análise comercial':  'bg-yellow-100 text-yellow-700',
  'Aguardando orçamento':          'bg-yellow-100 text-yellow-700',
  'Orçamento enviado':             'bg-blue-100 text-blue-700',
  'Aguardando aprovação do cliente': 'bg-amber-100 text-amber-700',
  'Aprovado pelo cliente':         'bg-emerald-100 text-emerald-700',
  'Reprovado pelo cliente':        'bg-red-100 text-red-700',
  'Aguardando pagamento':          'bg-orange-100 text-orange-700',
  'Pagamento confirmado':          'bg-emerald-100 text-emerald-700',
  'Aguardando designação técnica': 'bg-yellow-100 text-yellow-700',
  'Designado ao técnico':          'bg-blue-100 text-blue-700',
  'Agendado':                      'bg-indigo-100 text-indigo-700',
  'Em execução':                   'bg-purple-100 text-purple-700 animate-pulse',
  'Aguardando cliente':            'bg-amber-100 text-amber-700',
  'Aguardando informação':         'bg-amber-100 text-amber-700',
  'Aguardando desenvolvimento':    'bg-amber-100 text-amber-700',
  'Aguardando terceiro':           'bg-amber-100 text-amber-700',
  'Concluído':                     'bg-green-100 text-green-700',
  'Cancelado':                     'bg-red-100 text-red-700',
  'Reaberto':                      'bg-orange-100 text-orange-700',
}

export function StatusServicoBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', MAP[status] ?? 'bg-gray-100 text-gray-600')}>
      {status}
    </Badge>
  )
}
```

---

## src/components/servicos/ServicoDrawer.tsx

```tsx
'use client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obterServico } from '@/lib/api/servico'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusServicoBadge } from './StatusServicoBadge'
import { PrioridadeBadge } from './PrioridadeBadge'
import { AbaGeral } from './abas/AbaGeral'
import { AbaComercial } from './abas/AbaComercial'
import { AbaFinanceiro } from './abas/AbaFinanceiro'
import { AbaTecnico } from './abas/AbaTecnico'
import { AbaAgendamento } from './abas/AbaAgendamento'
import { AbaExecucao } from './abas/AbaExecucao'
import { AbaHistorico } from './abas/AbaHistorico'
import { AbaAnexosServico } from './abas/AbaAnexosServico'
import { AbaComunicacao } from './abas/AbaComunicacao'
import { usePermission } from '@/hooks/usePermission'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Props {
  servicoId: string
  onClose: () => void
}

export function ServicoDrawer({ servicoId, onClose }: Props) {
  const { data: servico, isLoading } = useQuery({
    queryKey: ['servico', servicoId],
    queryFn: () => obterServico(servicoId),
    staleTime: 10_000,
  })

  if (isLoading || !servico) return null

  return (
    <Sheet open onOpenChange={open => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto p-0">
        <SheetHeader className="p-6 border-b bg-muted/40">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-mono text-muted-foreground">{servico.numero}</p>
              <h2 className="text-lg font-bold mt-1">{servico.tipoServico.nome}</h2>
              <p className="text-sm text-muted-foreground">
                {servico.clienteBase.nomeFantasia || servico.clienteBase.razaoSocial}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusServicoBadge status={servico.statusGeral} />
              <PrioridadeBadge prioridade={servico.prioridade} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Lançado por {servico.lancadoPor.nome} · {format(new Date(servico.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </SheetHeader>

        <Tabs defaultValue="geral" className="flex-1">
          <TabsList className="w-full justify-start px-6 pt-4 gap-1 flex-wrap h-auto bg-transparent border-b rounded-none">
            {['geral','comercial','financeiro','tecnico','agendamento','execucao','historico','anexos','comunicacao'].map(tab => (
              <TabsTrigger key={tab} value={tab} className="text-xs capitalize">{tab}</TabsTrigger>
            ))}
          </TabsList>

          <div className="p-6">
            <TabsContent value="geral">      <AbaGeral servico={servico} /></TabsContent>
            <TabsContent value="comercial">  <AbaComercial servico={servico} /></TabsContent>
            <TabsContent value="financeiro"> <AbaFinanceiro servico={servico} /></TabsContent>
            <TabsContent value="tecnico">    <AbaTecnico servico={servico} /></TabsContent>
            <TabsContent value="agendamento"><AbaAgendamento servico={servico} /></TabsContent>
            <TabsContent value="execucao">   <AbaExecucao servico={servico} /></TabsContent>
            <TabsContent value="historico">  <AbaHistorico servico={servico} /></TabsContent>
            <TabsContent value="anexos">     <AbaAnexosServico servico={servico} /></TabsContent>
            <TabsContent value="comunicacao"><AbaComunicacao servico={servico} /></TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
```

---

## src/components/servicos/abas/AbaComercial.tsx

```tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { atualizarComercial } from '@/lib/api/servico'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePermission } from '@/hooks/usePermission'
import { toast } from 'sonner'

const schema = z.object({
  valorNegociado:     z.coerce.number().optional(),
  desconto:           z.coerce.number().optional(),
  motivoDesconto:     z.string().optional(),
  formaPagamento:     z.string().optional(),
  aprovadoEmData:     z.string().optional(),
  aprovadoPorCliente: z.string().optional(),
  comoAprovou:        z.string().optional(),
  observacoesComerciais: z.string().optional(),
})

const FORMAS_PAGAMENTO = [
  'Pix', 'Boleto', 'Cartão de crédito', 'Cartão de débito',
  'Junto com mensalidade', 'Crédito em conta', 'Cortesia', 'A combinar',
]

export function AbaComercial({ servico }: { servico: any }) {
  const { can } = usePermission()
  const qc = useQueryClient()
  const podeEditar = can('editarComercial')

  const { register, handleSubmit, setValue, watch } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      valorNegociado:     servico.valorNegociado ?? servico.valorPadrao ?? '',
      desconto:           servico.desconto ?? '',
      motivoDesconto:     servico.motivoDesconto ?? '',
      formaPagamento:     servico.formaPagamento ?? '',
      aprovadoEmData:     servico.aprovadoEmData?.slice(0, 10) ?? '',
      aprovadoPorCliente: servico.aprovadoPorCliente ?? '',
      comoAprovou:        servico.comoAprovou ?? '',
      observacoesComerciais: servico.observacoesComerciais ?? '',
    },
  })

  const { mutate, isPending } = useMutation({
    mutationFn: (data: any) => atualizarComercial(servico.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['servico', servico.id] })
      toast.success('Dados comerciais salvos')
    },
  })

  const valorNeg = watch('valorNegociado') as number
  const desconto = watch('desconto') as number
  const pct = valorNeg && desconto ? ((desconto / valorNeg) * 100).toFixed(1) : null

  return (
    <form onSubmit={handleSubmit(d => mutate(d))} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Valor padrão</Label>
          <Input value={`R$ ${servico.valorPadrao?.toFixed(2) ?? '—'}`} disabled />
        </div>
        <div className="space-y-1">
          <Label>Valor negociado</Label>
          <Input type="number" step="0.01" {...register('valorNegociado')} disabled={!podeEditar} />
        </div>
        <div className="space-y-1">
          <Label>Desconto (R$) {pct && <span className="text-xs text-muted-foreground">({pct}%)</span>}</Label>
          <Input type="number" step="0.01" {...register('desconto')} disabled={!podeEditar} />
        </div>
        <div className="space-y-1">
          <Label>Motivo do desconto</Label>
          <Input {...register('motivoDesconto')} disabled={!podeEditar} />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Forma de pagamento</Label>
        <Select
          defaultValue={servico.formaPagamento ?? ''}
          onValueChange={v => setValue('formaPagamento', v)}
          disabled={!podeEditar}
        >
          <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
          <SelectContent>
            {FORMAS_PAGAMENTO.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <p className="text-sm font-medium">Aprovação do cliente</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Data da aprovação</Label>
            <Input type="date" {...register('aprovadoEmData')} disabled={!podeEditar} />
          </div>
          <div className="space-y-1">
            <Label>Aprovado por (cliente)</Label>
            <Input {...register('aprovadoPorCliente')} disabled={!podeEditar} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Como aprovou</Label>
            <Select
              defaultValue={servico.comoAprovou ?? ''}
              onValueChange={v => setValue('comoAprovou', v)}
              disabled={!podeEditar}
            >
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {['WhatsApp','E-mail','Assinatura','Verbal','Reunião online'].map(o =>
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Label>Observações comerciais</Label>
        <Textarea {...register('observacoesComerciais')} rows={3} disabled={!podeEditar} />
      </div>

      {podeEditar && (
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Salvando...' : 'Salvar comercial'}
        </Button>
      )}
    </form>
  )
}
```

---

## src/components/servicos/abas/AbaFinanceiro.tsx

```tsx
'use client'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { atualizarFinanceiro } from '@/lib/api/servico'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { usePermission } from '@/hooks/usePermission'
import { toast } from 'sonner'

const STATUS_FIN = [
  'Aguardando cobrança', 'Cobrança enviada', 'Aguardando pagamento', 'Pago',
  'Isento', 'Cortesia', 'Parcelado', 'Pago parcialmente', 'Em atraso', 'Cancelado',
]

export function AbaFinanceiro({ servico }: { servico: any }) {
  const { can } = usePermission()
  const qc = useQueryClient()
  const podeEditar = can('editarFinanceiro')

  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      statusFinanceiro:    servico.statusFinanceiro ?? 'Aguardando cobrança',
      valorCobrado:        servico.valorCobrado ?? '',
      dataCobranca:        servico.dataCobranca?.slice(0, 10) ?? '',
      dataVencimento:      servico.dataVencimento?.slice(0, 10) ?? '',
      dataPagamento:       servico.dataPagamento?.slice(0, 10) ?? '',
      valorPago:           servico.valorPago ?? '',
      liberadoParaExecucao: servico.liberadoParaExecucao ?? false,
      observacoesFinanceiro: servico.observacoesFinanceiro ?? '',
    },
  })

  const { mutate, isPending } = useMutation({
    mutationFn: (data: any) => atualizarFinanceiro(servico.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['servico', servico.id] })
      toast.success('Dados financeiros salvos')
    },
  })

  return (
    <form onSubmit={handleSubmit(d => mutate(d))} className="space-y-6">
      <div className="space-y-1">
        <Label>Status financeiro</Label>
        <Select
          defaultValue={servico.statusFinanceiro ?? ''}
          onValueChange={v => setValue('statusFinanceiro', v)}
          disabled={!podeEditar}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_FIN.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Valor cobrado</Label>
          <Input type="number" step="0.01" {...register('valorCobrado')} disabled={!podeEditar} />
        </div>
        <div className="space-y-1">
          <Label>Data da cobrança</Label>
          <Input type="date" {...register('dataCobranca')} disabled={!podeEditar} />
        </div>
        <div className="space-y-1">
          <Label>Data de vencimento</Label>
          <Input type="date" {...register('dataVencimento')} disabled={!podeEditar} />
        </div>
        <div className="space-y-1">
          <Label>Data de pagamento</Label>
          <Input type="date" {...register('dataPagamento')} disabled={!podeEditar} />
        </div>
        <div className="space-y-1 col-span-2">
          <Label>Valor pago</Label>
          <Input type="number" step="0.01" {...register('valorPago')} disabled={!podeEditar} />
        </div>
      </div>

      {podeEditar && !servico.liberadoParaExecucao && (
        <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
          <Checkbox
            id="liberar"
            onCheckedChange={checked => setValue('liberadoParaExecucao', !!checked)}
          />
          <Label htmlFor="liberar" className="text-green-800 font-medium cursor-pointer">
            Liberar para execução técnica
          </Label>
        </div>
      )}

      {servico.liberadoParaExecucao && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          ✅ Liberado para execução por {servico.liberadoPor?.nome}
        </div>
      )}

      <div className="space-y-1">
        <Label>Observações</Label>
        <Textarea {...register('observacoesFinanceiro')} rows={3} disabled={!podeEditar} />
      </div>

      {podeEditar && (
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Salvando...' : 'Salvar financeiro'}
        </Button>
      )}
    </form>
  )
}
```

---

## src/components/servicos/abas/AbaTecnico.tsx

```tsx
'use client'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { atualizarTecnico } from '@/lib/api/servico'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePermission } from '@/hooks/usePermission'
import { api } from '@/lib/api'
import { toast } from 'sonner'

const STATUS_TEC = [
  'Aguardando designação','Designado','Analisando','Em execução',
  'Aguardando cliente','Aguardando informação','Aguardando desenvolvimento',
  'Aguardando terceiro','Aguardando agendamento','Agendado','Suspenso',
  'Reaberto','Parcialmente concluído','Concluído','Cancelado',
  'Não será executado','Transferido',
]

const SETORES = ['Comercial','Suporte','Implantação','Desenvolvimento','Financeiro','Fiscal','Diretoria','Técnico externo']
const COMPLEXIDADES = ['Baixa','Média','Alta','Muito alta','Crítica']

export function AbaTecnico({ servico }: { servico: any }) {
  const { can } = usePermission()
  const qc = useQueryClient()
  const podeEditar = can('designarTecnico') || can('editarExecucao')

  const { data: tecnicos } = useQuery({
    queryKey: ['usuarios-tecnicos'],
    queryFn: () => api.get('/usuarios', { params: { perfil: 'TECNICO' } }).then(r => r.data),
    staleTime: 300_000,
  })

  const { register, handleSubmit, setValue } = useForm({
    defaultValues: {
      setorResponsavel:    servico.setorResponsavel ?? '',
      tecnicoDesignadoId:  servico.tecnicoDesignadoId ?? '',
      complexidade:        servico.complexidade ?? 'Baixa',
      statusTecnico:       servico.statusTecnico ?? 'Aguardando designação',
      prazoDiasUteis:      servico.prazoDiasUteis ?? '',
      observacoesTecnicas: servico.observacoesTecnicas ?? '',
    },
  })

  const { mutate, isPending } = useMutation({
    mutationFn: (data: any) => atualizarTecnico(servico.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['servico', servico.id] })
      toast.success('Dados técnicos salvos')
    },
  })

  return (
    <form onSubmit={handleSubmit(d => mutate(d))} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Setor responsável</Label>
          <Select defaultValue={servico.setorResponsavel ?? ''} onValueChange={v => setValue('setorResponsavel', v)} disabled={!can('designarTecnico')}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>{SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Técnico designado</Label>
          <Select defaultValue={servico.tecnicoDesignadoId ?? ''} onValueChange={v => setValue('tecnicoDesignadoId', v)} disabled={!can('designarTecnico')}>
            <SelectTrigger><SelectValue placeholder="Selecionar técnico" /></SelectTrigger>
            <SelectContent>
              {tecnicos?.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Complexidade</Label>
          <Select defaultValue={servico.complexidade ?? 'Baixa'} onValueChange={v => setValue('complexidade', v)} disabled={!podeEditar}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{COMPLEXIDADES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Prazo (dias úteis)</Label>
          <Input type="number" {...register('prazoDiasUteis')} disabled={!podeEditar} />
          {servico.dataPrevista && (
            <p className="text-xs text-muted-foreground">
              Previsto: {new Date(servico.dataPrevista).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label>Status técnico</Label>
        <Select defaultValue={servico.statusTecnico ?? ''} onValueChange={v => setValue('statusTecnico', v)} disabled={!podeEditar}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_TEC.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>Observações técnicas</Label>
        <Textarea {...register('observacoesTecnicas')} rows={4} disabled={!podeEditar} />
      </div>

      {podeEditar && (
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Salvando...' : 'Salvar técnico'}
        </Button>
      )}
    </form>
  )
}
```

---

## src/components/servicos/abas/AbaHistorico.tsx

```tsx
'use client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const ICONES: Record<string, string> = {
  servico_criado:        '📋',
  status_alterado:       '🔄',
  status_tecnico_alterado: '🔧',
  status_financeiro_alterado: '💰',
  tecnico_designado:     '👤',
  agendado:              '📅',
  agendamento_confirmado: '✅',
  execucao_iniciada:     '▶️',
  execucao_concluida:    '🏁',
  pagamento_registrado:  '💳',
  liberado_para_execucao: '🔓',
  aprovacao_cliente:     '👍',
  arquivo_anexado:       '📎',
  arquivo_excluido:      '🗑️',
  comunicacao_registrada: '💬',
  campo_editado:         '✏️',
  cancelado:             '❌',
  reaberto:              '🔁',
}

export function AbaHistorico({ servico }: { servico: any }) {
  const historicos = servico.historicos ?? []

  return (
    <div className="space-y-3">
      {historicos.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Sem eventos registrados</p>
      )}
      {historicos.map((h: any) => (
        <div key={h.id} className="flex gap-3 text-sm">
          <span className="text-lg flex-shrink-0 w-8 text-center">{ICONES[h.tipo] ?? '•'}</span>
          <div className="flex-1">
            <p className="font-medium">{h.descricao}</p>
            {h.valorAnterior && h.valorNovo && (
              <p className="text-xs text-muted-foreground">
                <span className="line-through">{h.valorAnterior}</span> → <span>{h.valorNovo}</span>
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              {h.autor.nome} · {format(new Date(h.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
```

---

## src/components/servicos/abas/AbaComunicacao.tsx

```tsx
'use client'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { registrarComunicacao, marcarResposta } from '@/lib/api/servico'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { MessageSquare, Plus } from 'lucide-react'

const CANAIS = ['WhatsApp','E-mail','Ligação','Reunião online','Reunião presencial']

export function AbaComunicacao({ servico }: { servico: any }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ destinatarioNome: '', canal: 'WhatsApp', mensagem: '' })
  const qc = useQueryClient()

  const { mutate, isPending } = useMutation({
    mutationFn: () => registrarComunicacao(servico.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['servico', servico.id] })
      setModalOpen(false)
      setForm({ destinatarioNome: '', canal: 'WhatsApp', mensagem: '' })
      toast.success('Comunicação registrada')
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Registrar mensagem
        </Button>
      </div>

      {servico.comunicacoes?.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma comunicação registrada</p>
      )}

      <div className="space-y-3">
        {servico.comunicacoes?.map((c: any) => (
          <div key={c.id} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">{c.remetente.nome}</span>
                <span className="text-xs text-muted-foreground">→ {c.destinatarioNome}</span>
                <span className="text-xs bg-muted px-2 py-0.5 rounded">{c.canal}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {format(new Date(c.dataEnvio), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
            <p className="text-sm">{c.mensagem}</p>
            {c.respostaRecebida && (
              <div className="text-xs bg-green-50 border border-green-200 rounded p-2 text-green-800">
                ✅ Resposta recebida: {c.resumoResposta}
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar comunicação</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Destinatário</Label>
              <Input value={form.destinatarioNome} onChange={e => setForm(f => ({ ...f, destinatarioNome: e.target.value }))} placeholder="Nome do contato no cliente" />
            </div>
            <div className="space-y-1">
              <Label>Canal</Label>
              <Select value={form.canal} onValueChange={v => setForm(f => ({ ...f, canal: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CANAIS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Mensagem</Label>
              <Textarea value={form.mensagem} onChange={e => setForm(f => ({ ...f, mensagem: e.target.value }))} rows={4} />
            </div>
            <Button onClick={() => mutate()} disabled={isPending || !form.mensagem || !form.destinatarioNome}>
              {isPending ? 'Salvando...' : 'Registrar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

---

## src/components/servicos/NovoServicoModal.tsx

```tsx
'use client'
import { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { criarServico, listarClientesBase, listarTiposServico } from '@/lib/api/servico'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

const ORIGENS = [
  'Cliente solicitou pelo WhatsApp','Cliente solicitou por ligação','Cliente solicitou por e-mail',
  'Cliente solicitou pelo suporte','Cliente solicitou em reunião','Vendedor identificou oportunidade',
  'Técnico identificou necessidade','Supervisão lançou',
]
const PRIORIDADES = ['Baixa','Normal','Alta','Urgente','Crítica']
const CANAIS = ['WhatsApp','Ligação','E-mail','Suporte Freshdesk','Reunião online','Reunião presencial']

export function NovoServicoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<any>({ prioridade: 'Normal', statusGeral: 'Lançado' })
  const [clienteBusca, setClienteBusca] = useState('')

  const { data: clientes } = useQuery({
    queryKey: ['clientes-base', clienteBusca],
    queryFn: () => listarClientesBase({ q: clienteBusca }),
    enabled: clienteBusca.length > 2,
    staleTime: 60_000,
  })

  const { data: tipos } = useQuery({
    queryKey: ['tipos-servico'],
    queryFn: () => listarTiposServico({ ativo: true }),
    staleTime: 300_000,
  })

  const { mutate, isPending } = useMutation({
    mutationFn: criarServico,
    onSuccess: (novo) => {
      qc.invalidateQueries({ queryKey: ['servicos'] })
      toast.success(`Serviço ${novo.numero} lançado com sucesso!`)
      onClose()
    },
  })

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novo Serviço Contratado</DialogTitle></DialogHeader>

        <div className="space-y-6">
          {/* Cliente */}
          <div className="space-y-3">
            <p className="font-medium text-sm">1. Cliente</p>
            <Input
              placeholder="Buscar por razão social, CNPJ ou código..."
              value={clienteBusca}
              onChange={e => setClienteBusca(e.target.value)}
            />
            {clientes?.clientes && clienteBusca.length > 2 && (
              <div className="border rounded max-h-40 overflow-y-auto">
                {clientes.clientes.map((c: any) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`w-full text-left px-3 py-2 hover:bg-muted text-sm ${form.clienteBaseId === c.id ? 'bg-primary/10' : ''}`}
                    onClick={() => { set('clienteBaseId', c.id); setClienteBusca(c.nomeFantasia || c.razaoSocial) }}
                  >
                    <div className="font-medium">{c.nomeFantasia || c.razaoSocial}</div>
                    <div className="text-xs text-muted-foreground">{c.cnpj} · {c.planoAtual}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Serviço */}
          <div className="space-y-3">
            <p className="font-medium text-sm">2. Tipo de serviço</p>
            <Select onValueChange={v => set('tipoServicoId', v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar serviço" /></SelectTrigger>
              <SelectContent>
                {tipos?.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.nome} — {t.categoria}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Origem</Label>
                <Select onValueChange={v => set('origemSolicitacao', v)}>
                  <SelectTrigger><SelectValue placeholder="Origem" /></SelectTrigger>
                  <SelectContent>{ORIGENS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Canal</Label>
                <Select onValueChange={v => set('canalEntrada', v)}>
                  <SelectTrigger><SelectValue placeholder="Canal" /></SelectTrigger>
                  <SelectContent>{CANAIS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Prioridade</Label>
                <Select defaultValue="Normal" onValueChange={v => set('prioridade', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORIDADES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Solicitante + descrição */}
          <div className="space-y-3">
            <p className="font-medium text-sm">3. Solicitante e detalhamento</p>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Nome do solicitante" onChange={e => set('nomeSolicitante', e.target.value)} />
              <Input placeholder="Cargo" onChange={e => set('cargoSolicitante', e.target.value)} />
              <Input placeholder="WhatsApp" onChange={e => set('whatsappSolicitante', e.target.value)} />
              <Input placeholder="E-mail" type="email" onChange={e => set('emailSolicitante', e.target.value)} />
            </div>
            <Textarea
              placeholder="Problema / necessidade apresentada pelo cliente..."
              rows={3}
              onChange={e => set('problemaNecessidade', e.target.value)}
            />
            <Textarea
              placeholder="Resultado esperado pelo cliente..."
              rows={2}
              onChange={e => set('resultadoEsperado', e.target.value)}
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              variant="outline"
              onClick={() => mutate({ ...form, statusGeral: 'Rascunho' })}
              disabled={isPending || !form.clienteBaseId || !form.tipoServicoId}
            >
              Salvar rascunho
            </Button>
            <Button
              onClick={() => mutate({ ...form, statusGeral: 'Lançado' })}
              disabled={isPending || !form.clienteBaseId || !form.tipoServicoId}
            >
              {isPending ? 'Lançando...' : 'Lançar serviço'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

---

## usePermission — novas actions

```typescript
// Adicionar ao mapa de actions no usePermission.ts:
editarComercial:     ['SUPERVISAO', 'CEO', 'ADMIN'],
editarFinanceiro:    ['FINANCEIRO', 'SUPERVISAO', 'CEO', 'ADMIN'],
designarTecnico:     ['SUPERVISAO', 'CEO', 'ADMIN'],
editarExecucao:      ['TECNICO', 'SUPERVISAO', 'CEO', 'ADMIN'],
aprovarCortesia:     ['SUPERVISAO', 'CEO', 'ADMIN'],
gerenciarCatalogo:   ['CEO', 'ADMIN'],
gerenciarClienteBase: ['SUPERVISAO', 'CEO', 'ADMIN'],
verAnexosInternos:   ['FINANCEIRO', 'TECNICO', 'SUPERVISAO', 'CEO', 'ADMIN'],
excluirQualquerAnexoServico: ['SUPERVISAO', 'CEO', 'ADMIN'],
```

---

## Sidebar — nova entrada

```tsx
// Adicionar ao sidebar após BI Avançado:
{
  href: '/servicos',
  icon: Wrench,
  label: 'Serviços Contratados',
  subItems: [
    { href: '/servicos', label: 'Serviços' },
    { href: '/servicos/clientes', label: 'Clientes Base' },
    { href: '/servicos/catalogo', label: 'Catálogo' },
  ]
}
```

---

## Sprint 22 — FRONTEND PRONTO ✅
