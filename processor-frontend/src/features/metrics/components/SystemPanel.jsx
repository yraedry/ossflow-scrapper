// SystemPanel — CPU gauge + RAM bar + per-mount disk list.
import { Cpu, MemoryStick, HardDrive, Thermometer } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useMetrics } from '../api/useMetrics'

function Gauge({ value = 0, label, accent = 'stroke-sky-400' }) {
  const v = Math.min(100, Math.max(0, value))
  const r = 32
  const c = 2 * Math.PI * r
  const offset = c - (v / 100) * c
  return (
    <div className="relative flex h-20 w-20 items-center justify-center">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          className="stroke-muted"
          strokeWidth="6"
        />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          className={cn('transition-all duration-700', accent)}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold tabular-nums leading-none">
          {Math.round(v)}
        </span>
        <span className="text-[10px] uppercase text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

function Bar({ value, accent = 'bg-emerald-500' }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn('h-full rounded-full transition-all duration-500', accent)}
        style={{ width: `${Math.min(100, Math.max(0, value || 0))}%` }}
      />
    </div>
  )
}

export function SystemPanel({ className }) {
  const { data, isPending } = useMetrics()
  const cpu = data?.cpu_percent ?? 0
  const cpuTemp = data?.cpu_temp_c
  const ram = data?.ram
  const disks = data?.disks || []

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Sistema</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            <div className="flex items-center gap-4">
              <Gauge value={cpu} label="CPU %" accent="stroke-sky-400" />
              <div className="flex-1 space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <MemoryStick className="h-3.5 w-3.5" /> RAM
                    </span>
                    <span className="tabular-nums">
                      {ram?.used_gb?.toFixed(1) ?? '—'} / {ram?.total_gb?.toFixed(1) ?? '—'} GB
                    </span>
                  </div>
                  <Bar value={ram?.percent} accent="bg-emerald-500" />
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Cpu className="h-3 w-3" /> {Math.round(cpu)}%
                  </span>
                  {cpuTemp != null ? (
                    <span className="flex items-center gap-1">
                      <Thermometer className="h-3 w-3" /> {Math.round(cpuTemp)}°C
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                <HardDrive className="h-3.5 w-3.5" /> Discos
              </div>
              {disks.length === 0 ? (
                <div className="text-xs text-muted-foreground">Sin volúmenes monitorizados.</div>
              ) : (
                disks.map((d) => (
                  <div key={d.path} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate font-medium">{d.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {d.used_gb?.toFixed(0)} / {d.total_gb?.toFixed(0)} GB
                      </span>
                    </div>
                    <Bar
                      value={d.percent}
                      accent={
                        d.percent > 90
                          ? 'bg-rose-500'
                          : d.percent > 75
                            ? 'bg-amber-500'
                            : 'bg-violet-500'
                      }
                    />
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default SystemPanel
