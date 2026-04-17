// MSW request handlers for tests.
// Keep minimal — only what smoke tests touch.
import { http, HttpResponse } from 'msw'

const API = '/api'

export const fixtures = {
  library: {
    instructionals: [
      {
        name: 'Tripod Passing - Jozef Chen',
        author: 'Jozef Chen',
        total_videos: 12,
        chapters_detected: 12,
        subtitled: 6,
        dubbed: 0,
        has_poster: true,
        poster_filename: 'poster.jpg',
        mtime: 1700000000,
      },
      {
        name: 'No Poster Show - Foo',
        author: 'Foo',
        total_videos: 3,
        chapters_detected: 0,
        subtitled: 0,
        dubbed: 0,
        has_poster: false,
        poster_filename: null,
        mtime: 1700000001,
      },
    ],
  },
  settings: {
    library_path: '/media/instruccionales',
    processing: {},
  },
  pipelines: [
    {
      id: 'p-1',
      instructional: 'Tripod Passing - Jozef Chen',
      status: 'completed',
      steps: [
        { name: 'chapters', status: 'completed', duration_s: 10 },
        { name: 'subtitles', status: 'completed', duration_s: 120 },
        { name: 'dubbing', status: 'pending' },
      ],
      started_at: 1700000000,
    },
  ],
  metrics: {
    cpu_percent: 12,
    ram_percent: 44,
    disk_percent: 70,
    gpu: { utilization: 0, memory_used_mb: 0, memory_total_mb: 24576 },
  },
}

export const handlers = [
  http.get(`${API}/library`, () => HttpResponse.json(fixtures.library)),

  http.get(`${API}/library/:name`, ({ params }) =>
    HttpResponse.json({
      name: decodeURIComponent(params.name),
      author: 'Jozef Chen',
      seasons: [
        {
          season: 1,
          chapters: [
            { path: '/media/x/S01E01.mp4', title: 'Intro', episode: 1 },
            { path: '/media/x/S01E02.mp4', title: 'Stance', episode: 2 },
          ],
        },
      ],
      has_poster: true,
      poster_filename: 'poster.jpg',
    }),
  ),

  http.get(`${API}/settings`, () => HttpResponse.json(fixtures.settings)),
  http.put(`${API}/settings`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ ...fixtures.settings, ...body })
  }),

  http.get(`${API}/pipeline`, () => HttpResponse.json({ pipelines: fixtures.pipelines })),
  http.get(`${API}/pipeline/eta`, () =>
    HttpResponse.json({ chapters: 5, subtitles: 120, dubbing: 300 }),
  ),

  http.get(`${API}/metrics/`, () => HttpResponse.json(fixtures.metrics)),
  http.get(`${API}/metrics`, () => HttpResponse.json(fixtures.metrics)),

  http.get(`${API}/jobs`, () => HttpResponse.json({ jobs: [] })),
  http.get(`${API}/logs/`, () => HttpResponse.json({ entries: [] })),
  http.get(`${API}/logs`, () => HttpResponse.json({ entries: [] })),
  http.get(`${API}/voices`, () => HttpResponse.json({ voices: [] })),
  http.get(`${API}/oracle/providers`, () =>
    HttpResponse.json({
      providers: [
        { id: 'bjjfanatics', display_name: 'BJJ Fanatics', domains: ['bjjfanatics.com'] },
      ],
    }),
  ),
  http.get(`${API}/preflight`, () => HttpResponse.json({ ok: true, checks: [] })),
  http.get(`${API}/telegram/status`, () => HttpResponse.json({ authenticated: false })),
]
