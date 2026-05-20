# Sprint 24 — Step 05 — Isabela Costa (Frontend Developer)
# Módulo de Metas e Comissões — Pages e Components

---

## Estrutura de arquivos

```
src/app/(dashboard)/metas-comissoes/
  metas/                page.tsx
  regras-comissao/      page.tsx
  comissoes/            page.tsx
  recebimentos/         page.tsx
  indicacoes/           page.tsx
  parceiros/            page.tsx

src/components/metas-comissoes/
  StatusMetaBadge.tsx
  StatusComissaoBadge.tsx
  StatusRecebimentoBadge.tsx
  StatusIndicacaoBadge.tsx
  ProgressoMeta.tsx
  MetaDrawer.tsx
  RegraComissaoDrawer.tsx
  RecebimentoDrawer.tsx
  NovaIndicacaoModal.tsx
  ParceiroDrawer.tsx
```

---

## Sidebar — adição em nav.tsx

```tsx
// Adicionar após "Serviços Contratados":
{
  label: 'Metas e Comissões',
  icon: <Target className="h-4 w-4" />,
  children: [
    { label: 'Meu Dashboard', href: '/metas-comissoes/dashboard', roles: ['VENDEDOR','SUPERVISAO','CEO','ADMIN'] },
    { label: 'Minhas Metas', href: '/metas-comissoes/metas', roles: ['VENDEDOR','SUPERVISAO','CEO','ADMIN','FINANCEIRO'] },
    { label: 'Minhas Comissões', href: '/metas-comissoes/comissoes', roles: ['VENDEDOR','SUPERVISAO','CEO','ADMIN','FINANCEIRO'] },
    { label: 'Minhas Indicações', href: '/metas-comissoes/indicacoes', roles: ['VENDEDOR','SUPERVISAO','CEO','ADMIN'] },
    { label: 'Recebimentos', href: '/metas-comissoes/recebimentos', roles: ['FINANCEIRO','SUPERVISAO','CEO','ADMIN'] },
    // --- separador ---
    { label: 'Metas (gestão)', href: '/metas-comissoes/metas', roles: ['SUPERVISAO','CEO','ADMIN'], separator: true },
    { label: 'Regras de Comissão', href: '/metas-comissoes/regras-comissao', roles: ['SUPERVISAO','CEO','ADMIN'] },
    { label: 'Parceiros', href: '/metas-comissoes/parceiros', roles: ['SUPERVISAO','CEO','ADMIN'] },
  ]
}
```

---

## Badges de status

```tsx
// StatusMetaBadge.tsx
const STATUS_META_MAP: Record<string, { label: string; className: string }> = {
  RASCUNHO: { label: 'Rascunho', className: 'bg-gray-100 text-gray-700' },
  ATIVA: { label: 'Ativa', className: 'bg-green-100 text-green-700' },
  PAUSADA: { label: 'Pausada', className: 'bg-yellow-100 text-yellow-700' },
  ENCERRADA: { label: 'Encerrada', className: 'bg-slate-100 text-slate-600' },
  CANCELADA: { label: 'Cancelada', className: 'bg-red-100 text-red-700' },
  REVISADA: { label: 'Revisada', className: 'bg-blue-100 text-blue-700' },
}

export function StatusMetaBadge({ status }: { status: string }) {
  const s = STATUS_META_MAP[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}>{s.label}</span>
}

// StatusComissaoBadge.tsx
const STATUS_COMISSAO_MAP: Record<string, { label: string; className: string }> = {
  PREVISTA:              { label: 'Prevista',         className: 'bg-gray-100 text-gray-600' },
  AGUARDANDO_RECEBIMENTO:{ label: 'Ag. recebimento',  className: 'bg-yellow-100 text-yellow-700' },
  AGUARDANDO_APROVACAO:  { label: 'Ag. aprovação',    className: 'bg-amber-100 text-amber-700' },
  LIBERADA:              { label: 'Liberada',          className: 'bg-green-100 text-green-700' },
  PAGA:                  { label: 'Paga',              className: 'bg-emerald-100 text-emerald-800' },
  BLOQUEADA:             { label: 'Bloqueada',         className: 'bg-red-100 text-red-700' },
  CANCELADA:             { label: 'Cancelada',         className: 'bg-slate-100 text-slate-600' },
  RECALCULADA:           { label: 'Recalculada',       className: 'bg-purple-100 text-purple-700' },
  EM_ANALISE:            { label: 'Em análise',        className: 'bg-blue-100 text-blue-700' },
}

export function StatusComissaoBadge({ status }: { status: string }) {
  const s = STATUS_COMISSAO_MAP[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}>{s.label}</span>
}

// StatusIndicacaoBadge.tsx
const STATUS_INDICACAO_MAP: Record<string, { label: string; className: string }> = {
  LANCADA:                   { label: 'Lançada',              className: 'bg-blue-100 text-blue-700' },
  ENVIADA_AO_PARCEIRO:       { label: 'Enviada ao parceiro',  className: 'bg-indigo-100 text-indigo-700' },
  AGUARDANDO_RETORNO:        { label: 'Ag. retorno',          className: 'bg-yellow-100 text-yellow-700' },
  PARCEIRO_ENTROU_EM_CONTATO:{ label: 'Parceiro contatou',    className: 'bg-purple-100 text-purple-700' },
  CLIENTE_EM_NEGOCIACAO:     { label: 'Em negociação',        className: 'bg-amber-100 text-amber-700' },
  CONVERTIDA:                { label: 'Convertida ✅',        className: 'bg-green-100 text-green-700' },
  NAO_CONVERTIDA:            { label: 'Não convertida',       className: 'bg-gray-100 text-gray-600' },
  CANCELADA:                 { label: 'Cancelada',            className: 'bg-red-100 text-red-700' },
  COMISSAO_LIBERADA:         { label: 'Comissão liberada',    className: 'bg-emerald-100 text-emerald-700' },
  COMISSAO_PAGA:             { label: 'Comissão paga',        className: 'bg-emerald-200 text-emerald-900' },
}

export function StatusIndicacaoBadge({ status }: { status: string }) {
  const s = STATUS_INDICACAO_MAP[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}>{s.label}</span>
}
```

