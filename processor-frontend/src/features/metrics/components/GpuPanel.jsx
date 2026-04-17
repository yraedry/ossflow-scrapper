// GpuPanel — renders GPU stats reported by the metrics endpoint plus
// per-backend GPU info via /gpu (useBackendsHealth checks /health, so we
// fall back to the aggregated metrics.gpus list for utilization data).
import { Cpu, Thermometer, Activity, MemoryStick } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { useMetrics } from '../api/useMetrics'
import { useBackendsHealth } from '@/components/layout/useBackendsHealth'

function Bar({ value, accent = 'bg-amber-500' }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn('h-full rounded-full transition-all duration-500', accent)}
        style={{ width: `${Math.min(100, Math.max(0, value || 0))}%` }}
      />
    </div>
  )
}

function GpuRow({ gpu }) {
  const memPct =
    gpu.mem_total_mb > 0 ? (gpu.mem_used_mb / gpu.mem_total_mb) * 100 : 0
  const memUsedGb = (gpu.mem_used_mb / 1024).toFixed(1)
  const memTotalGb = (gpu.mem_total_mb / 1024).toFixed(1)
  return (
    <div className="space-y-2 rounded-lg border bg-card/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 truncate">
          <Cpu className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
          <span className="truncate text-sm font-medium">{gpu.name}</span>
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Thermometer className="h-3 w-3" aria-hidden />
          {Math.round(gpu.temp_c)}°C
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3" /> Utilización
          </span>
          <span className="tabular-nums">{Math.round(gpu.util_percent)}%</span>
        </div>
        <Bar value={gpu.util_percent} accent="bg-amber-500" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MemoryStick className="h-3 w-3" /> VRAM
          </span>
          <span className="tabular-nums">
            {memUsedGb} / {memTotalGb} GB
          </span>
        </div>
        <Bar value={memPct} accent="bg-violet-500" />
      </div>
    </div>
  )
}

function BackendStatus({ backend }) {
  const tone =
    backend.status === 'up'
      ? 'bg-emerald-500'
      : backend.status === 'down'
        ? 'bg-rose-500'
        : 'bg-muted-foreground/40'
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={cn('h-1.5 w-1.5 rounded-full', tone)} aria-hidden />
      <span className="text-muted-foreground">{backend.label}</span>
    </div>
  )
}

export function GpuPanel({ className }) {
  const metrics = useMetrics()
  const backends = useBackendsHealth()
  const gpus = metrics.data?.gpus || []
  const loading = metrics.isPending

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">GPU</CardTitle>
          <Badge variant="outline" className="text-[10px] font-normal">
            {gpus.length} {gpus.length === 1 ? 'unidad' : 'unidades'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : gpus.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            No hay GPU detectada o todos los backends están offline.
          </div>
        ) : (
          gpus.map((gpu, i) => <GpuRow key={`${gpu.name}-${i}`} gpu={gpu} />)
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
          {backends.map((b) => (
            <BackendStatus key={b.id} backend={b} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default GpuPanel
