# BJJ Processor — Frontend Redesign Implementation Plan

Status: v1 (2026-04-14)
Owner: Planificador
Consumers: Implementador (+ subagentes paralelos)
Inputs: `docs/redesign-architecture.md`, `CLAUDE.md`

---

## 0. Decisión TS vs JSX

**Decisión: mantener JSX en este sprint. Posponer TypeScript a un sprint posterior dedicado.**

Justificación:
- El alcance ya es enorme: rediseño visual completo + Tailwind v3→v4 + nuevo design system con tokens + shadcn/ui (registry copy) + reorganización feature-first + introducción de TanStack Query (reemplaza TODO el data layer) + MSW + re-escritura de 98 tests + 13 páginas. Cada uno es un eje de cambio independiente.
- Añadir TS en el mismo sprint multiplica fricción: cada componente nuevo se diseñaría dos veces (forma JSX + tipado correcto), cada hook de TanStack Query exige tipos de respuesta que **aún no existen** porque los endpoints no están tipados desde backend (Python/Pydantic, no se exporta OpenAPI tipado), y los 98 tests duplican esfuerzo (re-escribir + tipar fixtures + mocks MSW tipados).
- ROI de TS llega cuando hay equipo o cuando el dominio es estable. Aquí el dominio se está reformulando — tipar algo que aún muta es desperdicio.
- El arquitecto dejó la puerta abierta ("si el planificador ve riesgo de scope, mantener JSX"). El esqueleto del doc usa `.tsx` solo como notación; el contenido es agnóstico.
- **Camino futuro**: cuando el rediseño esté en `main` y estabilizado, abrir `redesign/v3-typescript` que migra archivo a archivo con `// @ts-check` → `.ts/.tsx` + zod schemas como única fuente de verdad de los DTOs. Sprint independiente.

**Implicación práctica**: todos los archivos nuevos se crean con extensión `.jsx` / `.js`. Mantener `jsconfig.json` con `paths` para `@/*` → `src/*`. Sin `tsconfig.json`.

---

## 1. Branch strategy

- Rama única: **`redesign/v3`** desde `main`.
- Migración **big-bang dentro de la rama** — la `main` queda intacta hasta el merge final.
- **Sin feature flags** (SPA interno, single user).
- Commits atómicos por sub-fase (un commit por sub-fase de las descritas abajo) para que el bisect sea útil si algo regresa.
- PR final: squash NO (queremos historial por fase). Merge commit a `main`. Tag `v3.0.0-frontend`.
- Versión vieja recuperable via `git checkout v2.x` o el tag previo. No hay rollback runtime — basta `git revert` del merge commit.

---

## 2. Mapping endpoints → hooks → páginas (referencia rápida)