---

## ProgressoMeta.tsx

```tsx
interface ProgressoMetaProps {
  nomeVendedor: string
  tipoMeta: string
  mes: number
  ano: number
  meta: number
  realizado: number
  percentual: number
  unidade?: string
}

const TIPO_META_LABELS: Record<string, string> = {
  CONTRATOS_FECHADOS: 'Contratos', MRR_NOVO: 'MRR', RECEITA_INSTALACAO: 'Instalação',
  RECEITA_TOTAL_RECEBIDA: 'Receita total', SERVICOS_VENDIDOS: 'Serviços',
  INDICACOES_REALIZADAS: 'Indicações', INDICACOES_CONVERTIDAS: 'Indicações convertidas',
  RECEITA_INDICACOES: 'Receita indicações',
}

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export function ProgressoMeta({ nomeVendedor, tipoMeta, mes, ano, meta, realizado, percentual, unidade }: ProgressoMetaProps) {
  const pct = Math.min(percentual, 100)
  const color = pct >= 100 ? 'bg-green-500' : pct >= 75 ? 'bg-blue-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400'

  const formatVal = (v: number) =>
    unidade === 'R$' ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : v.toLocaleString('pt-BR')

  return (
    <div className="text-sm">
      <div className="flex justify-between mb-1 text-xs text-muted-foreground">
        <span>{nomeVendedor} · {TIPO_META_LABELS[tipoMeta] ?? tipoMeta} · {MESES[mes-1]}/{ano}</span>
        <span className="font-medium text-foreground">{percentual.toFixed(1)}%</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs w-20 text-right">{formatVal(realizado)}</span>
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs w-20">{formatVal(meta)}</span>
      </div>
    </div>
  )
}
```

---

## MetasPage (app/metas-comissoes/metas/page.tsx)

