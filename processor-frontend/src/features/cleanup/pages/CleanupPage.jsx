// WIRE_ROUTE_CLEANUP: /cleanup → src/features/cleanup/pages/CleanupPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Trash2, Loader2, RefreshCw, AlertTriangle, HardDrive, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/Progress'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { formatBytes } from '@/lib/format'
import { useSettings } from '@/features/settings/api/useSettings'
import {
  useCleanupScan,
  useCleanupJob,
  useCleanupApply,
} from '../api/useCleanup'

const CATEGORY_META = {
  orphan_srt: { label: 'Subtítulos huérfanos', reason: 'Sin vídeo hermano' },
  old_dubbed: { label: 'Doblajes obsoletos', reason: '_DOBLADO más antiguo que .ES.srt' },
  temp_files: { label: 'Ficheros temporales', reason: '.tmp/.part/.bak/~' },
  empty_dirs: { label: 'Directorios vacíos', reason: 'Sin archivos ni subdirectorios' },
}

const CATEGORY_ORDER = ['orphan_srt', 'old_dubbed', 'temp_files', 'empty_dirs']

export default function CleanupPage() {
  const settingsQ = useSettings()
  const libraryPath = settingsQ.data?.library_path || ''

  const [jobId, setJobId] = useState(null)
  const [selected, setSelected] = useState(() => new Set())

  const scanMut = useCleanupScan()
  const applyMut = useCleanupApply()
  const jobQ = useCleanupJob(jobId)

  const job = jobQ.data
  const status = job?.status
  const isScanning = status === 'running' || status === 'pending' || status === 'queued'
  const result = status === 'completed' ? job?.result : null

  useEffect(() => {
    if (status === 'failed') {
      toast.error(job?.error || 'El escaneo falló')
    }
  }, [status, job?.error])

  const sizeByPath = useMemo(() => {
    const m = new Map()
    if (!result) return m
    for (const cat of Object.values(result.categories || {})) {
      for (const it of cat) m.set(it.path, it.size || 0)
    }
    return m
  }, [result])

  const selectedBytes = useMemo(() => {
    let total = 0
    for (const p of selected) total += sizeByPath.get(p) || 0
    return total
  }, [selected, sizeByPath])

  const doScan = async () => {
    if (!libraryPath) {
      toast.error('Configura library_path en Settings antes de escanear')
      return
    }
    setSelected(new Set())
    try {
      const res = await scanMut.mutateAsync({ path: libraryPath })
      setJobId(res?.job_id || null)
    } catch (e) {
      toast.error(e?.message || 'No se pudo iniciar el escaneo')
    }
  }

  const toggle = (p) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  const toggleCategory = (cat, allChecked) => {
    const items = result?.categories?.[cat] || []
    setSelected((prev) => {
      const next = new Set(prev)
      if (allChecked) {
        for (const it of items) next.delete(it.path)
      } else {
        for (const it of items) next.add(it.path)
      }
      return next
    })
  }

  const doApply = async () => {
    if (selected.size === 0) return
    try {
      const res = await applyMut.mutateAsync({ paths: Array.from(selected), dryRun: false })
      toast.success(
        `Borrados ${res?.deleted?.length ?? 0} · liberados ${formatBytes(res?.freed_bytes || 0)}`
      )
      if (res?.errors?.length) toast.error(`${res.errors.length} errores al borrar`)
      setSelected(new Set())
      // re-scan to refresh
      doScan()
    } catch (e) {
      toast.error(e?.message || 'Error aplicando borrado')
    }
  }

  return (
    <div className="space-y-6 p-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-100">
            <Sparkles className="h-6 w-6 text-emerald-400" /> Limpieza
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Escanea la biblioteca en busca de artefactos borrables. Dry-run primero; aplica después.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={doScan} disabled={isScanning || scanMut.isPending} variant="outline">
            {isScanning || scanMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Escanear
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={selected.size === 0 || applyMut.isPending}>
                {applyMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Aplicar selección ({selected.size})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Confirmar borrado
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminarán <strong>{selected.size}</strong> elementos, liberando aproximadamente{' '}
                  <strong>{formatBytes(selectedBytes)}</strong>. Esta acción es irreversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={doApply}>Borrar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </motion.div>

      {/* Progress while scanning */}
      {isScanning && (
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between text-sm text-zinc-300">
            <span>Escaneando…{job?.message ? ` ${job.message}` : ''}</span>
            <span>{job?.progress != null ? `${Math.round(job.progress)}%` : ''}</span>
          </div>
          <Progress value={job?.progress ?? 0} />
        </Card>
      )}

      {/* Summary */}
      {result && (
        <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3 text-sm">
            <HardDrive className="h-5 w-5 text-zinc-400" />
            <div>
              <div className="text-zinc-100">
                {result.total_items} items · {formatBytes(result.total_bytes)}
              </div>
              <div className="text-xs text-zinc-500">Total detectado en el último escaneo</div>
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="text-zinc-100">
              Seleccionado: {selected.size} · {formatBytes(selectedBytes)}
            </div>
            <div className="text-xs text-zinc-500">Ahorro estimado si aplicas</div>
          </div>
        </Card>
      )}

      {/* Categories */}
      {result && (
        <Card className="p-2">
          <Accordion type="multiple" defaultValue={CATEGORY_ORDER}>
            {CATEGORY_ORDER.map((cat) => {
              const meta = CATEGORY_META[cat]
              const items = result.categories?.[cat] || []
              const allChecked = items.length > 0 && items.every((it) => selected.has(it.path))
              const someChecked = items.some((it) => selected.has(it.path))
              const catBytes = items.reduce((sum, it) => sum + (it.size || 0), 0)
              return (
                <AccordionItem key={cat} value={cat} className="px-3">
                  <AccordionTrigger>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-zinc-100">{meta.label}</span>
                      <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                        {items.length}
                      </span>
                      <span className="text-xs text-zinc-500">{formatBytes(catBytes)}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {items.length === 0 ? (
                      <div className="py-3 text-sm text-zinc-500">Sin items.</div>
                    ) : (
                      <>
                        <div className="mb-2 flex items-center gap-3 border-b border-zinc-800 pb-2 text-xs text-zinc-400">
                          <Checkbox
                            checked={allChecked}
                            indeterminate={!allChecked && someChecked}
                            onCheckedChange={() => toggleCategory(cat, allChecked)}
                          />
                          <span>
                            {allChecked ? 'Deseleccionar todo' : 'Seleccionar todo'} · {meta.reason}
                          </span>
                        </div>
                        <ul className="divide-y divide-zinc-800/60">
                          {items.map((it) => (
                            <li key={it.path} className="flex items-center gap-3 py-2 text-sm">
                              <Checkbox
                                checked={selected.has(it.path)}
                                onCheckedChange={() => toggle(it.path)}
                              />
                              <span className="flex-1 truncate font-mono text-xs text-zinc-300">
                                {it.path}
                              </span>
                              <span className="w-24 text-right text-zinc-400">
                                {formatBytes(it.size)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        </Card>
      )}

      {!result && !isScanning && (
        <Card className="p-8 text-center text-sm text-zinc-400">
          Pulsa <strong>Escanear</strong> para buscar artefactos en{' '}
          <span className="font-mono text-zinc-300">{libraryPath || '(sin library_path)'}</span>.
        </Card>
      )}
    </div>
  )
}
