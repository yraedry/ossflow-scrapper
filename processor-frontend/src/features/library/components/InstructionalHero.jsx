// Netflix/Plex-style hero for an instructional: poster side by side with
// title, stats, status pills and action CTAs. Background uses a blurred
// duplicate of the poster with an amber/zinc gradient overlay.
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Film,
  Upload,
  Loader2,
  Play,
  Sparkles,
  Pencil,
  Scissors,
  Captions,
  Mic,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { posterUrl, useUploadPoster } from '../api/useLibrary'

function StatusPill({ ok, label, Icon }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 border-zinc-700/70',
        ok
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
          : 'bg-zinc-800/50 text-zinc-400',
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  )
}

export default function InstructionalHero({
  instructional,
  onProcessAll,
  onEditMetadata,
}) {
  const nav = useNavigate()
  const [cacheBust, setCacheBust] = useState(0)
  const [posterErrored, setPosterErrored] = useState(false)
  const fileInputRef = useRef(null)

  const name = instructional?.name || ''
  const author =
    instructional?.author || instructional?.metadata?.author || instructional?.instructor || ''

  const videos = instructional?.videos || []
  const seasons = useMemo(() => {
    const set = new Set()
    for (const v of videos) set.add(v.season || 'Sin temporada')
    return set.size
  }, [videos])

  const hasChapters = videos.length > 0 && videos.every((v) => v.has_chapters || v.is_chapter)
  const hasSubs = videos.length > 0 && videos.every((v) => v.has_subtitles_en)
  const hasDub = videos.length > 0 && videos.every((v) => v.has_dubbing || v.has_dubbed)

  const poster = instructional?.has_poster || instructional?.poster_filename
  const src = poster && !posterErrored ? `${posterUrl(name)}?v=${cacheBust}` : null

  const upload = useUploadPoster()

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await upload.mutateAsync({ name, file })
      setPosterErrored(false)
      setCacheBust((n) => n + 1)
      toast.success('Póster actualizado')
    } catch (err) {
      toast.error(`Error subiendo póster: ${err.message || 'desconocido'}`)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="relative overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950"
    >
      {/* Blurred poster background */}
      {src && (
        <div
          aria-hidden
          className="absolute inset-0 scale-110 opacity-30"
          style={{
            backgroundImage: `url(${src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(40px) saturate(1.2)',
          }}
        />
      )}
      {/* Gradient overlay */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-amber-950/20 via-zinc-950/80 to-zinc-950"
      />

      <div className="relative flex flex-col gap-6 p-6 md:flex-row md:p-8">
        {/* Poster */}
        <div className="flex-shrink-0">
          <div className="relative aspect-[2/3] w-[200px] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl md:w-[280px]">
            {src ? (
              <img
                src={src}
                alt={name}
                onError={() => setPosterErrored(true)}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Film className="h-16 w-16 text-zinc-700" />
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={upload.isPending}
          >
            {upload.isPending ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-2 h-3.5 w-3.5" />
            )}
            {upload.isPending ? 'Subiendo…' : 'Cambiar póster'}
          </Button>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl font-bold tracking-tight text-zinc-100 md:text-4xl">
            {name}
          </h1>
          {author && (
            <p className="mt-1 truncate text-sm text-zinc-400">{author}</p>
          )}
          <p className="mt-1 truncate font-mono text-[11px] text-zinc-600">
            {instructional?.path}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
            <span>{videos.length} vídeos</span>
            <span className="text-zinc-700">·</span>
            <span>
              {seasons} {seasons === 1 ? 'temporada' : 'temporadas'}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <StatusPill ok={hasChapters} label="Capítulos" Icon={Scissors} />
            <StatusPill ok={hasSubs} label="Subtítulos" Icon={Captions} />
            <StatusPill ok={hasDub} label="Doblaje" Icon={Mic} />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={onProcessAll}>
              <Play className="mr-2 h-4 w-4" /> Procesar todo
            </Button>
            <Button
              variant="outline"
              onClick={() => nav(`/library/${encodeURIComponent(name)}/oracle`)}
            >
              <Sparkles className="mr-2 h-4 w-4 text-amber-400" /> Oracle
            </Button>
            <Button variant="outline" onClick={onEditMetadata}>
              <Pencil className="mr-2 h-4 w-4" /> Editar metadatos
            </Button>
          </div>
        </div>
      </div>
    </motion.header>
  )
}
