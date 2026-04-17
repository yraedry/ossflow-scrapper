import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const FILTER_CHIPS = [
  { value: 'all', label: 'Todos' },
  { value: 'processed', label: 'Solo procesados' },
  { value: 'unprocessed', label: 'Sin procesar' },
  { value: 'no_poster', label: 'Sin póster' },
]

const SORT_OPTIONS = [
  { value: 'name', label: 'Alfabético' },
  { value: 'recent', label: 'Recientes' },
  { value: 'size', label: 'Tamaño' },
]

export function LibraryFilters() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const filter = params.get('filter') || 'all'
  const sort = params.get('sort') || 'name'

  const updateParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (!value || value === 'all' || (key === 'sort' && value === 'name')) {
      next.delete(key)
    } else {
      next.set(key, value)
    }
    setParams(next, { replace: true })
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="relative w-full md:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={q}
          onChange={(e) => updateParam('q', e.target.value)}
          placeholder="Buscar por título o autor..."
          className="pl-9"
          aria-label="Buscar instructional"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtro estado">
          {FILTER_CHIPS.map((chip) => {
            const active = filter === chip.value
            return (
              <button
                key={chip.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => updateParam('filter', chip.value)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {chip.label}
              </button>
            )
          })}
        </div>

        <Select value={sort} onValueChange={(v) => updateParam('sort', v)}>
          <SelectTrigger className="h-9 w-[160px]" aria-label="Ordenar">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export default LibraryFilters
