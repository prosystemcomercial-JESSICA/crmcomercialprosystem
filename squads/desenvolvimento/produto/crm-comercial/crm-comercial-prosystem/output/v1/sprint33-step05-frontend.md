# Sprint 33 — Step 05 — Isabela Costa (Frontend)
# Softphone Integrado — Componentes React

## hooks/use-softphone.ts

```typescript
import { useRef, useState, useCallback, useEffect } from 'react'
import JsSIP from 'jssip'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export type EstadoChamada = 'idle' | 'discando' | 'em-chamada' | 'encerrada'

interface ChamadaInfo {
  leadId: string
  leadNome: string
  numero: string
}

export function useSoftphone() {
  const [estado, setEstado] = useState<EstadoChamada>('idle')
  const [chamadaInfo, setChamadaInfo] = useState<ChamadaInfo | null>(null)
  const [duracao, setDuracao] = useState(0)
  const [sipStatus, setSipStatus] = useState<'ATENDIDA' | 'NAO_ATENDIDA' | 'OCUPADO' | 'ERRO'>('NAO_ATENDIDA')
  const [minimizado, setMinimizado] = useState(false)
  const uaRef = useRef<JsSIP.UA | null>(null)
  const sessionRef = useRef<any>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const sipCallIdRef = useRef<string>('')
  const qc = useQueryClient()

  const { data: config } = useQuery({
    queryKey: ['sip-config'],
    queryFn: () => api.get('/softphone/config').then(r => r.data),
    staleTime: 10 * 60 * 1000,
  })

  const registrarChamada = useMutation({
    mutationFn: (dados: any) => api.post('/softphone/chamadas', dados).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chamadas-lead'] }),
  })

  // Inicializar UA SIP quando config estiver disponível
  useEffect(() => {
    if (!config?.host || !config?.user || !config?.password) return

    const socket = new JsSIP.WebSocketInterface(`wss://${config.host}:${config.port ?? 5060}/ws`)
    const ua = new JsSIP.UA({
      sockets: [socket],
      uri: `sip:${config.user}@${config.host}`,
      password: config.password,
    })

    ua.on('registered', () => console.log('[SIP] Registrado'))
    ua.on('registrationFailed', (e: any) => console.error('[SIP] Falha no registro', e))
    ua.start()
    uaRef.current = ua

    return () => { ua.stop(); uaRef.current = null }
  }, [config])

  const iniciarChamada = useCallback((leadId: string, leadNome: string, numero: string) => {
    if (!uaRef.current || estado !== 'idle') {
      toast.error('Softphone não disponível')
      return
    }

    setChamadaInfo({ leadId, leadNome, numero })
    setEstado('discando')
    setDuracao(0)
    setSipStatus('NAO_ATENDIDA')

    const eventHandlers = {
      connecting: () => setEstado('discando'),
      progress: () => {},
      confirmed: () => {
        setEstado('em-chamada')
        setSipStatus('ATENDIDA')
        timerRef.current = setInterval(() => setDuracao(d => d + 1), 1000)
      },
      ended: (e: any) => {
        if (timerRef.current) clearInterval(timerRef.current)
        const duracaoFinal = duracao
        setEstado('encerrada')
        sipCallIdRef.current = sessionRef.current?.id ?? ''
        registrarChamada.mutate({
          leadId,
          numeroDiscado: numero,
          duracao: duracaoFinal,
          status: sipStatus,
          sipCallId: sipCallIdRef.current,
        })
      },
      failed: (e: any) => {
        if (timerRef.current) clearInterval(timerRef.current)
        const causa = e.cause
        const status = causa === JsSIP.C.causes.BUSY ? 'OCUPADO' : 'NAO_ATENDIDA'
        setSipStatus(status)
        setEstado('encerrada')
        registrarChamada.mutate({
          leadId, numeroDiscado: numero, duracao: 0, status,
          sipCallId: sessionRef.current?.id ?? '',
        })
      },
    }

    const session = uaRef.current.call(`sip:${numero}@${config.host}`, {
      eventHandlers,
      mediaConstraints: { audio: true, video: false },
      pcConfig: { iceServers: [{ urls: config.stun ?? 'stun:stun.l.google.com:19302' }] },
    })
    sessionRef.current = session
  }, [estado, config, duracao, sipStatus])

  const encerrarChamada = useCallback(() => {
    sessionRef.current?.terminate()
  }, [])

  const toggleMudo = useCallback(() => {
    const session = sessionRef.current
    if (!session) return
    if (session.isMuted().audio) session.unmute({ audio: true })
    else session.mute({ audio: true })
  }, [])

  const resetar = useCallback(() => {
    setEstado('idle')
    setChamadaInfo(null)
    setDuracao(0)
    setMinimizado(false)
  }, [])

  return { estado, chamadaInfo, duracao, minimizado, sipStatus, iniciarChamada, encerrarChamada, toggleMudo, resetar, setMinimizado }
}
```

## components/softphone/SoftphoneWidget.tsx

```tsx
'use client'
import { useState } from 'react'
import { useSoftphone } from '@/hooks/use-softphone'
import { SoftphoneContext } from '@/contexts/softphone'
import { ResultadoChamadaDrawer } from './ResultadoChamadaDrawer'
import { Phone, PhoneOff, MicOff, Mic, Minimize2, Maximize2 } from 'lucide-react'

