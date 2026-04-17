// Compact logs view filtered (client-side) by instructional path.
// The ring-buffer backend doesn't index by path, so we pull recent lines from
// processor-api and surface those whose message mentions the path basename.
import { useMemo, useState } from 'react'
import {
  RefreshCw,
  Terminal,
  Pause,
  Play,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/Badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { qk } from '@/lib/queryKeys'
import { useLogs } from '@/features/logs/api/useLogs'

const SERVICES = [
  { value: 'processor-api', label: 'Processor API' },
  { value: 'chapter-splitter', label: 'Chapter Splitter' },
  { value: 'subtitle-generator', label: 'Subtitles' },
  { value: 'dubbing-generator', label: 'Dubbing' },
]

const LEVELS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'INFO', label: 'Info' },
  { value: 'WARN', label: 'Warn' },
  { value: 'ERROR', label: 'Error' },
]

const LEVEL_BADGE = {
  ERROR: 'bg-red-500/15 text-red-300 border-red-500/30',
  WARN: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  WARNING: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  INFO: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  DEBUG: 'bg-zinc-700/40 text-zinc-400 border-zinc-700/60',
}

function basename(p) {
  if (!p) return ''
  return String(p).split(/[\\/]/).filter(Boolean).slice(-1)[0] || ''
}

function fmtTs(ts) {
  if (!ts) return '--:--:--'
  const d = typeof ts === 'number' ? new Date(ts * (ts < 1e12 ? 1000 : 1)) : new Date(ts)
  if (Number.isNaN(d.getTime())) return String(ts)
  return d.toISOString().slice(11, 19)
}

export default function LogsTab({ instructional }) {
  const [service, setService] = useState('processor-api')
  const [level, setLevel] = useState('ALL')
  const [text, setText] = useState('')
  const [paused, setPaused] = useState(false)
  const qc = useQueryClient()
  const needle = basename(instructional?.path).toLowerCase()

  const { data, isLoading, isFetching, isError, error, refetch } = useLogs({
    service,
    level: level === 'ALL' ? undefined : level,
    tail: 500,
  })

  const lines = useMemo(() => {
    const all = data?.lines || []
    const q = text.trim().toLowerCase()
    return all.filter((l) => {
      const msg = (l.message || '').toLowerCase()
      if (needle && !msg.includes(needle)) return false
      if (q && !msg.includes(q)) return false
      return true
    })
  }, [data, text, needle])

  const togglePause = () => {
    const next = !paused
    setPaused(next)
    if (next) qc.cancelQueries({ queryKey: qk.logs.all })
    else qc.invalidateQueries({ queryKey: qk.logs.all })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 p-2">
        <Terminal className="ml-1 h-4 w-4 text-zinc-500" />
        <Select value={service} onValueChange={setService}>
          <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SERVICES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className="h-9 w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {LEVELS.map((l) => (
              <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Filtrar…"
          className="h-9 max-w-[220px] flex-1"
        />
        <div className="ml-auto flex items-center gap-2">
          {isFetching && !paused && (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <RefreshCw className="h-3 w-3 animate-spin" /> live
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={togglePause}>
            {paused ? <Play className="mr-1 h-3 w-3" /> : <Pause className="mr-1 h-3 w-3" />}
            {paused ? 'Reanudar' : 'Pausar'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className={`mr-1 h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
            Refrescar
          </Button>
        </div>
      </div>

      {isError ? (
        <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-300">
          {error?.message || 'Error cargando logs'}
        </div>
      ) : isLoading ? (
        <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-black/40 p-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full bg-zinc-900/70" />
          ))}
        </div>
      ) : lines.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/40 p-8 text-center text-sm text-zinc-500">
          Sin logs relacionados con este instructional.
        </div>
      ) : (
        <div className="max-h-[55vh] overflow-auto rounded-lg border border-zinc-800 bg-black/60 font-mono text-xs">
          {lines.map((l, i) => {
            const lvl = (l.level || 'INFO').toUpperCase()
            return (
              <div
                key={`${l.timestamp}-${i}`}
                className="flex items-start gap-2 px-3 py-0.5 hover:bg-white/5"
              >
                <span className="shrink-0 text-zinc-600">{fmtTs(l.timestamp)}</span>
                <span
                  className={`shrink-0 rounded border px-1 text-[10px] uppercase ${
                    LEVEL_BADGE[lvl] || LEVEL_BADGE.INFO
                  }`}
                >
                  {lvl}
                </span>
                {l.logger && (
                  <span className="shrink-0 text-zinc-600">{l.logger}</span>
                )}
                <span className="min-w-0 break-all text-zinc-300">{l.message}</span>
              </div>
            )
          })}
        </div>
      )}
      <p className="text-[11px] text-zinc-500">
        Filtrado cliente por <span className="font-mono">{needle || '—'}</span> sobre el ring buffer.
      </p>
    </div>
  )
}
