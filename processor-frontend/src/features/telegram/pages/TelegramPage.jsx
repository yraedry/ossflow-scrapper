// WIRE_ROUTE_TELEGRAM: /telegram → src/features/telegram/pages/TelegramPage.jsx
//
// Telegram fetcher SPA: connect, browse channels, sync, browse media (chronological
// + by author), edit metadata, queue full-instructional downloads.
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronDown,
  ChevronRight,
  Check,
  Download,
  Film,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  UserCircle2,
  X,
  XCircle,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/Progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatBytes, formatRelativeTime } from '@/lib/format'
import {
  thumbnailUrl,
  useActiveSyncs,
  useAddChannel,
  useCancelDownload,
  useDeleteChannel,
  useLogout,
  useStartDownload,
  useSyncChannel,
  useTelegramChannels,
  useTelegramDownloads,
  useTelegramMedia,
  useTelegramStatus,
  useUpdateChannel,
} from '../api/useTelegram'
import TelegramAuthDialog from '../components/TelegramAuthDialog'
import MetadataEditDialog from '../components/MetadataEditDialog'
import SyncProgressBar from '../components/SyncProgressBar'

const PAGE_SIZE = 20

export default function TelegramPage() {
  const { data: auth, isLoading: authLoading } = useTelegramStatus()
  const isAuth = auth?.state === 'authenticated'

  const [authOpen, setAuthOpen] = useState(false)
  const [editMedia, setEditMedia] = useState(null)
  // Locally-dismissed syncs — we hide these even if the server still reports
  // them (terminal jobs are retained server-side for ~60s so clients that
  // reconnect can see the final state).
  const [dismissedSyncs, setDismissedSyncs] = useState({}) // { [jobId]: true }
  const activeSyncsQ = useActiveSyncs(isAuth)
  // Build the same shape the UI used before: { [username]: { jobId, label } }
  const activeSyncs = useMemo(() => {
    const byUsername = {}
    for (const s of activeSyncsQ.data || []) {
      if (dismissedSyncs[s.job_id]) continue
      byUsername[s.channel] = { jobId: s.job_id, label: s.channel, serverState: s }
    }
    return byUsername
  }, [activeSyncsQ.data, dismissedSyncs])

  const [tab, setTab] = useState('channels')
  const [mediaView, setMediaView] = useState('by_author')
  const [mediaChannel, setMediaChannel] = useState('')
  const [mediaSearch, setMediaSearch] = useState('')
  const [mediaPage, setMediaPage] = useState(1)

  const channelsQ = useTelegramChannels(isAuth)
  const channels = channelsQ.data || []

  const mediaFilters = {
    channel: mediaChannel || undefined,
    view: mediaView,
    search: mediaSearch || undefined,
    page: mediaPage,
    page_size: PAGE_SIZE,
  }
  const mediaQ = useTelegramMedia(mediaFilters, isAuth && tab === 'media')

  const downloadsQ = useTelegramDownloads()
  const downloads = downloadsQ.data || []
  const activeDownloads = downloads.filter((j) =>
    ['queued', 'in_progress', 'running'].includes(j.status),
  )
  const historyDownloads = downloads.filter(
    (j) => !['queued', 'in_progress', 'running'].includes(j.status),
  )

  const syncMut = useSyncChannel()
  const startDownload = useStartDownload()
  const cancelDownload = useCancelDownload()
  const logoutMut = useLogout()
  const addChannelMut = useAddChannel()
  const updateChannelMut = useUpdateChannel()
  const deleteChannelMut = useDeleteChannel()

  const [newChannelUsername, setNewChannelUsername] = useState('')

  const handleAddChannel = async (e) => {
    e?.preventDefault?.()
    const username = newChannelUsername.trim()
    if (!username) return
    try {
      const ch = await addChannelMut.mutateAsync({ username })
      toast.success(`Canal añadido: ${ch?.title || username}`)
      setNewChannelUsername('')
    } catch (err) {
      const msg = err?.data?.detail || err?.message || 'No se pudo añadir el canal'
      toast.error(msg)
    }
  }

  const handleDeleteChannel = async (ch) => {
    const name = ch.title || ch.username
    if (!window.confirm(`¿Borrar canal "${name}"? Se eliminarán todos los medios cacheados.`)) return
    try {
      await deleteChannelMut.mutateAsync({ channel_id: ch.channel_id })
      toast.success(`Canal borrado: ${name}`)
    } catch (err) {
      toast.error(err?.data?.detail || err?.message || 'No se pudo borrar el canal')
    }
  }

  const handleRenameChannel = async (ch, title) => {
    const next = (title || '').trim()
    if (!next || next === ch.title) return false
    try {
      await updateChannelMut.mutateAsync({ channel_id: ch.channel_id, title: next })
      toast.success('Canal actualizado')
      return true
    } catch (err) {
      toast.error(err?.data?.detail || err?.message || 'No se pudo actualizar')
      return false
    }
  }

  const handleSync = async (channel) => {
    const username = channel.username || channel.id || channel.channel_id
    try {
      await syncMut.mutateAsync({ username })
      // activeSyncs is server-authoritative; the query will pick it up.
    } catch (e) {
      toast.error(e?.message || 'No se pudo iniciar la sincronización')
    }
  }

  const dismissSync = (username) => {
    const sync = activeSyncs[username]
    if (!sync) return
    setDismissedSyncs((s) => ({ ...s, [sync.jobId]: true }))
  }

  const handleDownload = async ({ channel_id, author, title }) => {
    try {
      await startDownload.mutateAsync({ channel_id, author, title })
      toast.success(`Descarga encolada: ${author} — ${title}`)
      setTab('downloads')
    } catch (e) {
      toast.error(e?.message || 'No se pudo encolar la descarga')
    }
  }

  const totalPages = useMemo(() => {
    if (mediaView !== 'chronological' || !mediaQ.data) return 1
    return Math.max(1, Math.ceil((mediaQ.data.total || 0) / PAGE_SIZE))
  }, [mediaQ.data, mediaView])

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10">
            <Send className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Telegram</h1>
            <p className="text-xs text-muted-foreground">
              {authLoading
                ? 'Comprobando sesión…'
                : isAuth
                ? 'Sesión activa'
                : 'Desconectado — conecta tu cuenta para empezar'}
            </p>
          </div>
        </div>

        {isAuth ? (
          <Card className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
              <UserCircle2 className="h-5 w-5 text-amber-500" />
            </div>
            <div className="leading-tight">
              <p className="font-mono text-sm font-semibold">
                {auth?.me_username ? `@${auth.me_username}` : auth?.phone || 'usuario'}
              </p>
              <Badge variant="secondary" className="mt-0.5 h-4 text-[10px]">
                online
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMut.mutate()}
              disabled={logoutMut.isPending}
              className="ml-2"
            >
              <LogOut className="h-3.5 w-3.5" /> Desconectar
            </Button>
          </Card>
        ) : (
          <Button onClick={() => setAuthOpen(true)}>
            <LogIn className="h-4 w-4" /> Conectar Telegram
          </Button>
        )}
      </header>

      {!isAuth && !authLoading && (
        <Card className="p-8 text-center">
          <Send className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="mb-1 text-lg font-semibold">
            Conecta tu cuenta de Telegram para empezar
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Necesitas haber configurado <span className="font-mono">API_ID</span> y{' '}
            <span className="font-mono">API_HASH</span> en el backend.
          </p>
          <Button onClick={() => setAuthOpen(true)}>
            <LogIn className="h-4 w-4" /> Conectar Telegram
          </Button>
        </Card>
      )}

      {isAuth && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="channels">Canales</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="downloads">
              Descargas
              {activeDownloads.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-4 text-[10px]">
                  {activeDownloads.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="channels" className="mt-4 space-y-3">
            <Card className="p-4">
              <form onSubmit={handleAddChannel} className="flex flex-wrap items-center gap-2">
                <div className="flex flex-1 items-center gap-2 min-w-[220px]">
                  <span className="font-mono text-sm text-muted-foreground">@</span>
                  <Input
                    placeholder="username o t.me/username"
                    value={newChannelUsername}
                    onChange={(e) => setNewChannelUsername(e.target.value)}
                    disabled={addChannelMut.isPending}
                  />
                </div>
                <Button type="submit" size="sm" disabled={addChannelMut.isPending || !newChannelUsername.trim()}>
                  {addChannelMut.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Añadir canal
                </Button>
              </form>
              <p className="mt-2 text-xs text-muted-foreground">
                Se validará contra Telegram antes de guardarlo.
              </p>
            </Card>

            {channelsQ.isLoading ? (
              <ChannelSkeletons />
            ) : channels.length === 0 ? (
              <EmptyState message="No hay canales configurados — añade uno arriba" />
            ) : (
              channels.map((ch) => {
                const username = ch.username || ch.id || ch.channel_id
                const sync = activeSyncs[username]
                return (
                  <ChannelRow
                    key={ch.channel_id || username}
                    channel={ch}
                    username={username}
                    sync={sync}
                    syncPending={syncMut.isPending}
                    deletePending={deleteChannelMut.isPending}
                    renamePending={updateChannelMut.isPending}
                    onSync={() => handleSync(ch)}
                    onDismissSync={() => dismissSync(username)}
                    onDelete={() => handleDeleteChannel(ch)}
                    onRename={(title) => handleRenameChannel(ch, title)}
                  />
                )
              })
            )}
          </TabsContent>

          <TabsContent value="media" className="mt-4 space-y-4">
            <Card className="flex flex-wrap items-center gap-3 p-3">
              <div className="flex gap-1 rounded-md border bg-muted p-1">
                {[
                  { id: 'chronological', label: 'Cronológico' },
                  { id: 'by_author', label: 'Por autor' },
                ].map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setMediaView(v.id)
                      setMediaPage(1)
                    }}
                    className={`rounded px-3 py-1.5 text-xs ${
                      mediaView === v.id
                        ? 'bg-amber-500/15 text-amber-500'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <Select
                value={mediaChannel || 'all'}
                onValueChange={(v) => {
                  setMediaChannel(v === 'all' ? '' : v)
                  setMediaPage(1)
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todos los canales" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los canales</SelectItem>
                  {channels.map((c) => (
                    <SelectItem key={c.id || c.username} value={String(c.id || c.username)}>
                      {c.title || c.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-1 items-center gap-2 min-w-[200px]">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar…"
                  value={mediaSearch}
                  onChange={(e) => {
                    setMediaSearch(e.target.value)
                    setMediaPage(1)
                  }}
                />
              </div>
            </Card>

            {mediaQ.isLoading ? (
              <MediaSkeletons />
            ) : mediaView === 'chronological' ? (
              <ChronologicalView
                items={mediaQ.data?.items || []}
                page={mediaPage}
                totalPages={totalPages}
                total={mediaQ.data?.total || 0}
                setPage={setMediaPage}
                onEdit={setEditMedia}
              />
            ) : (
              <ByAuthorView
                authors={mediaQ.data?.authors || []}
                onDownload={handleDownload}
                disableDownload={activeDownloads.length > 0}
              />
            )}
          </TabsContent>

          <TabsContent value="downloads" className="mt-4 space-y-6">
            <section>
              <h2 className="mb-2 text-sm font-semibold">Activas</h2>
              {activeDownloads.length === 0 ? (
                <EmptyState message="Sin descargas activas" />
              ) : (
                <div className="space-y-3">
                  {activeDownloads.map((j) => (
                    <DownloadRow
                      key={j.id}
                      job={j}
                      onCancel={() => cancelDownload.mutate({ jobId: j.id })}
                    />
                  ))}
                </div>
              )}
            </section>
            <section>
              <h2 className="mb-2 text-sm font-semibold">Histórico</h2>
              {historyDownloads.length === 0 ? (
                <EmptyState message="Sin histórico" />
              ) : (
                <div className="space-y-2">
                  {historyDownloads.map((j) => (
                    <DownloadRow key={j.id} job={j} history />
                  ))}
                </div>
              )}
            </section>
          </TabsContent>
        </Tabs>
      )}

      <TelegramAuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      <MetadataEditDialog
        media={editMedia}
        open={!!editMedia}
        onOpenChange={(v) => !v && setEditMedia(null)}
      />
    </div>
  )
}

function ChannelRow({
  channel,
  username,
  sync,
  syncPending,
  deletePending,
  renamePending,
  onSync,
  onDismissSync,
  onDelete,
  onRename,
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(channel.title || username)

  const startEdit = () => {
    setDraft(channel.title || username)
    setEditing(true)
  }
  const cancelEdit = () => setEditing(false)
  const saveEdit = async () => {
    const ok = await onRename(draft)
    if (ok !== false) setEditing(false)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="flex flex-wrap items-start justify-between gap-4 p-4">
        <div className="min-w-[220px] flex-1">
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit()
                  if (e.key === 'Escape') cancelEdit()
                }}
                disabled={renamePending}
                className="h-8 max-w-sm"
              />
              <Button size="sm" variant="ghost" onClick={saveEdit} disabled={renamePending}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={renamePending}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{channel.title || username}</h3>
              <Button size="sm" variant="ghost" onClick={startEdit} className="h-6 w-6 p-0">
                <Pencil className="h-3 w-3" />
              </Button>
              {channel.noforwards && (
                <Badge
                  variant="destructive"
                  className="flex items-center gap-1"
                  title="Canal con protección de contenido activada: Telegram impide la descarga de sus vídeos vía API. Solo podrás verlos dentro de la app de Telegram."
                >
                  <ShieldAlert className="h-3 w-3" />
                  Protegido
                </Badge>
              )}
            </div>
          )}
          <p className="font-mono text-xs text-muted-foreground">@{username}</p>
          {channel.noforwards && (
            <p className="mt-1 text-xs text-destructive">
              Este canal restringe la descarga de medios. No podrán obtenerse los vídeos.
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Última sync: {channel.last_sync_at ? formatRelativeTime(channel.last_sync_at) : '—'} ·{' '}
            {channel.media_count ?? 0} media cacheados
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {sync && (
            <SyncProgressBar
              username={username}
              jobId={sync.jobId}
              channelLabel={sync.label}
              initialState={sync.serverState}
              onDismiss={onDismissSync}
            />
          )}
          <Button size="sm" variant="outline" onClick={onSync} disabled={!!sync || syncPending}>
            {sync ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Sincronizar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            disabled={deletePending}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Borrar
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}

function ChannelSkeletons() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  )
}

function MediaSkeletons() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <Card className="p-6 text-center text-sm text-muted-foreground">{message}</Card>
  )
}

function ChronologicalView({ items, page, totalPages, total, setPage, onEdit }) {
  if (!items.length) return <EmptyState message="Sin media" />
  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="w-12 px-3 py-2 text-left"></th>
            <th className="px-3 py-2 text-left">Archivo</th>
            <th className="px-3 py-2 text-left">Autor</th>
            <th className="px-3 py-2 text-left">Título</th>
            <th className="w-16 px-3 py-2 text-left">Cap</th>
            <th className="w-24 px-3 py-2 text-left">Tamaño</th>
            <th className="w-28 px-3 py-2 text-left">Fecha</th>
            <th className="w-24 px-3 py-2 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => {
            const parserFailed = !m.author || !m.title || m.chapter_num == null
            const thumb = thumbnailUrl(m)
            return (
              <tr
                key={`${m.channel_id}-${m.message_id}`}
                className="border-t hover:bg-muted/30"
              >
                <td className="px-3 py-2">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded border bg-muted">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <Film className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </td>
                <td className="max-w-[240px] truncate px-3 py-2 font-mono text-xs">
                  {m.filename || m.caption}
                </td>
                <td className="px-3 py-2">
                  {m.author || <span className="text-xs text-destructive">—</span>}
                </td>
                <td className="max-w-[200px] truncate px-3 py-2">
                  {m.title || <span className="text-xs text-destructive">—</span>}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{m.chapter_num ?? '—'}</td>
                <td className="px-3 py-2 text-xs">{formatBytes(m.size_bytes)}</td>
                <td className="px-3 py-2 text-xs">{m.date ? formatRelativeTime(m.date) : '—'}</td>
                <td className="px-3 py-2 text-right">
                  <Button
                    size="sm"
                    variant={parserFailed ? 'destructive' : 'ghost'}
                    onClick={() => onEdit(m)}
                  >
                    <Pencil className="h-3 w-3" /> Editar
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 border-t p-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
          >
            Anteriores
          </Button>
          <span className="font-mono text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{page}</span> / {totalPages} ·{' '}
            {total} total
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
          >
            Siguientes
          </Button>
        </div>
      )}
    </Card>
  )
}

function ByAuthorView({ authors, onDownload, disableDownload }) {
  const [expanded, setExpanded] = useState({})
  if (!authors.length) return <EmptyState message="Sin autores detectados" />
  return (
    <div className="space-y-2">
      {authors.map((a) => {
        const open = expanded[a.name]
        const totalCh = (a.instructionals || []).reduce(
          (acc, i) => acc + (i.chapter_count || i.chapters || 0),
          0,
        )
        return (
          <Card key={a.name} className="overflow-hidden">
            <button
              onClick={() => setExpanded((s) => ({ ...s, [a.name]: !s[a.name] }))}
              className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/40"
            >
              <div className="flex items-center gap-2">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <div>
                  <h3 className="font-semibold">{a.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {(a.instructionals || []).length} instructionals · {totalCh} capítulos
                  </p>
                </div>
              </div>
            </button>
            {open && (
              <div className="space-y-2 border-t p-4">
                {(a.instructionals || []).map((ins) => {
                  const chapters = ins.chapter_count || ins.chapters || 0
                  return (
                    <div
                      key={`${a.name}-${ins.title}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted">
                          {ins.thumbnail_url ? (
                            <img
                              src={thumbnailUrl({
                                thumbnail_url: ins.thumbnail_url,
                                channel_id: ins.first_channel_id,
                                message_id: ins.first_message_id,
                              })}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          ) : (
                            <Film className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-medium">{ins.title}</h4>
                          <p className="text-xs text-muted-foreground">
                            {chapters} capítulos · {formatBytes(ins.total_size_bytes)}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() =>
                          onDownload({
                            channel_id:
                              ins.first_channel_id || ins.channel_id || a.channel_id,
                            author: a.name,
                            title: ins.title,
                          })
                        }
                        disabled={disableDownload || ins.available === false}
                      >
                        <Download className="h-3.5 w-3.5" /> Descargar todo
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

function DownloadRow({ job, onCancel, history }) {
  const overall = Math.round(job.overall_pct || job.progress || 0)
  const current = Math.round(job.current_pct || 0)
  const variant = {
    done: 'secondary',
    failed: 'destructive',
    cancelled: 'outline',
    running: 'default',
    in_progress: 'default',
    queued: 'outline',
  }[job.status] || 'outline'

  return (
    <Card className="p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-medium">
            {job.author} — {job.title}
          </h4>
          <div className="mt-0.5 flex items-center gap-2">
            <Badge variant={variant} className="h-4 text-[10px]">
              {({ done: 'completado', failed: 'fallido', cancelled: 'cancelado', running: 'ejecutando', in_progress: 'en curso', queued: 'en cola' })[job.status] || job.status}
            </Badge>
            {job.total ? (
              <span className="font-mono text-[11px] text-muted-foreground">
                {job.current_index || 0}/{job.total} archivos
              </span>
            ) : null}
          </div>
          {job.error && <p className="mt-1 text-xs text-destructive">{job.error}</p>}
        </div>
        {!history && onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            <XCircle className="h-3 w-3" /> Cancelar
          </Button>
        )}
      </div>
      {!history && (
        <>
          <Progress value={Math.min(100, overall)} />
          {(job.status === 'in_progress' || job.status === 'running') && (
            <div className="mt-1 flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>archivo: {current}%</span>
              <span>total: {overall}%</span>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
