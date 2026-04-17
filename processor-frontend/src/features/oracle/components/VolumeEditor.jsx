import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2, X, Save, AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useUpdateOracle, useDeleteOracle } from '@/features/oracle/api/useOracle'
import { parseTime, formatTime, validateOracle, deepClone, oracleEqual } from '@/features/oracle/lib/time'

function TimeCell({ value, onChange, ariaLabel, error }) {
  const [text, setText] = useState(formatTime(value))
  useEffect(() => { setText(formatTime(value)) }, [value])
  return (
    <Input
      type="text"
      aria-label={ariaLabel}
      aria-invalid={!!error}
      value={text}
      onChange={(e) => {
        const v = e.target.value
        setText(v)
        onChange(parseTime(v))
      }}
      placeholder="MM:SS"
      className={`h-8 w-24 font-mono text-xs ${error ? 'border-red-500/60 focus-visible:ring-red-500' : ''}`}
    />
  )
}

function SortableChapterRow({ id, vi, ci, ch, errors, onChange, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  const errFor = (field) => errors.find((e) => e.vi === vi && e.ci === ci && e.field === field)
  return (
    <tr ref={setNodeRef} style={style} className="border-t border-zinc-800/60 group">
      <td className="px-2 py-2 w-8 align-middle">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`drag-${vi}-${ci}`}
          className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300"
        >
          <GripVertical size={14} />
        </button>
      </td>
      <td className="px-2 py-2 w-12 text-xs font-mono text-zinc-500 align-middle">{ci + 1}</td>
      <td className="px-2 py-2 align-middle">
        <Input
          type="text"
          aria-label={`title-${vi}-${ci}`}
          value={ch.title}
          onChange={(e) => onChange({ ...ch, title: e.target.value })}
          className="h-8 text-sm"
        />
      </td>
      <td className="px-2 py-2 align-middle">
        <TimeCell
          ariaLabel={`start-${vi}-${ci}`}
          value={ch.start_s}
          onChange={(v) => onChange({ ...ch, start_s: v })}
          error={errFor('start')}
        />
        {errFor('start') && <div className="text-[10px] text-red-400 mt-0.5">{errFor('start').msg}</div>}
      </td>
      <td className="px-2 py-2 align-middle">
        <TimeCell
          ariaLabel={`end-${vi}-${ci}`}
          value={ch.end_s}
          onChange={(v) => onChange({ ...ch, end_s: v })}
          error={errFor('end')}
        />
        {errFor('end') && <div className="text-[10px] text-red-400 mt-0.5">{errFor('end').msg}</div>}
      </td>
      <td className="px-2 py-2 w-10 align-middle">
        <button
          type="button"
          aria-label={`delete-chapter-${vi}-${ci}`}
          onClick={onDelete}
          className="text-zinc-500 hover:text-red-400"
        >
          <X size={14} />
        </button>
      </td>
    </tr>
  )
}

