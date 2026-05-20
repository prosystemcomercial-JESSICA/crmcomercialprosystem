# Sprint 23 — Step 05 — Isabela Costa (Frontend)
# Serviços Contratados Avançado — Implementação UI

---

## src/lib/api/servico.ts — adições Sprint 23

```typescript
// Adicionar ao arquivo existente:
export const getDashboardServicos  = (params?: any) => api.get('/servicos/dashboard', { params }).then(r => r.data)
export const baixarRelatorio       = (params: any)  => api.get('/servicos/relatorios', { params, responseType: 'blob' }).then(r => r.data)

export const listarChecklistPadrao = (tipoId: string) => api.get(`/tipos-servico/${tipoId}/checklist`).then(r => r.data)
export const criarItemChecklist    = (tipoId: string, data: any) => api.post(`/tipos-servico/${tipoId}/checklist`, data).then(r => r.data)
export const marcarItemChecklist   = (servicoId: string, itemId: string, data: any) =>
  api.patch(`/servicos/${servicoId}/checklist/${itemId}`, data).then(r => r.data)
export const salvarDadosExtras     = (servicoId: string, dados: any) =>
  api.patch(`/servicos/${servicoId}/dados-extras`, dados).then(r => r.data)

export const listarFeriados        = (ano?: number) => api.get('/feriados', { params: { ano } }).then(r => r.data)
export const criarFeriado          = (data: any) => api.post('/feriados', data).then(r => r.data)
export const excluirFeriado        = (id: string) => api.delete(`/feriados/${id}`).then(r => r.data)
```

---

## src/app/(dashboard)/servicos/dashboard/page.tsx

```tsx
'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDashboardServicos } from '@/lib/api/servico'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { formatarMoeda } from '@/lib/formatters'

const CORES_STATUS = ['#4ade80','#a78bfa','#fb923c','#f87171','#60a5fa','#fbbf24']

function KpiCard({ titulo, valor, sufixo = '', cor = 'default' }: any) {
  const corMap: Record<string, string> = {
    verde: 'text-green-600', vermelho: 'text-red-600',
    amarelo: 'text-yellow-600', default: 'text-foreground',
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground font-normal">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold ${corMap[cor]}`}>{valor}{sufixo}</p>
      </CardContent>
    </Card>
  )
}

