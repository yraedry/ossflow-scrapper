// WIRE_ROUTE_SETTINGS: /settings → src/features/settings/pages/SettingsPage.jsx
import { useState, useMemo, useEffect } from 'react'
import {
  FolderOpen,
  Folder,
  ChevronRight,
  ChevronLeft,
  Cog,
  Sparkles,
  Palette,
  Shield,
  Send,
  Eye,
  EyeOff,
  Loader2,
  Save,
  CheckCircle2,
  XCircle,
  Download,
  Upload,
  RotateCcw,
  HardDrive,
  Plug,
  Wrench,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/Badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTheme } from '@/components/theme-provider'
import { useSettings, useUpdateSettings } from '@/features/settings/api/useSettings'
import { useMount, useMountStatus } from '@/features/settings/api/useMount'
import { useProviders } from '@/features/oracle/api/useOracle'
import { http } from '@/lib/httpClient'

// --- Zod schemas per section ---
const librarySchema = z.object({
  library_path: z.string().trim(),
})

const mountSchema = z.object({
  share: z.string().trim().min(1, 'Requerido'),
  username: z.string().trim().optional(),
  password: z.string().optional(),
})

const processingSchema = z.object({
  voice_profile_default: z.string().optional().nullable(),
  output_dir: z.string().optional(),
  source_lang: z.string().min(2).max(8).default('en'),
  target_lang: z.string().min(2).max(8).default('es'),
})

const oracleSchema = z.object({
  provider_default: z.string().optional(),
  timeout_seconds: z.coerce.number().int().min(5).max(300).default(30),
})

const telegramSchema = z.object({
  telegram_api_id: z
    .union([z.string().length(0), z.coerce.number().int().positive()])
    .optional(),
  telegram_api_hash: z
    .string()
    .optional()
    .refine((v) => !v || /^[a-f0-9]{32}$/.test(v), {
      message: 'Debe ser 32 caracteres hex (a-f, 0-9)',
    }),
})

const translationSchema = z.object({
  translation_provider: z.enum(['openai', 'deepl']).default('openai'),
  translation_model: z.string().optional(),
  translation_fallback_provider: z.enum(['', 'openai', 'deepl']).optional(),
  openai_api_key: z.string().optional(),
  deepl_api_key: z.string().optional(),
})

const SECTIONS = [
  { id: 'library', label: 'Biblioteca', icon: FolderOpen },
  { id: 'processing', label: 'Procesamiento', icon: Cog },
  { id: 'oracle', label: 'Oracle', icon: Sparkles },
  { id: 'telegram', label: 'Telegram', icon: Send },
  { id: 'translation', label: 'Traducción', icon: Plug },
  { id: 'authors', label: 'Alias autores', icon: Sparkles },
  { id: 'appearance', label: 'Apariencia', icon: Palette },
  { id: 'maintenance', label: 'Mantenimiento', icon: Wrench },
  { id: 'advanced', label: 'Avanzado', icon: Shield },
]