```tsx
'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusMetaBadge } from '@/components/metas-comissoes/StatusMetaBadge'
import { ProgressoMeta } from '@/components/metas-comissoes/ProgressoMeta'
import { MetaDrawer } from '@/components/metas-comissoes/MetaDrawer'
import { Plus } from 'lucide-react'

const MESES = [
  { value: '1', label: 'Janeiro' }, { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' }, { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' }, { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' }, { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' }, { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
]

const TIPO_META_LABELS: Record<string, string> = {
  CONTRATOS_FECHADOS: 'Contratos', MRR_NOVO: 'MRR', RECEITA_INSTALACAO: 'Instalação',
  RECEITA_TOTAL_RECEBIDA: 'Receita total', SERVICOS_VENDIDOS: 'Serviços',
  INDICACOES_REALIZADAS: 'Indicações', INDICACOES_CONVERTIDAS: 'Indicações convertidas',
  RECEITA_INDICACOES: 'Receita indicações', PROPOSTAS_ENVIADAS: 'Propostas',
  APRESENTACOES_REALIZADAS: 'Apresentações', LEADS_TRABALHADOS: 'Leads trabalhados',
  LEADS_QUALIFICADOS: 'Leads qualificados', META_PERSONALIZADA: 'Personalizada',
}

const hoje = new Date()

export default function MetasPage() {
  const { can } = usePermission()
  const [mes, setMes] = useState(String(hoje.getMonth() + 1))
  const [ano] = useState(String(hoje.getFullYear()))
  const [status, setStatus] = useState<string>('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [metaSelecionada, setMetaSelecionada] = useState<any>(null)

  const { data: metas = [], isLoading, refetch } = useQuery({
    queryKey: ['metas', mes, ano, status],
    queryFn: () => api.get('/metas', { params: { mes, ano, status: status || undefined } }).then(r => r.data),
    staleTime: 30_000
  })

  const abrirNova = () => { setMetaSelecionada(null); setDrawerOpen(true) }
  const abrirEditar = (meta: any) => { setMetaSelecionada(meta); setDrawerOpen(true) }

  const isMonetario = (tipo: string) => ['MRR_NOVO','RECEITA_INSTALACAO','RECEITA_TOTAL_RECEBIDA','RECEITA_INDICACOES'].includes(tipo)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Metas Comerciais</h1>
        {can('gerenciarMetas') && (
          <Button onClick={abrirNova} size="sm"><Plus className="h-4 w-4 mr-1" />Nova Meta</Button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Mês" /></SelectTrigger>
          <SelectContent>{MESES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            <SelectItem value="ATIVA">Ativa</SelectItem>
            <SelectItem value="RASCUNHO">Rascunho</SelectItem>
            <SelectItem value="PAUSADA">Pausada</SelectItem>
            <SelectItem value="ENCERRADA">Encerrada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Meta</TableHead>
              <TableHead>Realizado</TableHead>
              <TableHead>Progresso</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : metas.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma meta encontrada</TableCell></TableRow>
            ) : metas.map((meta: any) => {
              const monetario = isMonetario(meta.tipoMeta)
              const formatVal = (v: number) => monetario
                ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                : v.toLocaleString('pt-BR')

              return (
                <TableRow key={meta.id} className="cursor-pointer hover:bg-muted/50" onClick={() => abrirEditar(meta)}>
                  <TableCell className="font-medium">{meta.vendedor?.name}</TableCell>
                  <TableCell>{TIPO_META_LABELS[meta.tipoMeta] ?? meta.tipoMeta}</TableCell>
                  <TableCell>{formatVal(Number(meta.valorMeta ?? meta.quantidadeMeta ?? 0))}</TableCell>
                  <TableCell>{formatVal(Number(meta.valorRealizado ?? meta.quantidadeRealizada ?? 0))}</TableCell>
                  <TableCell className="w-52">
                    <ProgressoMeta
                      nomeVendedor=""
                      tipoMeta={meta.tipoMeta}
                      mes={meta.mes}
                      ano={meta.ano}
                      meta={Number(meta.valorMeta ?? meta.quantidadeMeta ?? 0)}
                      realizado={Number(meta.valorRealizado ?? meta.quantidadeRealizada ?? 0)}
                      percentual={Number(meta.percentualAtingido)}
                      unidade={monetario ? 'R$' : ''}
                    />
                  </TableCell>
                  <TableCell><StatusMetaBadge status={meta.status} /></TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <MetaDrawer
        open={drawerOpen}
        meta={metaSelecionada}
        onClose={() => setDrawerOpen(false)}
        onSave={() => { setDrawerOpen(false); refetch() }}
      />
    </div>
  )
}
```

---

## MetaDrawer.tsx

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { StatusMetaBadge } from './StatusMetaBadge'
import { ProgressoMeta } from './ProgressoMeta'
import { useToast } from '@/hooks/use-toast'

const metaSchema = z.object({
  vendedorId: z.string().min(1),
  mes: z.coerce.number().min(1).max(12),
  ano: z.coerce.number().min(2024),
  tipoMeta: z.string(),
  valorMeta: z.coerce.number().optional(),
  quantidadeMeta: z.coerce.number().optional(),
  status: z.string(),
  metaPrincipal: z.boolean(),
  contaParaComissao: z.boolean(),
  contaParaRanking: z.boolean(),
  permiteComissaoSemMeta: z.string(),
  exigeRecebimento: z.string(),
  exigeContratoAssinado: z.boolean(),
  exigePagamentoEntrada: z.boolean(),
  observacoes: z.string().optional(),
})

