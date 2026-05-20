# Sprint 32 — Step 05 — Isabela Costa (Frontend)
# Portal do Cliente — Componentes Next.js

## app/portal/layout.tsx (Layout do portal — sem sidebar do CRM)

```tsx
import type { ReactNode } from 'react'
import { PortalAuthProvider } from '@/contexts/portal-auth'

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <PortalAuthProvider>
      <div className="min-h-screen bg-slate-50">
        {children}
      </div>
    </PortalAuthProvider>
  )
}
```

## app/portal/login/page.tsx

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function PortalLogin() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/portal/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      localStorage.setItem('portal_token', data.token)
      localStorage.setItem('portal_cliente', JSON.stringify(data.cliente))

      if (data.primeiroAcesso) {
        router.push('/portal/alterar-senha')
      } else {
        router.push('/portal')
      }
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center pb-4">
          <div className="text-4xl font-black text-blue-700 mb-1">ProSystem</div>
          <CardTitle className="text-lg font-medium text-slate-600">Área do Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            </div>
            <div>
              <Label>Senha</Label>
              <Input type="password" value={senha} onChange={e => setSenha(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
          <p className="text-center text-sm text-slate-400 mt-6">
            Precisa de ajuda? Fale com seu vendedor.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

## app/portal/page.tsx (Dashboard)

```tsx
'use client'
import { usePortalQuery } from '@/hooks/use-portal'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { FileText, FileCheck, AlertCircle, User } from 'lucide-react'

export default function PortalDashboard() {
  const { data, isLoading } = usePortalQuery('/portal/api/dashboard')

  if (isLoading) return <PortalSkeleton />

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Olá, {data?.lead?.nome?.split(' ')[0]}! 👋
        </h1>
        <p className="text-slate-500">{data?.lead?.empresa}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link href="/portal/propostas">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-amber-200">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <div className="text-3xl font-bold text-amber-600">{data?.propostasPendentes ?? 0}</div>
              <div className="text-sm text-slate-500 mt-1">Proposta{data?.propostasPendentes !== 1 ? 's' : ''} Pendente{data?.propostasPendentes !== 1 ? 's' : ''}</div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/portal/contratos">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-green-200">
            <CardContent className="pt-6 text-center">
              <FileCheck className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-3xl font-bold text-green-700">{data?.contratosAtivos ?? 0}</div>
              <div className="text-sm text-slate-500 mt-1">Contrato{data?.contratosAtivos !== 1 ? 's' : ''} Ativo{data?.contratosAtivos !== 1 ? 's' : ''}</div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/portal/historico">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6 text-center">
              <FileText className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-sm font-semibold text-slate-700 mt-2">Histórico</div>
              <div className="text-sm text-slate-500">de comunicações</div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Vendedor */}
      {data?.lead?.vendedor && (
        <Card className="bg-slate-50">
          <CardContent className="pt-4 pb-4 flex items-center gap-4">
            <User className="w-10 h-10 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-700">Seu Vendedor ProSystem</p>
              <p className="font-semibold">{data.lead.vendedor.nome}</p>
              <p className="text-sm text-slate-500">{data.lead.vendedor.email} · {data.lead.vendedor.telefone}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

## app/portal/propostas/[id]/page.tsx (Detalhe + Aprovação)

```tsx
'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePortalQuery, usePortalMutation } from '@/hooks/use-portal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatCurrency, formatDate } from '@/lib/format'

const STATUS_BADGE: Record<string, { label: string; variant: any }> = {
  AGUARDANDO_APROVACAO: { label: '⏳ Aguardando aprovação', variant: 'warning' },
  APROVADA: { label: '✅ Aprovada', variant: 'success' },
  RECUSADA: { label: '❌ Recusada', variant: 'destructive' },
  EM_NEGOCIACAO: { label: '🔵 Em negociação', variant: 'default' },
}

export default function PropostaDetalhe() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: proposta, isLoading } = usePortalQuery(`/portal/api/propostas/${id}`)
  const [modalAprovar, setModalAprovar] = useState(false)
  const [modalRecusar, setModalRecusar] = useState(false)
  const [motivo, setMotivo] = useState('')

  const aprovar = usePortalMutation(`/portal/api/propostas/${id}/aprovar`, 'PATCH')
  const recusar = usePortalMutation(`/portal/api/propostas/${id}/recusar`, 'PATCH')

  if (isLoading) return <div className="p-8">Carregando...</div>
  if (!proposta) return null

  const badge = STATUS_BADGE[proposta.status] ?? { label: proposta.status, variant: 'default' }
  const pendente = proposta.status === 'AGUARDANDO_APROVACAO'

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <button onClick={() => router.back()} className="text-sm text-blue-600 mb-4 flex items-center gap-1">← Propostas</button>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Proposta {proposta.numero}</h1>
          <p className="text-slate-500">{proposta.titulo}</p>
        </div>
        <Badge variant={badge.variant as any}>{badge.label}</Badge>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-slate-500">Valor total</span><p className="font-semibold text-lg">{formatCurrency(proposta.valorTotal)}</p></div>
          <div><span className="text-slate-500">Válido até</span><p className="font-semibold">{proposta.validadeAte ? formatDate(proposta.validadeAte) : '—'}</p></div>
        </div>

        {proposta.itens?.length > 0 && (
          <div>
            <p className="text-sm text-slate-500 mb-2">Itens da proposta</p>
            <div className="divide-y">
              {proposta.itens.map((item: any) => (
                <div key={item.id} className="flex justify-between py-2 text-sm">
                  <span>{item.descricao}</span>
                  <span className="font-medium">{formatCurrency(item.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {pendente && (
        <div className="flex gap-4">
          <Button onClick={() => setModalAprovar(true)} className="flex-1 bg-green-600 hover:bg-green-700">
            ✅ Aprovar Proposta
          </Button>
          <Button onClick={() => setModalRecusar(true)} variant="destructive" className="flex-1">
            ❌ Recusar Proposta
          </Button>
        </div>
      )}

      {/* Modal Aprovar */}
      <Dialog open={modalAprovar} onOpenChange={setModalAprovar}>
        <DialogContent>
          <DialogHeader><DialogTitle>✅ Confirmar Aprovação</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">
            Ao aprovar, você confirma o interesse nos termos da proposta. Isso não é um contrato assinado — seu vendedor entrará em contato para formalizar o acordo.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAprovar(false)}>Cancelar</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={aprovar.isPending}
              onClick={() => aprovar.mutate({}, {
                onSuccess: () => { toast.success('Proposta aprovada!'); setModalAprovar(false); router.push('/portal/propostas') },
                onError: (e: any) => toast.error(e.message),
              })}
            >
              {aprovar.isPending ? 'Confirmando...' : 'Confirmar Aprovação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Recusar */}
      <Dialog open={modalRecusar} onOpenChange={setModalRecusar}>
        <DialogContent>
          <DialogHeader><DialogTitle>❌ Recusar Proposta</DialogTitle></DialogHeader>
          <Textarea
            placeholder="Motivo da recusa (opcional)..."
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            maxLength={500}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalRecusar(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={recusar.isPending}
              onClick={() => recusar.mutate({ motivo: motivo || undefined }, {
                onSuccess: () => { toast.success('Proposta recusada'); setModalRecusar(false); router.push('/portal/propostas') },
                onError: (e: any) => toast.error(e.message),
              })}
            >
              {recusar.isPending ? 'Enviando...' : 'Confirmar Recusa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

## hooks/use-portal.ts

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

function getPortalToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('portal_token')
}

async function portalFetch(url: string, options?: RequestInit) {
  const token = getPortalToken()
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  if (res.status === 401) {
    localStorage.removeItem('portal_token')
    window.location.href = '/portal/login'
    throw new Error('Sessão expirada')
  }
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Erro na requisição')
  return data
}

export function usePortalQuery(url: string) {
  return useQuery({
    queryKey: ['portal', url],
    queryFn: () => portalFetch(url),
    staleTime: 3 * 60 * 1000,
  })
}

export function usePortalMutation(url: string, method: 'POST' | 'PATCH' | 'DELETE' = 'POST') {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: object) => portalFetch(url, { method, body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal'] }),
  })
}
```

## Botão "Enviar Acesso ao Portal" — Ficha do Lead (CRM Web)

```tsx
// Adicionar em app/(crm)/leads/[id]/page.tsx
// Botão para gestores enviarem o convite ao cliente

import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { ExternalLink } from 'lucide-react'

function BotaoConvitePortal({ leadId }: { leadId: string }) {
  const { mutate, isPending } = useMutation({
    mutationFn: () => api.post('/portal-clientes/convidar', { leadId }).then(r => r.data),
    onSuccess: (data) => toast.success(`Convite enviado para ${data.email}`),
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erro ao enviar convite'),
  })

  return (
    <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isPending}>
      <ExternalLink className="w-4 h-4 mr-1" />
      {isPending ? 'Enviando...' : 'Enviar Acesso ao Portal'}
    </Button>
  )
}
```
