// Sync progress bar driven by SSE from /api/telegram/channels/{u}/sync/{job}/events.
// Subscribes via lib/sse.js when `jobId` is set; writes incremental state into
// component-local React state (UI-ephemeral, not in TanStack/Zustand).
import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Progress } from '@/components/ui/Progress'
import { Button } from '@/components/ui/button'
import { subscribeSSE } from '@/lib/sse'
import { useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/queryKeys'

const TERMINAL = new Set(['done', 'failed', 'cancelled'])

export default function SyncProgressBar({
  username,
  jobId,
  channelLabel,
  initialState,
  onDismiss,
}) {
  const qc = useQueryClient()
  const [state, setState] = useState(() => ({
    status: initialState?.status || 'running',
    scanned: initialState?.scanned ?? 0,
    total: initialState?.total ?? null,
    message: initialState?.message ?? 'Iniciando…',
    progress: initialState?.progress ?? null,
    new: initialState?.new ?? 0,
    error: initialState?.error ?? null,
    elapsed_s: initialState?.elapsed_s ?? null,
  }))

  useEffect(() => {
    if (!username || !jobId) return undefined
    const url = `/api/telegram/channels/${encodeURIComponent(username)}/sync/${encodeURIComponent(jobId)}/events`
    const sub = subscribeSSE(url, {
      onMessage: (raw) => {
        const evt = raw?.data || raw
        const t = raw?.type || raw?.status
        if (t === 'done' || raw?.status === 'done') {
          setState((s) => ({
            ...s,
            status: 'done',
            scanned: evt?.scanned ?? s.scanned,
            new: evt?.new ?? s.new,
            elapsed_s: evt?.elapsed_s ?? null,
            progress: 100,
            message: null,
          }))
          qc.invalidateQueries({ queryKey: qk.telegram.channels })
          qc.invalidateQueries({ queryKey: ['telegram', 'media'] })
          return
        }
        if (t === 'error' || raw?.status === 'failed') {
          setState((s) => ({
            ...s,
            status: 'failed',
            error: evt?.message || raw?.message || 'Error de sincronización',
          }))
          return
        }
        // progress / queued
        setState((s) => ({
          ...s,
          status: 'running',
          scanned: evt?.scanned ?? s.scanned,
          total: evt?.total ?? s.total,
          message:
            evt?.message ||
            (evt?.total
              ? `Procesando mensaje ${evt?.scanned || 0} de ~${evt?.total}`
              : `Procesados ${evt?.scanned || 0} mensajes`),
          progress:
            evt?.total ? Math.min(100, ((evt?.scanned || 0) / evt.total) * 100) : null,
        }))
      },
      onError: () => {
        // sse.js handles retries; if it bubbles up we surface it but keep panel alive.
        setState((s) => (TERMINAL.has(s.status) ? s : { ...s, message: 'Reconectando…' }))
      },
    })
    return () => sub.close()
  }, [username, jobId, qc])

  if (state.status === 'failed') {
    return (
      <div
        role="alert"
        className="inline-flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
      >
        <AlertCircle className="h-3.5 w-3.5" />
        <span className="font-medium">Error:</span>
        <span>{state.error}</span>
        {onDismiss && (
          <Button size="sm" variant="ghost" className="ml-2 h-6 px-2 text-xs" onClick={onDismiss}>
            Cerrar
          </Button>
        )}
      </div>
    )
  }

  if (state.status === 'done') {
    const elapsed = state.elapsed_s != null ? ` · ${Math.round(state.elapsed_s)}s` : ''
    return (
      <div
        role="status"
        className="inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-500"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>
          <span className="font-semibold">{state.new || state.scanned}</span> nuevos/actualizados
          {elapsed}
        </span>
        {onDismiss && (
          <Button size="sm" variant="ghost" className="ml-2 h-6 px-2 text-xs" onClick={onDismiss}>
            Cerrar
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm space-y-1">
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 truncate">
          <Loader2 className="h-3 w-3 animate-spin text-amber-500 shrink-0" />
          <span className="truncate">
            Sincronizando <span className="font-medium text-foreground">{channelLabel || username}</span>
          </span>
        </span>
        {state.progress != null && (
          <span className="font-mono text-foreground shrink-0">{state.progress.toFixed(1)}%</span>
        )}
      </div>
      <Progress value={state.progress ?? 5} />
      <div className="text-[11px] text-muted-foreground">{state.message}</div>
    </div>
  )
}
