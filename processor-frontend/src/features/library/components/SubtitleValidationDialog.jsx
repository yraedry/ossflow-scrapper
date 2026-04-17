// Validate subtitles of a video and regenerate suspect segments.
// Flow: open → validate → per-row Regenerate → inline preview → Apply / Discard / Edit.
import { useMemo, useState } from 'react'
import { Loader2, RefreshCw, Check, X, Pencil, AlertTriangle, AlertCircle, Info, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  useValidateSubs,
  useRegenerateSegment,
  useApplySegment,
} from '../api/useSubtitles'

function fmtTime(sec) {
  if (sec == null || sec < 0) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = (sec % 60).toFixed(1)
  return h ? `${h}:${String(m).padStart(2, '0')}:${s.padStart(4, '0')}` : `${m}:${s.padStart(4, '0')}`
}

const SEV_STYLES = {
  error: 'bg-red-500/15 text-red-300 border-red-500/30',
  warn: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  info: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  ok: 'bg-zinc-800/50 text-zinc-500 border-zinc-700',
}
const SEV_ICON = { error: AlertCircle, warn: AlertTriangle, info: Info, ok: Check }

function SegmentRow({ seg, srtPath, videoPath, onApplied, onStagedChange }) {
  const regen = useRegenerateSegment()
  const apply = useApplySegment()
  const [preview, setPreview] = useState(null) // { text, start, end }
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const Icon = SEV_ICON[seg.severity] || Info

  const handleRegen = async () => {
    try {
      const r = await regen.mutateAsync({
        srtPath,
        segmentIdx: seg.idx,
        videoPath,
      })
      setPreview(r.new)
      setDraft(r.new?.text || '')
      onStagedChange?.(seg.idx, r.new)
    } catch (e) {
      toast.error(`Regeneración falló: ${e.message || 'error'}`)
    }
  }

  const handleApply = async () => {
    const text = editing ? draft : preview?.text
    if (!text) return
    try {
      await apply.mutateAsync({
        srtPath,
        segmentIdx: seg.idx,
        text,
        start: preview?.start,
        end: preview?.end,
      })
      toast.success(`Segmento ${seg.idx} aplicado`)
      setPreview(null)
      setEditing(false)
      onApplied?.(seg.idx)
    } catch (e) {
      toast.error(`Aplicar falló: ${e.message || 'error'}`)
    }
  }

  const handleDiscard = () => {
    setPreview(null)
    setEditing(false)
    onStagedChange?.(seg.idx, null)
  }

  return (
    <>
      <tr className="border-t border-zinc-800/60">
        <td className="px-2 py-1.5 font-mono text-xs text-zinc-500">#{seg.idx}</td>
        <td className="px-2 py-1.5 font-mono text-xs text-zinc-500 whitespace-nowrap">
          {fmtTime(seg.start)} → {fmtTime(seg.end)}
        </td>
        <td className="px-2 py-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide',
              SEV_STYLES[seg.severity] || SEV_STYLES.ok,
            )}
          >
            <Icon className="h-3 w-3" />
            {seg.severity}
          </span>
        </td>
        <td className="px-2 py-1.5 text-xs text-zinc-300">
          <div className="truncate max-w-[340px]" title={seg.text}>{seg.text || <em className="text-zinc-600">(vacío)</em>}</div>
          {seg.issues?.length > 0 && (
            <div className="mt-0.5 text-[10px] text-zinc-500">
              {seg.issues.map((it) => it.message).join(' · ')}
            </div>
          )}
        </td>
        <td className="px-2 py-1.5 text-right">
          <Button
            size="sm"
            variant="ghost"
            disabled={regen.isPending || Boolean(preview)}
            onClick={handleRegen}
          >
            {regen.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3 w-3" />
            )}
            Regenerar
          </Button>
        </td>
      </tr>
      {preview && (
        <tr className="bg-zinc-900/40">
          <td colSpan={5} className="px-3 py-2">
            <div className="grid gap-2 text-xs">
              <div className="flex items-start gap-2">
                <span className="w-10 text-zinc-500">Viejo:</span>
                <span className="text-zinc-400 line-through">{seg.text}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-10 text-zinc-500">Nuevo:</span>
                {editing ? (
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={2}
                    className="flex-1 rounded border border-zinc-700 bg-zinc-950 p-1 text-zinc-100"
                  />
                ) : (
                  <span className="text-emerald-300">{preview.text || <em className="text-zinc-600">(vacío)</em>}</span>
                )}
              </div>
              <div className="mt-1 flex gap-2">
                <Button size="sm" onClick={handleApply} disabled={apply.isPending}>
                  {apply.isPending ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="mr-1 h-3 w-3" />
                  )}
                  Aplicar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
                  <Pencil className="mr-1 h-3 w-3" />
                  {editing ? 'Listo' : 'Editar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDiscard}>
                  <X className="mr-1 h-3 w-3" />
                  Descartar
                </Button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function SubtitleValidationDialog({ open, onOpenChange, srtPath, videoPath: videoPathProp }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useValidateSubs(srtPath, { enabled: open })
  const apply = useApplySegment()
  const [staged, setStaged] = useState({}) // idx → {text,start,end} pendientes
  const [mode, setMode] = useState('issues') // 'issues' | 'all' | 'search'
  const [query, setQuery] = useState('')

  const videoPath = videoPathProp || data?.video_path

  const visible = useMemo(() => {
    const list = data?.segments || []
    if (mode === 'issues') return list.filter((s) => s.severity !== 'ok')
    if (mode === 'search') {
      const q = query.trim().toLowerCase()
      if (!q) return list
      return list.filter((s) => (s.text || '').toLowerCase().includes(q))
    }
    return list
  }, [data, mode, query])

  const onStagedChange = (idx, preview) => {
    setStaged((prev) => {
      const next = { ...prev }
      if (preview) next[idx] = preview
      else delete next[idx]
      return next
    })
  }
  const onApplied = (idx) => {
    setStaged((prev) => {
      const next = { ...prev }
      delete next[idx]
      return next
    })
  }

  const applyAll = async () => {
    const entries = Object.entries(staged)
    if (!entries.length) return
    let ok = 0
    for (const [idx, p] of entries) {
      try {
        await apply.mutateAsync({
          srtPath,
          segmentIdx: Number(idx),
          text: p.text,
          start: p.start,
          end: p.end,
        })
        ok++
      } catch (e) {
        toast.error(`Segmento ${idx}: ${e.message || 'error'}`)
      }
    }
    setStaged({})
    toast.success(`Aplicados ${ok}/${entries.length} segmentos`)
    refetch()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Validar subtítulos</DialogTitle>
          <DialogDescription className="font-mono text-xs text-zinc-500 truncate">
            {srtPath}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center gap-2 py-8 text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analizando…
          </div>
        )}
        {isError && (
          <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            Error: {error?.message || 'desconocido'}
          </div>
        )}
        {data && (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-3 text-xs">
              <div className="flex rounded border border-zinc-800 overflow-hidden">
                {[
                  ['issues', 'Solo issues'],
                  ['all', 'Todos'],
                  ['search', 'Buscar'],
                ].map(([k, lbl]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setMode(k)}
                    className={cn(
                      'px-2 py-1 text-[11px]',
                      mode === k
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-400 hover:text-zinc-200',
                    )}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              {mode === 'search' && (
                <div className="flex items-center gap-1">
                  <Search className="h-3 w-3 text-zinc-500" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="filtrar por texto…"
                    className="h-7 w-48 text-xs"
                  />
                </div>
              )}
              <Badge variant="secondary">{data.summary.total} segmentos</Badge>
              <Badge className="bg-red-500/15 text-red-300 border-red-500/30">
                {data.summary.by_severity.error || 0} errores
              </Badge>
              <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30">
                {data.summary.by_severity.warn || 0} avisos
              </Badge>
              <Badge className="bg-sky-500/15 text-sky-300 border-sky-500/30">
                {data.summary.by_severity.info || 0} infos
              </Badge>
              <Badge variant="outline">
                Cobertura {data.summary.coverage_percent.toFixed(0)}%
              </Badge>
              {!videoPath && (
                <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30">
                  Sin video hermano — regen deshabilitado
                </Badge>
              )}
              <div className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  {isFetching ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                  Re-analizar
                </Button>
                <Button
                  size="sm"
                  onClick={applyAll}
                  disabled={!Object.keys(staged).length || apply.isPending}
                >
                  Aplicar {Object.keys(staged).length} pendiente{Object.keys(staged).length === 1 ? '' : 's'}
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium">#</th>
                    <th className="px-2 py-2 text-left font-medium">Tiempo</th>
                    <th className="px-2 py-2 text-left font-medium">Sev</th>
                    <th className="px-2 py-2 text-left font-medium">Texto / Issues</th>
                    <th className="px-2 py-2 text-right font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-6 text-center text-sm text-zinc-500">
                        {mode === 'issues'
                          ? 'Sin issues — los subtítulos parecen correctos.'
                          : mode === 'search'
                          ? 'Sin coincidencias.'
                          : 'Sin segmentos.'}
                      </td>
                    </tr>
                  ) : (
                    visible.map((seg) => (
                      <SegmentRow
                        key={seg.idx}
                        seg={seg}
                        srtPath={srtPath}
                        videoPath={videoPath}
                        onApplied={onApplied}
                        onStagedChange={onStagedChange}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
