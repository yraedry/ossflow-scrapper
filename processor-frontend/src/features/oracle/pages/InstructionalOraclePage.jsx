// WIRE_ROUTE_INSTRUCTIONAL_ORACLE: /library/:name/oracle → src/features/oracle/pages/InstructionalOraclePage.jsx
import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate, useBlocker } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, ExternalLink, Sparkles, Play, RefreshCw, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/Badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useOracleData } from '@/features/oracle/api/useOracle'
import { useStartPipeline } from '@/features/pipeline/api/usePipeline'
import { useInstructional } from '@/features/library/api/useLibrary'
import OracleUrlInput from '@/features/oracle/components/OracleUrlInput'
import OracleAutoResolve from '@/features/oracle/components/OracleAutoResolve'
import VolumeEditor from '@/features/oracle/components/VolumeEditor'
import PosterPreview from '@/features/oracle/components/PosterPreview'

export default function InstructionalOraclePage() {
  const params = useParams()
  const path = params.name || params.path || ''
  const navigate = useNavigate()
  const { data: oracle, isLoading, isError, error, refetch } = useOracleData(path)
  const { data: instructional } = useInstructional(path)

  const [isDirty, setDirty] = useState(false)
  const onDirtyChange = useCallback((d) => setDirty(d), [])

  // Block in-app navigation when dirty
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    isDirty && currentLocation.pathname !== nextLocation.pathname,
  )

  // Block window/tab close
  useEffect(() => {
    if (!isDirty) return undefined
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const hasOracle = !!oracle && Array.isArray(oracle.volumes)
  const noOracleYet = isError && error?.status === 404

  const startPipeline = useStartPipeline()

  const posterUrl = oracle?.poster_url || null
  // The /scrape response includes `poster_downloaded` once persisted; treat presence
  // of that key as "already on disk". Conservative default: if scraped but not yet
  // downloaded, the badge in PosterPreview informs the user.
  const hasLocalPoster = !!oracle?.poster_downloaded

  const productUrl = oracle?.product_url

  const handleProcessOracle = async () => {
    const fullPath = instructional?.path || path
    try {
      const resp = await startPipeline.mutateAsync({
        path: fullPath,
        steps: ['chapters'],
        options: { mode: 'oracle' },
      })
      const id = resp?.pipeline_id || resp?.id
      toast.success('Pipeline con oráculo lanzado')
      if (id) navigate(`/pipelines/${id}`)
    } catch (e) {
      toast.error(`Error: ${e?.message || 'desconocido'}`)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <Link
          to={`/library/${encodeURIComponent(path)}`}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft size={14} /> Volver al instructional
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-100">
              <Sparkles className="h-5 w-5 text-amber-400" /> Oráculo
            </h1>
            <p className="mt-1 text-xs text-zinc-500 font-mono truncate" title={path}>{path}</p>
            {productUrl && (
              <a
                href={productUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-amber-400 hover:underline"
              >
                <ExternalLink size={11} /> {productUrl}
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isError && !noOracleYet && (
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw size={14} className="mr-1.5" /> Reintentar
              </Button>
            )}
            {hasOracle && (
              <Button onClick={handleProcessOracle} disabled={startPipeline.isPending}>
                {startPipeline.isPending ? (
                  <Loader2 size={14} className="mr-2 animate-spin" />
                ) : (
                  <Play size={14} className="mr-2" />
                )}
                Procesar con oráculo
              </Button>
            )}
          </div>
        </div>
      </header>

      {isLoading && (
        <div className="grid gap-6 lg:grid-cols-[4fr_1fr]">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      )}

      {!isLoading && noOracleYet && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-2xl"
        >
          <Card className="bg-zinc-950/60 border-zinc-800">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-amber-400" /> Aún no hay oráculo
              </CardTitle>
              <CardDescription>
                Pega la URL del producto en BJJFanatics para scrapear los capítulos automáticamente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <OracleAutoResolve path={path} onResolved={() => refetch()} />
              </div>
              <div className="my-3 flex items-center gap-2 text-[11px] text-zinc-600">
                <div className="h-px flex-1 bg-zinc-800" />
                <span>o pega la URL manualmente</span>
                <div className="h-px flex-1 bg-zinc-800" />
              </div>
              <OracleUrlInput
                path={path}
                autoFocus
                onResolved={() => refetch()}
              />
              <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-zinc-600">
                <Badge variant="outline">Sugerencia</Badge>
                <span>el dominio se detecta automáticamente vía providers registrados</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {!isLoading && isError && !noOracleYet && (
        <Card className="border-red-900/50 bg-red-950/20">
          <CardContent className="pt-6">
            <p className="text-sm text-red-300">
              Error cargando oracle: {error?.message || 'desconocido'}
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && hasOracle && (
        <div className="grid gap-6 lg:grid-cols-[1fr_180px]">
          <section className="min-w-0">
            <VolumeEditor
              path={path}
              oracle={oracle}
              onSaved={() => refetch()}
              onDeleted={() => {
                setDirty(false)
                refetch()
              }}
              onDirtyChange={onDirtyChange}
            />
          </section>
          <aside className="space-y-3">
            <PosterPreview posterUrl={posterUrl} hasLocalPoster={hasLocalPoster} />
            <details className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2 text-xs">
              <summary className="cursor-pointer text-zinc-400 hover:text-zinc-200 select-none">
                Re-scrapear
              </summary>
              <div className="mt-2">
                <OracleUrlInput path={path} onResolved={() => refetch()} />
              </div>
            </details>
          </aside>
        </div>
      )}

      {/* In-app nav block confirmation */}
      <AlertDialog open={blocker?.state === 'blocked'} onOpenChange={(open) => {
        if (!open) blocker?.reset?.()
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambios sin guardar</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes ediciones sin guardar en el oráculo. Si sales ahora se perderán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker?.reset?.()}>Quedarse</AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker?.proceed?.()}>Salir sin guardar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