function formatDuracao(seg: number) {
  const m = Math.floor(seg / 60).toString().padStart(2, '0')
  const s = (seg % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function SoftphoneProvider({ children }: { children: React.ReactNode }) {
  const softphone = useSoftphone()
  const [mudo, setMudo] = useState(false)
  const [drawerAberto, setDrawerAberto] = useState(false)

  // Abrir drawer ao encerrar chamada
  if (softphone.estado === 'encerrada' && !drawerAberto) setDrawerAberto(true)

  return (
    <SoftphoneContext.Provider value={softphone}>
      {children}

      {/* Widget flutuante */}
      {softphone.estado !== 'idle' && (
        <div
          className={`fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 transition-all ${
            softphone.minimizado ? 'w-64 h-12' : 'w-80'
          }`}
        >
          {softphone.minimizado ? (
            <div className="flex items-center justify-between px-4 h-full">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Phone className="w-4 h-4 text-green-600 animate-pulse" />
                {softphone.chamadaInfo?.leadNome} · {formatDuracao(softphone.duracao)}
              </div>
              <button onClick={() => softphone.setMinimizado(false)}>
                <Maximize2 className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          ) : (
            <div className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Phone className={`w-4 h-4 ${softphone.estado === 'em-chamada' ? 'text-green-600 animate-pulse' : 'text-blue-600'}`} />
                    <span className="text-sm font-semibold">
                      {softphone.estado === 'discando' ? 'Discando...' : softphone.estado === 'em-chamada' ? 'Em chamada' : 'Encerrada'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{softphone.chamadaInfo?.leadNome}</p>
                  <p className="text-xs text-gray-400">{softphone.chamadaInfo?.numero}</p>
                </div>
                {softphone.estado === 'em-chamada' && (
                  <button onClick={() => softphone.setMinimizado(true)}>
                    <Minimize2 className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>

              {softphone.estado === 'em-chamada' && (
                <div className="text-center text-2xl font-mono font-bold text-gray-800 my-2">
                  {formatDuracao(softphone.duracao)}
                </div>
              )}

              <div className="flex gap-3 mt-3">
                {softphone.estado === 'em-chamada' && (
                  <button
                    onClick={() => { softphone.toggleMudo(); setMudo(m => !m) }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      mudo ? 'bg-red-50 border-red-200 text-red-600' : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}
                  >
                    {mudo ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    {mudo ? 'Mudo' : 'Mutuar'}
                  </button>
                )}
                {softphone.estado !== 'encerrada' && (
                  <button
                    onClick={softphone.encerrarChamada}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                  >
                    <PhoneOff className="w-4 h-4" /> Encerrar
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drawer de resultado */}
      <ResultadoChamadaDrawer
        aberto={drawerAberto && softphone.estado === 'encerrada'}
        chamadaInfo={softphone.chamadaInfo}
        duracao={softphone.duracao}
        sipStatus={softphone.sipStatus}
        onClose={() => { setDrawerAberto(false); softphone.resetar() }}
      />
    </SoftphoneContext.Provider>
  )
}
```

## components/softphone/ResultadoChamadaDrawer.tsx

```tsx
'use client'
import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { DateTimePicker } from '@/components/ui/datetime-picker'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

const STATUS_BADGE: Record<string, string> = {
  ATENDIDA: '✅ Atendida',
  NAO_ATENDIDA: '❌ Não atendida',
  OCUPADO: '📵 Ocupado',
}

export function ResultadoChamadaDrawer({ aberto, chamadaInfo, duracao, sipStatus, onClose }: any) {
  const [resultado, setResultado] = useState('')
  const [proximoContato, setProximoContato] = useState<Date | null>(null)
  const qc = useQueryClient()

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => api.post('/atividades', {
      leadId: chamadaInfo?.leadId,
      tipo: 'LIGACAO',
      resultado: resultado || undefined,
      dataVencimento: proximoContato?.toISOString() ?? null,
      duracao,
    }).then(r => r.data),
    onSuccess: () => {
      toast.success('Atividade registrada!')
      qc.invalidateQueries({ queryKey: ['atividades', chamadaInfo?.leadId] })
      onClose()
    },
    onError: () => toast.error('Erro ao salvar atividade'),
  })

  const min = Math.floor(duracao / 60)
  const seg = duracao % 60

  return (
    <Sheet open={aberto} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-96">
        <SheetHeader>
          <SheetTitle>📝 Registrar resultado da chamada</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="font-semibold">{chamadaInfo?.leadNome}</p>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
              <span>⏱️ {min}min {seg}s</span>
              <Badge variant="outline">{STATUS_BADGE[sipStatus] ?? sipStatus}</Badge>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Resultado</label>
            <Textarea
              className="mt-1"
              placeholder="Ex: Cliente demonstrou interesse, pediu proposta até sexta..."
              value={resultado}
              onChange={e => setResultado(e.target.value)}
              rows={4}
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Próximo contato</label>
            <DateTimePicker
              className="mt-1 w-full"
              value={proximoContato}
              onChange={setProximoContato}
              placeholder="Selecionar data/hora..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Pular
            </Button>
            <Button className="flex-1" onClick={() => salvar()} disabled={isPending}>
              {isPending ? 'Salvando...' : '💾 Salvar Atividade'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

## Botão Ligar na Ficha do Lead

```tsx
// Usar o contexto do softphone para iniciar chamadas
import { useSoftphoneContext } from '@/contexts/softphone'

// Na ficha do lead:
const { iniciarChamada } = useSoftphoneContext()

<Button
  variant="outline"
  size="sm"
  disabled={!lead.telefone}
  onClick={() => iniciarChamada(lead.id, lead.nome, lead.telefone)}
>
  <Phone className="w-4 h-4 mr-1" />
  Ligar
</Button>
```

## Adicionar provider no layout principal

```tsx
// app/(crm)/layout.tsx — envolver com SoftphoneProvider
import { SoftphoneProvider } from '@/components/softphone/SoftphoneWidget'

export default function CRMLayout({ children }) {
  return (
    <SoftphoneProvider>
      <Sidebar />
      <main>{children}</main>
    </SoftphoneProvider>
  )
}
```