| Dominio | Endpoint(s) processor-api | Hook(s) TanStack | Página(s) consumidora(s) |
|---|---|---|---|
| settings | `GET/PUT /api/settings` | `useSettings`, `useUpdateSettings` | Settings, AppShell (library_path inicial) |
| library | `GET /api/library`, `GET /api/library/{name}`, `POST /api/library/scan`, `GET/PUT /api/library/{name}/meta`, `POST /api/library/{name}/poster` | `useLibrary`, `useInstructional`, `useScanLibrary`, `useUpdateMeta`, `useUploadPoster` | Library, LibraryDetail, Dashboard (counts), CommandPalette (fuzzy) |
| chapters | `POST /api/chapters/rename` | `useRenameChapter` (optimistic) | LibraryDetail (Capítulos tab) |
| pipeline | `POST /api/pipeline`, `GET /api/pipeline`, `GET /api/pipeline/{id}`, `POST /api/pipeline/{id}/cancel`, `POST /api/pipeline/{id}/retry`, `GET /api/pipeline/eta`, `GET /api/pipeline/{id}/events` (SSE) | `usePipelines`, `usePipeline(id)`, `useRunPipeline`, `useCancelPipeline`, `useRetryPipeline`, `usePipelineEta`, `usePipelineEvents` (SSE) | PipelinesList, PipelinePage, LibraryDetail (Pipeline tab), Dashboard (recent) |
| preflight | `GET /api/preflight` | `usePreflight` | PipelinePage (banner), Dashboard (services grid) |
| oracle | `GET /api/oracle/providers`, `GET/POST/PUT/DELETE /api/oracle/{path}`, `POST /api/oracle/resolve`, `POST /api/oracle/scrape` | `useOracleProviders`, `useOracleMeta`, `useOracleResolve`, `useOracleScrape`, `useSaveOracleMeta`, `useDeleteOracleMeta` | Providers, InstructionalOraclePage, LibraryDetail (Oracle tab) |
| jobs | `GET /api/jobs` | `useJobs` (adaptive polling) | Dashboard, AppShell status pill |
| cleanup | `POST /api/cleanup/scan`, `POST /api/cleanup/apply`, `GET /api/cleanup/jobs/{id}` | `useCleanupScan`, `useCleanupApply`, `useCleanupJob` | Cleanup |
| duplicates | `POST /api/duplicates/scan`, `GET /api/duplicates/jobs/{id}` | `useDuplicatesScan`, `useDuplicatesJob` | Duplicates |
| metrics | `GET /api/metrics/` | `useMetrics` (poll 5s, visible-only) | Dashboard, AppShell status pill |
| logs | `GET /api/logs/` (+ SSE futuro) | `useLogs` (poll 2s, pause-on-scroll) | Logs, LibraryDetail (Logs tab), PipelinePage (LogPanel) |
| search | `GET /api/search?q=` | `useSearch(q)` (debounced) | Search, CommandPalette |
| voices | `GET/POST/DELETE /api/voices` | `useVoices`, `useCreateVoice`, `useDeleteVoice` | Voices, PipelineConfigForm (selector) |
| telegram | `GET/PUT /api/telegram`, `POST /api/telegram/test` | `useTelegram`, `useUpdateTelegram`, `useTestTelegram` | Telegram |

---

## 3. Fases ordenadas

Cada fase declara: **objetivo · archivos crear/modificar/borrar · criterios de aceptación verificables · dependencias · riesgos · complejidad**.

### Fase 0 — Foundation  (complejidad: L)

**Objetivo**: rama lista, build pasa con Tailwind v4 + tokens + shadcn init + providers globales + MSW armado. Aún no hay UI nueva visible.

**Crear**:
- `src/styles/globals.css` con `@import "tailwindcss"` + `@theme` + tokens `:root` y `.dark` (copiar §2.2 del arch doc literal).
- `src/lib/cn.js` (`cn = (...args) => twMerge(clsx(args))`).
- `src/lib/queryClient.js` (`createQueryClient()` con defaults §6.2 del arch doc).
- `src/lib/httpClient.js` (`fetch` wrapper: base `''`, `JSON.parse`, error normalizer → `HttpError {status, body, message}`).
- `src/lib/sse.js` (`subscribeSSE(url, onMessage, onError) → unsubscribe`, basado en `EventSource`).
- `src/lib/format.js` (`formatDuration`, `formatBytes`, `relativeTime` con `date-fns`).
- `src/app/providers.jsx` (`<QueryClientProvider>` + `<ThemeProvider>` (atributo `class` en `<html>`) + `<TooltipProvider>` + `<Toaster richColors position="bottom-right">` (sonner) + Devtools en dev).
- `src/app/main.jsx` (mover desde `src/main.jsx`, importa `globals.css` y `<Providers>`).
- `src/test/setup.js` (jest-dom, MSW server lifecycle).
- `src/test/msw/server.js` (`setupServer(...handlers)`).
- `src/test/msw/handlers.js` (handlers vacíos por dominio: `library`, `pipeline`, `oracle`, `metrics`, `jobs`, `settings`, `cleanup`, `duplicates`, `logs`, `search`, `voices`, `telegram`, `preflight`).
- `src/components/ui/.gitkeep` (carpeta destino del CLI shadcn).
- `components.json` (config shadcn: estilo `default`, RSC `false`, alias `@/components` `@/lib/utils`).
- `jsconfig.json` con `compilerOptions.paths` `{"@/*": ["src/*"]}`.
- `vite.config.js` (modificar): añadir `@tailwindcss/vite` plugin, alias `@`, proxy `/api` y `/events` (con `ws: true`/`changeOrigin`) hacia `http://localhost:8000`.

