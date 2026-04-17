// Oracle (BJJFanatics) domain.
// Endpoints (verified against processor-api/api/oracle.py — prefix /api/oracle):
//   GET    /providers
//   GET    /{instructional_path}                       (current .bjj-meta oracle block)
//   PUT    /{instructional_path}                       (save)
//   DELETE /{instructional_path}                       (clear)
//   POST   /{instructional_path}/resolve               (search + best-match)
//   POST   /{instructional_path}/scrape                (scrape a specific URL)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/httpClient'
import { qk } from '@/lib/queryKeys'

const enc = encodeURIComponent

export function useProviders() {
  return useQuery({
    queryKey: qk.oracle.providers,
    queryFn: () => http.get('/oracle/providers'),
    staleTime: 10 * 60_000,
  })
}

export function useOracleData(path) {
  return useQuery({
    queryKey: qk.oracle.detail(path),
    queryFn: () => http.get(`/oracle/${enc(path)}`),
    enabled: !!path,
    staleTime: 60_000,
  })
}

// Search is implemented server-side via the `resolve` endpoint (search+scrape).
// Exposed here as a lazy mutation; callers that want a debounced "search-as-you-type"
// should compose with `useDebouncedValue` from the search feature.
export function useResolveUrl() {
  return useMutation({
    mutationFn: ({ path, providerId, title, author }) => {
      const body = {}
      if (providerId) body.provider_id = providerId
      if (title) body.title = title
      if (author) body.author = author
      return http.post(`/oracle/${enc(path)}/resolve`, body)
    },
  })
}

// Poster may have been auto-downloaded by the backend (scrape/PUT), which
// updates the scan cache — invalidate library queries so has_poster re-reads.
function invalidateOracleAndLibrary(qc, path) {
  qc.invalidateQueries({ queryKey: qk.oracle.detail(path) })
  qc.invalidateQueries({ queryKey: qk.library.list() })
  qc.invalidateQueries({ queryKey: qk.library.detail(path) })
}

export function useOracleScrape() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ path, url }) => http.post(`/oracle/${enc(path)}/scrape`, { url }),
    onSuccess: (_d, { path }) => invalidateOracleAndLibrary(qc, path),
  })
}

export function useUpdateOracle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ path, oracle }) => http.put(`/oracle/${enc(path)}`, oracle),
    onSuccess: (_d, { path }) => invalidateOracleAndLibrary(qc, path),
  })
}

export function useDeleteOracle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ path }) => http.del(`/oracle/${enc(path)}`),
    onSuccess: (_d, { path }) => qc.invalidateQueries({ queryKey: qk.oracle.detail(path) }),
  })
}

// Convenience alias so pages reading "search" semantics can import it from here.
// Note: the real product search lives in resolve(); `useOracleSearch` is a thin
// wrapper that pairs a query string with the active provider.
export function useOracleSearch() {
  return useResolveUrl()
}
