// Settings — backed by /api/settings (processor-api/api/settings.py).
//   GET /api/settings
//   PUT /api/settings
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/httpClient'
import { qk } from '@/lib/queryKeys'

export function useSettings() {
  return useQuery({
    queryKey: qk.settings.all,
    queryFn: () => http.get('/settings'),
    staleTime: 5 * 60_000,
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => http.put('/settings', data),
    onSuccess: (fresh) => {
      if (fresh) qc.setQueryData(qk.settings.all, fresh)
      qc.invalidateQueries({ queryKey: qk.settings.all })
    },
  })
}
