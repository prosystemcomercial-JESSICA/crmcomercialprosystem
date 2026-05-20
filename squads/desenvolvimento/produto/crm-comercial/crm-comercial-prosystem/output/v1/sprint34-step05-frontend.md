# Sprint 34 — Step 05 — Isabela Costa (Frontend)
# Vínculo Manual WA → Lead — Componentes React

## hooks/use-desconhecidas.ts

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function useDesconhecidas(incluirArquivadas = false) {
  return useQuery({
    queryKey: ['wa-desconhecidas', incluirArquivadas],
    queryFn: () =>
      api
        .get(`/conversas/desconhecidas?arquivadas=${incluirArquivadas}`)
        .then((r) => r.data),
    staleTime: 2 * 60 * 1000,
  })
}

export function useContagemDesconhecidas() {
  return useQuery({
    queryKey: ['wa-desconhecidas-contagem'],
    queryFn: () =>
      api.get('/conversas/desconhecidas/contagem').then((r) => r.data.total),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 60 * 1000,
  })
}

export function useMensagensDesconhecida(id: string | null) {
  return useQuery({
    queryKey: ['wa-desconhecida-msgs', id],
    queryFn: () =>
      api
        .get(`/conversas/desconhecidas/${id}/mensagens`)
        .then((r) => r.data),
    enabled: !!id,
    staleTime: 30 * 1000,
  })
}

export function useVincularLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, leadId }: { id: string; leadId: string }) =>
      api.patch(`/conversas/desconhecidas/${id}/vincular`, { leadId }).then((r) => r.data),
    onSuccess: (data) => {
      toast.success(`Conversa vinculada a ${data.leadNome}`)
      qc.invalidateQueries({ queryKey: ['wa-desconhecidas'] })
      qc.invalidateQueries({ queryKey: ['wa-desconhecidas-contagem'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erro ao vincular'),
  })
}

export function useCriarLeadViaWA() {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: ({
      id,
      dados,
    }: {
      id: string
      dados: { nome: string; empresa?: string; email?: string; vendedorId: string }
    }) =>
      api
        .post(`/conversas/desconhecidas/${id}/criar-lead`, dados)
        .then((r) => r.data),
    onSuccess: (data) => {
      toast.success('Lead criado e conversa vinculada!')
      qc.invalidateQueries({ queryKey: ['wa-desconhecidas'] })
      qc.invalidateQueries({ queryKey: ['wa-desconhecidas-contagem'] })
      router.push(`/leads/${data.leadId}`)
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erro ao criar lead'),
  })
}

