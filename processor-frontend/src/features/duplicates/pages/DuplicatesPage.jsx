// WIRE_ROUTE_DUPLICATES: /duplicates → src/features/duplicates/pages/DuplicatesPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Copy,
  Search,
  ScanSearch,
  Trash2,
  Loader2,
  AlertTriangle,
  Ban,
  Clock,
  Route,
} from 'lucide-react'
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
import { formatBytes, formatDuration } from '@/lib/format'
import { useSettings } from '@/features/settings/api/useSettings'
import { useDuplicatesScan, useDuplicatesJob } from '../api/useDuplicates'
import { useCleanupApply } from '@/features/cleanup/api/useCleanup'

function groupSignature(group) {
  const first = group[0] || {}
  return `${formatBytes(first.size)} · ${formatDuration(first.duration_sec)}`
}

function groupTotalBytes(group) {
  return group.reduce((s, e) => s + (e.size || 0), 0)
}

export default function DuplicatesPage() {
  const settingsQ = useSettings()
  const libraryPath = settingsQ.data?.library_path || ''

  const [jobId, setJobId] = useState(null)
  // For each group index: { keep: path, remove: Set<path> }
  const [selections, setSelections] = useState({})

  const scanMut = useDuplicatesScan()
  const applyMut = useCleanupApply()
  const jobQ = useDuplicatesJob(jobId)

  const job = jobQ.data
  const status = job?.status
  const isScanning = status === 'running' || status === 'pending' || status === 'queued'
  const result = status === 'completed' ? job?.result : null
  const isDeep = !!job?.params?.deep

  useEffect(() => {
    if (status === 'failed') toast.error(job?.error || 'El escaneo falló')
  }, [status, job?.error])

  const doScan = async (deep) => {
    if (!libraryPath) {
      toast.error('Configura library_path en Settings antes de escanear')
      return
    }
    setSelections({})
    try {
      const res = await scanMut.mutateAsync({ path: libraryPath, deep })
      setJobId(res?.job_id || null)
    } catch (e) {
      toast.error(e?.message || 'No se pudo iniciar el escaneo')
    }
  }

  const doAbort = () => {
    // No abort endpoint; we locally forget the job. The backend will keep running
    // but the UI stops polling.
    setJobId(null)
    toast('Escaneo descartado en UI (el backend puede seguir)')
  }

  const setKeep = (idx, path, group) => {
    setSelections((prev) => {
      const next = { ...prev }
      const remove = new Set(group.map((e) => e.path).filter((p) => p !== path))
      next[idx] = { keep: path, remove }
      return next
    })
  }

  const toggleRemove = (idx, path) => {
    setSelections((prev) => {
      const cur = prev[idx] || { keep: null, remove: new Set() }
      const remove = new Set(cur.remove)
      if (remove.has(path)) remove.delete(path)
      else remove.add(path)
      return { ...prev, [idx]: { ...cur, remove } }
    })
  }

  const bulkKeepNewest = () => {
    if (!result) return
    const next = {}
    result.groups.forEach((group, idx) => {
      const newest = [...group].sort((a, b) => (b.mtime || 0) - (a.mtime || 0))[0]
      const keep = newest?.path || group[0]?.path
      const remove = new Set(group.map((e) => e.path).filter((p) => p !== keep))
      next[idx] = { keep, remove }
    })
    setSelections(next)
  }

  const bulkKeepShortestPath = () => {
    if (!result) return
    const next = {}
    result.groups.forEach((group, idx) => {
      const shortest = [...group].sort((a, b) => (a.path?.length || 0) - (b.path?.length || 0))[0]
      const keep = shortest?.path || group[0]?.path
      const remove = new Set(group.map((e) => e.path).filter((p) => p !== keep))
      next[idx] = { keep, remove }
    })
    setSelections(next)
  }

  const pathsToDelete = useMemo(() => {
    const out = []
    for (const sel of Object.values(selections)) {
      if (!sel?.remove) continue
      for (const p of sel.remove) out.push(p)
    }
    return out
  }, [selections])

  const bytesToFree = useMemo(() => {
    if (!result) return 0
    const byPath = new Map()
    for (const g of result.groups) for (const e of g) byPath.set(e.path, e.size || 0)
    return pathsToDelete.reduce((s, p) => s + (byPath.get(p) || 0), 0)
  }, [pathsToDelete, result])

  const doApply = async () => {
    if (pathsToDelete.length === 0) return
    try {
      const res = await applyMut.mutateAsync({ paths: pathsToDelete, dryRun: false })
      toast.success(
        `Borrados ${res?.deleted?.length ?? 0} · liberados ${formatBytes(res?.freed_bytes || 0)}`
      )
      if (res?.errors?.length) toast.error(`${res.errors.length} errores al borrar`)
      setSelections({})
      doScan(isDeep)
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
            <Copy className="h-6 w-6 text-emerald-400" /> Duplicados
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Detecta vídeos repetidos por tamaño + duración. Modo profundo confirma con md5.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => doScan(false)}
            disabled={isScanning || scanMut.isPending}
            variant="outline"
          >
            {(isScanning && !isDeep) || scanMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Scan rápido
          </Button>
          <Button
            onClick={() => doScan(true)}
            disabled={isScanning || scanMut.isPending}
            variant="outline"
          >
            {(isScanning && isDeep) ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ScanSearch className="mr-2 h-4 w-4" />
            )}
            Scan profundo (md5)
          </Button>
          {isScanning && (
            <Button onClick={doAbort} variant="ghost">
              <Ban className="mr-2 h-4 w-4" /> Abortar
            </Button>
          )}
        </div>
      </motion.div>

      {isScanning && (
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between text-sm text-zinc-300">
            <span>Escaneando{isDeep ? ' (deep)' : ''}…{job?.message ? ` ${job.message}` : ''}</span>
            <span>{job?.progress != null ? `${Math.round(job.progress)}%` : ''}</span>
          </div>
          <Progress value={job?.progress ?? 0} />
        </Card>
      )}

      {result && (
        <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="text-sm">
            <div className="text-zinc-100">
              {result.stats.total_videos} vídeos · {result.stats.groups_found} grupos duplicados
            </div>
            <div className="text-xs text-zinc-500">
              Espacio desperdiciado: <strong>{formatBytes(result.stats.wasted_bytes)}</strong>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={bulkKeepNewest}>
              <Clock className="mr-2 h-4 w-4" /> Mantener más reciente
            </Button>
            <Button size="sm" variant="outline" onClick={bulkKeepShortestPath}>
              <Route className="mr-2 h-4 w-4" /> Mantener path más corto
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={pathsToDelete.length === 0 || applyMut.isPending}
                >
                  {applyMut.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Borrar ({pathsToDelete.length})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" /> Confirmar borrado
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminarán <strong>{pathsToDelete.length}</strong> duplicados,
                    liberando aproximadamente <strong>{formatBytes(bytesToFree)}</strong>.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={doApply}>Borrar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </Card>
      )}

      {result && result.groups.length === 0 && (
        <Card className="p-8 text-center text-sm text-zinc-400">
          Sin duplicados encontrados.
        </Card>
      )}

      {result && result.groups.length > 0 && (
        <Card className="p-2">
          <Accordion type="multiple">
            {result.groups.map((group, idx) => {
              const sel = selections[idx] || { keep: null, remove: new Set() }
              return (
                <AccordionItem key={idx} value={`g-${idx}`} className="px-3">
                  <AccordionTrigger>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-medium text-zinc-100">Grupo #{idx + 1}</span>
                      <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                        {group.length} copias
                      </span>
                      <span className="text-xs text-zinc-500">{groupSignature(group)}</span>
                      <span className="text-xs text-zinc-500">
                        total {formatBytes(groupTotalBytes(group))}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                            <th className="py-2 pr-2 font-normal">Borrar</th>
                            <th className="py-2 pr-2 font-normal">Mantener</th>
                            <th className="py-2 pr-2 font-normal">Path</th>
                            <th className="py-2 pr-2 text-right font-normal">Size</th>
                            <th className="py-2 pr-2 text-right font-normal">Duración</th>
                            {isDeep && (
                              <th className="py-2 pr-2 font-normal">md5</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60">
                          {group.map((entry) => {
                            const isKeep = sel.keep === entry.path
                            const isRemove = sel.remove?.has(entry.path)
                            return (
                              <tr key={entry.path}>
                                <td className="py-2 pr-2">
                                  <Checkbox
                                    checked={!!isRemove}
                                    disabled={isKeep}
                                    onCheckedChange={() => toggleRemove(idx, entry.path)}
                                  />
                                </td>
                                <td className="py-2 pr-2">
                                  <input
                                    type="radio"
                                    name={`keep-${idx}`}
                                    checked={isKeep}
                                    onChange={() => setKeep(idx, entry.path, group)}
                                    aria-label={`Mantener ${entry.path}`}
                                    className="h-4 w-4 accent-emerald-500"
                                  />
                                </td>
                                <td className="py-2 pr-2 font-mono text-xs text-zinc-300 break-all">
                                  {entry.path}
                                </td>
                                <td className="py-2 pr-2 text-right text-zinc-400">
                                  {formatBytes(entry.size)}
                                </td>
                                <td className="py-2 pr-2 text-right text-zinc-400">
                                  {formatDuration(entry.duration_sec)}
                                </td>
                                {isDeep && (
                                  <td className="py-2 pr-2 font-mono text-xs text-zinc-500">
                                    {entry.md5 ? entry.md5.slice(0, 10) : '—'}
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        </Card>
      )}

      {!result && !isScanning && (
        <Card className="p-8 text-center text-sm text-zinc-400">
          Pulsa <strong>Scan rápido</strong> para buscar duplicados en{' '}
          <span className="font-mono text-zinc-300">{libraryPath || '(sin library_path)'}</span>.
        </Card>
      )}
    </div>
  )
}
