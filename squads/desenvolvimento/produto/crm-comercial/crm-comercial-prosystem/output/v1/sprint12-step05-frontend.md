# Sprint 12 — Step 05 — Isabela Costa (Frontend)
# Importação de Leads — Wizard 5 Steps

## Estrutura de arquivos

```
src/app/(dashboard)/importacao/
  page.tsx                        # TELA 0 — lista de importações
  nova/
    page.tsx                      # Wizard wrapper
    _components/
      ImportacaoStepper.tsx       # Stepper visual no topo
      Step1Upload.tsx             # Drag-and-drop + template
      Step2Mapeamento.tsx         # Mapeamento coluna-a-coluna
      Step3Validacao.tsx          # Cards de validação + preview
      Step4Distribuicao.tsx       # Radio buttons de distribuição
      Step5Confirmacao.tsx        # Resumo + progresso + relatório

src/hooks/useImportacao.ts        # React Query + mutations
src/lib/api/importacao.ts         # Fetch helpers
```

## src/lib/api/importacao.ts

```typescript
const BASE = '/api/importacao'

export const importacaoApi = {
  upload: async (file: File) => {
    const fd = new FormData()
    fd.append('arquivo', file)
    const res = await fetch(`${BASE}/upload`, { method: 'POST', body: fd })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  validar: async (id: string, body: object) => {
    const res = await fetch(`${BASE}/${id}/validar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  executar: async (id: string, body: object) => {
    const res = await fetch(`${BASE}/${id}/executar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  listar: async (page = 1) => {
    const res = await fetch(`${BASE}?page=${page}&limit=20`)
    return res.json()
  },

  getMapeamentosSalvos: async () => {
    const res = await fetch(`${BASE}/mapeamentos`)
    return res.json()
  },
}
```

## src/app/(dashboard)/importacao/page.tsx — TELA 0

```tsx
'use client'
import { useQuery } from '@tanstack/react-query'
import { importacaoApi } from '@/lib/api/importacao'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

const STATUS_BADGE: Record<string, { label: string; variant: 'default'|'secondary'|'destructive'|'outline' }> = {
  CONCLUIDO:              { label: 'Concluído',   variant: 'default'     },
  PROCESSANDO:            { label: 'Processando', variant: 'secondary'   },
  AGUARDANDO_CONFIRMACAO: { label: 'Aguardando',  variant: 'outline'     },
  ERRO:                   { label: 'Erro',        variant: 'destructive' },
  PENDENTE:               { label: 'Pendente',    variant: 'secondary'   },
}

export default function ImportacaoPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['importacoes'],
    queryFn: () => importacaoApi.listar(),
    staleTime: 30_000,
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Importações de Leads</h1>
          <p className="text-muted-foreground text-sm">Histórico de importações via CSV/XLSX</p>
        </div>
        <Button asChild>
          <Link href="/importacao/nova">+ Nova Importação</Link>
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground">Carregando...</p>}

      <div className="space-y-2">
        {data?.items?.map((item: any) => {
          const badge = STATUS_BADGE[item.status] ?? { label: item.status, variant: 'secondary' }
          return (
            <Card key={item.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{item.nomeArquivo}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(item.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  {' · '}{item.criadoPor.nome}
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-600 font-medium">{item.totalImportados} importados</span>
                {item.totalErros > 0 && <span className="text-red-500">{item.totalErros} erros</span>}
                {item.totalDuplicatas > 0 && <span className="text-yellow-600">{item.totalDuplicatas} duplicatas</span>}
                <Badge variant={badge.variant}>{badge.label}</Badge>
                {item.status === 'CONCLUIDO' && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/leads?importacaoId=${item.id}`}>Ver leads</Link>
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
        {data?.items?.length === 0 && (
          <p className="text-muted-foreground text-center py-12">Nenhuma importação realizada ainda.</p>
        )}
      </div>
    </div>
  )
}
```

## nova/page.tsx — Wizard wrapper

```tsx
'use client'
import { useState } from 'react'
import { ImportacaoStepper } from './_components/ImportacaoStepper'
import { Step1Upload }       from './_components/Step1Upload'
import { Step2Mapeamento }   from './_components/Step2Mapeamento'
import { Step3Validacao }    from './_components/Step3Validacao'
import { Step4Distribuicao } from './_components/Step4Distribuicao'
import { Step5Confirmacao }  from './_components/Step5Confirmacao'

