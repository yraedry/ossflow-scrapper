// Telegram domain hooks (TanStack Query).
// Endpoints (verified against processor-api/api/telegram.py):
//   GET    /api/telegram/status
//   POST   /api/telegram/auth/send-code   { phone }
//   POST   /api/telegram/auth/sign-in     { phone, code, phone_code_hash? }
//   POST   /api/telegram/auth/2fa         { password }
//   POST   /api/telegram/auth/logout
//   GET    /api/telegram/channels
//   POST   /api/telegram/channels/{username}/sync   { limit? }
//   GET    /api/telegram/channels/{username}/sync/{job_id}/events  (SSE)
//   GET    /api/telegram/media?channel&view&search&page&page_size
//   GET    /api/telegram/media/{channel}/{message}/thumbnail (binary)
//   PUT    /api/telegram/media/{channel}/{message}  { author?, title?, chapter_num? }
//   POST   /api/telegram/download         { channel_id, author, title }
//   GET    /api/telegram/download/{job_id}/events (SSE)
//   POST   /api/telegram/download/{job_id}/cancel
//   GET    /api/telegram/download/jobs?status=
//
// 404 on status/channels/media/jobs is treated as "empty state", not an error.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http, HttpError, qs } from '@/lib/httpClient'
import { qk } from '@/lib/queryKeys'

const enc = encodeURIComponent
const EMPTY_AUTH = { state: 'disconnected', phone: null, me_username: null, session_age_s: null }

function emptyOnNotFound(fallback) {
  return (e) => {
    if (e instanceof HttpError && e.status === 404) return fallback
    throw e
  }
}

export function useTelegramStatus() {
  return useQuery({
    queryKey: qk.telegram.status,
    queryFn: async () => {
      try {
        const data = await http.get('/telegram/status')
        if (!data) return EMPTY_AUTH
        return {
          state: data.state || (data.authenticated ? 'authenticated' : 'disconnected'),
          phone: data.phone || null,
          me_username: data.me_username || null,
          session_age_s: data.session_age_s ?? null,
        }
      } catch (e) {
        return emptyOnNotFound(EMPTY_AUTH)(e)
      }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useTelegramChannels(enabled = true) {
  return useQuery({
    queryKey: qk.telegram.channels,
    enabled,
    queryFn: async () => {
      try {
        const data = await http.get('/telegram/channels')
        if (Array.isArray(data)) return data
        return data?.channels || []
      } catch (e) {
        return emptyOnNotFound([])(e)
      }
    },
    staleTime: 30_000,
  })
}

export function useTelegramMedia(filters, enabled = true) {
  const safe = filters || {}
  return useQuery({
    queryKey: qk.telegram.media(safe),
    enabled,
    queryFn: async () => {
      try {
        const data = await http.get(`/telegram/media${qs(safe)}`)
        if (safe.view === 'by_author') {
          const list = Array.isArray(data?.authors) ? data.authors : (Array.isArray(data) ? data : [])
          return { authors: list }
        }
        return {
          items: data?.items || data?.media || [],
          total: data?.total ?? (data?.items?.length || 0),
          page: data?.page ?? safe.page ?? 1,
          page_size: data?.page_size ?? safe.page_size ?? 50,
        }
      } catch (e) {
        if (safe.view === 'by_author') return emptyOnNotFound({ authors: [] })(e)
        return emptyOnNotFound({ items: [], total: 0, page: safe.page || 1, page_size: safe.page_size || 50 })(e)
      }
    },
    keepPreviousData: true,
    staleTime: 15_000,
  })
}

// Active sync jobs — server-authoritative. Survives navigation and reloads;
// consumed by TelegramPage to rehydrate the progress bars on mount.
export function useActiveSyncs(enabled = true) {
  return useQuery({
    queryKey: qk.telegram.activeSyncs,
    enabled,
    queryFn: async () => {
      try {
        const data = await http.get('/telegram/syncs/active')
        return Array.isArray(data) ? data : (data?.syncs || [])
      } catch (e) {
        return emptyOnNotFound([])(e)
      }
    },
    refetchInterval: (q) => {
      const list = q.state.data || []
      const hasRunning = list.some((s) => ['queued', 'running'].includes(s.status))
      return hasRunning ? 2_000 : 15_000
    },
    staleTime: 0,
  })
}

export function useTelegramDownloads() {
  return useQuery({
    queryKey: qk.telegram.downloads,
    queryFn: async () => {
      try {
        const data = await http.get('/telegram/download/jobs')
        const list = Array.isArray(data) ? data : (data?.jobs || [])
        return list.map((j) => ({ ...j, id: j.id || j.job_id }))
      } catch (e) {
        return emptyOnNotFound([])(e)
      }
    },
    // Adaptive polling: 2s while there is an active download, 30s otherwise.
    refetchInterval: (q) => {
      const list = q.state.data || []
      const active = list.some((j) =>
        ['queued', 'in_progress', 'running'].includes(j.status),
      )
      return active ? 2_000 : 30_000
    },
  })
}

// ---------- Mutations: auth ----------

export function useSendCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ phone }) => http.post('/telegram/auth/send-code', { phone }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.telegram.status }),
  })
}

export function useSignIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ phone, code, phone_code_hash }) =>
      http.post('/telegram/auth/sign-in', { phone, code, phone_code_hash }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.telegram.status }),
  })
}

export function useSubmit2FA() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ password }) => http.post('/telegram/auth/2fa', { password }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.telegram.status }),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => http.post('/telegram/auth/logout').catch((e) => {
      if (e instanceof HttpError && e.status === 404) return null
      throw e
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.telegram.all }),
  })
}

// ---------- Mutations: channels & media ----------

export function useAddChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ username }) => http.post('/telegram/channels', { username }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.telegram.channels }),
  })
}

export function useUpdateChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ channel_id, title }) =>
      http.patch(`/telegram/channels/${enc(channel_id)}`, { title }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.telegram.channels }),
  })
}

export function useDeleteChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ channel_id }) => http.del(`/telegram/channels/${enc(channel_id)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.telegram.channels })
      qc.invalidateQueries({ queryKey: ['telegram', 'media'] })
    },
  })
}

export function useSyncChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ username, limit }) =>
      http.post(`/telegram/channels/${enc(username)}/sync`, limit ? { limit } : {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.telegram.channels })
      qc.invalidateQueries({ queryKey: ['telegram', 'media'] })
      qc.invalidateQueries({ queryKey: qk.telegram.activeSyncs })
    },
  })
}

export function useUpdateMediaMetadata() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ channel_id, message_id, metadata }) =>
      http.put(`/telegram/media/${enc(channel_id)}/${enc(message_id)}`, metadata),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['telegram', 'media'] }),
  })
}

// ---------- Mutations: downloads ----------

export function useStartDownload() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ channel_id, author, title }) =>
      http.post('/telegram/download', { channel_id, author, title }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.telegram.downloads }),
  })
}

export function useCancelDownload() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ jobId }) => http.post(`/telegram/download/${enc(jobId)}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.telegram.downloads }),
  })
}

export function thumbnailUrl(media) {
  if (!media) return null
  if (media.thumbnail_url) {
    if (media.thumbnail_url.startsWith('/api/')) return media.thumbnail_url
    if (media.thumbnail_url.startsWith('/telegram/')) return `/api${media.thumbnail_url}`
    return media.thumbnail_url
  }
  if (media.channel_id != null && media.message_id != null) {
    return `/api/telegram/media/${media.channel_id}/${media.message_id}/thumbnail`
  }
  return null
}
