// Edit author/title/chapter_num for a Telegram media row.
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useUpdateMediaMetadata } from '../api/useTelegram'

const schema = z.object({
  author: z.string().trim().optional(),
  title: z.string().trim().optional(),
  chapter_num: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === '' || v == null) return null
      const n = typeof v === 'number' ? v : parseInt(v, 10)
      if (Number.isNaN(n)) return null
      return n
    })
    .refine((n) => n == null || (n >= 1 && n <= 50), 'Capítulo entre 1 y 50'),
})

export default function MetadataEditDialog({ media, open, onOpenChange }) {
  const update = useUpdateMediaMetadata()
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { author: '', title: '', chapter_num: '' },
  })

  useEffect(() => {
    if (media) {
      form.reset({
        author: media.author || '',
        title: media.title || '',
        chapter_num: media.chapter_num != null ? String(media.chapter_num) : '',
      })
    }
  }, [media, form])

  if (!media) return null

  const onSubmit = async (values) => {
    const tid = toast.loading('Guardando metadata…')
    try {
      const payload = {
        author: values.author || null,
        title: values.title || null,
        chapter_num: values.chapter_num,
      }
      // Strip nulls so PUT only touches provided fields (backend requires ≥1 key).
      const clean = Object.fromEntries(
        Object.entries(payload).filter(([, v]) => v !== undefined),
      )
      await update.mutateAsync({
        channel_id: media.channel_id,
        message_id: media.message_id,
        metadata: clean,
      })
      toast.success('Metadata actualizada', { id: tid })
      onOpenChange?.(false)
    } catch (e) {
      toast.error(e?.message || 'Error guardando metadata', { id: tid })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar metadata</DialogTitle>
          <DialogDescription className="font-mono truncate">
            {media.filename || media.caption || `${media.channel_id}/${media.message_id}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="meta-author">Autor</Label>
            <Input id="meta-author" placeholder="John Danaher" {...form.register('author')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meta-title">Título</Label>
            <Input id="meta-title" placeholder="Leglocks: Enter the System" {...form.register('title')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meta-chapter">Nº capítulo</Label>
            <Input
              id="meta-chapter"
              type="number"
              min={1}
              max={50}
              className="w-24"
              {...form.register('chapter_num')}
            />
            {form.formState.errors.chapter_num && (
              <p className="text-xs text-destructive">
                {form.formState.errors.chapter_num.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange?.(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