function VolumePanel({ vol, vi, errors, onChange, onDelete }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const ids = useMemo(() => vol.chapters.map((_, i) => `v${vi}-c${i}`), [vol.chapters, vi])

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ids.indexOf(active.id)
    const newIndex = ids.indexOf(over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onChange({ ...vol, chapters: arrayMove(vol.chapters, oldIndex, newIndex) })
  }

  const updateChapter = (ci, ch) => {
    const chapters = vol.chapters.map((c, i) => (i === ci ? ch : c))
    onChange({ ...vol, chapters })
  }
  const deleteChapter = (ci) => {
    onChange({ ...vol, chapters: vol.chapters.filter((_, i) => i !== ci) })
  }
  const addChapter = () => {
    const last = vol.chapters[vol.chapters.length - 1]
    const start = last?.end_s ?? 0
    onChange({
      ...vol,
      chapters: [...vol.chapters, { title: 'Nuevo capítulo', start_s: start, end_s: start + 60 }],
    })
  }

  const volErrorCount = errors.filter((e) => e.vi === vi).length

  return (
    <AccordionItem value={`vol-${vi}`} className="border border-zinc-800/60 rounded-lg overflow-hidden bg-zinc-950/40 mb-3">
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-zinc-100">Volume {vol.number}</span>
          <Badge variant="secondary" className="font-mono">
            {vol.chapters.length} caps
          </Badge>
          {volErrorCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle size={11} /> {volErrorCount}
            </Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4">
        <div className="overflow-x-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="w-full">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="w-8" />
                  <th className="text-left px-2 py-2 font-medium w-12">#</th>
                  <th className="text-left px-2 py-2 font-medium">Título</th>
                  <th className="text-left px-2 py-2 font-medium w-28">Start</th>
                  <th className="text-left px-2 py-2 font-medium w-28">End</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                  {vol.chapters.map((ch, ci) => (
                    <SortableChapterRow
                      key={ids[ci]}
                      id={ids[ci]}
                      vi={vi}
                      ci={ci}
                      ch={ch}
                      errors={errors}
                      onChange={(c) => updateChapter(ci, c)}
                      onDelete={() => deleteChapter(ci)}
                    />
                  ))}
                </SortableContext>
              </tbody>
            </table>
          </DndContext>
        </div>
        <div className="flex items-center justify-between mt-3">
          <Button type="button" variant="ghost" size="sm" onClick={addChapter}>
            <Plus size={14} className="mr-1" /> Añadir capítulo
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onDelete} className="text-red-400 hover:text-red-300">
            <Trash2 size={14} className="mr-1" /> Borrar volumen
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

export default function VolumeEditor({ path, oracle, onSaved, onDeleted, onDirtyChange }) {
  const [draft, setDraft] = useState(() => deepClone(oracle))
  useEffect(() => { setDraft(deepClone(oracle)) }, [oracle])

  const errors = useMemo(() => validateOracle(draft), [draft])
  const isDirty = useMemo(() => !oracleEqual(draft, oracle), [draft, oracle])

  useEffect(() => { onDirtyChange?.(isDirty) }, [isDirty, onDirtyChange])

  const update = useUpdateOracle()
  const remove = useDeleteOracle()

  const updateVolume = (vi, vol) => {
    setDraft({ ...draft, volumes: draft.volumes.map((v, i) => (i === vi ? vol : v)) })
  }
  const deleteVolume = (vi) => {
    setDraft({ ...draft, volumes: draft.volumes.filter((_, i) => i !== vi) })
  }
  const addVolume = () => {
    const nextNum = (draft.volumes[draft.volumes.length - 1]?.number || 0) + 1
    setDraft({
      ...draft,
      volumes: [...draft.volumes, { number: nextNum, chapters: [{ title: 'Capítulo 1', start_s: 0, end_s: 60 }], total_duration_s: 60 }],
    })
  }
  const reset = () => setDraft(deepClone(oracle))

  async function handleSave() {
    if (errors.length) {
      toast.error(`${errors.length} error(es) de validación`)
      return
    }
    try {
      await update.mutateAsync({ path, oracle: draft })
      toast.success('Oracle guardado')
      onSaved?.()
    } catch (e) {
      toast.error(`Error guardando: ${e.message || 'desconocido'}`)
    }
  }

  async function handleDelete() {
    try {
      await remove.mutateAsync({ path })
      toast.success('Oracle eliminado')
      onDeleted?.()
    } catch (e) {
      toast.error(`Error eliminando: ${e.message || 'desconocido'}`)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleSave} disabled={!isDirty || errors.length > 0 || update.isPending}>
          <Save size={14} className="mr-2" />
          {update.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        {isDirty && (
          <Button variant="outline" onClick={reset}>
            Descartar
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-red-400 hover:text-red-300 ml-auto">
              <Trash2 size={14} className="mr-2" /> Eliminar oracle
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar oracle?</AlertDialogTitle>
              <AlertDialogDescription>
                Se borrarán los datos scrapeados de este instructional. La acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {errors.length > 0 && (
        <div role="alert" className="text-xs text-red-400 flex items-center gap-1.5">
          <AlertTriangle size={12} /> {errors.length} {errors.length === 1 ? 'error' : 'errores'} de validación — corrige antes de guardar
        </div>
      )}
      {isDirty && errors.length === 0 && (
        <div className="text-xs text-amber-400">Cambios sin guardar</div>
      )}

      <Accordion type="multiple" defaultValue={draft.volumes.map((_, i) => `vol-${i}`)} className="space-y-0">
        {draft.volumes.map((vol, vi) => (
          <VolumePanel
            key={vi}
            vol={vol}
            vi={vi}
            errors={errors}
            onChange={(v) => updateVolume(vi, v)}
            onDelete={() => deleteVolume(vi)}
          />
        ))}
      </Accordion>

      <Button type="button" variant="ghost" size="sm" onClick={addVolume}>
        <Plus size={14} className="mr-1" /> Añadir volumen
      </Button>
    </motion.div>
  )
}