export type WizardState = {
  importacaoId: string
  cabecalhos: string[]
  mapeamento: Record<string, string>
  validacao: {
    totalValidos: number
    totalErros: number
    totalDuplicatas: number
    preview: any[]
    erros: any[]
    duplicatas: any[]
  } | null
  distribuicao: any | null
  ignorarErros: boolean
  ignorarDuplicatas: boolean
}

const STEPS = ['Upload', 'Mapeamento', 'Validação', 'Distribuição', 'Confirmação']

export default function NovaImportacaoPage() {
  const [step, setStep] = useState(0)
  const [state, setState] = useState<Partial<WizardState>>({})

  const next = (patch: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...patch }))
    setStep(s => s + 1)
  }
  const back = () => setStep(s => s - 1)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Nova Importação de Leads</h1>
      <ImportacaoStepper steps={STEPS} current={step} />

      {step === 0 && <Step1Upload onNext={next} />}
      {step === 1 && <Step2Mapeamento state={state as WizardState} onNext={next} onBack={back} />}
      {step === 2 && <Step3Validacao state={state as WizardState} onNext={next} onBack={back} />}
      {step === 3 && <Step4Distribuicao state={state as WizardState} onNext={next} onBack={back} />}
      {step === 4 && <Step5Confirmacao state={state as WizardState} onBack={back} />}
    </div>
  )
}
```

## ImportacaoStepper.tsx

```tsx
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ImportacaoStepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors',
              i < current  && 'bg-primary border-primary text-white',
              i === current && 'border-primary text-primary bg-primary/10',
              i > current  && 'border-muted text-muted-foreground bg-background',
            )}>
              {i < current ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={cn('text-xs whitespace-nowrap', i === current && 'font-semibold text-primary', i !== current && 'text-muted-foreground')}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={cn('h-0.5 flex-1 mx-2 mb-4', i < current ? 'bg-primary' : 'bg-muted')} />
          )}
        </div>
      ))}
    </div>
  )
}
```

## Step1Upload.tsx

```tsx
'use client'
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { importacaoApi } from '@/lib/api/importacao'
import { toast } from 'sonner'

export function Step1Upload({ onNext }: { onNext: (patch: any) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const onDrop = useCallback((accepted: File[]) => setFile(accepted[0] ?? null), [])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
  })

  async function handleUpload() {
    if (!file) return
    setLoading(true)
    try {
      const data = await importacaoApi.upload(file)
      onNext({
        importacaoId: data.importacaoId,
        cabecalhos: data.cabecalhos,
        mapeamento: data.mapeamentoDetectado,
        mapeamentosSalvos: data.mapeamentosSalvos,
      })
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao enviar arquivo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-8 space-y-6">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto w-10 h-10 text-muted-foreground mb-3" />
        {file ? (
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <span className="font-medium">{file.name}</span>
            </div>
            <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        ) : (
          <>
            <p className="font-medium">Arraste um arquivo CSV ou XLSX aqui</p>
            <p className="text-sm text-muted-foreground mt-1">ou clique para selecionar · máx. 5MB · ~5.000 leads</p>
          </>
        )}
      </div>

      <div className="flex items-center justify-between">
        <a href="/api/importacao/template" download className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
          <Download className="w-4 h-4" />
          Baixar template CSV
        </a>
        <Button onClick={handleUpload} disabled={!file || loading}>
          {loading ? 'Enviando...' : 'Próximo →'}
        </Button>
      </div>
    </Card>
  )
}
```

## Step2Mapeamento.tsx

```tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { importacaoApi } from '@/lib/api/importacao'
import { toast } from 'sonner'
import { WizardState } from '../page'

