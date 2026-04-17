// Auto-resolve oracle by folder name. Calls /resolve to get candidates,
// then either auto-scrapes the top match (score ≥ 0.9) or shows a picker.
import { useState } from 'react'
import { toast } from 'sonner'
import { Wand2, Loader2, ExternalLink, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/Badge'
import { useResolveUrl, useOracleScrape } from '@/features/oracle/api/useOracle'

const AUTO_SCRAPE_THRESHOLD = 0.9

export default function OracleAutoResolve({ path, onResolved }) {
  const resolve = useResolveUrl()
  const scrape = useOracleScrape()
  const [candidates, setCandidates] = useState(null)
  const [scrapingUrl, setScrapingUrl] = useState(null)

  const doScrape = async (url) => {
    setScrapingUrl(url)
    try {
      const result = await scrape.mutateAsync({ path, url })
      toast.success('Oráculo scrapeado correctamente')
      setCandidates(null)
      onResolved?.(result)
    } catch (e) {
      toast.error(`Scrape falló: ${e.message || 'error'}`)
    } finally {
      setScrapingUrl(null)
    }
  }

  const onAutoResolve = async () => {
    try {
      const result = await resolve.mutateAsync({ path })
      const list = Array.isArray(result) ? result : (result?.candidates || [])
      if (list.length === 0) {
        toast.error('No se encontraron coincidencias en BJJFanatics')
        return
      }
      const top = list[0]
      if (top.score >= AUTO_SCRAPE_THRESHOLD) {
        toast.success(`Mejor match: ${top.title} (${Math.round(top.score * 100)}%)`)
        await doScrape(top.url)
        return
      }
      setCandidates(list)
    } catch (e) {
      toast.error(`Búsqueda falló: ${e.message || 'error'}`)
    }
  }

  if (candidates) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-zinc-400">
          Encontrados {candidates.length} candidatos. Elige el correcto:
        </p>
        <ul className="space-y-1.5 max-h-80 overflow-y-auto">
          {candidates.map((c) => (
            <li
              key={c.url}
              className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-zinc-200">{c.title}</div>
                <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                  {c.author && <span className="truncate">{c.author}</span>}
                  <Badge variant="outline" className="text-[10px]">
                    {Math.round((c.score || 0) * 100)}%
                  </Badge>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-amber-400 hover:underline"
                  >
                    <ExternalLink size={10} /> abrir
                  </a>
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => doScrape(c.url)}
                disabled={scrape.isPending}
              >
                {scrapingUrl === c.url ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                <span className="ml-1">Usar</span>
              </Button>
            </li>
          ))}
        </ul>
        <Button variant="ghost" size="sm" onClick={() => setCandidates(null)}>
          Cancelar
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        onClick={onAutoResolve}
        disabled={resolve.isPending}
        className="w-full sm:w-auto"
      >
        {resolve.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Wand2 className="mr-2 h-4 w-4" />
        )}
        Buscar por nombre de carpeta
      </Button>
      <span className="text-[11px] text-zinc-600">
        usa el nombre del instructional para buscar automáticamente
      </span>
    </div>
  )
}
