# BJJ Processor — Frontend Redesign Architecture

Status: Draft v1 (2026-04-14)
Owner: Arquitecto
Consumers: Planificador, Implementador

---

## 0. TL;DR

Reemplazo completo del SPA actual (React 18 + Tailwind v3 + Zustand + fetch manual) por un stack moderno centrado en **shadcn/ui + Tailwind v4 + TanStack Query**, manteniendo React 18, Vite, Zustand (solo UI state) y react-router. Dirección visual: **dark-first, zinc/slate neutros + acento ámbar** (tatami BJJ). Densidad tipo Linear en chrome, bento-grid tipo Vercel en Dashboard, grid de pósters protagonista tipo Plex en Biblioteca. Migración **big-bang pero en rama**, los endpoints `processor-api` son inmutables.

---

## 1. Stack final y versiones

| Capa | Paquete | Versión | Por qué |
|---|---|---|---|
| Runtime | `react`, `react-dom` | 18.3.x | Estable; no hay razón para 19 aún (shadcn todavía valida integraciones). No migramos a Next.js. |
| Build | `vite` | ^5.4 | Ya en uso, compatible con Tailwind v4 plugin. |
| Routing | `react-router-dom` | ^6.26 | Conservamos; migrar a v7/Remix es ruido. |
| Styling | `tailwindcss` | **^4.0** | v4 trae `@theme` CSS-native, `@tailwindcss/vite` plugin, sin `tailwind.config.js` obligatorio. Reemplaza PostCSS + autoprefixer. |
| Tailwind plugin | `@tailwindcss/vite` | ^4.0 | Plugin Vite oficial v4. |
| UI kit | **shadcn/ui** (registry) | última (CLI 2.x) | No es dep npm; copia componentes a `src/components/ui`. Base Radix. Totalmente editable. |
| Primitives | `@radix-ui/react-*` | últimas | Instaladas por shadcn CLI on-demand. |
| Iconos | `lucide-react` | ^0.400 | Ya en uso. |
| Toasts | `sonner` | ^1.5 | Reemplaza `Toaster` custom. |
| Animación | `framer-motion` | ^11 | Transiciones de panel, poster hover, timeline pipeline. |
| Data fetching | **`@tanstack/react-query`** | ^5.59 | Reemplaza fetch directo en stores + `useJobsPolling`. |
| Devtools QC | `@tanstack/react-query-devtools` | ^5.59 | Solo dev. |
| UI state | `zustand` | ^4.5 | **Solo** UI local: sidebar collapsed, command palette open, filtros Library. NO server state. |
| Utilidades | `clsx`, `tailwind-merge`, `class-variance-authority` | últimas | `cn()` helper shadcn + variants. |
| Forms | `react-hook-form` + `zod` + `@hookform/resolvers` | últimas | Settings, Metadata editor, Oracle URL form. |
| Command palette | `cmdk` | ^1.0 | Base de shadcn `<Command>`. |
| Tablas | `@tanstack/react-table` | ^8.20 | Pipelines list, Duplicates, Cleanup. |
| Charts (Dashboard) | `recharts` | ^2.12 | Sparklines GPU/RAM. Shadcn Chart wraps. |
| Fechas | `date-fns` | ^3 | Durations, relative time. |
| Tests | `vitest`, `@testing-library/react`, `jsdom`, `msw` | — | Añadimos **MSW** para mockear TanStack queries en tests. |

Quitar: `autoprefixer`, `postcss`, `tailwindcss@3`, custom `Toaster`, `api/client.js` fetch wrappers (migran a query hooks).

---

## 2. Sistema de diseño

### 2.1 Filosofía

- **Dark primary**: la app corre 24/7 en un home-lab; contraste alto, poca saturación.
- **Acento ámbar (BJJ tatami)**: señaliza acciones primarias y el branding. Esmeralda queda reservada para estados `success` (pipeline ok).
- **Densidad Linear en chrome** (sidebar/topbar/tablas), **protagonismo visual en biblioteca** (pósters 2:3 grandes).

### 2.2 Tokens CSS (Tailwind v4 `@theme`)

