import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Globe, Search } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/Badge'
import { useProviders, useOracleScrape } from '@/features/oracle/api/useOracle'

function detectProvider(url, providers) {
  if (!url) return null
  let host = ''
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
  for (const p of providers || []) {
    const domains = p.domains || []
    if (domains.some((d) => host.endsWith(String(d).toLowerCase()))) return p
  }
  return null
}

const baseSchema = z.object({
  url: z.string().trim().min(1, 'Pega una URL').url('URL inválida'),
})

export default function OracleUrlInput({ path, onResolved, autoFocus = false }) {
  const { data: providersResp } = useProviders()
  const providers = useMemo(() => {
    if (Array.isArray(providersResp)) return providersResp
    return providersResp?.providers || []
  }, [providersResp])

  const schema = useMemo(
    () =>
      baseSchema.refine((v) => detectProvider(v.url, providers) != null, {
        path: ['url'],
        message: 'Dominio no soportado por ningún provider',
      }),
    [providers],
  )

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { url: '' },
  })

  const url = watch('url')
  const matchedProvider = useMemo(() => detectProvider(url, providers), [url, providers])

  const scrape = useOracleScrape()

  const onSubmit = handleSubmit(async ({ url }) => {
    try {
      const result = await scrape.mutateAsync({ path, url: url.trim() })
      toast.success('Oracle scrapeado correctamente')
      onResolved?.(result)
    } catch (e) {
      toast.error(`No se pudo resolver: ${e.message || 'error'}`)
    }
  })

  return (
    <motion.form
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1 min-w-0">
          <Input
            autoFocus={autoFocus}
            placeholder="https://bjjfanatics.com/products/..."
            aria-label="oracle-url"
            aria-invalid={!!errors.url}
            {...register('url')}
            className="font-mono text-sm"
          />
          <div className="mt-1.5 flex items-center gap-2 min-h-[20px]">
            {matchedProvider && (
              <Badge variant="secondary" className="gap-1">
                <Globe size={11} /> {matchedProvider.display_name || matchedProvider.id}
              </Badge>
            )}
            {errors.url && (
              <span role="alert" className="text-xs text-red-400">
                {errors.url.message}
              </span>
            )}
          </div>
        </div>
        <Button type="submit" disabled={isSubmitting || scrape.isPending} className="shrink-0">
          {scrape.isPending || isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          Resolver URL
        </Button>
      </div>
    </motion.form>
  )
}