export default function DashboardServicosPage() {
  const [filtros, setFiltros] = useState<any>({})

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-servicos', filtros],
    queryFn: () => getDashboardServicos(filtros),
    staleTime: 300_000,
  })

  if (isLoading || !data) return <div className="p-8 text-center text-muted-foreground">Carregando dashboard...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard de Serviços</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada do módulo de serviços contratados</p>
        </div>
        <div className="flex gap-2">
          <Select onValueChange={v => setFiltros((f: any) => ({ ...f, tecnicoId: v || undefined }))}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Técnico" /></SelectTrigger>
            <SelectContent><SelectItem value="">Todos</SelectItem></SelectContent>
          </Select>
        </div>
      </div>

      {/* Bloco Operacional */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Operacional</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard titulo="Total de serviços"  valor={data.total} />
          <KpiCard titulo="Em aberto"          valor={data.abertos}    cor="amarelo" />
          <KpiCard titulo="Concluídos"         valor={data.concluidos} cor="verde" />
          <KpiCard titulo="Cancelados"         valor={data.cancelados} cor="vermelho" />
          <KpiCard titulo="Taxa de conclusão"  valor={data.taxaConclusao} sufixo="%" cor={data.taxaConclusao >= 70 ? 'verde' : 'amarelo'} />
          <KpiCard titulo="Tempo médio"        valor={data.tempoMedioDias} sufixo=" dias" />
        </div>
      </div>

      {/* Bloco Financeiro */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Financeiro</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard titulo="Receita gerada"    valor={formatarMoeda(data.receitaGerada)}   cor="verde" />
          <KpiCard titulo="Receita pendente"  valor={formatarMoeda(data.receitaPendente)} cor="amarelo" />
          <KpiCard titulo="Receita em aberto" valor={formatarMoeda(data.receitaAberto)} />
          <KpiCard titulo="Inadimplência"     valor={data.inadimplencia} sufixo="%" cor={data.inadimplencia > 5 ? 'vermelho' : 'default'} />
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Por categoria */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Serviços por categoria</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.porCategoria} layout="vertical">
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="categoria" width={130} fontSize={11} />
                <Tooltip />
                <Bar dataKey="total" fill="#4f46e5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Por status */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Distribuição por status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data.porStatus}
                  dataKey="total"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  label={({ status, percent }) => `${status} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                  fontSize={10}
                >
                  {data.porStatus.map((_: any, i: number) => (
                    <Cell key={i} fill={CORES_STATUS[i % CORES_STATUS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Volume diário */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Volume diário (30 dias)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data.volumeDiario}>
                <XAxis dataKey="dia" fontSize={10} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#4f46e5" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Produtividade técnicos */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Produtividade por técnico</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.produtividade} layout="vertical">
                <XAxis type="number" fontSize={10} />
                <YAxis type="category" dataKey="nome" width={100} fontSize={10} />
                <Tooltip />
                <Bar dataKey="concluidos" fill="#4ade80" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

---

## src/app/(dashboard)/servicos/relatorios/page.tsx

```tsx
'use client'
import { useState } from 'react'
import { baixarRelatorio } from '@/lib/api/servico'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from 'sonner'
import { Download, FileSpreadsheet } from 'lucide-react'

const TIPOS = [
  { value: 'lancados',      label: 'Serviços Lançados',  desc: 'Todos os serviços no período com status e dados principais' },
  { value: 'financeiro',    label: 'Financeiro',          desc: 'Valores cobrados, pagos, descontos e status de pagamento' },
  { value: 'tecnico',       label: 'Técnico',             desc: 'Dados de execução: técnico, prazo, tempo real e resultado' },
  { value: 'produtividade', label: 'Produtividade',       desc: 'Desempenho por técnico: total, concluídos e tempo médio' },
  { value: 'gargalos',      label: 'Gargalos',            desc: 'Serviços parados há mais de X dias no mesmo status' },
]

export default function RelatoriosServicosPage() {
  const hoje = new Date()
  const [tipo, setTipo] = useState('lancados')
  const [inicio, setInicio] = useState(
    new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10)
  )
  const [fim, setFim] = useState(hoje.toISOString().slice(0, 10))
  const [diasParado, setDiasParado] = useState('7')
  const [carregando, setCarregando] = useState(false)

  async function gerar() {
    setCarregando(true)
    try {
      const blob = await baixarRelatorio({ tipo, inicio, fim, diasParado })
      const url = URL.createObjectURL(new Blob([blob]))
      const a = document.createElement('a')
      a.href = url
      a.download = `relatorio-${tipo}-${inicio}-${fim}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Relatório gerado com sucesso!')
    } catch {
      toast.error('Erro ao gerar relatório')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Relatórios de Serviços</h1>
        <p className="text-sm text-muted-foreground">Exporte dados em formato XLSX para análise externa</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Tipo */}
        <div className="space-y-4">
          <p className="font-medium text-sm">Tipo de relatório</p>
          <RadioGroup value={tipo} onValueChange={setTipo} className="space-y-3">
            {TIPOS.map((t) => (
              <div key={t.value} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${tipo === t.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                   onClick={() => setTipo(t.value)}>
                <RadioGroupItem value={t.value} id={t.value} className="mt-0.5" />
                <div>
                  <Label htmlFor={t.value} className="font-medium cursor-pointer">{t.label}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Parâmetros */}
        <div className="space-y-4">
          <p className="font-medium text-sm">Parâmetros</p>

          <div className="space-y-1">
            <Label>Data inicial</Label>
            <Input type="date" value={inicio} onChange={e => setInicio(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Data final</Label>
            <Input type="date" value={fim} onChange={e => setFim(e.target.value)} />
          </div>

          {tipo === 'gargalos' && (
            <div className="space-y-1">
              <Label>Dias sem atualização</Label>
              <Input type="number" min={1} value={diasParado} onChange={e => setDiasParado(e.target.value)} />
              <p className="text-xs text-muted-foreground">Serviços parados há mais de {diasParado} dias</p>
            </div>
          )}

          <div className="pt-4">
            <Button onClick={gerar} disabled={carregando} className="w-full gap-2">
              {carregando ? (
                <span>Gerando...</span>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  Gerar relatório XLSX
                </>
              )}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
            <Download className="w-3 h-3" />
            O arquivo será baixado automaticamente
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## src/components/servicos/abas/AbaChecklist.tsx

```tsx
'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { marcarItemChecklist } from '@/lib/api/servico'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/usePermission'

export function AbaChecklist({ servico }: { servico: any }) {
  const { can } = usePermission()
  const qc = useQueryClient()
  const podeMarcar = can('marcarItemChecklist')
  const [observacoes, setObservacoes] = useState<Record<string, string>>({})

  const checklist: any[] = servico.checklist ?? []
  const concluidos = checklist.filter((i) => i.concluido).length
  const pct = checklist.length > 0 ? Math.round((concluidos / checklist.length) * 100) : 0

  const { mutate } = useMutation({
    mutationFn: ({ itemId, concluido }: any) =>
      marcarItemChecklist(servico.id, itemId, { concluido, observacao: observacoes[itemId] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['servico', servico.id] })
      toast.success('Checklist atualizado')
    },
  })

  if (checklist.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">Este tipo de serviço não possui checklist configurado.</p>
        <p className="text-xs text-muted-foreground mt-1">Adicione itens no Catálogo → Tipo de Serviço.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Progresso */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{concluidos}/{checklist.length} itens concluídos</span>
          <span className={`font-bold ${pct === 100 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{pct}%</span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>

      {/* Itens */}
      <div className="space-y-3">
        {checklist.map((item: any, i: number) => (
          <div key={item.id} className={`border rounded-lg p-4 space-y-2 transition-colors ${item.concluido ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
            <div className="flex items-start gap-3">
              <Checkbox
                id={item.id}
                checked={item.concluido}
                disabled={!podeMarcar}
                onCheckedChange={(checked) => mutate({ itemId: item.id, concluido: !!checked })}
                className="mt-0.5"
              />
              <div className="flex-1">
                <label
                  htmlFor={item.id}
                  className={`text-sm font-medium cursor-pointer ${item.concluido ? 'line-through text-muted-foreground' : ''}`}
                >
                  {i + 1}. {item.descricao}
                  {item.obrigatorio && !item.concluido && (
                    <span className="ml-2 text-xs text-red-500 font-normal">*obrigatório</span>
                  )}
                </label>
                {item.concluido && item.concluidoPor && (
                  <p className="text-xs text-green-600 mt-0.5">
                    ✅ {item.concluidoPor.nome} · {format(new Date(item.concluidoEm), "dd/MM HH:mm", { locale: ptBR })}
                  </p>
                )}
                {item.observacao && (
                  <p className="text-xs text-muted-foreground mt-1 italic">"{item.observacao}"</p>
                )}
              </div>
            </div>

            {podeMarcar && !item.concluido && (
              <div className="ml-8 flex gap-2">
                <Textarea
                  placeholder="Observação (opcional)..."
                  rows={1}
                  className="text-xs resize-none"
                  value={observacoes[item.id] ?? ''}
                  onChange={e => setObservacoes(o => ({ ...o, [item.id]: e.target.value }))}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## src/components/servicos/abas/AbaDadosExtras.tsx

```tsx
'use client'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { salvarDadosExtras } from '@/lib/api/servico'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { usePermission } from '@/hooks/usePermission'
import { toast } from 'sonner'

// Formulários por categoria
function FormImpressora({ dados, onChange, disabled }: any) {
  const MARCAS = ['Bematech','Elgin','Epson','Zebra','Argox','Sweda','Daruma','Outro']
  const CONEXOES = ['USB','Serial (COM)','Rede (TCP/IP)','Paralela','Bluetooth']
  const LARGURAS = ['40mm','58mm','80mm','Outro']

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label>Marca</Label>
        <Select value={dados.marcaImpressora ?? ''} onValueChange={v => onChange('marcaImpressora', v)} disabled={disabled}>
          <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
          <SelectContent>{MARCAS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Modelo</Label>
        <Input value={dados.modeloImpressora ?? ''} onChange={e => onChange('modeloImpressora', e.target.value)} disabled={disabled} />
      </div>
      <div className="space-y-1">
        <Label>Tipo de conexão</Label>
        <Select value={dados.tipoConexao ?? ''} onValueChange={v => onChange('tipoConexao', v)} disabled={disabled}>
          <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
          <SelectContent>{CONEXOES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Porta</Label>
        <Input value={dados.portaCom ?? ''} onChange={e => onChange('portaCom', e.target.value)} placeholder="COM3 / 192.168.1.x" disabled={disabled} />
      </div>
      <div className="space-y-1">
        <Label>Largura do papel</Label>
        <Select value={dados.larguraPapel ?? ''} onValueChange={v => onChange('larguraPapel', v)} disabled={disabled}>
          <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
          <SelectContent>{LARGURAS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1 col-span-2">
        <Label>Problema relatado</Label>
        <Textarea value={dados.problemaRelatado ?? ''} onChange={e => onChange('problemaRelatado', e.target.value)} rows={2} disabled={disabled} />
      </div>
    </div>
  )
}

function FormImportacao({ dados, onChange, disabled }: any) {
  const TIPOS = ['Tabela de produtos','Lista de preços','Tabela de clientes','Tabela de fornecedores','Estoque','Código de barras','Outro']
  const FORMATOS = ['CSV','TXT','XLS','XLSX','XML','JSON','Outro']
  const ENCODINGS = ['UTF-8','ANSI (Latin-1)','UTF-16','Outro']

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label>Tipo de importação</Label>
        <Select value={dados.tipoImportacao ?? ''} onValueChange={v => onChange('tipoImportacao', v)} disabled={disabled}>
          <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
          <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Formato do arquivo</Label>
        <Select value={dados.formatoArquivo ?? ''} onValueChange={v => onChange('formatoArquivo', v)} disabled={disabled}>
          <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
          <SelectContent>{FORMATOS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Encoding</Label>
        <Select value={dados.encodingArquivo ?? ''} onValueChange={v => onChange('encodingArquivo', v)} disabled={disabled}>
          <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
          <SelectContent>{ENCODINGS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Campo chave</Label>
        <Input value={dados.campoChave ?? ''} onChange={e => onChange('campoChave', e.target.value)} placeholder="Ex: codigo_barras" disabled={disabled} />
      </div>
      <div className="space-y-1">
        <Label>Qtd. registros (estimada)</Label>
        <Input type="number" value={dados.qtdRegistros ?? ''} onChange={e => onChange('qtdRegistros', Number(e.target.value))} disabled={disabled} />
      </div>
      <div className="space-y-1">
        <Label>Sistema de origem</Label>
        <Input value={dados.sistemaOrigem ?? ''} onChange={e => onChange('sistemaOrigem', e.target.value)} placeholder="Ex: Siga, SAP..." disabled={disabled} />
      </div>
    </div>
  )
}

function FormCnpj({ dados, onChange, disabled }: any) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label>CNPJ atual</Label>
        <Input value={dados.cnpjAtual ?? ''} onChange={e => onChange('cnpjAtual', e.target.value)} placeholder="00.000.000/0000-00" disabled={disabled} />
      </div>
      <div className="space-y-1">
        <Label>CNPJ novo</Label>
        <Input value={dados.cnpjNovo ?? ''} onChange={e => onChange('cnpjNovo', e.target.value)} placeholder="00.000.000/0000-00" disabled={disabled} />
      </div>
      <div className="space-y-1 col-span-2">
        <Label>Motivo da troca</Label>
        <Input value={dados.motivoTroca ?? ''} onChange={e => onChange('motivoTroca', e.target.value)} disabled={disabled} />
      </div>
    </div>
  )
}

// Mapa categoria → formulário
const FORM_MAP: Record<string, any> = {
  'Impressoras': FormImpressora,
  'Importação de dados': FormImportacao,
  'Dados cadastrais': FormCnpj,
}

export function AbaDadosExtras({ servico }: { servico: any }) {
  const { can } = usePermission()
  const qc = useQueryClient()
  const categoria = servico.tipoServico?.categoria
  const FormComponent = FORM_MAP[categoria]

  const [dados, setDados] = useState<Record<string, any>>(
    servico.dadosExtrasObj ?? {}
  )

  const podeEditar = can('editarDadosExtras')

  const { mutate, isPending } = useMutation({
    mutationFn: () => salvarDadosExtras(servico.id, dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['servico', servico.id] })
      toast.success('Detalhes específicos salvos')
    },
  })

  if (!FormComponent) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Não há campos específicos para a categoria "{categoria}".
      </p>
    )
  }

  function handleChange(campo: string, valor: any) {
    setDados(d => ({ ...d, [campo]: valor }))
  }

  return (
    <div className="space-y-6">
      <div className="text-xs text-muted-foreground">
        Campos específicos para serviços de <strong>{categoria}</strong>
      </div>

      <FormComponent dados={dados} onChange={handleChange} disabled={!podeEditar} />

      {podeEditar && (
        <Button onClick={() => mutate()} disabled={isPending}>
          {isPending ? 'Salvando...' : 'Salvar detalhes'}
        </Button>
      )}
    </div>
  )
}
```

---

## Atualizar ServicoDrawer — adicionar abas Checklist e Detalhes

```tsx
// Em ServicoDrawer.tsx — atualizar as abas:

// Imports adicionais:
import { AbaChecklist }    from './abas/AbaChecklist'
import { AbaDadosExtras }  from './abas/AbaDadosExtras'

// Atualizar array de abas:
const ABAS = ['geral','detalhes','comercial','financeiro','tecnico','agendamento','execucao','checklist','historico','anexos','comunicacao']

// Adicionar TabsContent:
<TabsContent value="detalhes">    <AbaDadosExtras servico={servico} /></TabsContent>
<TabsContent value="checklist">   <AbaChecklist servico={servico} /></TabsContent>
```

---

## usePermission — novas actions (Sprint 23)

```typescript
verDashboardServicos:    ['FINANCEIRO', 'TECNICO', 'SUPERVISAO', 'CEO', 'ADMIN'],
gerarRelatorioServicos:  ['FINANCEIRO', 'SUPERVISAO', 'CEO', 'ADMIN'],
gerenciarChecklists:     ['CEO', 'ADMIN'],
marcarItemChecklist:     ['TECNICO', 'SUPERVISAO', 'CEO', 'ADMIN'],
editarDadosExtras:       ['TECNICO', 'SUPERVISAO', 'CEO', 'ADMIN', 'FINANCEIRO'],
gerenciarFeriados:       ['ADMIN'],
```

---

## Sidebar — atualizar com Dashboard e Relatórios

```tsx
// Em sidebar config, dentro de "Serviços Contratados":
subItems: [
  { href: '/servicos',            label: 'Serviços' },
  { href: '/servicos/dashboard',  label: 'Dashboard' },     // novo
  { href: '/servicos/relatorios', label: 'Relatórios' },    // novo
  { href: '/servicos/clientes',   label: 'Clientes Base' },
  { href: '/servicos/catalogo',   label: 'Catálogo' },
]
```

---

## Sprint 23 — FRONTEND PRONTO ✅