```css
/* src/styles/globals.css */
@import "tailwindcss";

@theme {
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono Variable", ui-monospace, monospace;

  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
}

:root { /* Light (secundario) */
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 240 10% 3.9%;
  --primary: 32 95% 44%;           /* amber-600 tatami */
  --primary-foreground: 0 0% 100%;
  --secondary: 240 4.8% 95.9%;
  --secondary-foreground: 240 5.9% 10%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --accent: 32 95% 44%;
  --accent-foreground: 0 0% 100%;
  --destructive: 0 72% 51%;
  --destructive-foreground: 0 0% 98%;
  --border: 240 5.9% 90%;
  --input: 240 5.9% 90%;
  --ring: 32 95% 44%;

  --status-pending: 217 91% 60%;   /* blue-500 */
  --status-running: 32 95% 54%;    /* amber-500 pulsing */
  --status-success: 142 71% 45%;   /* emerald-500 */
  --status-error:   0 72% 51%;     /* red-500 */
  --status-idle:    240 4% 46%;    /* zinc-500 */
}

.dark { /* Default */
  --background: 240 10% 3.9%;      /* zinc-950 */
  --foreground: 0 0% 98%;
  --card: 240 6% 7%;               /* zinc-900-ish */
  --card-foreground: 0 0% 98%;
  --popover: 240 6% 7%;
  --popover-foreground: 0 0% 98%;
  --primary: 32 95% 54%;           /* amber-500 */
  --primary-foreground: 240 10% 3.9%;
  --secondary: 240 3.7% 15.9%;
  --secondary-foreground: 0 0% 98%;
  --muted: 240 3.7% 15.9%;
  --muted-foreground: 240 5% 64.9%;
  --accent: 32 95% 54%;
  --accent-foreground: 240 10% 3.9%;
  --destructive: 0 62.8% 50%;
  --destructive-foreground: 0 0% 98%;
  --border: 240 3.7% 15.9%;
  --input: 240 3.7% 15.9%;
  --ring: 32 95% 54%;

  --status-pending: 217 91% 65%;
  --status-running: 32 95% 60%;
  --status-success: 142 71% 50%;
  --status-error:   0 72% 60%;
  --status-idle:    240 5% 55%;
}
```

### 2.3 Tipografía

- **Inter Variable** (UI), **JetBrains Mono Variable** (logs, timestamps, paths, SRT previews).
- Escala (rem): `xs 0.75 / sm 0.875 / base 0.9375 / lg 1.0625 / xl 1.25 / 2xl 1.5 / 3xl 1.875`. Ligeramente comprimida vs Tailwind default (UI densa).
- Line-height: `1.5` en texto, `1.25` en headings.
- Chrome (sidebar, topbar, tabs): `text-sm`, `font-medium`. Logs y SRT: `font-mono text-xs`.

### 2.4 Espaciado, radios, sombras

- Espaciado base: 4 px (estándar TW). Gutters sección: `gap-6`. Gutter cards bento: `gap-4`.
- Radios: `sm` inputs/badges, `md` cards, `lg` modals/sheets, `xl` póster overlays.
- Sombras: prácticamente ninguna en dark; `ring-1 ring-border/60` en su lugar. Hover póster: elevación ligera `shadow-lg shadow-primary/10`.

### 2.5 Status badges semánticos

Componente `<StatusBadge status="pending|running|success|error|idle" />`:

| Status | Color token | Icon lucide | Animación |
|---|---|---|---|
| pending | `--status-pending` | `Clock` | — |
| running | `--status-running` | `Loader2` | `animate-spin` + pulse dot |
| success | `--status-success` | `CheckCircle2` | — |
| error | `--status-error` | `XCircle` | — |
| idle | `--status-idle` | `Circle` | — |

Badges compuestos por vídeo: tres píldoras `chapters / subs / dub` usando el mismo token mapping.

---

## 3. Arquitectura de carpetas

### 3.1 Propuesta

