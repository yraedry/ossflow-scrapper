// MetricCard — generic bento tile for a single metric.
// Props: title, value, unit?, icon?, accent (cpu|ram|disk|gpu|default),
//        sparkline? (number[]), footer?, loading?, className?.
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const ACCENTS = {
  cpu: 'text-sky-400 from-sky-500/15',
  ram: 'text-emerald-400 from-emerald-500/15',
  disk: 'text-violet-400 from-violet-500/15',
  gpu: 'text-amber-400 from-amber-500/15',
  default: 'text-foreground from-foreground/10',
}

function Sparkline({ data, className }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 100
  const h = 24
  const step = w / (data.length - 1)
  const points = data
    .map((v, i) => `${i * step},${h - ((v - min) / range) * h}`)
    .join(' ')
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn('h-6 w-full opacity-70', className)}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export function MetricCard({
  title,
  value,
  unit,
  icon: Icon,
  accent = 'default',
  sparkline,
  footer,
  loading,
  className,
  children,
}) {
  const ac = ACCENTS[accent] || ACCENTS.default
  return (
    <Card
      className={cn(
        'relative h-full overflow-hidden bg-gradient-to-br to-transparent',
        ac.split(' ').slice(1).join(' '),
        className,
      )}
    >
      <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          {Icon ? <Icon className={cn('h-4 w-4', ac.split(' ')[0])} aria-hidden /> : null}
        </div>
        <div className="flex flex-1 flex-col justify-end gap-1">
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-semibold tabular-nums leading-none">
                {value ?? '—'}
              </span>
              {unit ? (
                <span className="text-sm text-muted-foreground">{unit}</span>
              ) : null}
            </div>
          )}
          {sparkline ? (
            <div className={cn(ac.split(' ')[0])}>
              <Sparkline data={sparkline} />
            </div>
          ) : null}
          {children}
          {footer ? (
            <div className="text-xs text-muted-foreground">{footer}</div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export default MetricCard
