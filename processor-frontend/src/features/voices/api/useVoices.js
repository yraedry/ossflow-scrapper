// Voice-cloning profiles.
//   GET    /api/voice-profiles
//   POST   /api/voice-profiles        (body: { slug/name, sample_path, ... })
//   DELETE /api/voice-profiles/{slug}
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/httpClient'
import { qk } from '@/lib/queryKeys'

export function useVoices() {
  return useQuery({
    queryKey: qk.voices.list(),
    queryFn: async () => {
      const data = await http.get('/voice-profiles')
      return Array.isArray(data) ? data : data?.profiles || data?.items || []
    },
    staleTime: 60_000,
  })
}

export function useUploadVoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => http.post('/voice-profiles', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.voices.all }),
  })
}

export function useDeleteVoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ slug }) => http.del(`/voice-profiles/${encodeURIComponent(slug)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.voices.all }),
  })
}