```
src/
  app/
    router.tsx            # router config, lazy pages
    providers.tsx         # QueryClient, ThemeProvider, Tooltip, Toaster(sonner)
    main.tsx              # antes main.jsx
  components/
    ui/                   # shadcn/ui (button, dialog, sheet, tabs, command, ...)
    layout/
      AppShell.tsx
      Sidebar.tsx
      Topbar.tsx
      Breadcrumbs.tsx
      CommandPalette.tsx
    common/
      StatusBadge.tsx
      PipelineStatePills.tsx
      EmptyState.tsx
      ErrorState.tsx
      PageHeader.tsx
      MetricTile.tsx
      PosterCard.tsx
  features/               # dominio, co-locación lógica
    dashboard/
      pages/DashboardPage.tsx
      components/GpuCard.tsx RamCard.tsx JobsFeed.tsx ScansCard.tsx
      hooks/useMetrics.ts useJobsQuery.ts
    library/
      pages/LibraryPage.tsx LibraryDetailPage.tsx
      components/LibraryGrid.tsx LibraryFilters.tsx PosterBadges.tsx
        SeasonList.tsx ChapterRow.tsx MetadataEditor.tsx
      hooks/useLibrary.ts useInstructional.ts useRenameChapter.ts
      api/library.ts
    pipeline/
      pages/PipelinePage.tsx PipelinesListPage.tsx
      components/PipelineTimeline.tsx StepCard.tsx LogPanel.tsx
        PreflightBanner.tsx StepSelector.tsx PipelineConfigForm.tsx
      hooks/usePipeline.ts useRunPipeline.ts useCancelPipeline.ts
      api/pipeline.ts
    oracle/
      pages/ProvidersPage.tsx InstructionalOraclePage.tsx
      components/OracleUrlInput.tsx VolumeEditor.tsx ChapterTable.tsx
      hooks/useOracle*.ts
      api/oracle.ts
    search/ cleanup/ duplicates/ logs/ voices/ settings/ telegram/
      # misma estructura
  hooks/                  # globales (useTheme, useHotkey, useMediaQuery)
  lib/
    cn.ts
    queryClient.ts
    httpClient.ts         # fetch wrapper (auth header futuro, error normalizer)
    paths.ts              # path display helpers
    format.ts             # formatDuration, formatBytes, relativeTime
    constants.ts
  stores/                 # Zustand — SOLO UI
    useUiStore.ts         # sidebar collapsed, theme, command palette open
    useLibraryFiltersStore.ts
  styles/
    globals.css
  test/
    setup.ts
    msw/handlers.ts server.ts
```

### 3.2 Justificación vs estructura actual

- Actual mezcla `pages/`, `components/<dominio>/`, `stores/` acoplados a fetch. Está bien para ~12 páginas pero cada dominio tiene su lógica esparcida en 3 sitios.
- **Feature-first** (`features/<dominio>/{pages,components,hooks,api}`) co-localiza todo lo que cambia junto. Reduce imports cross-feature y facilita borrar un dominio entero.
- `components/ui` (shadcn) + `components/common` + `components/layout` separa: primitivos genéricos / compuestos de la app / shell. Escala mejor.
- `stores/` se reduce drásticamente: data viene de TanStack Query; Zustand queda para UI efímera.

---

## 4. Layout global

### 4.1 AppShell

```
┌──────────────────────────────────────────────────────────────────┐
│  TOPBAR  [logo] Breadcrumbs …………  [⌘K search]  [theme] [status] │
├──────┬───────────────────────────────────────────────────────────┤
│  S   │                                                           │
│  I   │                                                           │
│  D   │                  <Outlet />  (page content)               │
│  E   │                                                           │
│  B   │                                                           │
│  A   │                                                           │
│  R   │                                                           │
└──────┴───────────────────────────────────────────────────────────┘
```

### 4.2 Sidebar

- Ancho: `w-60` expandido, `w-14` colapsado. Estado en `useUiStore` (persistido localStorage).
- Secciones:
  - **Procesar**: Dashboard, Biblioteca, Pipelines, Búsqueda
  - **Utilidades**: Cleanup, Duplicados, Voces, Logs
  - **Fuentes**: Oracle Providers
  - **Config**: Settings, Telegram