const CAMPOS_CRM = [
  { campo: '', label: '— Ignorar coluna —' },
  { campo: 'nomeEmpresa',          label: 'Nome da Empresa *' },
  { campo: 'whatsapp',             label: 'WhatsApp' },
  { campo: 'email',                label: 'E-mail' },
  { campo: 'cnpj',                 label: 'CNPJ' },
  { campo: 'segmento',             label: 'Segmento' },
  { campo: 'origem',               label: 'Origem' },
  { campo: 'cidade',               label: 'Cidade' },
  { campo: 'estado',               label: 'Estado' },
  { campo: 'contato',              label: 'Nome do Contato' },
  { campo: 'telefone',             label: 'Telefone' },
  { campo: 'potencialMensalidade', label: 'Potencial Mensalidade' },
  { campo: 'observacao',           label: 'Observação' },
]

export function Step2Mapeamento({ state, onNext, onBack }: { state: WizardState; onNext: (p: any) => void; onBack: () => void }) {
  const [mapeamento, setMapeamento] = useState<Record<string, string>>(state.mapeamento ?? {})
  const [salvar, setSalvar] = useState(false)
  const [nomeMapeamento, setNomeMapeamento] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (col: string, campo: string) => setMapeamento(prev => ({ ...prev, [col]: campo }))

  async function handleValidar() {
    setLoading(true)
    try {
      const data = await importacaoApi.validar(state.importacaoId, {
        mapeamento,
        salvarMapeamento: salvar,
        nomeMapeamento: salvar ? nomeMapeamento : undefined,
      })
      onNext({ mapeamento, validacao: data })
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao validar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Mapeamento de Colunas</h2>
        <p className="text-sm text-muted-foreground">Relacione cada coluna do arquivo com o campo do CRM. <span className="text-primary">Detecção automática aplicada.</span></p>
      </div>

      <div className="border rounded-md divide-y">
        <div className="grid grid-cols-2 px-4 py-2 bg-muted text-xs font-semibold text-muted-foreground">
          <span>Coluna no arquivo</span>
          <span>Campo no CRM</span>
        </div>
        {state.cabecalhos.map(col => (
          <div key={col} className="grid grid-cols-2 items-center px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono">{col}</span>
              {mapeamento[col] && mapeamento[col] !== '' && (
                <Badge variant="secondary" className="text-xs">auto</Badge>
              )}
            </div>
            <Select value={mapeamento[col] ?? ''} onValueChange={v => set(col, v)}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {CAMPOS_CRM.map(c => (
                  <SelectItem key={c.campo} value={c.campo}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2">
        <Checkbox id="salvar" checked={salvar} onCheckedChange={v => setSalvar(!!v)} />
        <div className="space-y-1">
          <Label htmlFor="salvar" className="cursor-pointer">Salvar este mapeamento para reutilizar</Label>
          {salvar && (
            <Input
              placeholder="Nome do mapeamento (ex: Planilha Comercial)"
              value={nomeMapeamento}
              onChange={e => setNomeMapeamento(e.target.value)}
              className="mt-1 h-8 text-sm"
            />
          )}
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>← Voltar</Button>
        <Button onClick={handleValidar} disabled={loading}>
          {loading ? 'Validando...' : 'Validar arquivo →'}
        </Button>
      </div>
    </Card>
  )
}
```

## Step3Validacao.tsx

```tsx
'use client'
import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { CheckCircle2, AlertCircle, Copy } from 'lucide-react'
import { WizardState } from '../page'

export function Step3Validacao({ state, onNext, onBack }: { state: WizardState; onNext: (p: any) => void; onBack: () => void }) {
  const v = state.validacao!
  const [ignorarErros, setIgnorarErros] = useState(false)
  const [ignorarDuplicatas, setIgnorarDuplicatas] = useState(false)

  return (
    <Card className="p-6 space-y-6">
      <h2 className="text-lg font-semibold">Resultado da Validação</h2>

      {/* 3 cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 text-center space-y-1">
          <CheckCircle2 className="mx-auto w-6 h-6 text-green-500" />
          <p className="text-2xl font-bold text-green-600">{v.totalValidos}</p>
          <p className="text-sm text-muted-foreground">Válidos</p>
        </div>
        <div className="border rounded-lg p-4 text-center space-y-1">
          <AlertCircle className="mx-auto w-6 h-6 text-red-500" />
          <p className="text-2xl font-bold text-red-600">{v.totalErros}</p>
          <p className="text-sm text-muted-foreground">Com erro</p>
        </div>
        <div className="border rounded-lg p-4 text-center space-y-1">
          <Copy className="mx-auto w-6 h-6 text-yellow-500" />
          <p className="text-2xl font-bold text-yellow-600">{v.totalDuplicatas}</p>
          <p className="text-sm text-muted-foreground">Duplicatas</p>
        </div>
      </div>

      {/* Preview 10 linhas */}
      {v.preview.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-2">Preview — primeiras 10 linhas válidas</p>
          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>{Object.keys(v.preview[0]).filter(k => k !== '_linha').map(k => (
                  <th key={k} className="px-3 py-2 text-left font-semibold">{k}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y">
                {v.preview.map((row: any, i: number) => (
                  <tr key={i}>
                    {Object.entries(row).filter(([k]) => k !== '_linha').map(([k, val]) => (
                      <td key={k} className="px-3 py-2 max-w-[150px] truncate">{String(val)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lista de erros */}
      {v.erros.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-semibold text-red-600">Erros ({v.erros.length})</p>
            <div className="flex items-center gap-1.5">
              <Checkbox id="ignorarErros" checked={ignorarErros} onCheckedChange={c => setIgnorarErros(!!c)} />
              <Label htmlFor="ignorarErros" className="text-xs cursor-pointer">Ignorar e continuar</Label>
            </div>
          </div>
          <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
            {v.erros.map((e: any, i: number) => (
              <div key={i} className="px-3 py-2 text-xs flex gap-3">
                <span className="text-muted-foreground w-14">Linha {e.linha}</span>
                <span className="text-muted-foreground w-24">{e.campo}</span>
                <span className="text-red-600">{e.mensagem}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de duplicatas */}
      {v.duplicatas.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-semibold text-yellow-600">Duplicatas ({v.duplicatas.length})</p>
            <div className="flex items-center gap-1.5">
              <Checkbox id="ignorarDuplicatas" checked={ignorarDuplicatas} onCheckedChange={c => setIgnorarDuplicatas(!!c)} />
              <Label htmlFor="ignorarDuplicatas" className="text-xs cursor-pointer">Incluir mesmo assim</Label>
            </div>
          </div>
          <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
            {v.duplicatas.map((d: any, i: number) => (
              <div key={i} className="px-3 py-2 text-xs flex gap-3">
                <span className="text-muted-foreground w-14">Linha {d.linha}</span>
                <span className="text-muted-foreground w-24">{d.campo}</span>
                <span className="text-yellow-700">{d.valorDuplicado}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>← Voltar</Button>
        <Button
          onClick={() => onNext({ ignorarErros, ignorarDuplicatas })}
          disabled={v.totalValidos === 0 && !ignorarDuplicatas}
        >
          Próximo →
        </Button>
      </div>
    </Card>
  )
}
```

## Step4Distribuicao.tsx

```tsx
'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { WizardState } from '../page'

export function Step4Distribuicao({ state, onNext, onBack }: { state: WizardState; onNext: (p: any) => void; onBack: () => void }) {
  const [modo, setModo] = useState<string>('manual')
  const [vendedorId, setVendedorId] = useState('')
  const [vendedorIds, setVendedorIds] = useState<string[]>([])

  const { data: vendedores } = useQuery({
    queryKey: ['users', 'vendedores'],
    queryFn: () => fetch('/api/users?perfil=VENDEDOR').then(r => r.json()),
    staleTime: 60_000,
  })

  const totalValidos = state.validacao?.totalValidos ?? 0
  const perVendedor  = vendedorIds.length > 0 ? Math.ceil(totalValidos / vendedorIds.length) : 0

  function buildDistribuicao() {
    if (modo === 'manual')      return { modo: 'manual', vendedorId }
    if (modo === 'round-robin') return { modo: 'round-robin', vendedorIds }
    if (modo === 'segmento')    return { modo: 'segmento', mapeamentoSegmento: {} }
    if (modo === 'coluna')      return { modo: 'coluna', colunaArquivo: '' }
    return {}
  }

  const canProceed = (
    (modo === 'manual' && vendedorId) ||
    (modo === 'round-robin' && vendedorIds.length > 0) ||
    modo === 'segmento' ||
    modo === 'coluna'
  )

  return (
    <Card className="p-6 space-y-6">
      <h2 className="text-lg font-semibold">Distribuição dos Leads</h2>

      <RadioGroup value={modo} onValueChange={setModo} className="space-y-3">
        <div className="flex items-start gap-3 border rounded-lg p-4">
          <RadioGroupItem value="manual" id="manual" className="mt-0.5" />
          <div className="space-y-2 flex-1">
            <Label htmlFor="manual" className="font-medium cursor-pointer">Manual — atribuir a um vendedor</Label>
            {modo === 'manual' && (
              <Select value={vendedorId} onValueChange={setVendedorId}>
                <SelectTrigger className="h-8 w-64">
                  <SelectValue placeholder="Selecione o vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {vendedores?.items?.map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3 border rounded-lg p-4">
          <RadioGroupItem value="round-robin" id="round-robin" className="mt-0.5" />
          <div className="space-y-2 flex-1">
            <Label htmlFor="round-robin" className="font-medium cursor-pointer">
              Round-robin — distribuir entre vendedores
              {modo === 'round-robin' && vendedorIds.length > 0 && (
                <span className="text-muted-foreground font-normal ml-2 text-sm">
                  (~{perVendedor} por vendedor)
                </span>
              )}
            </Label>
            {modo === 'round-robin' && (
              <div className="space-y-1">
                {vendedores?.items?.map((v: any) => (
                  <div key={v.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`v-${v.id}`}
                      checked={vendedorIds.includes(v.id)}
                      onCheckedChange={c => setVendedorIds(prev =>
                        c ? [...prev, v.id] : prev.filter(id => id !== v.id)
                      )}
                    />
                    <Label htmlFor={`v-${v.id}`} className="cursor-pointer text-sm">{v.nome}</Label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3 border rounded-lg p-4">
          <RadioGroupItem value="segmento" id="segmento" className="mt-0.5" />
          <div>
            <Label htmlFor="segmento" className="font-medium cursor-pointer">Por segmento — cada segmento vai para um vendedor</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Configure o mapeamento segmento → vendedor na tela de confirmação</p>
          </div>
        </div>

        <div className="flex items-start gap-3 border rounded-lg p-4">
          <RadioGroupItem value="coluna" id="coluna" className="mt-0.5" />
          <div>
            <Label htmlFor="coluna" className="font-medium cursor-pointer">Por coluna da planilha — usar coluna "vendedorId" do arquivo</Label>
            <p className="text-xs text-muted-foreground mt-0.5">O arquivo deve ter uma coluna com o ID do vendedor</p>
          </div>
        </div>
      </RadioGroup>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>← Voltar</Button>
        <Button onClick={() => onNext({ distribuicao: buildDistribuicao() })} disabled={!canProceed}>
          Próximo →
        </Button>
      </div>
    </Card>
  )
}
```

## Step5Confirmacao.tsx

```tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, XCircle } from 'lucide-react'
import { importacaoApi } from '@/lib/api/importacao'
import { toast } from 'sonner'
import { WizardState } from '../page'

type JobStatus = 'idle' | 'running' | 'done' | 'error'

export function Step5Confirmacao({ state, onBack }: { state: WizardState; onBack: () => void }) {
  const router = useRouter()
  const [jobStatus, setJobStatus] = useState<JobStatus>('idle')
  const [processados, setProcessados] = useState(0)
  const [total, setTotal] = useState(state.validacao?.totalValidos ?? 0)
  const evtRef = useRef<EventSource | null>(null)

  async function handleImportar() {
    setJobStatus('running')
    try {
      await importacaoApi.executar(state.importacaoId, {
        distribuicao: state.distribuicao,
        ignorarErros: state.ignorarErros,
        ignorarDuplicatas: state.ignorarDuplicatas,
      })

      // Conecta SSE
      const evt = new EventSource(`/api/importacao/${state.importacaoId}/progresso`)
      evtRef.current = evt

      evt.onmessage = e => {
        const data = JSON.parse(e.data)
        setProcessados(data.processados ?? 0)
        setTotal(data.total ?? total)

        if (data.status === 'CONCLUIDO') {
          setJobStatus('done')
          evt.close()
        }
        if (data.status === 'ERRO') {
          setJobStatus('error')
          evt.close()
        }
      }

      evt.onerror = () => {
        setJobStatus('error')
        evt.close()
      }
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao iniciar importação')
      setJobStatus('idle')
    }
  }

  useEffect(() => () => evtRef.current?.close(), [])

  const pct = total > 0 ? Math.round((processados / total) * 100) : 0

  return (
    <Card className="p-6 space-y-6">
      <h2 className="text-lg font-semibold">Confirmação</h2>

      {/* Resumo */}
      <div className="border rounded-lg divide-y">
        <div className="flex justify-between px-4 py-3 text-sm">
          <span className="text-muted-foreground">Leads válidos para importar</span>
          <span className="font-semibold text-green-600">{state.validacao?.totalValidos}</span>
        </div>
        <div className="flex justify-between px-4 py-3 text-sm">
          <span className="text-muted-foreground">Erros ignorados</span>
          <span>{state.ignorarErros ? state.validacao?.totalErros : 0}</span>
        </div>
        <div className="flex justify-between px-4 py-3 text-sm">
          <span className="text-muted-foreground">Duplicatas incluídas</span>
          <span>{state.ignorarDuplicatas ? state.validacao?.totalDuplicatas : 0}</span>
        </div>
        <div className="flex justify-between px-4 py-3 text-sm">
          <span className="text-muted-foreground">Modo de distribuição</span>
          <span className="capitalize">{state.distribuicao?.modo}</span>
        </div>
      </div>

      {/* Progress bar */}
      {jobStatus !== 'idle' && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{jobStatus === 'running' ? 'Importando...' : jobStatus === 'done' ? 'Concluído!' : 'Erro na importação'}</span>
            <span>{processados}/{total}</span>
          </div>
          <Progress value={pct} className="h-3" />
          <p className="text-xs text-muted-foreground text-right">{pct}%</p>
        </div>
      )}

      {/* Estado final */}
      {jobStatus === 'done' && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
          <div>
            <p className="font-semibold text-green-800">{processados} leads importados com sucesso!</p>
            <p className="text-sm text-green-700">Os leads já estão disponíveis na sua lista.</p>
          </div>
        </div>
      )}

      {jobStatus === 'error' && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <XCircle className="w-6 h-6 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">Ocorreu um erro durante a importação. Verifique o histórico para detalhes.</p>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={jobStatus === 'running'}>← Voltar</Button>
        {jobStatus === 'idle' && (
          <Button onClick={handleImportar} size="lg">
            ▶ Importar {state.validacao?.totalValidos} leads
          </Button>
        )}
        {jobStatus === 'done' && (
          <Button onClick={() => router.push(`/leads?importacaoId=${state.importacaoId}`)}>
            Ver leads importados →
          </Button>
        )}
        {jobStatus === 'error' && (
          <Button variant="outline" onClick={() => router.push('/importacao')}>
            Ver histórico
          </Button>
        )}
      </div>
    </Card>
  )
}
```

## Ajuste em /leads — filtro importacaoId

```tsx
// src/app/(dashboard)/leads/page.tsx — adicionar ao useLeads
const searchParams = useSearchParams()
const importacaoId = searchParams.get('importacaoId')

// passar para o query:
queryFn: () => fetch(`/api/leads?importacaoId=${importacaoId ?? ''}&...`).then(r => r.json())

// Badge visual quando filtrado por importação
{importacaoId && (
  <Badge variant="outline" className="gap-1">
    Importação filtrada
    <button onClick={() => router.push('/leads')}>×</button>
  </Badge>
)}
```