**Modificar**:
- `package.json`: añadir deps (`@tailwindcss/vite@^4`, `tailwindcss@^4`, `@tanstack/react-query@^5`, `@tanstack/react-query-devtools@^5`, `@tanstack/react-table@^8`, `@tanstack/react-virtual`, `framer-motion@^11`, `sonner@^1.5`, `cmdk@^1`, `class-variance-authority`, `react-hook-form`, `zod`, `@hookform/resolvers`, `recharts@^2.12`, `date-fns@^3`, `msw@^2`, `@tanstack/react-query` test utils). Quitar `autoprefixer`, `postcss`, `tailwindcss@3`.
- `index.html`: añadir clase `dark` por defecto en `<html>`.
- `src/main.jsx`: convertir en re-export de `src/app/main.jsx` o mover importadores.
- `Dockerfile`: verificar que sigue válido (build context cambia poco — solo se elimina `postcss.config.js`).

**Borrar**:
- `tailwind.config.js`
- `postcss.config.js`

**shadcn CLI init** (ejecutar en host):
```bash
npx shadcn@latest init -d
npx shadcn@latest add button card dialog sheet tabs input select badge tooltip command scroll-area dropdown-menu accordion table progress skeleton alert separator label form checkbox toggle-group hover-card alert-dialog sidebar breadcrumb popover textarea
```

**Criterios de aceptación**:
- `npm install` ok.
- `npm run build` produce `dist/` sin warnings de Tailwind v4.
- `npm run dev` arranca en `:3000`, fondo dark zinc-950, fuente Inter cargada.
- `npm test` corre `setup.js` y reporta 0 tests (los viejos están borrados al arrancar la fase 5; aquí los tests viejos pueden seguir corriendo y rompiendo — **se acepta**, se barren en Fase 5).
- `<Toaster />` renderiza (test rápido manual: `toast('hola')` desde consola).
- Devtools de TanStack visibles solo en dev.

**Dependencias**: ninguna (primera).

**Riesgos**: el plugin Vite de Tailwind v4 puede chocar con `@vitejs/plugin-react@^4`. Mitigación: si rompe, anclar `tailwindcss@^4.0.0` exact y revisar issue tracker.

---

### Fase 1 — AppShell  (complejidad: M)

**Objetivo**: layout global navegable: sidebar colapsable, topbar con breadcrumbs, ⌘K command palette funcional (al menos navegación + toggle theme), theme toggle, status pill backends. Páginas viejas siguen accesibles vía rutas legacy temporales.

**Crear**:
- `src/components/layout/AppShell.jsx`
- `src/components/layout/Sidebar.jsx` (basado en shadcn `sidebar` block; secciones del §4.2 del arch).
- `src/components/layout/Topbar.jsx` (slot breadcrumbs + ⌘K trigger + theme toggle + status pill).
- `src/components/layout/Breadcrumbs.jsx` (alimentado por router via `useMatches`).
- `src/components/layout/CommandPalette.jsx` (`<CommandDialog>` con secciones Navegación + Acciones + Theme. La sección Instruccionales y Búsqueda full-text se rellenan en Fase 3 cuando existan los hooks).
- `src/components/layout/ThemeToggle.jsx`.
- `src/components/layout/BackendsStatusPill.jsx` (consume `/api/preflight` o `/api/metrics/`; placeholder OK si hook aún no existe — usar fetch directo y migrar en Fase 2).
- `src/stores/useUiStore.js` (zustand: `sidebarCollapsed`, `theme`, `commandOpen`, persistidos en `localStorage` con `zustand/middleware`).
- `src/hooks/useHotkey.js` (registra `Ctrl/Cmd+K` y otros).
- `src/app/router.jsx` (router con `createBrowserRouter`, lazy pages, `<AppShell>` como layout, rutas placeholder a páginas viejas mientras se migran).

