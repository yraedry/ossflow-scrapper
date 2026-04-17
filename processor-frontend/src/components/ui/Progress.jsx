import { clsx } from 'clsx'

export function Progress({ value = 0, className, variant = 'crimson' }) {
  const colors = {
    crimson: 'bg-crimson',
    gold: 'bg-gold',
    emerald: 'bg-emerald',
  }

  return (
    <div className={clsx('h-1.5 bg-dojo-border rounded-full overflow-hidden', className)}>
      <div
        className={clsx('h-full rounded-full transition-all duration-500 ease-out', colors[variant])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
