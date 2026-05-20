# Sprint 17 — Step 05 — Isabela Costa (Frontend)
# Arquivos e Anexos — UI

## Estrutura de arquivos

```
src/
  app/(dashboard)/leads/_components/arquivos/
    ArquivosTab.tsx          ← container da aba
    ArquivoLista.tsx         ← lista de arquivos
    ArquivoItem.tsx          ← linha individual
    ArquivoUploadModal.tsx   ← modal de upload (drag-and-drop)
    arquivoUtils.ts          ← ícone + formatar tamanho
  lib/api/arquivo.ts         ← fetch helpers
```

## src/lib/api/arquivo.ts

```typescript
import { apiFetch } from './client'

export interface Arquivo {
  id: string
  nomeOriginal: string
  mimeType: string
  tamanhoBytes: number
  caminho: string
  uploadadoPorId: string
  uploadadoPor: { nome: string }
  proposta?: { id: string; numero: number } | null
  createdAt: string
}

export async function listarArquivos(leadId: string): Promise<Arquivo[]> {
  return apiFetch(`/leads/${leadId}/arquivos`)
}

export async function uploadArquivo(
  leadId: string,
  file: File,
  propostaId?: string
): Promise<Arquivo> {
  const form = new FormData()
  form.append('arquivo', file)
  if (propostaId) form.append('propostaId', propostaId)
  return apiFetch(`/leads/${leadId}/arquivos`, {
    method: 'POST',
    body: form,
  })
}

export async function excluirArquivo(id: string): Promise<void> {
  return apiFetch(`/arquivos/${id}`, { method: 'DELETE' })
}

export function downloadUrl(id: string): string {
  return `${process.env.NEXT_PUBLIC_API_URL}/arquivos/${id}/download`
}
```

## src/app/(dashboard)/leads/_components/arquivos/arquivoUtils.ts

```typescript
export type TipoIcone = 'pdf' | 'doc' | 'xls' | 'img' | 'outro'

export function tipoArquivo(mimeType: string): TipoIcone {
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType.includes('word')) return 'doc'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'xls'
  if (mimeType.startsWith('image/')) return 'img'
  return 'outro'
}

const ICONES: Record<TipoIcone, { emoji: string; cor: string }> = {
  pdf:   { emoji: '📄', cor: 'text-red-600' },
  doc:   { emoji: '📝', cor: 'text-blue-600' },
  xls:   { emoji: '📊', cor: 'text-green-600' },
  img:   { emoji: '🖼',  cor: 'text-purple-600' },
  outro: { emoji: '📎', cor: 'text-gray-500' },
}

export function iconeArquivo(mimeType: string) {
  return ICONES[tipoArquivo(mimeType)]
}

export function formatarTamanho(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}
```

## src/app/(dashboard)/leads/_components/arquivos/ArquivoItem.tsx

```tsx
'use client'

import { useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Arquivo, downloadUrl } from '@/lib/api/arquivo'
import { iconeArquivo, formatarTamanho } from './arquivoUtils'
import { usePermission } from '@/hooks/usePermission'

interface Props {
  arquivo: Arquivo
  usuarioId: string
  onExcluir: (id: string) => Promise<void>
}

export function ArquivoItem({ arquivo, usuarioId, onExcluir }: Props) {
  const [excluindo, setExcluindo] = useState(false)
  const { can } = usePermission()
  const icone = iconeArquivo(arquivo.mimeType)

  const podeExcluir =
    can('excluirQualquerArquivo') || arquivo.uploadadoPorId === usuarioId

  async function handleExcluir() {
    setExcluindo(true)
    try {
      await onExcluir(arquivo.id)
    } finally {
      setExcluindo(false)
    }
  }

  const dataRelativa = formatDistanceToNow(new Date(arquivo.createdAt), {
    addSuffix: true,
    locale: ptBR,
  })

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors">
      <span className={`text-2xl ${icone.cor}`}>{icone.emoji}</span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" title={arquivo.nomeOriginal}>
          {arquivo.nomeOriginal}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatarTamanho(arquivo.tamanhoBytes)}
          {arquivo.proposta && ` · Proposta #${arquivo.proposta.numero}`}
          {' · '}{arquivo.uploadadoPor.nome}
          {' · '}{dataRelativa}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <a
            href={downloadUrl(arquivo.id)}
            download={arquivo.nomeOriginal}
            title="Baixar arquivo"
          >
            <Download className="h-4 w-4" />
          </a>
        </Button>

        {podeExcluir && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                disabled={excluindo}
                title="Excluir arquivo"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir arquivo?</AlertDialogTitle>
                <AlertDialogDescription>
                  "{arquivo.nomeOriginal}" será removido permanentemente. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleExcluir}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  )
}
```

## src/app/(dashboard)/leads/_components/arquivos/ArquivoUploadModal.tsx

```tsx
'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { uploadArquivo, Arquivo } from '@/lib/api/arquivo'
import { formatarTamanho } from './arquivoUtils'

const ACCEPT = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif': ['.gif'],
}

interface Proposta {
  id: string
  numero: number
}

interface Props {
  open: boolean
  onClose: () => void
  leadId: string
  propostas: Proposta[]
  onSuccess: (arquivo: Arquivo) => void
}