**Modificar**:
- `src/App.jsx` → reduce a `<RouterProvider router={router}/>` (envuelto por `<Providers>` desde `main.jsx`). **WIRE_APPSHELL** marker en commit message.

**Borrar**: ninguno todavía.

**Criterios de aceptación**:
- Navegación entre rutas funciona; sidebar colapsa/expande y persiste.
- `Ctrl+K` abre la palette; "Toggle theme" cambia clase `dark` en `<html>` y persiste.
- Breadcrumbs muestran la ruta actual.
- Status pill muestra estado (verde si processor-api responde, rojo si no).
- 0 errores en consola del browser.
- Tests AppShell mínimos: `Sidebar` colapsa, `CommandPalette` abre con hotkey, `Topbar` renderiza breadcrumbs (3 tests, MSW para preflight).

**Dependencias**: Fase 0.

**Riesgos**: shadcn `sidebar` block recientemente rediseñado (v0.x). Si la API cambia, fijar versión del comando `add`.

---

### Fase 2 — Data layer  (complejidad: L)

**Objetivo**: todos los hooks TanStack Query existen, devuelven datos reales (validados contra processor-api en dev) y MSW handlers cubren los happy paths. Las páginas viejas siguen vivas pero **no se modifican** — los hooks aún no son consumidos por nadie excepto tests y status pill.

**Crear**:
- `src/features/library/api/library.js` + `src/features/library/hooks/{useLibrary,useInstructional,useScanLibrary,useUpdateMeta,useUploadPoster,useRenameChapter}.js`
- `src/features/pipeline/api/pipeline.js` + hooks `usePipelines`, `usePipeline`, `useRunPipeline`, `useCancelPipeline`, `useRetryPipeline`, `usePipelineEta`, `usePipelineEvents` (SSE → setQueryData).
- `src/features/oracle/api/oracle.js` + hooks `useOracleProviders`, `useOracleMeta`, `useOracleResolve`, `useOracleScrape`, `useSaveOracleMeta`, `useDeleteOracleMeta`.
- `src/features/dashboard/hooks/{useMetrics,usePreflight,useJobs}.js`
- `src/features/cleanup/api/cleanup.js` + hooks (scan, apply, job).
- `src/features/duplicates/api/duplicates.js` + hooks (scan, job).
- `src/features/logs/hooks/useLogs.js` (con polling adaptativo + pause-on-scroll handler exportado).
- `src/features/search/hooks/useSearch.js` (debounce 300 ms con `useDeferredValue` + `keepPreviousData`).
- `src/features/voices/api/voices.js` + hooks.
- `src/features/settings/api/settings.js` + hooks.
- `src/features/telegram/api/telegram.js` + hooks.
- Cada `api/*.js` exporta un objeto `*Keys` (jerárquico, §6.1 del arch).
- Para cada hook: archivo de test `*.test.js` con MSW (al menos happy + error 5xx).
- `src/test/msw/handlers.js`: rellenar handlers reales por dominio.

**Modificar**:
- `src/components/layout/BackendsStatusPill.jsx` → migrar a `usePreflight`.

**Borrar**: ninguno (la limpieza llega en Fase 4).

**Criterios de aceptación**:
- Cada hook tiene al menos 2 tests (success + error) con MSW.
- `useRenameChapter` aplica optimistic + rollback (test específico).
- `usePipelineEvents` parsea SSE y muta cache (test con MSW SSE mock).
- `useMetrics` no hace polling cuando la pestaña no es visible (test con `document.visibilityState`).
- Smoke en dev: en una página debug, `useLibrary()` devuelve la biblioteca real.

**Dependencias**: Fase 0 (queryClient, httpClient, sse). Fase 1 NO necesaria (puede ir paralelo a Fase 1 si el implementador prefiere, ver §5).

**Riesgos**: SSE con MSW requiere mock manual (MSW no soporta SSE nativo). Implementar `mockEventSource` global en `setup.js` para los tests de SSE.

---

### Fase 3 — Páginas en orden de valor  (complejidad: XL — total)

Cada sub-fase es **una unidad atómica que el implementador puede abrir, ejecutar, verificar y commitear**. Cada una sigue el mismo patrón:

- Crear `src/features/<dominio>/pages/<Name>Page.jsx` + componentes en `src/features/<dominio>/components/`.
- Consumir hooks de Fase 2.
- Registrar ruta nueva en `src/app/router.jsx` (**WIRE_ROUTE_<NOMBRE>** marker — no editar `router.jsx` desde subagentes paralelos; dejar el wiring para una pasada serial).
- Añadir nav item en `Sidebar.jsx` (**WIRE_NAV_<NOMBRE>** marker — mismo motivo).
- Tests: re-escribir los tests viejos del dominio (los que existen en `pages/*.test.jsx`) contra el nuevo árbol con MSW.
- Borrar el archivo viejo `src/pages/<Name>.jsx` + `src/pages/<Name>.test.jsx` + componentes asociados en `src/components/<dominio>/`.

Orden por valor (entrega visible incremental):

#### 3.1 Library  (M)
- Crear `LibraryPage.jsx` + `LibraryGrid`, `PosterCard`, `LibraryFilters`, `PosterBadges`. Filtros via `useLibraryFiltersStore` (zustand).
- Virtualización (`@tanstack/react-virtual`) si `items.length > 200`.
- AC: grid renderiza pósters reales del NAS, hover overlay funciona, filtros persisten, ContextMenu derecho con acciones.
- Borrar: `src/pages/LibraryPage.jsx`, `LibraryPage.test.jsx`, `src/components/library/*` viejos.

#### 3.2 LibraryDetail  (L)
- Crear `LibraryDetailPage.jsx` + `SeasonList`, `ChapterRow` (rename inline), `MetadataEditor` (rhf+zod), `OracleTab`, `LogsTab`, `PipelineTab`.
- Tabs: Capítulos / Pipeline / Metadatos / Logs / Oracle.
- AC: editar nombre capítulo aplica optimistic, rollback en error; subir póster funciona; tabs deeplinkables `?tab=metadatos`.
- Borrar `src/pages/LibraryDetail.jsx` (+test).

#### 3.3 PipelinePage  (L)
- Crear `PipelinePage.jsx` + `PipelineTimeline` (framer-motion), `LogPanel` (SSE), `PreflightBanner`, `StepSelector`, `PipelineConfigForm`, `StepDiff`.
- AC: pipeline corriendo muestra timeline animada, logs en vivo via SSE; cancel/retry funcionan; ETA visible.
- Borrar `src/pages/PipelinePage.jsx` (+test) y `src/components/pipeline/*` viejos.

#### 3.4 PipelinesList  (S)
- Crear `PipelinesListPage.jsx` con TanStack Table.
- AC: lista paginada, filtro por estado, acciones inline cancel/retry, link a detalle.
- Borrar `src/pages/PipelinesPage.jsx` (+test).

#### 3.5 Dashboard  (M)
- Crear `DashboardPage.jsx` con bento layout: `GpuCard`, `RamCard`, `DiskCard`, `JobsFeed`, `RecentPipelines`, `ServicesHealthGrid`.
- Recharts sparklines (shadcn Chart wrapper).
- AC: métricas auto-refresh 5s solo si visible; jobs activos muestran progreso; click navega a la página correspondiente.
- Borrar `src/pages/Dashboard.jsx` y `src/components/dashboard/*` viejos.

#### 3.6 Search  (S)
- Crear `SearchPage.jsx` con input debounced, results agrupados por instructional (Accordion), highlights.
- Conectar también con CommandPalette (sección 4 del §4.4).
- AC: debounce 300ms, click en hit navega al capítulo con `?t=NN`.
- Borrar `src/pages/SearchPage.jsx` (+test).

#### 3.7 Cleanup  (S)
- Crear `CleanupPage.jsx` con secciones Card por tipo (orphan SRT, dub obsoleto, temp, dirs vacíos), Checkbox selección, AlertDialog confirm.
- AC: dry-run preview, apply confirmado, polling del job background.
- Borrar `src/pages/CleanupPage.jsx` (+test).

