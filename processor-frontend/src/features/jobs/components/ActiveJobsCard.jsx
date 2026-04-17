// ActiveJobsCard — running background jobs list with progress + elapsed time.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Inbox } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { useBackgroundJobs } from '../api/useJobs'
import { usePipelines } from '@/features/pipeline/api/usePipeline'

const ACTIVE = new Set(['running', 'pending', 'queued'])

function fmtElapsed(start) {
  if (!start) return ''
  const startMs = typeof start === 'number' ? start * 1000 : Date.parse(start)
  if (!startMs || Number.isNaN(startMs)) return ''
  const sec = Math.max(0, Math.floor((Date.now() - startMs) / 1000))
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function JobRow({ job }) {
  const [, force] = useState(0)
  const nav = useNavigate()
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const progress = Number(job.progress ?? 0)
  const start = job.started_at || job.created_at || job.start_time
  const desc = job.description || job.summary || job.path || job.id
  const href = job.href
  return (
    <div
      className={cn(
        'rounded-lg border bg-card/50 p-3',
        href && 'cursor-pointer hover:border-amber-500/50 hover:bg-card/80 transition-colors',
      )}
      onClick={href ? () => nav(href) : undefined}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="secondary" className="shrink-0 text-[10px] uppercase">
            {job.type || 'job'}
          </Badge>
          <span className="truncate text-sm">{desc}</span>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {fmtElapsed(start)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            progress > 0 ? 'bg-amber-500' : 'animate-pulse bg-amber-500/40',
          )}
          style={{ width: `${Math.min(100, Math.max(progress, 4))}%` }}
        />
      </div>
    </div>
  )
}

function pipelineToJob(p) {
  const name = p.path ? p.path.split(/[/\\]/).pop() : p.id
  const rawSteps = Array.isArray(p.steps) ? p.steps : []
  const stepNames = rawSteps.map((s) => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean)
  const steps = stepNames.join(' → ')
  return {
    id: `pipeline:${p.id}`,
    type: 'pipeline',
    status: p.status,
    progress: p.progress ?? 0,
    description: steps ? `${name} · ${steps}` : name,
    started_at: p.started_at || p.created_at,
    href: `/pipelines/${p.id}`,
  }
}

export function ActiveJobsCard({ className }) {
  const { data: bgData, isPending: bgPending } = useBackgroundJobs()
  const { data: pipeData, isPending: pipePending } = usePipelines()

  const activeBg = (bgData || []).filter((j) =>
    ACTIVE.has(String(j.status || '').toLowerCase()),
  )
  const activePipelines = (pipeData || [])
    .filter((p) => ACTIVE.has(String(p.status || '').toLowerCase()))
    .map(pipelineToJob)

  const active = [...activePipelines, ...activeBg]
  const isPending = bgPending && pipePending

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-amber-400" /> Jobs activos
          </CardTitle>
          {active.length > 0 ? (
            <Badge variant="outline" className="text-[10px]">
              {active.length}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isPending ? (
          <>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </>
        ) : active.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-sm text-muted-foreground">
            <Inbox className="h-6 w-6" aria-hidden />
            <span>Sin jobs activos</span>
          </div>
        ) : (
          active.map((j) => <JobRow key={j.id} job={j} />)
        )}
      </CardContent>
    </Card>
  )
}

export default ActiveJobsCard