const TIPOS_META = [
  { value: 'CONTRATOS_FECHADOS', label: 'Contratos fechados' },
  { value: 'MRR_NOVO', label: 'MRR novo' },
  { value: 'RECEITA_INSTALACAO', label: 'Receita de instalação' },
  { value: 'RECEITA_TOTAL_RECEBIDA', label: 'Receita total recebida' },
  { value: 'PROPOSTAS_ENVIADAS', label: 'Propostas enviadas' },
  { value: 'APRESENTACOES_REALIZADAS', label: 'Apresentações realizadas' },
  { value: 'LEADS_TRABALHADOS', label: 'Leads trabalhados' },
  { value: 'LEADS_QUALIFICADOS', label: 'Leads qualificados' },
  { value: 'SERVICOS_VENDIDOS', label: 'Serviços vendidos' },
  { value: 'INDICACOES_REALIZADAS', label: 'Indicações realizadas' },
  { value: 'INDICACOES_CONVERTIDAS', label: 'Indicações convertidas' },
  { value: 'RECEITA_INDICACOES', label: 'Receita por indicações' },
  { value: 'META_PERSONALIZADA', label: 'Meta personalizada' },
]

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export function MetaDrawer({ open, meta, onClose, onSave }: any) {
  const { toast } = useToast()
  const [tab, setTab] = useState('identificacao')
  const isEdicao = !!meta

  const { data: vendedores = [] } = useQuery({
    queryKey: ['usuarios-vendedores'],
    queryFn: () => api.get('/usuarios?perfil=VENDEDOR').then(r => r.data),
    staleTime: 60_000
  })

  const form = useForm<z.infer<typeof metaSchema>>({
    resolver: zodResolver(metaSchema),
    defaultValues: {
      status: 'ATIVA', metaPrincipal: false, contaParaComissao: true,
      contaParaRanking: true, permiteComissaoSemMeta: 'NAO',
      exigeRecebimento: 'SIM', exigeContratoAssinado: false, exigePagamentoEntrada: false,
      mes: new Date().getMonth() + 1, ano: new Date().getFullYear()
    }
  })

  useEffect(() => {
    if (meta) form.reset(meta)
    else form.reset({ status: 'ATIVA', metaPrincipal: false, contaParaComissao: true,
      contaParaRanking: true, permiteComissaoSemMeta: 'NAO', exigeRecebimento: 'SIM',
      exigeContratoAssinado: false, exigePagamentoEntrada: false,
      mes: new Date().getMonth() + 1, ano: new Date().getFullYear() })
  }, [meta, open])

  const mutation = useMutation({
    mutationFn: (data: any) =>
      isEdicao ? api.patch(`/metas/${meta.id}`, data) : api.post('/metas', data),
    onSuccess: () => { toast({ title: `Meta ${isEdicao ? 'atualizada' : 'criada'}!` }); onSave() },
    onError: (e: any) => toast({ title: 'Erro', description: e.response?.data?.message, variant: 'destructive' })
  })

  const tipoSelecionado = form.watch('tipoMeta')
  const isMonetario = ['MRR_NOVO','RECEITA_INSTALACAO','RECEITA_TOTAL_RECEBIDA','RECEITA_INDICACOES'].includes(tipoSelecionado)

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-[560px] sm:w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEdicao
              ? `Meta — ${meta.vendedor?.name} — ${MESES_ABREV[(meta.mes ?? 1) - 1]}/${meta.ano}`
              : 'Nova Meta'}
          </SheetTitle>
          {isEdicao && <StatusMetaBadge status={meta.status} />}
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="identificacao" className="flex-1">Identificação</TabsTrigger>
            <TabsTrigger value="progresso" className="flex-1" disabled={!isEdicao}>Progresso</TabsTrigger>
            <TabsTrigger value="regras" className="flex-1" disabled={!isEdicao}>Regras</TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => mutation.mutate(d))}>
              <TabsContent value="identificacao" className="space-y-4 mt-4">
                <FormField control={form.control} name="vendedorId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendedor</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                      <SelectContent>{vendedores.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="mes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mês</FormLabel>
                      <Select onValueChange={v => field.onChange(parseInt(v))} value={String(field.value)}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {MESES_ABREV.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="ano" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ano</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="tipoMeta" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de meta</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                      <SelectContent>{TIPOS_META.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name={isMonetario ? 'valorMeta' : 'quantidadeMeta'} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meta {isMonetario ? '(R$)' : '(quantidade)'}</FormLabel>
                    <FormControl>
                      <Input type="number" step={isMonetario ? '0.01' : '1'} placeholder={isMonetario ? 'Ex: 2280.00' : 'Ex: 6'} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="RASCUNHO">Rascunho</SelectItem>
                        <SelectItem value="ATIVA">Ativa</SelectItem>
                        <SelectItem value="PAUSADA">Pausada</SelectItem>
                        <SelectItem value="ENCERRADA">Encerrada</SelectItem>
                        <SelectItem value="CANCELADA">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                <div className="space-y-2 pt-2">
                  {[
                    { name: 'metaPrincipal', label: 'Meta principal' },
                    { name: 'contaParaComissao', label: 'Conta para comissão' },
                    { name: 'contaParaRanking', label: 'Conta para ranking' },
                    { name: 'exigeContratoAssinado', label: 'Exige contrato assinado' },
                    { name: 'exigePagamentoEntrada', label: 'Exige pagamento de entrada' },
                  ].map(({ name, label }) => (
                    <FormField key={name} control={form.control} name={name as any} render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel className="!mt-0 cursor-pointer">{label}</FormLabel>
                      </FormItem>
                    )} />
                  ))}
                </div>

                <FormField control={form.control} name="permiteComissaoSemMeta" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Permite comissão sem bater meta?</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="SIM">Sim</SelectItem>
                        <SelectItem value="NAO">Não</SelectItem>
                        <SelectItem value="PARCIALMENTE">Parcialmente</SelectItem>
                        <SelectItem value="DEPENDE_APROVACAO">Depende de aprovação</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                <FormField control={form.control} name="exigeRecebimento" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exige recebimento para liberar comissão?</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="SIM">Sim</SelectItem>
                        <SelectItem value="NAO">Não</SelectItem>
                        <SelectItem value="APENAS_ENTRADA">Apenas entrada</SelectItem>
                        <SelectItem value="APENAS_PRIMEIRA_MENSALIDADE">Apenas primeira mensalidade</SelectItem>
                        <SelectItem value="ENTRADA_MAIS_PRIMEIRA_MENSALIDADE">Entrada + primeira mensalidade</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="progresso" className="mt-4 space-y-4">
                {meta && (
                  <div className="space-y-4">
                    <ProgressoMeta
                      nomeVendedor={meta.vendedor?.name ?? ''}
                      tipoMeta={meta.tipoMeta}
                      mes={meta.mes}
                      ano={meta.ano}
                      meta={Number(meta.valorMeta ?? meta.quantidadeMeta ?? 0)}
                      realizado={Number(meta.valorRealizado ?? meta.quantidadeRealizada ?? 0)}
                      percentual={Number(meta.percentualAtingido)}
                    />
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="rounded-lg border p-3">
                        <div className="text-xs text-muted-foreground">Meta</div>
                        <div className="text-lg font-semibold">{meta.quantidadeMeta ?? meta.valorMeta?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                      </div>
                      <div className="rounded-lg border p-3">
                        <div className="text-xs text-muted-foreground">Realizado</div>
                        <div className="text-lg font-semibold">{meta.quantidadeRealizada ?? Number(meta.valorRealizado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                      </div>
                      <div className="rounded-lg border p-3">
                        <div className="text-xs text-muted-foreground">Atingimento</div>
                        <div className={`text-lg font-semibold ${Number(meta.percentualAtingido) >= 100 ? 'text-green-600' : ''}`}>
                          {Number(meta.percentualAtingido).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="regras" className="mt-4">
                <RegrasMeta metaId={meta?.id} vendedorId={meta?.vendedorId} />
              </TabsContent>
            </form>
          </Form>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

function RegrasMeta({ metaId, vendedorId }: { metaId?: string; vendedorId?: string }) {
  const { data: regras = [] } = useQuery({
    queryKey: ['regras-comissao', vendedorId],
    queryFn: () => api.get('/regras-comissao', { params: { vendedorId } }).then(r => r.data),
    enabled: !!vendedorId
  })
  if (!regras.length) return <p className="text-sm text-muted-foreground">Nenhuma regra de comissão vinculada a este vendedor.</p>
  return (
    <ul className="space-y-2">
      {regras.map((r: any) => (
        <li key={r.id} className="rounded-md border p-3 text-sm">
          <div className="font-medium">{r.nome}</div>
          <div className="text-xs text-muted-foreground">{r.tipoComissao} · {r.baseCalculo}</div>
        </li>
      ))}
    </ul>
  )
}
```

---

## RegrasComissaoPage (app/metas-comissoes/regras-comissao/page.tsx)

```tsx
'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { RegraComissaoDrawer } from '@/components/metas-comissoes/RegraComissaoDrawer'
import { Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const TIPO_COMISSAO_LABELS: Record<string, string> = {
  PERCENTUAL: 'Percentual', VALOR_FIXO: 'Valor fixo',
  PERCENTUAL_POR_FAIXA: '% por faixa', VALOR_FIXO_POR_FAIXA: 'Fixo por faixa',
  MISTA: 'Mista', MANUAL: 'Manual', SEM_COMISSAO: 'Sem comissão'
}

const BASE_LABELS: Record<string, string> = {
  VALOR_INSTALACAO_VENDIDA: 'Inst. vendida', VALOR_INSTALACAO_RECEBIDA: 'Inst. recebida',
  VALOR_MENSALIDADE: 'Mensalidade', MRR_FECHADO: 'MRR fechado',
  PRIMEIRA_MENSALIDADE_RECEBIDA: '1ª mensalidade', VALOR_TOTAL_CONTRATO_12M: 'Contrato 12m',
  VALOR_SERVICO_VENDIDO: 'Serviço vendido', VALOR_SERVICO_RECEBIDO: 'Serviço recebido',
  VALOR_INDICACAO_CONVERTIDA: 'Indicação conv.', VALOR_FIXO_POR_CONTRATO: 'Fixo/contrato',
  VALOR_FIXO_POR_SERVICO: 'Fixo/serviço', VALOR_FIXO_POR_INDICACAO: 'Fixo/indicação',
  PERSONALIZADO: 'Personalizado'
}

export default function RegrasComissaoPage() {
  const { can } = usePermission()
  const qc = useQueryClient()
  const { toast } = useToast()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [regraSelecionada, setRegraSelecionada] = useState<any>(null)

  const { data: regras = [], isLoading } = useQuery({
    queryKey: ['regras-comissao'],
    queryFn: () => api.get('/regras-comissao').then(r => r.data),
    staleTime: 30_000
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Regras de Comissão</h1>
        {can('gerenciarRegrasComissao') && (
          <Button onClick={() => { setRegraSelecionada(null); setDrawerOpen(true) }} size="sm">
            <Plus className="h-4 w-4 mr-1" />Nova Regra
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Base de cálculo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : regras.map((r: any) => (
              <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setRegraSelecionada(r); setDrawerOpen(true) }}>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell>{r.aplicarParaTodos ? <Badge variant="outline">Todos</Badge> : r.vendedor?.name}</TableCell>
                <TableCell>{TIPO_COMISSAO_LABELS[r.tipoComissao]}</TableCell>
                <TableCell className="text-xs">{BASE_LABELS[r.baseCalculo]}</TableCell>
                <TableCell>
                  {r.tipoComissao === 'PERCENTUAL' || r.tipoComissao === 'PERCENTUAL_POR_FAIXA'
                    ? `${(Number(r.percentual) * 100).toFixed(1)}%`
                    : r.valorFixo ? `R$ ${Number(r.valorFixo).toFixed(2)}` : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={r.status === 'ATIVA' ? 'default' : 'secondary'}>{r.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <RegraComissaoDrawer
        open={drawerOpen}
        regra={regraSelecionada}
        onClose={() => setDrawerOpen(false)}
        onSave={() => { setDrawerOpen(false); qc.invalidateQueries({ queryKey: ['regras-comissao'] }) }}
      />
    </div>
  )
}
```

---

## RegraComissaoDrawer.tsx (resumido)

```tsx
'use client'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'

const regraSchema = z.object({
  nome: z.string().min(1),
  tipoComissao: z.string(),
  vendedorId: z.string().optional(),
  aplicarParaTodos: z.boolean(),
  baseCalculo: z.string(),
  percentual: z.coerce.number().optional(),
  valorFixo: z.coerce.number().optional(),
  comissaoMinima: z.coerce.number().optional(),
  comissaoMaxima: z.coerce.number().optional(),
  calculaSobreValorBruto: z.boolean(),
  considerarDesconto: z.boolean(),
  dependeRecebimento: z.string(),
  dependeContratoAssinado: z.boolean(),
  dependeImplantacao: z.boolean(),
  dependeAprovacaoSupervisao: z.boolean(),
  dataInicio: z.string().min(1),
  dataFim: z.string().optional(),
  status: z.string(),
})

const BASES_CALCULO = [
  { value: 'VALOR_INSTALACAO_VENDIDA', label: 'Valor da instalação vendida' },
  { value: 'VALOR_INSTALACAO_RECEBIDA', label: 'Valor da instalação recebida' },
  { value: 'VALOR_MENSALIDADE', label: 'Valor da mensalidade' },
  { value: 'MRR_FECHADO', label: 'MRR fechado' },
  { value: 'PRIMEIRA_MENSALIDADE_RECEBIDA', label: 'Primeira mensalidade recebida' },
  { value: 'VALOR_TOTAL_CONTRATO_12M', label: 'Valor total do contrato em 12 meses' },
  { value: 'VALOR_SERVICO_VENDIDO', label: 'Valor do serviço vendido' },
  { value: 'VALOR_SERVICO_RECEBIDO', label: 'Valor do serviço recebido' },
  { value: 'VALOR_INDICACAO_CONVERTIDA', label: 'Valor da indicação convertida' },
  { value: 'VALOR_FIXO_POR_CONTRATO', label: 'Valor fixo por contrato' },
  { value: 'VALOR_FIXO_POR_SERVICO', label: 'Valor fixo por serviço' },
  { value: 'VALOR_FIXO_POR_INDICACAO', label: 'Valor fixo por indicação' },
  { value: 'PERSONALIZADO', label: 'Personalizado' },
]

export function RegraComissaoDrawer({ open, regra, onClose, onSave }: any) {
  const { toast } = useToast()
  const isEdicao = !!regra

  const { data: vendedores = [] } = useQuery({
    queryKey: ['usuarios-vendedores'],
    queryFn: () => api.get('/usuarios?perfil=VENDEDOR').then(r => r.data),
    staleTime: 60_000
  })

  const form = useForm<z.infer<typeof regraSchema>>({
    resolver: zodResolver(regraSchema),
    defaultValues: {
      status: 'ATIVA', aplicarParaTodos: false, calculaSobreValorBruto: true,
      considerarDesconto: false, dependeRecebimento: 'SIM', dependeContratoAssinado: false,
      dependeImplantacao: false, dependeAprovacaoSupervisao: false,
      dataInicio: new Date().toISOString().split('T')[0]
    }
  })

  useEffect(() => {
    if (regra) form.reset({ ...regra, percentual: regra.percentual ? Number(regra.percentual) * 100 : undefined })
    else form.reset({ status: 'ATIVA', aplicarParaTodos: false, calculaSobreValorBruto: true,
      considerarDesconto: false, dependeRecebimento: 'SIM', dependeContratoAssinado: false,
      dependeImplantacao: false, dependeAprovacaoSupervisao: false,
      dataInicio: new Date().toISOString().split('T')[0] })
  }, [regra, open])

  const mutation = useMutation({
    mutationFn: (data: any) => {
      // converte percentual de % para decimal
      const payload = { ...data, percentual: data.percentual ? data.percentual / 100 : undefined }
      return isEdicao ? api.patch(`/regras-comissao/${regra.id}`, payload) : api.post('/regras-comissao', payload)
    },
    onSuccess: () => { toast({ title: `Regra ${isEdicao ? 'atualizada' : 'criada'}!` }); onSave() },
    onError: (e: any) => toast({ title: 'Erro', description: e.response?.data?.message, variant: 'destructive' })
  })

  const tipoSelecionado = form.watch('tipoComissao')
  const aplicarTodos = form.watch('aplicarParaTodos')

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-[560px] sm:w-[620px] overflow-y-auto">
        <SheetHeader><SheetTitle>{isEdicao ? 'Editar Regra de Comissão' : 'Nova Regra de Comissão'}</SheetTitle></SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="mt-4 space-y-4">
            <FormField control={form.control} name="nome" render={({ field }) => (
              <FormItem><FormLabel>Nome da regra</FormLabel><FormControl><Input placeholder="Ex: Comissão sobre instalação recebida" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="tipoComissao" render={({ field }) => (
                <FormItem><FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="PERCENTUAL">Percentual</SelectItem>
                      <SelectItem value="VALOR_FIXO">Valor fixo</SelectItem>
                      <SelectItem value="PERCENTUAL_POR_FAIXA">% por faixa</SelectItem>
                      <SelectItem value="VALOR_FIXO_POR_FAIXA">Fixo por faixa</SelectItem>
                      <SelectItem value="MISTA">Mista</SelectItem>
                      <SelectItem value="MANUAL">Manual</SelectItem>
                      <SelectItem value="SEM_COMISSAO">Sem comissão</SelectItem>
                    </SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="baseCalculo" render={({ field }) => (
                <FormItem><FormLabel>Base de cálculo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                    <SelectContent>{BASES_CALCULO.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
            </div>

            <FormField control={form.control} name="aplicarParaTodos" render={({ field }) => (
              <FormItem className="flex items-center gap-2">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <FormLabel className="!mt-0">Aplicar para todos os vendedores</FormLabel>
              </FormItem>
            )} />

            {!aplicarTodos && (
              <FormField control={form.control} name="vendedorId" render={({ field }) => (
                <FormItem><FormLabel>Vendedor específico</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                    <SelectContent>{vendedores.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
            )}

            {(tipoSelecionado === 'PERCENTUAL' || tipoSelecionado === 'PERCENTUAL_POR_FAIXA') && (
              <FormField control={form.control} name="percentual" render={({ field }) => (
                <FormItem><FormLabel>Percentual (%)</FormLabel><FormControl><Input type="number" step="0.1" placeholder="Ex: 5" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            )}

            {(tipoSelecionado === 'VALOR_FIXO' || tipoSelecionado === 'VALOR_FIXO_POR_FAIXA') && (
              <FormField control={form.control} name="valorFixo" render={({ field }) => (
                <FormItem><FormLabel>Valor fixo (R$)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="Ex: 50.00" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="comissaoMinima" render={({ field }) => (
                <FormItem><FormLabel>Mínima (R$)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="—" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="comissaoMaxima" render={({ field }) => (
                <FormItem><FormLabel>Máxima (R$)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="—" {...field} /></FormControl></FormItem>
              )} />
            </div>

            <div className="space-y-2">
              {[
                { name: 'calculaSobreValorBruto', label: 'Calcular sobre valor bruto' },
                { name: 'considerarDesconto', label: 'Considerar desconto no cálculo' },
                { name: 'dependeContratoAssinado', label: 'Depende de contrato assinado' },
                { name: 'dependeImplantacao', label: 'Depende de implantação concluída' },
                { name: 'dependeAprovacaoSupervisao', label: 'Depende de aprovação da supervisão' },
              ].map(({ name, label }) => (
                <FormField key={name} control={form.control} name={name as any} render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel className="!mt-0">{label}</FormLabel>
                  </FormItem>
                )} />
              ))}
            </div>

            <FormField control={form.control} name="dependeRecebimento" render={({ field }) => (
              <FormItem><FormLabel>Depende de recebimento</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="NAO">Não</SelectItem>
                    <SelectItem value="SIM">Sim (total)</SelectItem>
                    <SelectItem value="APENAS_ENTRADA">Apenas entrada</SelectItem>
                    <SelectItem value="APENAS_PRIMEIRA_MENSALIDADE">Apenas 1ª mensalidade</SelectItem>
                    <SelectItem value="ENTRADA_MAIS_PRIMEIRA_MENSALIDADE">Entrada + 1ª mensalidade</SelectItem>
                    <SelectItem value="VALOR_TOTAL_RECEBIDO">Valor total recebido</SelectItem>
                  </SelectContent>
                </Select></FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="dataInicio" render={({ field }) => (
                <FormItem><FormLabel>Válida de</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="dataFim" render={({ field }) => (
                <FormItem><FormLabel>Válida até</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
              )} />
            </div>

            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem><FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="ATIVA">Ativa</SelectItem>
                    <SelectItem value="INATIVA">Inativa</SelectItem>
                    <SelectItem value="EM_TESTE">Em teste</SelectItem>
                    <SelectItem value="AGUARDANDO_APROVACAO">Aguardando aprovação</SelectItem>
                  </SelectContent>
                </Select></FormItem>
            )} />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
```

---

## RecebimentosPage + RecebimentoDrawer (resumido)

```tsx
// app/metas-comissoes/recebimentos/page.tsx
// Tabela: Data · Cliente · Tipo · Vendido · Recebido · Status · Comissão
// Filters: Vendedor, Tipo, Status, checkboxes: Somente vencidos / Pendentes / Com comissão
// RecebimentoDrawer: 3 abas — Geral / Parcelas / Comissão

// ABA GERAL (react-hook-form + zod):
// tipoReceita, origemReceita, valorVendido, valorDesconto, formaPagamento,
// statusRecebimento, qtdParcelas, observacoes

// ABA PARCELAS:
// valorEntrada, dataVencimentoEntrada, entradaRecebida (checkbox + datestamp)
// valorParcela, parcelaAtual, proximoVencimento

// ABA COMISSÃO (read-only):
// Lista de Comissao[] vinculadas via contratoId ou servicoId
// Chip StatusComissaoBadge por comissão
// Botões: [Liberar comissão] [Bloquear] — apenas SUPERVISAO+
//   → PATCH /comissoes/:id/liberar | /bloquear

export function RecebimentoDrawer({ open, recebimento, onClose, onSave }: any) {
  // ... implementação com 3 abas conforme UX
  // Ao salvar ABA GERAL → PATCH /recebimentos/:id
  // Motor de liberação é ativado automaticamente no backend
}
```

---

## IndicacoesPage + NovaIndicacaoModal

```tsx
// app/metas-comissoes/indicacoes/page.tsx
// Tabela: Data · Cliente · Parceiro · Serviço · Status · Comissão
// Filters: Parceiro, Status, Vendedor, Período

// NovaIndicacaoModal — 3 passos com stepper visual:
export function NovaIndicacaoModal({ open, onClose, onSave }: any) {
  const [passo, setPasso] = useState(1)
  const [formData, setFormData] = useState<any>({})

  // Passo 1 — Cliente
  // Input busca (clienteLeadId ou clienteBaseId) → ou preenchimento manual
  // Campos: razaoSocial, cnpj, responsavelNome, whatsapp, cidade, estado, segmento

  // Passo 2 — Parceiro
  // Select parceiro (GET /parceiros — apenas ATIVO)
  // Select produtoServico (do parceiro selecionado)
  // Exibe comissão padrão do parceiro como preview

  // Passo 3 — Detalhamento
  // observacao, valorEstimado
  // Resumo da indicação antes de lançar

  // Botão "Lançar indicação" → POST /indicacoes
}

// StatusIndicacaoBadge para a tabela
// Supervisor vê botões de ação: [Marcar enviada] [Marcar convertida] [Aprovar]
//   → PATCH /indicacoes/:id/status e /aprovar
```

---

## ParceirosPage (app/metas-comissoes/parceiros/page.tsx)

```tsx
// Tabela: Parceiro · Categoria · Produto/Serviço · Comissão padrão · Status
// Filters: Categoria, Status
// ParceiroDrawer — formulário completo (todos os campos da tabela Parceiro)
//   → POST /parceiros (SUPERVISAO+), PATCH /parceiros/:id

const CATEGORIAS_PARCEIRO: Record<string, string> = {
  TEF: 'TEF', CERTIFICADO_DIGITAL: 'Cert. digital', CONTABILIDADE: 'Contabilidade',
  EQUIPAMENTOS: 'Equipamentos', IMPRESSORAS: 'Impressoras', BALANCAS: 'Balanças',
  ECOMMERCE: 'E-commerce', DELIVERY: 'Delivery', PBM: 'PBM',
  MARKETING: 'Marketing', TELEFONIA: 'Telefonia', INTERNET: 'Internet',
  AUTOMACAO_COMERCIAL: 'Automação comercial', CONSULTORIA: 'Consultoria', OUTRO: 'Outro'
}
```

---

## ComissoesPage (app/metas-comissoes/comissoes/page.tsx)

```tsx
// Tabela: Data · Vendedor · Origem (contrato/serviço/indicação) · Regra · Valor · Status
// Filters: Vendedor, Status
// VENDEDOR: só vê as suas (filtro server-side)
// SUPERVISAO+: vê todas, com botões [Aprovar] [Liberar] [Bloquear] inline
// Row click → modal de detalhe com regra aplicada + historico de status

// Ações inline por role:
// StatusComissaoBadge + dropdownMenu (SUPERVISAO+):
//   → PATCH /comissoes/:id/liberar
//   → PATCH /comissoes/:id/bloquear (dialog com motivoBloqueio)
//   → PATCH /comissoes/:id/aprovar
```

---

## usePermission — adições (hook)

```typescript
// Adicionar ao mapa de permissões existente:
'gerenciarParceiros':        ['SUPERVISAO','CEO','ADMIN'],
'gerenciarMetas':            ['SUPERVISAO','CEO','ADMIN'],
'gerenciarRegrasComissao':   ['SUPERVISAO','CEO','ADMIN'],
'verTodasComissoes':         ['SUPERVISAO','CEO','ADMIN','FINANCEIRO'],
'aprovarComissao':           ['SUPERVISAO','CEO','ADMIN'],
'bloquearComissao':          ['SUPERVISAO','CEO','ADMIN'],
'gerenciarRecebimentos':     ['FINANCEIRO','SUPERVISAO','CEO','ADMIN'],
'lancarIndicacao':           ['VENDEDOR','SUPERVISAO','CEO','ADMIN'],
'verTodasIndicacoes':        ['SUPERVISAO','CEO','ADMIN'],
'aprovarIndicacao':          ['SUPERVISAO','CEO','ADMIN'],
```

---

## Sprint 24 — FRONTEND PRONTO ✅