#### 3.8 Duplicates  (S)
- Crear `DuplicatesPage.jsx` con TanStack Table grupos, ToggleGroup fast/deep, reuso del endpoint cleanup para borrar.
- AC: grupos expandibles, deep mode disponible, borrado funciona.
- Borrar `src/pages/DuplicatesPage.jsx` (+test).

#### 3.9 Logs  (S)
- Crear `LogsPage.jsx` con Select servicio + Select nivel, ScrollArea mono, Tabs por servicio, pause on scroll-up.
- AC: poll 2s, pausa al hacer scroll arriba, reanuda al volver al fondo.
- Borrar `src/pages/LogsPage.jsx` (+test).

#### 3.10 Voices  (S)
- Crear `VoicesPage.jsx` con grid Card de perfiles, Dialog crear, audio sample.
- AC: CRUD perfiles, sample reproduce.
- Borrar `src/pages/VoicesPage.jsx`.

#### 3.11 Settings  (S)
- Crear `SettingsPage.jsx` con Tabs Library / Processing / Advanced, rhf+zod, Save sticky con dirty warning.
- AC: guardar invalida `libraryKeys.all`, dirty bloquea navegación con Dialog.
- Borrar `src/pages/SettingsPage.jsx`.

#### 3.12 Providers  (S)
- Crear `ProvidersPage.jsx` con Table de providers Oracle.
- AC: muestra `id`, `display_name`, `domains`, status.
- Borrar `src/pages/ProvidersPage.jsx`.

#### 3.13 InstructionalOracle  (M)
- Crear `InstructionalOraclePage.jsx`: input URL → resolve → table volumes/chapters editables → procesar.
- También usable como tab embebido en LibraryDetail (Fase 3.2 ya lo importa).
- AC: flujo URL → scrape → editar → guardar → procesar termina con capítulos creados.
- Borrar `src/pages/InstructionalOraclePage.jsx` (+test).

#### 3.14 Telegram  (S, opcional dentro de la fase)
- Crear `TelegramPage.jsx`. Mantener feature.
- AC: configurar + test send.
- Borrar `src/pages/TelegramPage.jsx` (+test).

**Dependencias entre sub-fases**:
- 3.2 depende de 3.1 (PosterCard reutilizado en hero).
- 3.3 puede ir antes o después de 3.2 — usan hooks distintos.
- 3.13 depende de 3.2 si se quiere embeber como tab; standalone va paralelo.
- Resto independientes.

---

### Fase 4 — Limpieza  (complejidad: S)

**Objetivo**: eliminar todo el código viejo, asegurar 0 imports rotos, navegación final consolidada.

**Borrar**:
- `src/api/client.js`, `client.test.js`, `oracleClient.js`, `oracleClient.test.js`, `telegramClient.js`, `telegramClient.test.js`.
- `src/stores/useJobs.js`, `useLibrary.js`, `useOracle.js`, `useSettings.js`, `useTelegram.js` y tests asociados (ya no consumidos — `useUiStore` y `useLibraryFiltersStore` quedan).
- `src/stores/useToasts.js` (+test) — sonner reemplaza.
- `src/hooks/useJobsPolling.js` (+test) — `useJobs` en TanStack lo reemplaza.
- Cualquier carpeta `src/components/<dominio>/` antigua que ya no se importe (validar con grep).
- `src/pages/` entera si está vacía.
- Componente `Toaster` viejo en `src/components/ui/` (si existía pre-shadcn).

**Modificar**:
- `src/app/router.jsx`: ruta final con todas las nuevas páginas (resolver todos los `WIRE_ROUTE_*`).
- `src/components/layout/Sidebar.jsx`: nav final (resolver todos los `WIRE_NAV_*`).
- `README.md` del frontend: cómo correr, cómo añadir un componente shadcn (`npx shadcn@latest add <name>`).

**Criterios de aceptación**:
- `npm run build` pasa sin warnings de imports.
- `grep -r "from '@/pages/" src/` devuelve 0 resultados.
- `grep -r "from '@/api/client'" src/` devuelve 0 resultados.
- Sidebar muestra todas las páginas exactamente una vez.

**Dependencias**: Fase 3 completa.

