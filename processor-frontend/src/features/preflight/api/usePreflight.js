// Preflight checks (ffmpeg, mkvtoolnix, disk, backend /health + /gpu).
//   GET /api/pipeline/preflight?path=
//   GET /api/pipeline/preflight/static
import { useQuery } from '@tanstack/react-query'
import { http, qs } from '@/lib/httpClient'
import { qk } from '@/lib/queryKeys'

export function usePreflight(path) {
  return useQuery({
    queryKey: qk.preflight.detail(path || ''),
    queryFn: () => http.get(`/pipeline/preflight${qs({ path })}`),
    // Cheap cache: backends may flap, staleTime balances freshness vs spam.
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

export function usePreflightStatic() {
  return useQuery({
    queryKey: qk.preflight.static,
    queryFn: () => http.get('/pipeline/preflight/static'),
    staleTime: 5 * 60_000,
  })
}
