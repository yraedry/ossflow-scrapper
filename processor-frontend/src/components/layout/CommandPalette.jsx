import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sun, Moon, Monitor, Search, Play, Terminal } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { navItems } from './navItems'
import { useTheme } from '@/components/theme-provider'

export function CommandPalette({ open, onOpenChange }) {
  const navigate = useNavigate()
  const { setTheme } = useTheme()

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  const run = (fn) => {
    onOpenChange(false)
    setTimeout(fn, 0)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar página, acción o comando…" />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>
        <CommandGroup heading="Navegación">
          {navItems.map(({ to, icon: Icon, label }) => (
            <CommandItem key={to} value={`nav ${label} ${to}`} onSelect={() => run(() => navigate(to))}>
              <Icon className="mr-2 h-4 w-4" />
              <span>{label}</span>
              <span className="ml-auto text-[10px] text-muted-foreground font-mono">{to}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Acciones">
          <CommandItem value="action search" onSelect={() => run(() => navigate('/search'))}>
            <Search className="mr-2 h-4 w-4" />
            Buscar instructional
          </CommandItem>
          <CommandItem value="action process" onSelect={() => run(() => navigate('/library'))}>
            <Play className="mr-2 h-4 w-4" />
            Procesar
          </CommandItem>
          <CommandItem value="action logs" onSelect={() => run(() => navigate('/logs'))}>
            <Terminal className="mr-2 h-4 w-4" />
            Ver logs
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Tema">
          <CommandItem value="theme light" onSelect={() => run(() => setTheme('light'))}>
            <Sun className="mr-2 h-4 w-4" /> Light
          </CommandItem>
          <CommandItem value="theme dark" onSelect={() => run(() => setTheme('dark'))}>
            <Moon className="mr-2 h-4 w-4" /> Dark
          </CommandItem>
          <CommandItem value="theme system" onSelect={() => run(() => setTheme('system'))}>
            <Monitor className="mr-2 h-4 w-4" /> System
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
