// RecentPipelinesCard — last 5 pipelines with badge + duration + relative date.
import { useNavigate } from 'react-router-dom'
import { History, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { usePipelines } from '../api/usePipeline'

const STATUS_VARIANT = {
  succeeded: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  failed: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  cancelled: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  running: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  pending: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
}

const STATUS_LABEL = {
  succeeded: 'completado',
  success: 'completado',
  completed: 'completado',
  failed: 'fallido',
  cancelled: 'cancelado',
  running: 'ejecutando',
  pending: 'pendiente',
  queued: 'en cola',
  cancelling: 'cancelando',
}

function fmtDuration(p) {
  const s = Number(p.duration_sec ?? p.duration ?? 0)
  if (!s) return '—'
  if (s < 60) return `${Math.round(s)}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${Math.round(s % 60)}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function fmtRelative(iso) {
  if (!iso) return ''
  const ms = typeof iso === 'number' ? iso * 1000 : Date.parse(iso)
  if (!ms || Number.isNaN(ms)) return ''
  const diff = Math.floor((Date.now() - ms) / 1000)
  if (diff < 60) return 'ahora'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} d`
}

function shortPath(p) {
  if (!p) return '—'
  const parts = String(p).split(/[\\/]/).filter(Boolean)
  return parts.slice(-1)[0] || p
}

export function RecentPipelinesCard({ className, limit = 5 }) {
  const { data, isPending } = usePipelines()
  const nav = useNavigate()
  const items = (data || [])
    .slice()
    .sort((a, b) => {
      const ta = Date.parse(b.created_at || b.started_at || 0)
      const tb = Date.parse(a.created_at || a.started_at || 0)
      return ta - tb
    })
    .slice(0, limit)

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <History className="h-4 w-4 text-violet-400" /> Pipelines recientes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isPending ? (
          <>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            Sin pipelines registrados.
          </div>
        ) : (
          items.map((p) => {
            const status = String(p.status || 'pending').toLowerCase()
            const ts = p.created_at || p.started_at || p.finished_at
            return (
              <button
                key={p.id || p.pipeline_id}
                onClick={() => nav(`/pipelines/${p.id || p.pipeline_id}`)}
                className="group flex w-full items-center gap-3 rounded-lg border bg-card/50 p-2.5 text-left transition-colors hover:bg-accent/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {shortPath(p.path || p.instructional)}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn('shrink-0 text-[10px]', STATUS_VARIANT[status])}
                    >
                      {STATUS_LABEL[status] || status}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{fmtDuration(p)}</span>
                    <span>·</span>
                    <span>{fmtRelative(ts)}</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

export default RecentPipelinesCard
