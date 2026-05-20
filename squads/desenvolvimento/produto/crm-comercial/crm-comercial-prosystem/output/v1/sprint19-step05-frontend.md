# Sprint 19 — Step 05 — Isabela Costa (Frontend)
# Integrações — UI

## Estrutura de arquivos

```
src/
  app/(dashboard)/
    configuracoes/
      integracoes/
        page.tsx                  ← painel de configuração
      log-mensagens/
        page.tsx                  ← log de mensagens
    leads/_components/
      integracoes/
        LeadActionBar.tsx         ← barra de ações rápidas (WhatsApp, Ligação)
        WhatsAppModal.tsx         ← modal envio WhatsApp
        LigacaoModal.tsx          ← modal registro de ligação
  lib/api/integracao.ts           ← fetch helpers
```

## src/lib/api/integracao.ts

```typescript
import { apiFetch } from './client'

export interface ConfigEntry { chave: string; valor: string; sensivel: boolean }
export interface LogMensagem {
  id: string
  canal: 'WHATSAPP' | 'EMAIL'
  destinatario: string
  template?: string
  status: 'ENVIADO' | 'FALHA' | 'PENDENTE'
  erro?: string
  lead?: { nome: string; empresa: string }
  campanha?: { nome: string }
  enviadoPor?: { nome: string }
  createdAt: string
}

export const integracaoApi = {
  listarConfig:   (): Promise<ConfigEntry[]> => apiFetch('/config/integracoes'),
  salvarConfig:   (entries: { chave: string; valor: string }[]) =>
    apiFetch('/config/integracoes', { method: 'PUT', body: JSON.stringify({ entries }) }),
  testar: (canal: 'whatsapp' | 'smtp') =>
    apiFetch(`/config/integracoes/testar/${canal}`, { method: 'POST' }),
  enviarWhatsApp: (leadId: string) =>
    apiFetch(`/leads/${leadId}/whatsapp`, { method: 'POST' }),
  registrarLigacao: (leadId: string, data: {
    dataHora: string; duracaoMin?: number; resultado: string; notas?: string
  }) => apiFetch(`/leads/${leadId}/ligacoes`, { method: 'POST', body: JSON.stringify(data) }),
  logMensagens: (params?: { canal?: string; dias?: number }): Promise<LogMensagem[]> => {
    const qs = new URLSearchParams()
    if (params?.canal) qs.set('canal', params.canal)
    if (params?.dias)  qs.set('dias', String(params.dias))
    return apiFetch(`/log-mensagens?${qs}`)
  },
}
```

## src/app/(dashboard)/leads/_components/integracoes/WhatsAppModal.tsx

```tsx
'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { integracaoApi } from '@/lib/api/integracao'

interface Props {
  open: boolean
  onClose: () => void
  leadId: string
  lead: { nome: string; empresa: string; telefone?: string }
}

export function WhatsAppModal({ open, onClose, leadId, lead }: Props) {
  const [resultado, setResultado] = useState<'ok' | 'erro' | null>(null)
  const [erroMsg, setErroMsg] = useState('')

  const mutation = useMutation({
    mutationFn: () => integracaoApi.enviarWhatsApp(leadId),
    onSuccess: () => setResultado('ok'),
    onError: (e: any) => { setResultado('erro'); setErroMsg(e?.message ?? 'Erro desconhecido') },
  })

  function handleClose() {
    setResultado(null)
    setErroMsg('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar WhatsApp</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm space-y-1">
            <p><span className="font-medium">Para:</span> {lead.nome} — {lead.empresa}</p>
            {lead.telefone
              ? <p className="text-muted-foreground">{lead.telefone}</p>
              : <p className="text-destructive">Lead sem telefone cadastrado</p>
            }
          </div>

          <div className="p-3 bg-muted rounded-lg text-sm">
            <p className="font-medium mb-1">Prévia (template):</p>
            <p className="text-muted-foreground italic">
              Olá, <strong>{lead.nome}</strong>! Aqui é da ProSystem.
              Gostaria de conversar sobre soluções para a <strong>{lead.empresa}</strong>.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            ⚠️ WhatsApp Business usa templates aprovados pelo Meta.
          </p>

          {resultado === 'ok' && (
            <p className="text-sm text-green-600 font-medium">✅ Mensagem enviada com sucesso!</p>
          )}
          {resultado === 'erro' && (
            <p className="text-sm text-destructive">❌ {erroMsg}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose}>
              {resultado ? 'Fechar' : 'Cancelar'}
            </Button>
            {!resultado && (
              <Button
                onClick={() => mutation.mutate()}
                disabled={!lead.telefone || mutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {mutation.isPending ? 'Enviando...' : '💬 Enviar mensagem'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

## src/app/(dashboard)/leads/_components/integracoes/LigacaoModal.tsx

```tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { integracaoApi } from '@/lib/api/integracao'

