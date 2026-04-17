// NAS/CIFS mount — backed by /api/mount (processor-api/api/app.py).
//   GET  /api/mount           → { mounted, directories?, items? }
//   POST /api/mount            body: { share, username?, password? }
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/httpClient'
import { qk } from '@/lib/queryKeys'

export function useMountStatus() {
  return useQuery({
    queryKey: qk.mount.all,
    queryFn: () => http.get('/mount'),
    staleTime: 30_000,
  })
}

export function useMount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => http.post('/mount', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.mount.all })
      qc.invalidateQueries({ queryKey: qk.settings.all })
    },
  })
}
