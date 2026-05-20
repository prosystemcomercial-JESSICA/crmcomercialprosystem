# Sprint 20 — Step 05 — Isabela Costa (Frontend)
# Inbound WhatsApp — UI

## Estrutura de arquivos

```
src/
  app/(dashboard)/conversas/
    page.tsx                          ← listagem de conversas
    _components/
      ConversaItem.tsx                ← item na lista
      BadgeNaoLidas.tsx               ← badge vermelho sidebar
  leads/_components/conversas/
    ConversasTab.tsx                  ← aba na ficha do lead
    MensagemBubble.tsx                ← bubble da thread
    RespostaInput.tsx                 ← caixa de resposta
  lib/api/conversa.ts                 ← fetch helpers
  hooks/useConversasStream.ts         ← SSE de notificações
```

## src/lib/api/conversa.ts

```typescript
import { apiFetch } from './client'

export interface Mensagem {
  id: string
  direcao: 'INBOUND' | 'OUTBOUND'
  tipo: 'TEXT' | 'IMAGE' | 'AUDIO' | 'DOCUMENT' | 'UNSUPPORTED'
  texto?: string
  mediaId?: string
  mediaNome?: string
  lida: boolean
  enviadoPor?: { nome: string }
  timestamp: string
}

export interface Conversa {
  id: string
  telefone: string
  leadId?: string
  ultimaMensagemEm?: string
  ultimaMensagemRecebidaEm?: string
  totalNaoLidas: number
  lead?: { nome: string; empresa: string; vendedor: { nome: string } }
  mensagens?: Mensagem[]
}

export const conversaApi = {
  listar: (): Promise<Conversa[]> => apiFetch('/conversas'),

  mensagens: (leadId: string): Promise<Conversa> => apiFetch(`/conversas/${leadId}`),

  responder: (leadId: string, texto: string): Promise<Mensagem> =>
    apiFetch(`/conversas/${leadId}/responder`, {
      method: 'POST',
      body: JSON.stringify({ texto }),
    }),

  marcarLidas: (leadId: string): Promise<void> =>
    apiFetch(`/conversas/${leadId}/lida`, { method: 'PATCH' }),

  naoLidas: (): Promise<{ total: number }> =>
    apiFetch('/conversas/nao-lidas/contagem'),

  mediaUrl: (mediaId: string) =>
    `${process.env.NEXT_PUBLIC_API_URL}/whatsapp/media/${mediaId}`,
}
```

## src/hooks/useConversasStream.ts

```typescript
'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export function useConversasStream() {
  const qc = useQueryClient()

  useEffect(() => {
    const es = new EventSource(
      `${process.env.NEXT_PUBLIC_API_URL}/conversas/stream`,
      { withCredentials: true }
    )

    es.onmessage = (e) => {
      const evento = JSON.parse(e.data)
      if (evento.tipo === 'nova_mensagem_whatsapp') {
        // Invalidar queries para atualizar badge e lista
        qc.invalidateQueries({ queryKey: ['conversas-nao-lidas'] })
        qc.invalidateQueries({ queryKey: ['conversas'] })
        if (evento.leadId) {
          qc.invalidateQueries({ queryKey: ['conversa', evento.leadId] })
        }
      }
    }

    return () => es.close()
  }, [qc])
}
```

## src/app/(dashboard)/conversas/_components/BadgeNaoLidas.tsx

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { conversaApi } from '@/lib/api/conversa'

export function BadgeNaoLidas() {
  const { data } = useQuery({
    queryKey: ['conversas-nao-lidas'],
    queryFn: conversaApi.naoLidas,
    refetchInterval: 10_000,
    staleTime: 5_000,
  })

  const total = data?.total ?? 0
  if (total === 0) return null

  return (
    <span className="ml-auto inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-xs font-bold">
      {total > 99 ? '99+' : total}
    </span>
  )
}
```

## src/leads/_components/conversas/MensagemBubble.tsx

```tsx
import { Mensagem, conversaApi } from '@/lib/api/conversa'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const ICONE_TIPO: Record<string, string> = {
  IMAGE:       '🖼',
  AUDIO:       '🎵',
  DOCUMENT:    '📎',
  UNSUPPORTED: '💬',
}

export function MensagemBubble({ msg }: { msg: Mensagem }) {
  const outbound = msg.direcao === 'OUTBOUND'
  const hora = formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true, locale: ptBR })

  return (
    <div className={`flex ${outbound ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-xs lg:max-w-md rounded-2xl px-4 py-2 shadow-sm
          ${outbound
            ? 'bg-blue-500 text-white rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm'
          }`}
      >
        {msg.tipo === 'TEXT' && (
          <p className="text-sm whitespace-pre-wrap">{msg.texto}</p>
        )}
        {msg.tipo !== 'TEXT' && msg.tipo !== 'UNSUPPORTED' && (
          <div className="flex items-center gap-2">
            <span className="text-lg">{ICONE_TIPO[msg.tipo]}</span>
            {msg.mediaId ? (
              <a
                href={conversaApi.mediaUrl(msg.mediaId)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline"
              >
                {msg.mediaNome ?? 'Baixar mídia'}
              </a>
            ) : (
              <span className="text-sm">{msg.mediaNome ?? 'Mídia'}</span>
            )}
          </div>
        )}
        {msg.tipo === 'UNSUPPORTED' && (
          <p className="text-sm italic opacity-70">Tipo de mídia não suportado</p>
        )}
        <p className={`text-xs mt-1 ${outbound ? 'text-blue-100' : 'text-muted-foreground'} text-right`}>
          {hora}
          {outbound && msg.enviadoPor && ` · ${msg.enviadoPor.nome}`}
        </p>
      </div>
    </div>
  )
}
```

## src/leads/_components/conversas/RespostaInput.tsx

```tsx
'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { conversaApi } from '@/lib/api/conversa'