- Indicador activo: barra lateral 2px en `--primary` + fondo `bg-accent/10`.
- Footer sidebar: chip estado global (backends verdes/rojos), user agent icon, versión.
- shadcn: usar **`<Sidebar>` block** (registry oficial).

### 4.3 Topbar

- Breadcrumbs contextuales (ruta → instruccional → season → capítulo).
- **Command palette trigger** `⌘K` / `Ctrl+K` (cmdk). Acciones: "Go to …", "Run pipeline on …", "Scan library", "Open logs for service X", "Toggle theme".
- Status pill global: backends up/down (ping agregado a `/api/metrics/`).
- Theme toggle (aunque dark es default).

### 4.4 Command palette (Cmd+K)

Secciones del `<CommandDialog>`:
1. **Navegación**: cada ruta.
2. **Instruccionales**: fuzzy search sobre lista library (TanStack Query ya cacheada).
3. **Acciones**: "Scan library", "New pipeline…", "Toggle theme", "Open logs service…".
4. **Búsqueda full-text**: envía a `/search?q=…` si el usuario pulsa enter con query libre.

---

## 5. Páginas clave

### 5.1 Dashboard — bento grid

```
┌─────────────┬─────────────┬─────────────┐
│ GPU (chart) │ RAM (chart) │ Disco (gauge)│
├─────────────┴──┬──────────┴─────────────┤
│ Jobs activos   │ Pipelines recientes    │
│ (live progress)│ (timeline compacta)    │
├────────────────┼────────────────────────┤
│ Scans / Clean  │ Servicios (health grid)│
└────────────────┴────────────────────────┘
```

- `MetricTile` (common) + `recharts` sparkline (shadcn Chart block).
- shadcn: `Card`, `Badge`, `Progress`, `Tooltip`, `HoverCard`.
- Data: `useMetricsQuery` (poll 5 s), `useJobsQuery` (poll 2 s mientras running, luego 30 s).

### 5.2 Biblioteca — Plex-like grid

```
[filters bar: search | status(chapters/subs/dub) | sort | view toggle]
┌────┬────┬────┬────┬────┬────┐
│ P1 │ P2 │ P3 │ P4 │ P5 │ P6 │   pósters 2:3, overlay hover
├────┼────┼────┼────┼────┼────┤
│ P7 │ ...
```

- `PosterCard`: ratio 2:3, lazy-load, placeholder blur, **overlay al hover** con autor, # capítulos, pills `chapters/subs/dub`.
- Filtros persistidos en `useLibraryFiltersStore` (zustand).
- shadcn: `Input`, `ToggleGroup`, `DropdownMenu`, `ContextMenu` (right-click → "Procesar", "Abrir Oracle", "Editar metadatos").
- Virtualización con `@tanstack/react-virtual` si >200 items.

### 5.3 Detalle Instruccional

```
┌─────────────────────────────────────────────────────────┐
│ [Póster grande]   Título                                │
│     2:3 big       Autor · N vols · estado global        │
│                   [Procesar todo] [Procesar faltantes▾] │
│                   [Abrir Oracle] [Editar metadata]      │
├─────────────────────────────────────────────────────────┤
│ Tabs: Capítulos | Pipeline | Metadatos | Logs | Oracle  │
└─────────────────────────────────────────────────────────┘
```

- **Capítulos**: `Accordion` por Season, cada row = `ChapterRow` con:
  - thumbnail (si hay), nombre `SNNEMM - …` (editable inline), duración, pills status.
  - acciones rápidas: play (futuro), procesar este, ver SRT, descargar doblado.
- **Pipeline**: embed del `StepSelector` + `PipelineConfigForm`. Si hay pipeline activo, mostrar link al detalle.
- **Metadatos**: form `react-hook-form` + `zod` editando `.bjj-meta.json`; subida de póster (drag-drop con `Dropzone` custom sobre `Input type=file`).
- **Logs**: filtrado por path del instruccional sobre ring buffer global.
- **Oracle**: integración vista Oracle (mover aquí en vez de ruta separada `/library/:path/oracle` — esa ruta queda como deep-link).
- shadcn: `Tabs`, `Accordion`, `Dialog` (rename), `Sheet` (metadata lateral), `Toast` via sonner.

