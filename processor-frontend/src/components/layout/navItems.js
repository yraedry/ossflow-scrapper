import {
  Home,
  Library,
  Workflow,
  Search,
  Trash2,
  Copy,
  FileText,
  Mic,
  Send,
  Settings,
} from 'lucide-react'

export const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/library', icon: Library, label: 'Biblioteca' },
  { to: '/pipelines', icon: Workflow, label: 'Pipelines' },
  { to: '/search', icon: Search, label: 'Búsqueda' },
  { to: '/cleanup', icon: Trash2, label: 'Limpieza' },
  { to: '/duplicates', icon: Copy, label: 'Duplicados' },
  { to: '/logs', icon: FileText, label: 'Logs' },
  { to: '/voices', icon: Mic, label: 'Voces' },
  { to: '/telegram', icon: Send, label: 'Telegram' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]