const schema = z.object({
  dataHora:   z.string().min(1),
  duracaoMin: z.coerce.number().int().min(0).optional(),
  resultado:  z.enum(['conectou_agendou', 'conectou_sem_interesse', 'nao_atendeu', 'caixa_postal']),
  notas:      z.string().optional(),
})

type Form = z.infer<typeof schema>

const RESULTADOS = [
  { value: 'conectou_agendou',       label: 'Conectou — agendou retorno' },
  { value: 'conectou_sem_interesse', label: 'Conectou — sem interesse' },
  { value: 'nao_atendeu',            label: 'Não atendeu' },
  { value: 'caixa_postal',           label: 'Caixa postal' },
]

interface Props {
  open: boolean
  onClose: () => void
  leadId: string
}

export function LigacaoModal({ open, onClose, leadId }: Props) {
  const qc = useQueryClient()
  const agora = new Date().toISOString().slice(0, 16) // "yyyy-MM-ddTHH:mm"

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { dataHora: agora },
  })

  const mutation = useMutation({
    mutationFn: (data: Form) => integracaoApi.registrarLigacao(leadId, {
      ...data,
      dataHora: new Date(data.dataHora).toISOString(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['historico', leadId] })
      reset()
      onClose()
    },
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Ligação</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data e hora *</Label>
              <Input type="datetime-local" {...register('dataHora')} />
            </div>
            <div className="space-y-1">
              <Label>Duração (min)</Label>
              <Input type="number" min={0} placeholder="5" {...register('duracaoMin')} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Resultado *</Label>
            <Select onValueChange={(v) => setValue('resultado', v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {RESULTADOS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.resultado && <p className="text-xs text-destructive">Campo obrigatório</p>}
          </div>

          <div className="space-y-1">
            <Label>Notas</Label>
            <Textarea placeholder="Observações da ligação..." rows={3} {...register('notas')} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : 'Salvar ligação'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

## src/app/(dashboard)/leads/_components/integracoes/LeadActionBar.tsx

```tsx
'use client'

import { useState } from 'react'
import { MessageCircle, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WhatsAppModal } from './WhatsAppModal'
import { LigacaoModal } from './LigacaoModal'

interface Props {
  leadId: string
  lead: { nome: string; empresa: string; telefone?: string }
}

export function LeadActionBar({ leadId, lead }: Props) {
  const [waOpen, setWaOpen] = useState(false)
  const [ligOpen, setLigOpen] = useState(false)

  return (
    <>
      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setWaOpen(true)}
        >
          <MessageCircle className="h-4 w-4 text-green-600" />
          WhatsApp
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setLigOpen(true)}
        >
          <Phone className="h-4 w-4 text-blue-600" />
          Registrar ligação
        </Button>
      </div>

      <WhatsAppModal open={waOpen} onClose={() => setWaOpen(false)} leadId={leadId} lead={lead} />
      <LigacaoModal  open={ligOpen} onClose={() => setLigOpen(false)} leadId={leadId} />
    </>
  )
}
```

## src/app/(dashboard)/configuracoes/integracoes/page.tsx

```tsx
'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { integracaoApi } from '@/lib/api/integracao'

function SenhaInput({ chave, valorAtual }: { chave: string; valorAtual: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        name={chave}
        defaultValue={valorAtual === '••••••••' ? '' : valorAtual}
        placeholder={valorAtual === '••••••••' ? '(mantém atual se vazio)' : ''}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm"
      >
        {show ? '🙈' : '👁'}
      </button>
    </div>
  )
}

export default function IntegracoesPage() {
  const [testeWa, setTesteWa] = useState<string | null>(null)
  const [testeSmtp, setTesteSmtp] = useState<string | null>(null)

  const { data: configs = [] } = useQuery({
    queryKey: ['config-integracoes'],
    queryFn: integracaoApi.listarConfig,
  })

  const getValor = (chave: string) => configs.find((c) => c.chave === chave)?.valor ?? ''
  const isSensivel = (chave: string) => configs.find((c) => c.chave === chave)?.sensivel ?? false

  const salvarMutation = useMutation({
    mutationFn: (entries: { chave: string; valor: string }[]) =>
      integracaoApi.salvarConfig(entries.filter((e) => e.valor !== '')),
  })

  function handleSubmitWA(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const entries = ['WHATSAPP_PHONE_ID', 'WHATSAPP_TOKEN', 'WHATSAPP_TEMPLATE'].map((k) => ({
      chave: k, valor: fd.get(k) as string,
    }))
    salvarMutation.mutate(entries)
  }

  function handleSubmitSmtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const keys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']
    salvarMutation.mutate(keys.map((k) => ({ chave: k, valor: fd.get(k) as string })))
  }

  async function testar(canal: 'whatsapp' | 'smtp', setFn: (s: string) => void) {
    try {
      await integracaoApi.testar(canal)
      setFn('✅ Conexão OK')
    } catch (e: any) {
      setFn(`❌ ${e?.message ?? 'Falha'}`)
    }
  }

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      <h1 className="text-2xl font-bold">Configurações — Integrações</h1>

      {/* WhatsApp */}
      <form onSubmit={handleSubmitWA} className="space-y-4 border rounded-lg p-5">
        <h2 className="font-semibold text-lg">💬 WhatsApp Business</h2>
        {[
          { chave: 'WHATSAPP_PHONE_ID', label: 'Phone Number ID' },
          { chave: 'WHATSAPP_TOKEN',    label: 'Access Token' },
          { chave: 'WHATSAPP_TEMPLATE', label: 'Template padrão' },
        ].map(({ chave, label }) => (
          <div key={chave} className="space-y-1">
            <Label>{label}</Label>
            {isSensivel(chave)
              ? <SenhaInput chave={chave} valorAtual={getValor(chave)} />
              : <Input name={chave} defaultValue={getValor(chave)} />
            }
          </div>
        ))}
        <div className="flex items-center gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => testar('whatsapp', setTesteWa)}>
            Testar conexão
          </Button>
          <Button type="submit" disabled={salvarMutation.isPending}>Salvar</Button>
          {testeWa && <span className="text-sm">{testeWa}</span>}
        </div>
      </form>

      {/* SMTP */}
      <form onSubmit={handleSubmitSmtp} className="space-y-4 border rounded-lg p-5">
        <h2 className="font-semibold text-lg">✉ E-mail (SMTP)</h2>
        {[
          { chave: 'SMTP_HOST',   label: 'Servidor' },
          { chave: 'SMTP_PORT',   label: 'Porta' },
          { chave: 'SMTP_USER',   label: 'Usuário' },
          { chave: 'SMTP_PASS',   label: 'Senha' },
          { chave: 'SMTP_FROM',   label: 'Remetente padrão' },
        ].map(({ chave, label }) => (
          <div key={chave} className="space-y-1">
            <Label>{label}</Label>
            {isSensivel(chave)
              ? <SenhaInput chave={chave} valorAtual={getValor(chave)} />
              : <Input name={chave} defaultValue={getValor(chave)} />
            }
          </div>
        ))}
        <div className="flex items-center gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => testar('smtp', setTesteSmtp)}>
            Testar conexão
          </Button>
          <Button type="submit" disabled={salvarMutation.isPending}>Salvar</Button>
          {testeSmtp && <span className="text-sm">{testeSmtp}</span>}
        </div>
      </form>
    </div>
  )
}
```

## Integração no LeadDrawer

```tsx
// Adicionar LeadActionBar logo abaixo do header da ficha do lead:
import { LeadActionBar } from './_components/integracoes/LeadActionBar'

// Dentro do LeadDrawer, antes das abas:
<LeadActionBar
  leadId={lead.id}
  lead={{ nome: lead.nome, empresa: lead.empresa, telefone: lead.telefone }}
/>
```

## Adicionar ao menu Configurações

```tsx
// src/components/Sidebar.tsx — submenu Configurações:
{ href: '/configuracoes/integracoes',    label: 'Integrações' }
{ href: '/configuracoes/log-mensagens',  label: 'Log de mensagens' }
// (Log visível somente para SUPERVISAO/CEO/ADMIN — via usePermission)
```