export function ArquivoUploadModal({ open, onClose, leadId, propostas, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [propostaId, setPropostaId] = useState<string>('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const onDrop = useCallback((accepted: File[], rejected: any[]) => {
    setErro(null)
    if (rejected.length > 0) {
      const reason = rejected[0].errors[0]
      if (reason.code === 'file-too-large') setErro('Arquivo muito grande. Máximo 10MB.')
      else setErro('Tipo de arquivo não permitido.')
      return
    }
    setFile(accepted[0] ?? null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: 10 * 1024 * 1024,
    multiple: false,
  })

  async function handleEnviar() {
    if (!file) return
    setEnviando(true)
    setErro(null)
    try {
      const arquivo = await uploadArquivo(leadId, file, propostaId || undefined)
      onSuccess(arquivo)
      handleClose()
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao enviar arquivo.')
    } finally {
      setEnviando(false)
    }
  }

  function handleClose() {
    setFile(null)
    setPropostaId('')
    setErro(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Anexar Arquivo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
              }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {isDragActive
                ? 'Solte o arquivo aqui'
                : 'Arraste o arquivo aqui ou clique para selecionar'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, DOCX, XLSX, PNG, JPG · máx. 10MB
            </p>
          </div>

          {/* Arquivo selecionado */}
          {file && (
            <div className="flex items-center justify-between p-2 bg-muted rounded-md">
              <span className="text-sm truncate flex-1">
                {file.name} <span className="text-muted-foreground">({formatarTamanho(file.size)})</span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => setFile(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Vincular proposta */}
          {propostas.length > 0 && (
            <div className="space-y-1">
              <Label className="text-sm">Vincular a proposta (opcional)</Label>
              <Select value={propostaId} onValueChange={setPropostaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {propostas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      Proposta #{p.numero}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Erro */}
          {erro && (
            <p className="text-sm text-destructive">{erro}</p>
          )}

          {/* Ações */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={handleEnviar} disabled={!file || enviando}>
              {enviando ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enviando...
                </span>
              ) : (
                'Enviar arquivo'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

## src/app/(dashboard)/leads/_components/arquivos/ArquivoLista.tsx

```tsx
'use client'

import { Arquivo } from '@/lib/api/arquivo'
import { ArquivoItem } from './ArquivoItem'

interface Props {
  arquivos: Arquivo[]
  usuarioId: string
  onExcluir: (id: string) => Promise<void>
}

export function ArquivoLista({ arquivos, usuarioId, onExcluir }: Props) {
  if (arquivos.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        Nenhum arquivo anexado ainda.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {arquivos.map((a) => (
        <ArquivoItem
          key={a.id}
          arquivo={a}
          usuarioId={usuarioId}
          onExcluir={onExcluir}
        />
      ))}
    </div>
  )
}
```

## src/app/(dashboard)/leads/_components/arquivos/ArquivosTab.tsx

```tsx
'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { listarArquivos, excluirArquivo } from '@/lib/api/arquivo'
import { ArquivoLista } from './ArquivoLista'
import { ArquivoUploadModal } from './ArquivoUploadModal'
import { useSession } from 'next-auth/react'

interface Proposta {
  id: string
  numero: number
}

interface Props {
  leadId: string
  propostas: Proposta[]
}

export function ArquivosTab({ leadId, propostas }: Props) {
  const [modalAberto, setModalAberto] = useState(false)
  const qc = useQueryClient()
  const { data: session } = useSession()
  const usuarioId = session?.user?.id ?? ''

  const { data: arquivos = [], isLoading } = useQuery({
    queryKey: ['arquivos', leadId],
    queryFn: () => listarArquivos(leadId),
    staleTime: 30_000,
  })

  const excluirMutation = useMutation({
    mutationFn: excluirArquivo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['arquivos', leadId] }),
  })

  function handleUploadSuccess() {
    qc.invalidateQueries({ queryKey: ['arquivos', leadId] })
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Arquivos ({arquivos.length})
        </h3>
        <Button size="sm" onClick={() => setModalAberto(true)}>
          <Paperclip className="h-4 w-4 mr-1" />
          Anexar arquivo
        </Button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Carregando...
        </div>
      ) : (
        <ArquivoLista
          arquivos={arquivos}
          usuarioId={usuarioId}
          onExcluir={(id) => excluirMutation.mutateAsync(id)}
        />
      )}

      <ArquivoUploadModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        leadId={leadId}
        propostas={propostas}
        onSuccess={handleUploadSuccess}
      />
    </div>
  )
}
```

## Integração no LeadDrawer — adicionar 5ª aba

```tsx
// Em src/app/(dashboard)/leads/_components/LeadDrawer.tsx
// Importar:
import { ArquivosTab } from './arquivos/ArquivosTab'

// Dentro do <Tabs> existente, adicionar após a aba Histórico:
<TabsList>
  {/* ... abas existentes ... */}
  <TabsTrigger value="arquivos">Arquivos</TabsTrigger>
</TabsList>

<TabsContent value="arquivos">
  <ArquivosTab
    leadId={lead.id}
    propostas={lead.propostas ?? []}
  />
</TabsContent>
```

## Atualizar usePermission hook

```typescript
// src/hooks/usePermission.ts — adicionar nova action:
// 'excluirQualquerArquivo' → SUPERVISAO | CEO | ADMIN

const PERMISSOES: Record<string, string[]> = {
  // ... existentes ...
  excluirQualquerArquivo: ['SUPERVISAO', 'CEO', 'ADMIN'],
}
```

## Instalação (se react-dropzone não estiver presente)

```bash
npm install react-dropzone
# react-dropzone foi adicionado no Sprint 12 (Step1Upload) — sem nova instalação
```