**Riesgos**: borrar algo aún importado. Mitigación: borrar incremental, ejecutar `npm run build` tras cada borrado.

---

### Fase 5 — Tests  (complejidad: L)

**Objetivo**: paridad funcional con la suite vieja (98 tests). Re-escritura por dominio sobre el nuevo árbol con MSW.

**Tareas**:
- Verificar que cada feature tiene tests de hooks (creados en Fase 2) + tests de página (creados en Fase 3).
- Añadir tests de integración mínimos: AppShell + ruta + hook real (con MSW) por cada página clave (Library, LibraryDetail, PipelinePage).
- Coverage objetivo: ≥ 70% líneas en `src/features/`. **No bloquear merge por count exacto** (el arquitecto lo aceptó).
- Util tests: `cn`, `format`, `sse`, `httpClient`.
- MSW: handlers cubren happy + 1 error path por endpoint.

**Criterios de aceptación**:
- `npm test` pasa.
- Conteo total ≥ 80 tests (paridad razonable).
- 0 tests `.skip`.
- CI-ready: tiempo total < 60 s en local.

**Dependencias**: Fases 2, 3, 4.

**Riesgos**: SSE en MSW requiere mock manual (ver Fase 2). Polling en tests con `vi.useFakeTimers` puede falsear visibility; usar `Object.defineProperty(document, 'visibilityState', ...)`.

---

### Fase 6 — Docker / build  (complejidad: S)

**Objetivo**: la imagen Docker construye, sirve la SPA en `:3000`, healthcheck OK, sin regresiones.

**Tareas**:
- Verificar `npm run build` produce `dist/` (Tailwind v4 puede cambiar layout de assets).
- Revisar `Dockerfile`: si usaba `postcss.config.js`, removerlo del COPY explícito.
- Revisar `nginx.conf`: rutas SPA fallback (`try_files $uri /index.html`) intactas.
- `docker compose build processor-frontend && docker compose up -d processor-frontend`.
- Smoke test E2E manual: scan library → abrir instruccional → procesar pipeline (chapters + subs) → verificar resultados.
- Healthcheck del contenedor responde 200.

**Criterios de aceptación**:
- Imagen construye sin warnings críticos.
- SPA arranca en `http://localhost:3000`.
- Network tab muestra todas las llamadas a `/api/*` 2xx.
- Pipeline E2E completo termina OK contra processor-api real.
- `docker compose ps` muestra `processor-frontend` healthy.

**Dependencias**: Fase 5.

---

## 4. Tabla resumen de fases

| Fase | Nombre | Complejidad | Paralelizable |
|---|---|---|---|
| 0 | Foundation | L | No |
| 1 | AppShell | M | Paralelo con Fase 2 (mismo implementador no, agentes distintos sí — no comparten archivos salvo `App.jsx` que solo Fase 1 toca) |
| 2 | Data layer | L | Paralelo con Fase 1 |
| 3.1 | Library | M | Ver §5 |
| 3.2 | LibraryDetail | L | depende de 3.1 |
| 3.3 | PipelinePage | L | paralelo |
| 3.4 | PipelinesList | S | paralelo |
| 3.5 | Dashboard | M | paralelo |
| 3.6 | Search | S | paralelo |
| 3.7 | Cleanup | S | paralelo |
| 3.8 | Duplicates | S | paralelo |
| 3.9 | Logs | S | paralelo |
| 3.10 | Voices | S | paralelo |
| 3.11 | Settings | S | paralelo |
| 3.12 | Providers | S | paralelo |
| 3.13 | InstructionalOracle | M | paralelo (standalone) |
| 3.14 | Telegram | S | paralelo |
| 4 | Limpieza | S | No (serial, requiere todo lo anterior) |
| 5 | Tests | L | Parcial (por dominio) |
| 6 | Docker/build | S | No |

**Total: 21 fases/sub-fases.**

---

## 5. Paralelización

Regla de oro de `CLAUDE.md`: **NO tocar `App.jsx`, `Layout.jsx`, `Sidebar.jsx`** en agentes paralelos. Cada subagente deja en su reporte líneas `WIRE_ROUTE_<NOMBRE>` y `WIRE_NAV_<NOMBRE>` con la ruta + componente importable, y un agente serial las aplica.

