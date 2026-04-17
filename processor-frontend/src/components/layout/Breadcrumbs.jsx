import { Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const LABELS = {
  '': 'Panel',
  library: 'Biblioteca',
  pipelines: 'Pipelines',
  pipeline: 'Pipeline',
  voices: 'Voces',
  settings: 'Configuración',
  logs: 'Logs',
  search: 'Buscar',
  cleanup: 'Limpieza',
  duplicates: 'Duplicados',
  telegram: 'Telegram',
  oracle: 'Oracle',
  providers: 'Providers',
}

function humanize(segment) {
  if (LABELS[segment] !== undefined) return LABELS[segment]
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export function Breadcrumbs() {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)

  const crumbs = [{ to: '/', label: 'Panel' }]
  let acc = ''
  segments.forEach((seg) => {
    acc += `/${seg}`
    crumbs.push({ to: acc, label: humanize(seg) })
  })

  // collapse root when there are nested crumbs
  const shown = crumbs.length === 1 ? crumbs : crumbs

  return (
    <nav className="flex items-center text-sm text-muted-foreground min-w-0" aria-label="Breadcrumb">
      {shown.map((c, i) => {
        const last = i === shown.length - 1
        return (
          <div key={c.to} className="flex items-center min-w-0">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 mx-1 shrink-0 opacity-60" />}
            {last ? (
              <span className={cn('truncate', 'text-foreground font-medium')}>{c.label}</span>
            ) : (
              <Link
                to={c.to}
                className="truncate hover:text-foreground transition-colors"
              >
                {c.label}
              </Link>
            )}
          </div>
        )
      })}
    </nav>
  )
}
