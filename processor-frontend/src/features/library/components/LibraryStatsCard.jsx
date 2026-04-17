// LibraryStatsCard — totals + processed-percentage bars per stage.
import { Library, Scissors, Subtitles, Mic2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useLibrary } from '../api/useLibrary'

function pct(n, d) {
  if (!d) return 0
  return Math.round((n / d) * 100)
}

function statsFrom(items) {
  const total = items.length
  let videos = 0
  let withChapters = 0
  let withSubs = 0
  let withDub = 0
  for (const it of items) {
    const chaptersDetected = Number(it.chapters_detected ?? 0)
    const subtitled = Number(it.subtitled ?? 0)
    const dubbed = Number(it.dubbed ?? 0)
    const totalVideos = Number(
      it.total_videos ?? (Array.isArray(it.videos) ? it.videos.length : 0),
    )
    videos += Number.isFinite(chaptersDetected) && chaptersDetected > 0 ? chaptersDetected : totalVideos
    if (chaptersDetected > 0) withChapters++
    if (subtitled > 0) withSubs++
    if (dubbed > 0) withDub++
  }
  return { total, videos, withChapters, withSubs, withDub }
}

function Bar({ value, accent }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className={cn('h-full rounded-full transition-all duration-700', accent)}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

function StageRow({ icon: Icon, label, count, total, accent }) {
  const p = pct(count, total)
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {label}
        </span>
        <span className="tabular-nums">
          {count}/{total} · {p}%
        </span>
      </div>
      <Bar value={p} accent={accent} />
    </div>
  )
}

export function LibraryStatsCard({ className }) {
  const { data, isPending } = useLibrary()
  const items = data || []
  const s = statsFrom(items)

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Library className="h-4 w-4 text-amber-400" /> Biblioteca
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs uppercase text-muted-foreground">Instruccionales</div>
                <div className="text-2xl font-semibold tabular-nums">{s.total}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">Capítulos</div>
                <div className="text-2xl font-semibold tabular-nums">{s.videos}</div>
              </div>
            </div>
            <div className="space-y-2 pt-1">
              <StageRow
                icon={Scissors}
                label="Capitulado"
                count={s.withChapters}
                total={s.total}
                accent="bg-amber-500"
              />
              <StageRow
                icon={Subtitles}
                label="Subtitulado"
                count={s.withSubs}
                total={s.total}
                accent="bg-sky-500"
              />
              <StageRow
                icon={Mic2}
                label="Doblado"
                count={s.withDub}
                total={s.total}
                accent="bg-emerald-500"
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default LibraryStatsCard