### Agentes paralelos posibles

**Bloque A (tras Fase 0)**: Fase 1 (AppShell) y Fase 2 (Data layer) en dos agentes simultáneos. Único punto de contacto: `BackendsStatusPill` consume `usePreflight` — el agente de Fase 1 lo crea con fetch crudo y el de Fase 2 lo refactoriza al final. Sin conflicto si se commitea por separado.

**Bloque B (tras Fase 1+2)**: las sub-fases de Fase 3 que NO comparten archivos pueden ir en paralelo. Grupos seguros (cada grupo = un agente):

- Grupo P1: 3.1 Library
- Grupo P2: 3.3 PipelinePage + 3.4 PipelinesList (comparten `pipeline/components/*`)
- Grupo P3: 3.5 Dashboard
- Grupo P4: 3.6 Search
- Grupo P5: 3.7 Cleanup + 3.8 Duplicates (comparten patrón de background jobs y endpoint cleanup)
- Grupo P6: 3.9 Logs
- Grupo P7: 3.10 Voices + 3.11 Settings
- Grupo P8: 3.12 Providers + 3.13 InstructionalOracle (comparten `oracle/`)
- Grupo P9: 3.14 Telegram

Tras Bloque B, **agente serial** ejecuta wiring de todos los `WIRE_*` en `router.jsx` + `Sidebar.jsx` y arranca **3.2 LibraryDetail** (que depende de 3.1 + tabs Pipeline/Oracle/Logs ya hechos).

**Fase 4, 5, 6**: serial.

---

## 6. Definition of Done del rediseño

- [ ] Rama `redesign/v3` mergeada a `main` con tag `v3.0.0-frontend`.
- [ ] `npm install && npm run build` pasa sin warnings.
- [ ] `npm test` pasa, ≥ 80 tests, 0 `.skip`.
- [ ] `docker compose build processor-frontend` produce imagen.
- [ ] `docker compose up -d` arranca el stack y `processor-frontend` queda `healthy`.
- [ ] Las 13 páginas funcionan contra `processor-api` real (no MSW): Dashboard, Library, LibraryDetail, PipelinesList, PipelinePage, Search, Cleanup, Duplicates, Logs, Voices, Settings, Providers, InstructionalOracle (+ Telegram opcional).
- [ ] Sidebar lista exactamente esas páginas, agrupadas según §4.2 del arch.
- [ ] CommandPalette `⌘K` abre, navega y togglea theme.
- [ ] Theme toggle persiste; dark default.
- [ ] Pipeline E2E manual completo: scan → abrir instructional → run pipeline (chapters oracle + subs + dub) → resultados visibles en LibraryDetail.
- [ ] `grep -r` no encuentra imports a `src/api/client`, `src/pages/`, `src/stores/use{Library,Jobs,Oracle,Settings,Telegram,Toasts}`, `useJobsPolling`.
- [ ] No quedan `tailwind.config.js`, `postcss.config.js`, `autoprefixer`, `tailwindcss@3` en deps.
- [ ] `README.md` del frontend actualizado.
- [ ] 0 errores en consola del browser en cualquier página.
- [ ] Lighthouse (dev build) ≥ 90 en performance y accessibility (aceptable bajar a 85 en perf por bundle de framer/recharts).

---

## 7. Recomendaciones operativas

- Cada sub-fase = 1 commit. Mensajes prefijados: `feat(redesign/foundation):`, `feat(redesign/library):`, etc.
- Antes de cada commit: `npm run build` debe pasar (excepto Fase 0 mientras shadcn aún no añade componentes).
- Si una fase explota el scope, dividir en sub-commits manteniendo cada commit verde (build pasa).
- Revisión visual rápida tras cada sub-fase de la Fase 3: abrir la página en `npm run dev` y verificar contra arch §5.
- Mantener `docs/redesign-architecture.md` como contrato; si algo cambia, actualizarlo en el mismo commit que lo introduce.

---

Fin del plan.
