import { useEffect, useMemo, useRef } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

function mediaUrl(path, extra = {}) {
  const params = new URLSearchParams({ path, ...extra })
  return `/api/media?${params.toString()}`
}

function srtSibling(videoPath, suffix) {
  if (!videoPath) return null
  const dot = videoPath.lastIndexOf('.')
  const stem = dot > 0 ? videoPath.slice(0, dot) : videoPath
  return `${stem}${suffix}`
}

export default function VideoReviewDialog({
  open,
  onOpenChange,
  videoPath,
  title,
  seekSeconds = 0,
  hasSubsEn = true,
  hasSubsEs = false,
}) {
  const videoRef = useRef(null)

  const srcUrl = useMemo(() => (videoPath ? mediaUrl(videoPath) : null), [videoPath])
  const enTrack = useMemo(
    () => (hasSubsEn ? mediaUrl(srtSibling(videoPath, '.srt'), { as: 'vtt' }) : null),
    [videoPath, hasSubsEn],
  )
  const esTrack = useMemo(
    () => (hasSubsEs ? mediaUrl(srtSibling(videoPath, '.es.srt'), { as: 'vtt' }) : null),
    [videoPath, hasSubsEs],
  )

  useEffect(() => {
    if (!open) return
    const el = videoRef.current
    if (!el) return
    const onLoaded = () => {
      if (seekSeconds > 0) el.currentTime = seekSeconds
    }
    el.addEventListener('loadedmetadata', onLoaded)
    return () => el.removeEventListener('loadedmetadata', onLoaded)
  }, [open, seekSeconds, srcUrl])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-zinc-800">
        <DialogTitle className="sr-only">{title || 'Reproducir video'}</DialogTitle>
        {srcUrl && (
          <video
            ref={videoRef}
            src={srcUrl}
            controls
            autoPlay
            crossOrigin="anonymous"
            className="w-full h-auto max-h-[80vh] bg-black"
          >
            {enTrack && (
              <track
                kind="subtitles"
                srcLang="en"
                label="English"
                src={enTrack}
                default={!esTrack}
              />
            )}
            {esTrack && (
              <track
                kind="subtitles"
                srcLang="es"
                label="Español"
                src={esTrack}
                default
              />
            )}
          </video>
        )}
        {title && (
          <div className="px-4 py-2 text-xs text-zinc-400 bg-zinc-950 truncate">
            {title}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