export function useArquivarConversa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, arquivada }: { id: string; arquivada: boolean }) =>
      api
        .patch(`/conversas/desconhecidas/${id}/arquivar`, { arquivada })
        .then((r) => r.data),
    onSuccess: (_, vars) => {
      toast.success(vars.arquivada ? 'Conversa arquivada' : 'Conversa restaurada')
      qc.invalidateQueries({ queryKey: ['wa-desconhecidas'] })
      qc.invalidateQueries({ queryKey: ['wa-desconhecidas-contagem'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Erro ao arquivar'),
  })
}
```

## components/whatsapp/VincularLeadModal.tsx

```tsx
'use client'
import { useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useVincularLead } from '@/hooks/use-desconhecidas'
import { useDebounce } from '@/hooks/use-debounce'
import { Phone, Building2, User } from 'lucide-react'

interface Props {
  conversaId: string
  telefone: string
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function VincularLeadModal({ conversaId, telefone, open, onOpenChange }: Props) {
  const [busca, setBusca] = useState('')
  const [leadSelecionado, setLeadSelecionado] = useState<any>(null)
  const termoDebouncado = useDebounce(busca, 300)

  const { data: leads = [], isFetching } = useQuery({
    queryKey: ['buscar-leads', termoDebouncado],
    queryFn: () =>
      api.get(`/leads/buscar?q=${termoDebouncado}`).then((r) => r.data),
    enabled: termoDebouncado.length >= 3,
  })

  const vincular = useVincularLead()

  const handleConfirmar = useCallback(() => {
    if (!leadSelecionado) return
    vincular.mutate(
      { id: conversaId, leadId: leadSelecionado.id },
      { onSuccess: () => { onOpenChange(false); setBusca(''); setLeadSelecionado(null) } }
    )
  }, [conversaId, leadSelecionado, vincular, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🔗 Vincular Conversa a Lead Existente
          </DialogTitle>
          <p className="text-sm text-muted-foreground">Número: {telefone}</p>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="Buscar por nome, e-mail, telefone ou empresa..."
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setLeadSelecionado(null) }}
            autoFocus
          />

          {termoDebouncado.length >= 3 && (
            <div className="border rounded-md max-h-64 overflow-y-auto divide-y">
              {isFetching && (
                <div className="p-3 text-sm text-muted-foreground">Buscando...</div>
              )}
              {!isFetching && leads.length === 0 && (
                <div className="p-3 text-sm text-muted-foreground">Nenhum lead encontrado</div>
              )}
              {leads.map((lead: any) => (
                <button
                  key={lead.id}
                  onClick={() => setLeadSelecionado(lead)}
                  className={`w-full text-left p-3 hover:bg-accent transition-colors ${
                    leadSelecionado?.id === lead.id ? 'bg-accent' : ''
                  }`}
                >
                  <div className="font-medium">{lead.nome}</div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    {lead.empresa && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> {lead.empresa}
                      </span>
                    )}
                    {lead.vendedor?.nome && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> {lead.vendedor.nome}
                      </span>
                    )}
                    {lead.telefone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {lead.telefone}
                      </span>
                    )}
                    {!lead.telefone && (
                      <Badge variant="outline" className="text-xs">sem telefone</Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={!leadSelecionado || vincular.isPending}
          >
            {vincular.isPending ? 'Vinculando...' : '✓ Vincular'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

## components/whatsapp/CriarLeadModal.tsx

```tsx
'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useCriarLeadViaWA } from '@/hooks/use-desconhecidas'

interface Props {
  conversaId: string
  telefone: string
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function CriarLeadModal({ conversaId, telefone, open, onOpenChange }: Props) {
  const [nome, setNome] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [email, setEmail] = useState('')
  const [vendedorId, setVendedorId] = useState('')

  const { data: vendedores = [] } = useQuery({
    queryKey: ['vendedores-lista'],
    queryFn: () => api.get('/usuarios?perfil=VENDEDOR').then((r) => r.data),
  })

  const criar = useCriarLeadViaWA()

  const handleSubmit = () => {
    if (!nome.trim() || !vendedorId) return
    criar.mutate(
      { id: conversaId, dados: { nome: nome.trim(), empresa: empresa || undefined, email: email || undefined, vendedorId } },
      { onSuccess: () => { onOpenChange(false) } }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>➕ Criar Lead a partir do WhatsApp</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Telefone</Label>
            <Input value={telefone} disabled className="bg-muted" />
          </div>
          <div>
            <Label>Nome <span className="text-destructive">*</span></Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do lead"
              autoFocus
            />
          </div>
          <div>
            <Label>Empresa</Label>
            <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Empresa (opcional)" />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail (opcional)" type="email" />
          </div>
          <div>
            <Label>Vendedor <span className="text-destructive">*</span></Label>
            <Select value={vendedorId} onValueChange={setVendedorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar vendedor" />
              </SelectTrigger>
              <SelectContent>
                {vendedores.map((v: any) => (
                  <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={!nome.trim() || !vendedorId || criar.isPending}
          >
            {criar.isPending ? 'Criando...' : '✓ Criar Lead e Vincular'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

## components/whatsapp/ArquivarModal.tsx

```tsx
'use client'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useArquivarConversa } from '@/hooks/use-desconhecidas'

interface Props {
  conversaId: string
  telefone: string
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function ArquivarModal({ conversaId, telefone, open, onOpenChange }: Props) {
  const arquivar = useArquivarConversa()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>🗂 Arquivar Conversa</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja arquivar a conversa com {telefone}?<br />
            Esta conversa não será mais exibida como pendente. Você pode
            desfazer em "Arquivadas".
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              arquivar.mutate(
                { id: conversaId, arquivada: true },
                { onSuccess: () => onOpenChange(false) }
              )
            }}
          >
            Arquivar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

## components/whatsapp/DesconhecidasTab.tsx

```tsx
'use client'
import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertTriangle, MessageSquare, Archive, ArchiveRestore } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useDesconhecidas,
  useMensagensDesconhecida,
  useArquivarConversa,
} from '@/hooks/use-desconhecidas'
import { VincularLeadModal } from './VincularLeadModal'
import { CriarLeadModal } from './CriarLeadModal'
import { ArquivarModal } from './ArquivarModal'

export function DesconhecidasTab() {
  const [incluirArquivadas, setIncluirArquivadas] = useState(false)
  const [conversaSelecionada, setConversaSelecionada] = useState<any>(null)
  const [modalVincular, setModalVincular] = useState(false)
  const [modalCriar, setModalCriar] = useState(false)
  const [modalArquivar, setModalArquivar] = useState(false)

  const { data: conversas = [], isLoading } = useDesconhecidas(incluirArquivadas)
  const { data: thread } = useMensagensDesconhecida(conversaSelecionada?.id ?? null)
  const arquivar = useArquivarConversa()

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Lista */}
      <div className="w-72 border-r flex flex-col">
        <div className="p-3 border-b flex items-center justify-between">
          <span className="text-sm font-medium">Desconhecidos</span>
          <div className="flex items-center gap-2">
            <Label htmlFor="arquivadas" className="text-xs text-muted-foreground">Arquivadas</Label>
            <Switch
              id="arquivadas"
              checked={incluirArquivadas}
              onCheckedChange={setIncluirArquivadas}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y">
          {conversas.length === 0 && (
            <div className="p-6 text-center text-muted-foreground text-sm">
              {incluirArquivadas
                ? 'Nenhuma conversa arquivada'
                : 'Nenhuma conversa pendente de identificação 🎉'}
            </div>
          )}
          {conversas.map((c: any) => (
            <button
              key={c.id}
              onClick={() => setConversaSelecionada(c)}
              className={`w-full text-left p-3 hover:bg-accent transition-colors ${
                conversaSelecionada?.id === c.id ? 'bg-accent' : ''
              } ${c.arquivada ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                <span className="font-mono text-xs truncate">{c.telefone}</span>
                {c.totalNaoLidas > 0 && (
                  <span className="ml-auto bg-destructive text-white text-xs rounded-full px-1.5 py-0.5 shrink-0">
                    {c.totalNaoLidas}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {c.previewMensagem ?? `[${c.previewTipo?.toLowerCase() ?? 'mídia'}]`}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                <span>
                  {c.ultimaMensagemEm
                    ? formatDistanceToNow(new Date(c.ultimaMensagemEm), { locale: ptBR, addSuffix: true })
                    : '—'}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> {c.totalMensagens}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 flex flex-col">
        {!conversaSelecionada ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Selecione uma conversa para visualizar
          </div>
        ) : (
          <>
            {/* Banner de ações */}
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center gap-2 flex-wrap">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-sm text-amber-800 font-medium">
                Lead desconhecido — {conversaSelecionada.telefone}
              </span>
              {!conversaSelecionada.arquivada && (
                <div className="ml-auto flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => setModalVincular(true)}>
                    🔗 Vincular Lead
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setModalCriar(true)}>
                    ➕ Criar Lead
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setModalArquivar(true)}
                    className="text-muted-foreground"
                  >
                    <Archive className="w-4 h-4 mr-1" /> Arquivar
                  </Button>
                </div>
              )}
              {conversaSelecionada.arquivada && (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => {
                    arquivar.mutate(
                      { id: conversaSelecionada.id, arquivada: false },
                      { onSuccess: () => setConversaSelecionada({ ...conversaSelecionada, arquivada: false }) }
                    )
                  }}
                >
                  <ArchiveRestore className="w-4 h-4 mr-1" /> Restaurar
                </Button>
              )}
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {thread?.mensagens?.map((m: any) => (
                <div
                  key={m.id}
                  className={`flex ${m.direcao === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-3 py-2 rounded-2xl text-sm ${
                      m.direcao === 'OUTBOUND'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted rounded-bl-sm'
                    }`}
                  >
                    {m.tipo === 'TEXT' ? (
                      <p>{m.texto}</p>
                    ) : (
                      <p className="italic text-xs opacity-70">[{m.tipo?.toLowerCase()}]</p>
                    )}
                    <div className={`text-xs mt-1 opacity-60 ${m.direcao === 'OUTBOUND' ? 'text-right' : ''}`}>
                      {new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      {m.enviadoPor && ` · ${m.enviadoPor.nome}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modais */}
      {conversaSelecionada && (
        <>
          <VincularLeadModal
            conversaId={conversaSelecionada.id}
            telefone={conversaSelecionada.telefone}
            open={modalVincular}
            onOpenChange={setModalVincular}
          />
          <CriarLeadModal
            conversaId={conversaSelecionada.id}
            telefone={conversaSelecionada.telefone}
            open={modalCriar}
            onOpenChange={setModalCriar}
          />
          <ArquivarModal
            conversaId={conversaSelecionada.id}
            telefone={conversaSelecionada.telefone}
            open={modalArquivar}
            onOpenChange={setModalArquivar}
          />
        </>
      )}
    </div>
  )
}
```

## Integração na página /conversas

```tsx
// app/(crm)/conversas/page.tsx
// Adicionar nova aba "Desconhecidos" apenas para gestão

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DesconhecidasTab } from '@/components/whatsapp/DesconhecidasTab'
import { useContagemDesconhecidas } from '@/hooks/use-desconhecidas'
import { useAuth } from '@/hooks/use-auth'

const GESTAO = ['SUPERVISAO', 'CEO', 'ADMIN']

export default function ConversasPage() {
  const { user } = useAuth()
  const isGestao = GESTAO.includes(user?.perfil)
  const { data: pendentes = 0 } = useContagemDesconhecidas()

  return (
    <Tabs defaultValue="todas">
      <TabsList>
        <TabsTrigger value="todas">Todas as Conversas</TabsTrigger>
        {isGestao && (
          <TabsTrigger value="desconhecidos" className="relative">
            Desconhecidos
            {pendentes > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {pendentes > 9 ? '9+' : pendentes}
              </span>
            )}
          </TabsTrigger>
        )}
        {isGestao && <TabsTrigger value="arquivadas">Arquivadas</TabsTrigger>}
      </TabsList>

      <TabsContent value="todas">
        {/* Componente existente de conversas vinculadas */}
      </TabsContent>

      {isGestao && (
        <TabsContent value="desconhecidos">
          <DesconhecidasTab />
        </TabsContent>
      )}
    </Tabs>
  )
}
```

## Badge no Sidebar

```tsx
// components/layout/Sidebar.tsx
// Adicionar badge de contagem ao item Conversas para gestão

import { useContagemDesconhecidas } from '@/hooks/use-desconhecidas'
import { useAuth } from '@/hooks/use-auth'

const GESTAO = ['SUPERVISAO', 'CEO', 'ADMIN']

// Dentro do componente:
const { user } = useAuth()
const isGestao = GESTAO.includes(user?.perfil)
const { data: pendentes = 0 } = useContagemDesconhecidas()

// No item de navegação Conversas:
<SidebarItem href="/conversas" icon={MessageSquare} label="Conversas">
  {isGestao && pendentes > 0 && (
    <span className="ml-auto bg-destructive text-white text-xs rounded-full px-1.5 py-0.5">
      {pendentes}
    </span>
  )}
</SidebarItem>
```

## SSE — Ouvir evento conversa_wa_vinculada

```tsx
// hooks/use-sse-whatsapp.ts (extensão do hook existente)
// Adicionar handler para o novo tipo de evento:

case 'conversa_wa_vinculada':
  toast.info(`Nova conversa WhatsApp vinculada: ${evento.leadNome}`)
  queryClient.invalidateQueries({ queryKey: ['conversas'] })
  break
```
