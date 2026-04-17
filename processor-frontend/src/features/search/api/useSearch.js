// Subtitle full-text search.
//   GET  /api/search?q=&limit=
//   POST /api/search/build-index  (body: { path })
//
// We debounce the query string inside the hook (300ms) so pages just pass the
// raw input value and don't need to wire their own debounce.
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http, qs } from '@/lib/httpClient'
import { qk } from '@/lib/queryKeys'

export function useDebouncedValue(value, delay = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

export function useSearch(query, { limit = 50, debounce = 300 } = {}) {
  const q = useDebouncedValue((query || '').trim(), debounce)
  return useQuery({
    queryKey: qk.search.query({ q, limit }),
    queryFn: () => http.get(`/search${qs({ q, limit })}`),
    enabled: q.length >= 2,
    staleTime: 30_000,
  })
}

export function useBuildSearchIndex() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ path }) => http.post('/search/build-index', { path }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.search.all }),
  })
}