### 5.4 Pipeline ejecución (PipelinePage)

```
┌────────────────────────────────┬────────────────────────┐
│ Timeline vertical              │ LogPanel (scroll live) │
│  ● Oracle scrape        ✓ 12s  │ [service filter]       │
│  ● Chapters split       ⟳ 3m   │ [level filter]         │
│  ○ Subtitles           pending │                        │
│  ○ Dubbing             pending │ mono text stream       │
│                                │                        │
│ [Cancel] [Retry failed]        │                        │
├────────────────────────────────┴────────────────────────┤
│ StepDiff viewer (added / modified / removed)            │
└──────────────────────────────────────────────────────────┘
```

- Timeline con Framer Motion (step status transitions).
- LogPanel: SSE hacia `/events/{id}` + fallback polling `/api/pipeline/{id}`.
- ETA pill usando `/api/pipeline/eta`.
- shadcn: `ScrollArea`, `Resizable` (divisor), `Button`, `AlertDialog` (cancel confirm).

### 5.5 Resto (resumen breve)

| Página | Componentes shadcn clave | Patrón |
|---|---|---|
| **Pipelines list** | `Table` (TanStack Table) + `Badge` + `Sheet` detail | Paginada, filtros estado, inline cancel/retry |
| **Búsqueda** | `Input` con debounce, `Accordion` agrupando por instruccional, `Highlight` custom | Click → navega a capítulo con `?t=NN` |
| **Cleanup** | `Card` secciones, `Checkbox` selección, `Progress` escaneo, `AlertDialog` apply | Dry-run preview → apply confirmado |
| **Duplicados** | `Table` groups, `ToggleGroup` modo (fast/deep), reusa cleanup endpoint | Group expandible |
| **Logs** | `Select` servicio/nivel, `ScrollArea` mono, `Tabs` por servicio | Polling 2 s, pause on scroll up |
| **Voces** | `Card` grid perfiles, `Dialog` crear, `AudioPlayer` sample | CRUD simple |
| **Settings** | `Form` rhf+zod, `Tabs` (Library/Processing/Advanced), `Save` sticky | Dirty state warning |
| **Providers** | `Table` providers, `Badge` status | Solo lectura |
| **InstructionalOracle** | `Form` URL → resolve → `Table` volumes/chapters editables → procesar | Ver 5.3 tab |
| **Telegram** | `Card` config + test send | Mantener feature |

---

## 6. Data layer — TanStack Query

### 6.1 Key strategy

Convención jerárquica:

```ts
// features/library/api/library.ts
export const libraryKeys = {
  all: ['library'] as const,
  list: (filters?: Filters) => ['library', 'list', filters] as const,
  detail: (name: string) => ['library', 'detail', name] as const,
  chapters: (name: string) => ['library', 'detail', name, 'chapters'] as const,
};
```

Mismo patrón para `pipelineKeys`, `oracleKeys`, `metricsKeys`, `jobsKeys`, `logsKeys`.