interface Props {
  leadId: string
  ultimaMensagemRecebidaEm?: string
}

export function RespostaInput({ leadId, ultimaMensagemRecebidaEm }: Props) {
  const [texto, setTexto] = useState('')
  const qc = useQueryClient()

  const naJanela = ultimaMensagemRecebidaEm &&
    Date.now() - new Date(ultimaMensagemRecebidaEm).getTime() < 24 * 60 * 60 * 1000

  const mutation = useMutation({
    mutationFn: () => conversaApi.responder(leadId, texto),
    onSuccess: () => {
      setTexto('')
      qc.invalidateQueries({ queryKey: ['conversa', leadId] })
    },
  })

  if (!naJanela) {
    return (
      <div className="p-4 bg-yellow-50 border-t border-yellow-200 text-sm text-yellow-800 flex items-center justify-between">
        <span>⚠️ Janela de 24h expirada. Use um template.</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          Usar template
        </Button>
      </div>
    )
  }

  return (
    <div className="p-3 border-t flex gap-2 items-end">
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Digite sua mensagem..."
        rows={2}
        className="resize-none flex-1"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (texto.trim()) mutation.mutate()
          }
        }}
      />
      <Button
        onClick={() => mutation.mutate()}
        disabled={!texto.trim() || mutation.isPending}
        size="sm"
      >
        {mutation.isPending ? '...' : 'Enviar →'}
      </Button>
    </div>
  )
}
```

## src/leads/_components/conversas/ConversasTab.tsx

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { conversaApi } from '@/lib/api/conversa'
import { MensagemBubble } from './MensagemBubble'
import { RespostaInput } from './RespostaInput'

export function ConversasTab({ leadId }: { leadId: string }) {
  const endRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  const { data: conversa } = useQuery({
    queryKey: ['conversa', leadId],
    queryFn: () => conversaApi.mensagens(leadId),
    staleTime: 10_000,
    refetchInterval: 10_000,
  })

  const marcarMutation = useMutation({
    mutationFn: () => conversaApi.marcarLidas(leadId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversas-nao-lidas'] }),
  })

  // Marcar como lidas ao abrir a aba
  useEffect(() => {
    marcarMutation.mutate()
  }, [leadId])

  // Scroll automático para o final
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversa?.mensagens?.length])

  const mensagens = conversa?.mensagens ?? []

  return (
    <div className="flex flex-col h-[500px]">
      {/* Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {mensagens.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma mensagem ainda.
          </p>
        ) : (
          mensagens.map((msg) => <MensagemBubble key={msg.id} msg={msg} />)
        )}
        <div ref={endRef} />
      </div>

      {/* Caixa de resposta */}
      <RespostaInput
        leadId={leadId}
        ultimaMensagemRecebidaEm={conversa?.ultimaMensagemRecebidaEm}
      />
    </div>
  )
}
```

## src/app/(dashboard)/conversas/page.tsx

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { conversaApi } from '@/lib/api/conversa'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useConversasStream } from '@/hooks/useConversasStream'

export default function ConversasPage() {
  useConversasStream() // Conecta ao SSE para atualizações em tempo real

  const { data: conversas = [] } = useQuery({
    queryKey: ['conversas'],
    queryFn: conversaApi.listar,
    staleTime: 10_000,
  })

  return (
    <div className="p-6 max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Conversas WhatsApp</h1>

      <div className="space-y-2">
        {conversas.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma conversa ainda.
          </p>
        )}
        {conversas.map((c) => {
          const ultima = c.mensagens?.[0]
          const tempo = c.ultimaMensagemEm
            ? formatDistanceToNow(new Date(c.ultimaMensagemEm), { addSuffix: true, locale: ptBR })
            : ''

          return (
            <Link
              key={c.id}
              href={c.leadId ? `/leads?id=${c.leadId}&tab=conversas` : '#'}
              className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted/40 transition-colors"
            >
              <div className="relative">
                <span className="text-2xl">💬</span>
                {c.totalNaoLidas > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                    {c.totalNaoLidas}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {c.lead?.nome ?? c.telefone}
                  {c.lead?.empresa && ` — ${c.lead.empresa}`}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {c.lead?.vendedor?.nome && `${c.lead.vendedor.nome} · `}
                  {ultima?.tipo === 'TEXT' ? ultima.texto : '[mídia]'}
                </p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{tempo}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
```

## Integração no LeadDrawer — 6ª aba

```tsx
// Adicionar ao LeadDrawer:
import { ConversasTab } from './_components/conversas/ConversasTab'

<TabsTrigger value="conversas">Conversas</TabsTrigger>
<TabsContent value="conversas">
  <ConversasTab leadId={lead.id} />
</TabsContent>
```

## Integração no Sidebar — item com badge

```tsx
// src/components/Sidebar.tsx:
import { BadgeNaoLidas } from '@/app/(dashboard)/conversas/_components/BadgeNaoLidas'
import { useConversasStream } from '@/hooks/useConversasStream'

// Dentro do Sidebar component:
useConversasStream() // SSE ativo em toda a sessão

// No item de menu:
{ href: '/conversas', label: 'Conversas', icon: <MessageCircle />, badge: <BadgeNaoLidas /> }
```