export default function SettingsPage() {
  const [active, setActive] = useState('library')
  const { data: settings, isLoading } = useSettings()

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Ajustes globales de la plataforma de procesamiento.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        {/* Vertical nav */}
        <nav aria-label="Secciones de configuración" className="md:sticky md:top-4 self-start">
          <ul className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {SECTIONS.map((s) => {
              const Icon = s.icon
              const isActive = active === s.id
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setActive(s.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary border border-primary/30'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Icon size={14} />
                    {s.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Content */}
        <div className="min-w-0 space-y-4">
          {isLoading && !settings ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                <Loader2 className="inline-block animate-spin mr-2" size={14} />
                Cargando…
              </CardContent>
            </Card>
          ) : (
            <>
              {active === 'library' && <LibrarySection settings={settings} />}
              {active === 'processing' && <ProcessingSection settings={settings} />}
              {active === 'oracle' && <OracleSection settings={settings} />}
              {active === 'telegram' && <TelegramSection settings={settings} />}
              {active === 'translation' && <TranslationSection settings={settings} />}
              {active === 'authors' && <AuthorAliasesSection settings={settings} />}
              {active === 'appearance' && <AppearanceSection />}
              {active === 'maintenance' && <MaintenanceSection />}
              {active === 'advanced' && <AdvancedSection settings={settings} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Sections ---

function LibrarySection({ settings }) {
  const updateMut = useUpdateSettings()
  const [selected, setSelected] = useState(settings?.library_path || '')
  const initial = settings?.library_path || ''
  const isDirty = selected !== initial

  const onSave = async () => {
    try {
      await updateMut.mutateAsync({ library_path: selected })
      toast.success('Biblioteca guardada')
    } catch (e) {
      toast.error(e?.message || 'Error al guardar')
    }
  }

  return (
    <div className="space-y-4">
      <NasMountCard onMounted={() => setSelected('/media')} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen size={16} className="text-primary" />
            Biblioteca
            {isDirty && (
              <Badge variant="outline" className="ml-2 border-amber-500/40 text-amber-500">
                sin guardar
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Elige la carpeta de instruccionales dentro del volumen montado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Carpeta seleccionada</Label>
            <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/30 font-mono text-sm">
              {selected ? (
                <>
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  <span className="truncate">{selected}</span>
                </>
              ) : (
                <>
                  <XCircle size={14} className="text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Sin seleccionar</span>
                </>
              )}
            </div>
          </div>
          <LibraryPicker value={selected} onChange={setSelected} />
        </CardContent>
        <Separator />
        <div className="flex justify-end gap-2 p-4">
          <Button type="button" onClick={onSave} disabled={!isDirty || !selected || updateMut.isPending}>
            {updateMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar
          </Button>
        </div>
      </Card>
    </div>
  )
}

function LibraryPicker({ value, onChange }) {
  const [cwd, setCwd] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = async (path) => {
    setLoading(true)
    setError(null)
    try {
      const qs = path ? `?path=${encodeURIComponent(path)}` : ''
      const res = await http.get(`/fs/browse${qs}`)
      setData(res)
      setCwd(res.path)
    } catch (e) {
      setError(e?.message || 'Error listando carpetas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load('') }, []) // initial load

  return (
    <div>
      <Label>Explorador</Label>
      <div className="mt-1.5 rounded-md border overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!data?.parent || loading}
            onClick={() => load(data.parent)}
          >
            <ChevronLeft size={14} />
          </Button>
          <code className="text-xs truncate flex-1">{cwd || '…'}</code>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!cwd || loading || value === cwd}
            onClick={() => onChange(cwd)}
          >
            Usar esta carpeta
          </Button>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <Loader2 size={14} className="inline animate-spin mr-2" />
              Cargando…
            </div>
          ) : error ? (
            <div className="py-6 text-center text-sm text-destructive">{error}</div>
          ) : data?.entries?.length ? (
            <ul className="divide-y">
              {data.entries.map((e) => (
                <li key={e.path}>
                  <button
                    type="button"
                    onClick={() => load(e.path)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left"
                  >
                    <Folder size={14} className="text-primary shrink-0" />
                    <span className="truncate flex-1">{e.name}</span>
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Carpeta vacía
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Navega y pulsa <strong>Usar esta carpeta</strong>. Solo se muestra el contenido del volumen
        montado en el contenedor.
      </p>
    </div>
  )
}

function NasMountCard({ onMounted }) {
  const { data: status, isLoading } = useMountStatus()
  const mountMut = useMount()
  const [showPass, setShowPass] = useState(false)
  const form = useForm({
    resolver: zodResolver(mountSchema),
    defaultValues: { share: '', username: '', password: '' },
  })

  const mounted = status?.mounted
  const onSubmit = async (values) => {
    try {
      const payload = {
        share: values.share.trim(),
        username: values.username?.trim() || 'guest',
        password: values.password || '',
      }
      const res = await mountMut.mutateAsync(payload)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success('NAS montado correctamente')
      onMounted?.()
    } catch (e) {
      toast.error(e?.message || 'Error al montar NAS')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive size={16} className="text-primary" />
          Conectar NAS / Unidad de red
          {mounted && (
            <Badge variant="outline" className="ml-2 border-emerald-500/40 text-emerald-500">
              montado
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Monta una carpeta compartida SMB/CIFS en <code>/media</code> para acceder a los instruccionales.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {mounted ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <CheckCircle2 size={14} className="inline -mt-0.5 mr-1 text-emerald-500" />
              NAS montado — {status?.directories ?? 0} carpetas detectadas.
            </p>
            {Array.isArray(status?.items) && status.items.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {status.items.slice(0, 8).map((name) => (
                  <Badge key={name} variant="secondary" className="text-[10px]">{name}</Badge>
                ))}
                {status.items.length > 8 && (
                  <Badge variant="outline" className="text-[10px]">
                    +{status.items.length - 8} más
                  </Badge>
                )}
              </div>
            )}
          </div>
        ) : (
          <form id="nas-mount-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <div>
              <Label htmlFor="nas-share">Ruta del share</Label>
              <Input
                id="nas-share"
                placeholder="//10.10.100.6/multimedia/instruccionales"
                {...form.register('share')}
              />
              {form.formState.errors.share && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.share.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="nas-user">Usuario</Label>
                <Input
                  id="nas-user"
                  placeholder="guest"
                  autoComplete="username"
                  {...form.register('username')}
                />
              </div>
              <div>
                <Label htmlFor="nas-pass">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="nas-pass"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    {...form.register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPass ? 'Ocultar' : 'Mostrar'}
                  >
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </CardContent>
      <Separator />
      <div className="flex justify-end gap-2 p-4">
        {!mounted && (
          <Button
            type="submit"
            form="nas-mount-form"
            disabled={mountMut.isPending || isLoading}
          >
            {mountMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
            {mountMut.isPending ? 'Conectando...' : 'Conectar NAS'}
          </Button>
        )}
      </div>
    </Card>
  )
}

function ProcessingSection({ settings }) {
  const updateMut = useUpdateSettings()
  const defaults = settings?.processing_defaults || {}
  const form = useForm({
    resolver: zodResolver(processingSchema),
    defaultValues: {
      voice_profile_default: settings?.voice_profile_default || '',
      output_dir: defaults.output_dir || '',
      source_lang: defaults.source_lang || 'en',
      target_lang: defaults.target_lang || 'es',
    },
  })

  const onSubmit = async (values) => {
    try {
      const payload = {
        voice_profile_default: values.voice_profile_default || null,
        processing_defaults: {
          ...defaults,
          output_dir: values.output_dir || undefined,
          source_lang: values.source_lang,
          target_lang: values.target_lang,
        },
      }
      await updateMut.mutateAsync(payload)
      toast.success('Procesamiento guardado')
      form.reset(values)
    } catch (e) {
      toast.error(e?.message || 'Error al guardar')
    }
  }

  const { isDirty } = form.formState

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cog size={16} className="text-primary" />
            Procesamiento
            {isDirty && <Badge variant="outline" className="ml-2 border-amber-500/40 text-amber-500">sin guardar</Badge>}
          </CardTitle>
          <CardDescription>Valores por defecto para nuevos pipelines.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="voice_profile_default">Perfil de voz por defecto</Label>
            <Input
              id="voice_profile_default"
              placeholder="(ninguno)"
              {...form.register('voice_profile_default')}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="output_dir">Directorio de salida (opcional)</Label>
            <Input
              id="output_dir"
              placeholder="Dejar vacío para procesar in-place"
              {...form.register('output_dir')}
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Cuando está vacío, los artefactos se guardan junto a los capítulos.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="source_lang">Idioma origen</Label>
              <Input
                id="source_lang"
                placeholder="en"
                {...form.register('source_lang')}
                className="mt-1.5 font-mono"
              />
            </div>
            <div>
              <Label htmlFor="target_lang">Idioma destino</Label>
              <Input
                id="target_lang"
                placeholder="es"
                {...form.register('target_lang')}
                className="mt-1.5 font-mono"
              />
            </div>
          </div>
        </CardContent>
        <Separator />
        <div className="flex justify-end gap-2 p-4">
          <Button type="submit" disabled={!isDirty || updateMut.isPending}>
            {updateMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar
          </Button>
        </div>
      </Card>
    </form>
  )
}

function OracleSection({ settings }) {
  const updateMut = useUpdateSettings()
  const { data: providers = [] } = useProviders()
  const defaults = settings?.processing_defaults || {}
  const form = useForm({
    resolver: zodResolver(oracleSchema),
    defaultValues: {
      provider_default: defaults.oracle_provider_default || (providers[0]?.id ?? ''),
      timeout_seconds: defaults.oracle_timeout_seconds || 30,
    },
  })

  const onSubmit = async (values) => {
    try {
      await updateMut.mutateAsync({
        processing_defaults: {
          ...defaults,
          oracle_provider_default: values.provider_default,
          oracle_timeout_seconds: values.timeout_seconds,
        },
      })
      toast.success('Oracle guardado')
      form.reset(values)
    } catch (e) {
      toast.error(e?.message || 'Error al guardar')
    }
  }

  const { isDirty } = form.formState
  const current = form.watch('provider_default')

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            Oracle
            {isDirty && <Badge variant="outline" className="ml-2 border-amber-500/40 text-amber-500">sin guardar</Badge>}
          </CardTitle>
          <CardDescription>
            Provider por defecto y timeouts para resolver/scrapear instruccionales.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Provider por defecto</Label>
            <Select
              value={current || ''}
              onValueChange={(v) => form.setValue('provider_default', v, { shouldDirty: true })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Seleccionar provider" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="timeout_seconds">Timeout (segundos)</Label>
            <Input
              id="timeout_seconds"
              type="number"
              min={5}
              max={300}
              {...form.register('timeout_seconds')}
              className="mt-1.5 font-mono"
            />
          </div>
        </CardContent>
        <Separator />
        <div className="flex justify-end gap-2 p-4">
          <Button type="submit" disabled={!isDirty || updateMut.isPending}>
            {updateMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar
          </Button>
        </div>
      </Card>
    </form>
  )
}

function TelegramSection({ settings }) {
  const updateMut = useUpdateSettings()
  const [showHash, setShowHash] = useState(false)

  const form = useForm({
    resolver: zodResolver(telegramSchema),
    defaultValues: {
      telegram_api_id:
        settings?.telegram_api_id != null ? String(settings.telegram_api_id) : '',
      telegram_api_hash: settings?.telegram_api_hash || '',
    },
  })

  const onSubmit = async (values) => {
    try {
      const idRaw = typeof values.telegram_api_id === 'string'
        ? values.telegram_api_id.trim()
        : values.telegram_api_id
      const hashRaw = (values.telegram_api_hash || '').trim()
      const payload = {
        telegram_api_id: idRaw === '' || idRaw == null ? null : Number(idRaw),
        telegram_api_hash: hashRaw === '' ? null : hashRaw,
      }
      await updateMut.mutateAsync(payload)
      toast.success('Telegram guardado')
      form.reset(values)
    } catch (e) {
      toast.error(e?.message || 'Error al guardar')
    }
  }

  const { isDirty } = form.formState
  const savedId = settings?.telegram_api_id
  const savedHash = settings?.telegram_api_hash
  const configured = savedId != null && savedId !== '' && !!savedHash

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send size={16} className="text-primary" />
            Telegram
            {configured ? (
              <Badge variant="outline" className="ml-2 border-emerald-500/40 text-emerald-500">
                Configurado
              </Badge>
            ) : (
              <Badge variant="outline" className="ml-2 border-amber-500/40 text-amber-500">
                Incompleto
              </Badge>
            )}
            {isDirty && (
              <Badge variant="outline" className="ml-2 border-amber-500/40 text-amber-500">
                sin guardar
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Credenciales de la API de Telegram para integraciones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="telegram_api_id">API ID</Label>
            <Input
              id="telegram_api_id"
              type="number"
              min={1}
              step={1}
              placeholder="123456"
              {...form.register('telegram_api_id')}
              className="mt-1.5 font-mono"
            />
            {form.formState.errors.telegram_api_id && (
              <p className="text-xs text-destructive mt-1">
                {form.formState.errors.telegram_api_id.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="telegram_api_hash">API Hash</Label>
            <div className="relative mt-1.5">
              <Input
                id="telegram_api_hash"
                type={showHash ? 'text' : 'password'}
                placeholder="32 caracteres hex"
                autoComplete="off"
                {...form.register('telegram_api_hash')}
                className="font-mono pr-10"
              />
              <button
                type="button"
                onClick={() => setShowHash((v) => !v)}
                aria-label={showHash ? 'Ocultar hash' : 'Mostrar hash'}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showHash ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {form.formState.errors.telegram_api_hash && (
              <p className="text-xs text-destructive mt-1">
                {form.formState.errors.telegram_api_hash.message}
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Obtén tus credenciales en{' '}
            <a
              href="https://my.telegram.org/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary"
            >
              my.telegram.org/apps
            </a>
            . Deja ambos campos vacíos para desactivar la integración.
          </p>
        </CardContent>
        <Separator />
        <div className="flex justify-end gap-2 p-4">
          <Button type="submit" disabled={!isDirty || updateMut.isPending}>
            {updateMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar
          </Button>
        </div>
      </Card>
    </form>
  )
}

function TranslationSection({ settings }) {
  const updateMut = useUpdateSettings()
  const [showOpenAI, setShowOpenAI] = useState(false)
  const [showDeepL, setShowDeepL] = useState(false)

  const form = useForm({
    resolver: zodResolver(translationSchema),
    defaultValues: {
      translation_provider: settings?.translation_provider || 'openai',
      translation_model: settings?.translation_model || 'gpt-4o-mini',
      translation_fallback_provider: settings?.translation_fallback_provider || '',
      openai_api_key: settings?.openai_api_key || '',
      deepl_api_key: settings?.deepl_api_key || '',
    },
  })

  const provider = form.watch('translation_provider')

  const onSubmit = async (values) => {
    try {
      const raw = (s) => {
        const v = (s || '').trim()
        return v === '' ? null : v
      }
      await updateMut.mutateAsync({
        translation_provider: values.translation_provider,
        translation_model: raw(values.translation_model),
        translation_fallback_provider: values.translation_fallback_provider || null,
        openai_api_key: raw(values.openai_api_key),
        deepl_api_key: raw(values.deepl_api_key),
      })
      toast.success('Traducción guardada')
      form.reset(values)
    } catch (e) {
      toast.error(e?.message || 'Error al guardar')
    }
  }

  const { isDirty } = form.formState
  const hasOpenAI = !!(settings?.openai_api_key)
  const hasDeepL = !!(settings?.deepl_api_key)
  const deeplIsFree = (settings?.deepl_api_key || '').endsWith(':fx')

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug size={16} className="text-primary" />
            Traducción
            {isDirty && (
              <Badge variant="outline" className="ml-2 border-amber-500/40 text-amber-500">
                sin guardar
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Motor de traducción de subtítulos EN → ES. OpenAI (gpt-4o-mini) por defecto, DeepL como fallback.
            Términos BJJ (guard, mount, armbar…) se mantienen en inglés.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Proveedor principal</Label>
              <Select
                value={form.watch('translation_provider')}
                onValueChange={(v) => form.setValue('translation_provider', v, { shouldDirty: true })}
              >
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI (gpt-4o-mini)</SelectItem>
                  <SelectItem value="deepl">DeepL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fallback</Label>
              <Select
                value={form.watch('translation_fallback_provider') || '__none__'}
                onValueChange={(v) =>
                  form.setValue('translation_fallback_provider', v === '__none__' ? '' : v, { shouldDirty: true })
                }
              >
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin fallback</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="deepl">DeepL</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {provider === 'openai' && (
            <div>
              <Label htmlFor="translation_model">Modelo OpenAI</Label>
              <Input
                id="translation_model"
                placeholder="gpt-4o-mini"
                {...form.register('translation_model')}
                className="mt-1.5 font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                <code>gpt-4o-mini</code> recomendado (~$0.03/Season). <code>gpt-4o</code> ~10× más caro.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="openai_api_key" className="flex items-center gap-2">
              OpenAI API Key
              {hasOpenAI && (
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-500">
                  Configurada
                </Badge>
              )}
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="openai_api_key"
                type={showOpenAI ? 'text' : 'password'}
                placeholder="sk-..."
                autoComplete="off"
                {...form.register('openai_api_key')}
                className="font-mono pr-10"
              />
              <button
                type="button"
                onClick={() => setShowOpenAI((v) => !v)}
                aria-label={showOpenAI ? 'Ocultar key' : 'Mostrar key'}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showOpenAI ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                platform.openai.com/api-keys
              </a>
            </p>
          </div>

          <div>
            <Label htmlFor="deepl_api_key" className="flex items-center gap-2">
              DeepL API Key
              {hasDeepL && (
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-500">
                  {deeplIsFree ? 'Free' : 'Pro'}
                </Badge>
              )}
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="deepl_api_key"
                type={showDeepL ? 'text' : 'password'}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"
                autoComplete="off"
                {...form.register('deepl_api_key')}
                className="font-mono pr-10"
              />
              <button
                type="button"
                onClick={() => setShowDeepL((v) => !v)}
                aria-label={showDeepL ? 'Ocultar key' : 'Mostrar key'}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showDeepL ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <a href="https://www.deepl.com/pro-api" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                deepl.com/pro-api
              </a>
              . Free: 500k caracteres/mes.
            </p>
          </div>
        </CardContent>
        <Separator />
        <div className="flex justify-end gap-2 p-4">
          <Button type="submit" disabled={!isDirty || updateMut.isPending}>
            {updateMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar
          </Button>
        </div>
      </Card>
    </form>
  )
}

function AuthorAliasesSection({ settings }) {
  const updateMut = useUpdateSettings()
  const initial = settings?.author_aliases || {}
  const [rows, setRows] = useState(() =>
    Object.entries(initial).map(([from, to]) => ({ from, to })),
  )

  const initialSerialized = JSON.stringify(initial)
  const currentSerialized = JSON.stringify(
    Object.fromEntries(
      rows
        .map((r) => [r.from.trim(), r.to.trim()])
        .filter(([a, b]) => a && b),
    ),
  )
  const isDirty = initialSerialized !== currentSerialized

  const update = (i, key, val) => {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)))
  }
  const add = () => setRows((rs) => [...rs, { from: '', to: '' }])
  const remove = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i))

  const onSave = async () => {
    const payload = Object.fromEntries(
      rows
        .map((r) => [r.from.trim(), r.to.trim()])
        .filter(([a, b]) => a && b),
    )
    try {
      await updateMut.mutateAsync({ author_aliases: payload })
      toast.success('Alias guardados')
    } catch (e) {
      toast.error(e?.message || 'Error al guardar')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          Alias de autores
          {isDirty && (
            <Badge variant="outline" className="ml-2 border-amber-500/40 text-amber-500">
              sin guardar
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Unifica nombres de autor mal parseados. Ej: <code>Powerride</code> → <code>Craig Jones</code>.
          Los grupos de la vista "Por autor" se mergean automáticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Sin alias configurados. Añade uno abajo.
          </p>
        )}
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              placeholder="Nombre crudo (ej: Powerride)"
              value={r.from}
              onChange={(e) => update(i, 'from', e.target.value)}
              className="flex-1"
            />
            <span className="text-muted-foreground text-sm">→</span>
            <Input
              placeholder="Canónico (ej: Craig Jones)"
              value={r.to}
              onChange={(e) => update(i, 'to', e.target.value)}
              className="flex-1"
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>
              <XCircle size={14} />
            </Button>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={add}>
          Añadir alias
        </Button>
      </CardContent>
      <Separator />
      <div className="flex justify-end gap-2 p-4">
        <Button type="button" onClick={onSave} disabled={!isDirty || updateMut.isPending}>
          {updateMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar
        </Button>
      </div>
    </Card>
  )
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme()
  const options = useMemo(
    () => [
      { id: 'dark', label: 'Oscuro' },
      { id: 'light', label: 'Claro' },
      { id: 'system', label: 'Sistema' },
    ],
    [],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette size={16} className="text-primary" />
          Apariencia
        </CardTitle>
        <CardDescription>Tema visual de la interfaz.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setTheme(o.id)}
              aria-pressed={theme === o.id}
              className={`px-3 py-4 rounded-md border text-sm transition-colors ${
                theme === o.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-muted'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function AdvancedSection({ settings }) {
  const updateMut = useUpdateSettings()
  const [importing, setImporting] = useState(false)

  const exportConfig = () => {
    try {
      const blob = new Blob([JSON.stringify(settings || {}, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'bjj-settings.json'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Configuración exportada')
    } catch (e) {
      toast.error(e?.message || 'Error exportando')
    }
  }

  const importConfig = async (file) => {
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      await updateMut.mutateAsync(data)
      toast.success('Configuración importada')
    } catch (e) {
      toast.error(e?.message || 'JSON inválido')
    } finally {
      setImporting(false)
    }
  }

  const resetConfig = async () => {
    if (!window.confirm('¿Restablecer configuración a valores por defecto? Esta acción no se puede deshacer.')) return
    try {
      await http.put('/settings', {
        library_path: '',
        voice_profile_default: null,
        processing_defaults: {},
        custom_prompts: {},
      })
      toast.success('Configuración restablecida')
      // soft reload to refetch
      window.location.reload()
    } catch (e) {
      toast.error(e?.message || 'Error al restablecer')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield size={16} className="text-primary" />
          Avanzado
        </CardTitle>
        <CardDescription>Exportar/importar configuración o restablecer.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={exportConfig}>
            <Download size={14} />
            Exportar config
          </Button>

          <label className="inline-flex items-center">
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                importConfig(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-9 px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 cursor-pointer">
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Importar config
            </span>
          </label>

          <Button type="button" variant="destructive" onClick={resetConfig}>
            <RotateCcw size={14} />
            Restablecer
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Importar sobreescribe los valores actuales. Restablecer vacía biblioteca, perfil de voz y
          prompts personalizados.
        </p>
      </CardContent>
    </Card>
  )
}

function MaintenanceSection() {
  const [busy, setBusy] = useState(false)
  const clearLocks = async () => {
    setBusy(true)
    try {
      const res = await http.post('/subtitles/maintenance/clear-locks', {})
      const removed = res?.removed ?? 0
      if (removed > 0) toast.success(`Locks eliminados: ${removed}`)
      else toast('Nada que limpiar', { description: 'No había locks residuales.' })
      if (res?.errors?.length) {
        toast.error(`Errores: ${res.errors.length}`, { description: res.errors[0] })
      }
    } catch (e) {
      toast.error('Falló la limpieza', { description: e?.message || 'Error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench size={16} />
          Mantenimiento
        </CardTitle>
        <CardDescription>
          Operaciones puntuales para recuperar el sistema cuando un proceso queda atascado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">Limpiar locks de HuggingFace</p>
            <p className="text-xs text-muted-foreground mt-1">
              Elimina los ficheros <code>.lock</code> residuales del cache del modelo Whisper.
              Útil si al relanzar un pipeline de subtítulos se queda esperando indefinidamente.
            </p>
          </div>
          <Button onClick={clearLocks} disabled={busy} variant="outline" size="sm">
            {busy ? <Loader2 className="mr-2 animate-spin" size={14} /> : <Wrench className="mr-2" size={14} />}
            Limpiar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
