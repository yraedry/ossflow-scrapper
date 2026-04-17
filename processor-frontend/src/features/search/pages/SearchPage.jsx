// WIRE_ROUTE_SEARCH: /search → src/features/search/pages/SearchPage.jsx
//
// Búsqueda full-text en subtítulos. useSearch ya debounce 300ms internamente.
// Hits agrupados por instructional (Accordion), timestamps clicables,
// filtros por idioma e instructional.
import React, { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Search, Film, Clock, Languages, Filter, FileSearch, Loader2 } from "lucide-react"
import { useSearch } from "@/features/search/api/useSearch"
import VideoReviewDialog from "@/components/media/VideoReviewDialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/Badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

function videoPathFromSrt(srtPath) {
  if (!srtPath) return null
  return srtPath.replace(/\.(es|en)\.srt$/i, ".mp4").replace(/\.srt$/i, ".mp4")
}

function srtToSeconds(srtTime) {
  if (!srtTime) return 0
  const [hms, ms = "0"] = String(srtTime).split(",")
  const parts = hms.split(":").map((p) => parseInt(p, 10) || 0)
  if (parts.length !== 3) return 0
  const [h, m, s] = parts
  return h * 3600 + m * 60 + s + parseInt(ms, 10) / 1000
}

function formatTimestamp(srtTime) {
  if (!srtTime) return "00:00"
  const [hms] = String(srtTime).split(",")
  const parts = hms.split(":").map((p) => parseInt(p, 10) || 0)
  if (parts.length !== 3) return hms
  const [h, m, s] = parts
  const mm = String(m).padStart(2, "0")
  const ss = String(s).padStart(2, "0")
  if (h > 0) return `${String(h).padStart(2, "0")}:${mm}:${ss}`
  return `${mm}:${ss}`
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function Highlight({ text, term }) {
  if (!term) return <>{text}</>
  const re = new RegExp(`(${escapeRegex(term)})`, "ig")
  const parts = String(text).split(re)
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === term.toLowerCase() ? (
          <mark
            key={i}
            className="rounded bg-amber-300/30 px-0.5 text-amber-100"
          >
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

function detectLang(hit) {
  if (hit.language) return String(hit.language).toUpperCase()
  const name = (hit.srt_path || hit.video_filename || "").toLowerCase()
  if (name.includes(".es.") || name.includes("_es") || name.includes("spanish")) return "ES"
  return "EN"
}

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [langFilter, setLangFilter] = useState("all")
  const [instFilter, setInstFilter] = useState("all")
  const [playerHit, setPlayerHit] = useState(null)

  // useSearch debounces 300ms internally; enabled when q.length >= 2
  const { data, isFetching, isError, error } = useSearch(query)

  const results = data?.results || data?.hits || (Array.isArray(data) ? data : []) || []
  const trimmed = query.trim()

  const { filtered, instructionals } = useMemo(() => {
    const instSet = new Set()
    const f = results.filter((r) => {
      const inst = r.instructional || "Desconocido"
      instSet.add(inst)
      if (instFilter !== "all" && inst !== instFilter) return false
      const lang = detectLang(r)
      if (langFilter !== "all" && lang !== langFilter) return false
      return true
    })
    return { filtered: f, instructionals: Array.from(instSet).sort() }
  }, [results, langFilter, instFilter])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const r of filtered) {
      const key = r.instructional || "Desconocido"
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(r)
    }
    return Array.from(map.entries()).map(([instructional, hits]) => ({
      instructional,
      hits,
    }))
  }, [filtered])

  const handleTimestampClick = (hit, e) => {
    e.stopPropagation()
    setPlayerHit(hit)
  }

  const showEmpty = !trimmed || trimmed.length < 2
  const showNoResults = !showEmpty && !isFetching && !isError && filtered.length === 0

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-zinc-100">Búsqueda full-text</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Encuentra cualquier técnica o concepto a través de todos los subtítulos indexados
        </p>
      </div>

      {/* Big centered search input */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="relative mb-4"
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
        <Input
          type="text"
          aria-label="Buscar"
          autoFocus
          placeholder="Buscar una técnica, concepto o palabra..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-14 pl-12 pr-12 text-base"
        />
        {isFetching && trimmed.length >= 2 && (
          <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-500" />
        )}
      </motion.div>

      {/* Filters */}
      {results.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
            <Filter className="h-3 w-3" /> Filtros:
          </span>
          <Select value={langFilter} onValueChange={setLangFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <Languages className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los idiomas</SelectItem>
              <SelectItem value="EN">Inglés (EN)</SelectItem>
              <SelectItem value="ES">Español (ES)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={instFilter} onValueChange={setInstFilter}>
            <SelectTrigger className="w-[240px] h-8 text-xs">
              <Film className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los instruccionales</SelectItem>
              {instructionals.map((inst) => (
                <SelectItem key={inst} value={inst}>
                  {inst}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* States */}
      {showEmpty && (
        <div className="py-20 text-center text-zinc-500">
          <Search className="mx-auto mb-4 h-12 w-12 opacity-30" />
          <p className="text-sm">Escribe al menos 2 caracteres para buscar.</p>
        </div>
      )}

      {isError && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error?.message || "Error al buscar"}
        </div>
      )}

      {showNoResults && (
        <div className="py-16 text-center text-zinc-500">
          <FileSearch className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm">Sin resultados para "{trimmed}".</p>
        </div>
      )}

      <VideoReviewDialog
        open={Boolean(playerHit)}
        onOpenChange={(o) => !o && setPlayerHit(null)}
        videoPath={playerHit ? videoPathFromSrt(playerHit.srt_path) : null}
        title={playerHit?.video_filename || playerHit?.instructional}
        seekSeconds={playerHit ? srtToSeconds(playerHit.start_time) : 0}
        hasSubsEn
        hasSubsEs={playerHit ? detectLang(playerHit) === "ES" : false}
      />

      {!showEmpty && filtered.length > 0 && (
        <>
          <div className="mb-3 text-xs text-zinc-500">
            {filtered.length} resultado{filtered.length === 1 ? "" : "s"} en{" "}
            {grouped.length} instructional{grouped.length === 1 ? "" : "es"}
          </div>
          <Accordion
            type="multiple"
            defaultValue={grouped.slice(0, 3).map((g) => g.instructional)}
            className="space-y-2"
          >
            {grouped.map((group) => (
              <AccordionItem
                key={group.instructional}
                value={group.instructional}
                className="rounded-md border border-zinc-800/60 bg-zinc-950/40 px-3"
              >
                <AccordionTrigger className="py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Film className="h-4 w-4 shrink-0 text-zinc-400" />
                    <span className="truncate text-sm font-medium text-zinc-100">
                      {group.instructional}
                    </span>
                    <Badge
                      variant="secondary"
                      className="ml-1 shrink-0 text-[10px] bg-zinc-800 text-zinc-300 border-0"
                    >
                      {group.hits.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <ul className="divide-y divide-zinc-800/60">
                    {group.hits.map((hit, idx) => {
                      const lang = detectLang(hit)
                      return (
                        <motion.li
                          key={`${hit.srt_path || ""}-${hit.subtitle_index ?? idx}-${idx}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.12, delay: Math.min(idx, 5) * 0.02 }}
                          className="py-2.5"
                        >
                          <div className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
                            <span className="truncate inline-flex items-center gap-1 min-w-0">
                              <Film className="h-3 w-3 shrink-0" />
                              <span className="truncate">{hit.video_filename || "—"}</span>
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleTimestampClick(hit, e)}
                              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-amber-400 hover:bg-amber-500/10 transition-colors shrink-0"
                              aria-label={`Ir a ${formatTimestamp(hit.start_time)}`}
                            >
                              <Clock className="h-3 w-3" />
                              <span className="tabular-nums">
                                {formatTimestamp(hit.start_time)}
                              </span>
                            </button>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] border-0 shrink-0",
                                lang === "ES"
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : "bg-sky-500/15 text-sky-400",
                              )}
                            >
                              {lang}
                            </Badge>
                          </div>
                          <p className="text-sm text-zinc-200 leading-relaxed">
                            <Highlight text={hit.text} term={trimmed} />
                          </p>
                        </motion.li>
                      )
                    })}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </>
      )}
    </div>
  )
}