### 6.2 QueryClient defaults

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (n, err) => n < 2 && !is4xx(err),
    },
    mutations: { retry: 0 },
  },
});
```

### 6.3 Polling

- Métricas Dashboard: `refetchInterval: 5000` (solo visible).
- Jobs activos: `refetchInterval: (data) => hasRunning(data) ? 2000 : 30_000`.
- Pipeline en curso: preferir **SSE** (`/events/{id}`) con `useEffect` que hace `queryClient.setQueryData(pipelineKeys.detail(id), ...)`. Fallback polling 2 s.
- Logs live: SSE igual.

### 6.4 Invalidación

| Acción | Invalida |
|---|---|
| `POST /api/pipeline` | `pipelineKeys.all`, `jobsKeys.all` |
| `POST /api/pipeline/{id}/cancel` | `pipelineKeys.detail(id)`, `pipelineKeys.list()` |
| `POST /api/chapters/rename` | `libraryKeys.detail(name)` |
| `POST /api/oracle/{path}` scrape | `libraryKeys.detail(name)`, `oracleKeys.detail(path)` |
| `POST /api/settings` | `settingsKeys.all` + invalidate `libraryKeys.all` |
| `POST /api/cleanup/apply` | `cleanupKeys.all`, `libraryKeys.all` |

### 6.5 Optimistic updates

- **Rename capítulo**: `useMutation` con `onMutate` → snapshot `chapters`, aplicar nuevo nombre; `onError` → rollback; `onSettled` → invalidate.
- **Cancel pipeline**: `onMutate` → marca `status: 'cancelling'` localmente; `onSettled` invalidate.
- **Delete voice profile**: optimistic remove.
- **Toggle step en pipeline config**: puramente UI (no server).

### 6.6 SSE helper

```ts
// lib/sse.ts
export function subscribeSSE(url, onMessage) { ... }
// en hook:
useEffect(() => {
  const un = subscribeSSE(`/api/pipeline/${id}/events`, (evt) =>
    queryClient.setQueryData(pipelineKeys.detail(id), merge));
  return un;
}, [id]);
```

---

## 7. Contratos inmutables (endpoints processor-api)

El frontend nuevo **consume los mismos endpoints**. No se negocia con backend en esta iteración.

| Grupo | Endpoints |
|---|---|
| Settings | `GET/PUT /api/settings` |
| Library | `GET /api/library`, `GET /api/library/{name}`, `POST /api/library/scan`, `POST /api/library/{name}/poster`, `GET/PUT /api/library/{name}/meta` |
| Chapters | `POST /api/chapters/rename` |
| Pipeline | `POST /api/pipeline`, `GET /api/pipeline`, `GET /api/pipeline/{id}`, `POST /api/pipeline/{id}/cancel`, `POST /api/pipeline/{id}/retry`, `GET /api/pipeline/eta`, `GET /api/pipeline/{id}/events` (SSE) |
| Preflight | `GET /api/preflight` |
| Oracle | `GET /api/oracle/providers`, `GET/POST/PUT/DELETE /api/oracle/{path}`, `POST /api/oracle/resolve`, `POST /api/oracle/scrape` |
| Jobs | `GET /api/jobs` (background jobs) |
| Cleanup | `POST /api/cleanup/scan`, `POST /api/cleanup/apply`, `GET /api/cleanup/jobs/{id}` |
| Duplicates | `POST /api/duplicates/scan`, `GET /api/duplicates/jobs/{id}` |
| Metrics | `GET /api/metrics/` |
| Logs | `GET /api/logs/` (ring buffer) |
| Search | `GET /api/search?q=…` |
| Voices | `GET/POST/DELETE /api/voices` |
| Telegram | `GET/PUT /api/telegram`, `POST /api/telegram/test` |

Si el rediseño descubre un contrato incómodo (p.ej. paginación), se anota en backlog, **no se cambia en este sprint**.

---

## 8. Plan de migración

### 8.1 Recomendación: **big-bang en rama `redesign/v3`**

Razones:
- Cambiar tokens de tema, Tailwind v3→v4, añadir QueryClient y mover stores implica tocar **cada página**. Hacerlo incremental obliga a dos estilos coexistiendo + dobles providers (zustand + query) + conversión de tokens a mitad. Más trabajo total.
- Solo hay un consumidor (el propio user). No hay SLA; se puede cortar.
- Tests frontend (98) se re-escriben por dominio a medida que la feature migra — esto sí es incremental **dentro de la rama**.

### 8.2 Fases (dentro de la rama)

1. **Foundation** (1 unidad)
   - Tailwind v4 + tokens + globals.css
   - shadcn CLI init + componentes base (`button, card, dialog, sheet, tabs, input, select, badge, tooltip, toast(sonner), command, scroll-area, dropdown-menu, accordion, table, progress, skeleton, alert, sidebar block`)
   - QueryClient provider, router, AppShell, Sidebar, Topbar, CommandPalette placeholder
   - MSW + vitest setup
2. **Data layer** (paralelo)
   - `lib/httpClient.ts`, `features/*/api/*.ts`, `features/*/hooks/*Query.ts`
   - Migrar `api/client.js`, `api/oracleClient.js`, `api/telegramClient.js`
3. **Migración página a página** (orden por valor):
   - Dashboard → Biblioteca (grid) → LibraryDetail → Pipeline exec → Pipelines list → Oracle (Providers + InstructionalOracle) → Search → Cleanup → Duplicates → Logs → Voices → Settings → Telegram
   - Cada página: borrar archivo viejo, crear en `features/`, escribir tests con MSW.
4. **Limpieza**
   - Borrar `src/pages/`, `src/stores/` obsoletos, `Toaster` viejo, `api/client.js`
   - Auditoría a11y (focus ring consistente, labels, roles tabs/accordion)
   - Lighthouse en dev build

### 8.3 Rollout

- PR único contra `main`. Tag `v3.0.0-frontend`.
- Versión vieja disponible via `git checkout` si algo crítico falla.
- No hay feature flags — es un SPA interno.

---

## 9. Riesgos y trade-offs

### 9.1 Riesgos

| Riesgo | Mitigación |
|---|---|
| **Tailwind v4 aún cambia APIs menores** | Anclar a `^4.0.x`, revisar changelog antes de bump. Fallback: v3.4 si bloquea shadcn registry. |
| **shadcn/ui en v4**: algunos bloques asumen v3 config | Usar registry v4-ready (docs shadcn.com actualizadas 2025); adaptar los que no lo estén. |
| **SSE en dev detrás de Vite proxy** | Configurar `vite.config.js` proxy con `ws: true` + tests con MSW mock SSE. |
| **Tests frontend (98) se rompen todos** | Re-escritura por dominio; meta: paridad en coverage al final (no bloquear merge por count). |
| **Command palette sobre dataset grande** | cmdk ya hace fuzzy eficiente; limitar lista library a 500 items en palette, resto por búsqueda full-text. |
| **Virtualización posters** | Solo si >200 ítems; detectar y activar. |
| **Dark mode only inicialmente** | Light tokens ya definidos; añadir toggle sin esfuerzo. |
| **Path Windows/UNC en URLs** | Reusar helpers `paths.ts`, tests con paths UNC reales. |

### 9.2 Trade-offs aceptados

- **Más peso en deps** (TanStack Query, Radix, rhf, zod, framer, recharts, cmdk) ~+80 KB gz. Aceptable; es app interna y trae DX + UX significativos.
- **TypeScript**: propongo migrar a TS en el mismo sprint (fricción ahora, ROI enorme con zod + query tipado). Si el planificador ve riesgo de scope, mantener JSX; pero el esqueleto del doc asume `.tsx` opcional.
- **Zustand reducido a UI**: re-trabajo de stores existentes, pero simplifica modelo mental.
- **SSE > polling** donde exista; más código de transporte, pero quita chatter HTTP.

### 9.3 Deps a quitar

`autoprefixer`, `postcss`, `tailwindcss@3`, `tailwind.config.js`, `postcss.config.js`, custom Toaster, `hooks/useJobsPolling.js` (reemplazado por query polling).

### 9.4 Deps a añadir

ver tabla sección 1.

---

## 10. Checklist para el planificador

- [ ] Fase 1 Foundation (tokens, shadcn init, AppShell, QueryClient, MSW)
- [ ] Fase 2 Data layer (httpClient + features/*/api + hooks query)
- [ ] Fase 3 Migración páginas — 13 páginas, orden del §8.2
- [ ] Fase 4 Limpieza (borrar viejo, a11y, lighthouse)
- [ ] Documentar en `README.md` del frontend cómo correr (`npm run dev`) y cómo añadir un componente shadcn
- [ ] Actualizar `Dockerfile` y `nginx.conf` si cambia `dist/` layout (no debería)
- [ ] Smoke test manual E2E: scan library → abrir instruccional → procesar pipeline completo → verificar resultados

---

Fin del documento.
