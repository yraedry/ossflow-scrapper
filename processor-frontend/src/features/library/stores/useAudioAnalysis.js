// Background audio analysis state.
// Allows launching analysis, navigating away, and viewing results later.
import { create } from 'zustand'
import { http } from '@/lib/httpClient'

const useAudioAnalysis = create((set, get) => ({
  // { [videoPath]: { status: 'pending'|'done'|'error', data: null|{...}, videoPath } }
  jobs: {},

  launch(videoPath) {
    const { jobs } = get()
    if (jobs[videoPath]?.status === 'pending') return // already running

    set({ jobs: { ...get().jobs, [videoPath]: { status: 'pending', data: null, videoPath } } })

    http
      .post('/subtitles/analyze', { video_path: videoPath })
      .then((result) => {
        set({
          jobs: { ...get().jobs, [videoPath]: { status: 'done', data: result, videoPath } },
        })
      })
      .catch((e) => {
        const detail = e?.response?.data?.detail || e?.message || 'Error desconocido'
        set({
          jobs: {
            ...get().jobs,
            [videoPath]: { status: 'error', data: { error: detail }, videoPath },
          },
        })
      })
  },

  clear(videoPath) {
    const next = { ...get().jobs }
    delete next[videoPath]
    set({ jobs: next })
  },

  get(videoPath) {
    return get().jobs[videoPath] || null
  },
}))

export default useAudioAnalysis
