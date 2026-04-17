import { useState } from 'react'
import { Image as ImageIcon, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export default function PosterPreview({ posterUrl, hasLocalPoster }) {
  const [errored, setErrored] = useState(false)

  return (
    <Card className="bg-zinc-950/60 border-zinc-800">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ImageIcon className="h-4 w-4 text-zinc-400" /> Póster
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="aspect-[2/3] w-full overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 flex items-center justify-center">
          {posterUrl && !errored ? (
            <img
              src={posterUrl}
              alt="Póster del instructional"
              className="h-full w-full object-cover"
              onError={() => setErrored(true)}
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-600 text-xs">
              <ImageIcon className="h-8 w-8" />
              <span>{errored ? 'No se pudo cargar' : 'Sin póster'}</span>
            </div>
          )}
        </div>
        {posterUrl && !hasLocalPoster && (
          <Badge variant="secondary" className="gap-1 w-full justify-center">
            <AlertCircle className="h-3 w-3" /> Se descargará al guardar
          </Badge>
        )}
        {posterUrl && (
          <a
            href={posterUrl}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-[11px] text-zinc-500 hover:text-zinc-300 font-mono"
            title={posterUrl}
          >
            {posterUrl}
          </a>
        )}
      </CardContent>
    </Card>
  )
}
