import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
      <div className="text-6xl font-bold font-mono text-muted-foreground">404</div>
      <div className="text-lg">Página no encontrada</div>
      <Button asChild variant="outline">
        <Link to="/">Volver al panel</Link>
      </Button>
    </div>
  )
}
