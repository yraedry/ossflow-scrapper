// Multi-step Telegram authentication dialog: phone → code → 2FA.
// Reads `auth.state` from server (TanStack Query) and advances steps when the
// backend reports `awaiting_code` / `awaiting_2fa` / `authenticated`.
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Send, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  useTelegramStatus,
  useSendCode,
  useSignIn,
  useSubmit2FA,
} from '../api/useTelegram'

const phoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, 'Formato internacional, p.ej. +34600000000'),
})
const codeSchema = z.object({
  code: z.string().trim().min(3, 'Introduce el código recibido'),
})
const twofaSchema = z.object({
  password: z.string().min(1, 'Introduce la contraseña 2FA'),
})

export default function TelegramAuthDialog({ open, onOpenChange }) {
  const { data: auth } = useTelegramStatus()
  const sendCode = useSendCode()
  const signIn = useSignIn()
  const submit2FA = useSubmit2FA()

  const [step, setStep] = useState('phone') // phone | code | twofa
  const [phone, setPhone] = useState('')
  const [phoneCodeHash, setPhoneCodeHash] = useState(null)

  // Sync step with server-reported auth state when dialog is open.
  useEffect(() => {
    if (!open || !auth) return
    if (auth.state === 'awaiting_code') setStep('code')
    else if (auth.state === 'awaiting_2fa') setStep('twofa')
    else if (auth.state === 'authenticated') {
      onOpenChange?.(false)
      toast.success('Conectado a Telegram')
    }
  }, [auth, open, onOpenChange])

  const phoneForm = useForm({ resolver: zodResolver(phoneSchema), defaultValues: { phone: '' } })
  const codeForm = useForm({ resolver: zodResolver(codeSchema), defaultValues: { code: '' } })
  const twofaForm = useForm({ resolver: zodResolver(twofaSchema), defaultValues: { password: '' } })

  const onSendCode = async ({ phone: p }) => {
    try {
      const data = await sendCode.mutateAsync({ phone: p.trim() })
      setPhone(p.trim())
      setPhoneCodeHash(data?.phone_code_hash || null)
      setStep('code')
    } catch (e) {
      toast.error(e?.message || 'No se pudo enviar el código')
    }
  }

  const onSignIn = async ({ code }) => {
    try {
      const data = await signIn.mutateAsync({ phone, code: code.trim(), phone_code_hash: phoneCodeHash })
      if (data?.state === 'awaiting_2fa' || data?.needs_2fa) setStep('twofa')
    } catch (e) {
      const msg = e?.message || ''
      if (/2fa|password|SessionPassword/i.test(msg)) {
        setStep('twofa')
      } else {
        toast.error(msg || 'Código inválido')
      }
    }
  }

  const onSubmit2FA = async ({ password }) => {
    try {
      await submit2FA.mutateAsync({ password })
    } catch (e) {
      toast.error(e?.message || 'Contraseña 2FA incorrecta')
    }
  }

  const loading = sendCode.isPending || signIn.isPending || submit2FA.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-amber-500" /> Conectar Telegram
          </DialogTitle>
          <DialogDescription>
            {step === 'phone' && 'Paso 1 de 2 — Número de teléfono'}
            {step === 'code' && 'Paso 2 de 2 — Código de verificación'}
            {step === 'twofa' && 'Paso extra — Contraseña 2FA'}
          </DialogDescription>
        </DialogHeader>

        {step === 'phone' && (
          <form onSubmit={phoneForm.handleSubmit(onSendCode)} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tg-phone">Teléfono (formato internacional)</Label>
              <Input
                id="tg-phone"
                type="tel"
                placeholder="+34600000000"
                autoFocus
                className="font-mono"
                {...phoneForm.register('phone')}
              />
              {phoneForm.formState.errors.phone && (
                <p className="text-xs text-destructive">
                  {phoneForm.formState.errors.phone.message}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Recibirás un código por SMS o en la propia app de Telegram.
              </p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar código
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={codeForm.handleSubmit(onSignIn)} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tg-code">Código</Label>
              <Input
                id="tg-code"
                inputMode="numeric"
                placeholder="12345"
                autoFocus
                className="font-mono tracking-widest"
                {...codeForm.register('code')}
              />
              {codeForm.formState.errors.code && (
                <p className="text-xs text-destructive">
                  {codeForm.formState.errors.code.message}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Teléfono: <span className="font-mono">{phone}</span>
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setStep('phone')}>
                Volver
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Verificar
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === 'twofa' && (
          <form onSubmit={twofaForm.handleSubmit(onSubmit2FA)} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tg-2fa">Contraseña 2FA</Label>
              <Input
                id="tg-2fa"
                type="password"
                autoFocus
                {...twofaForm.register('password')}
              />
              {twofaForm.formState.errors.password && (
                <p className="text-xs text-destructive">
                  {twofaForm.formState.errors.password.message}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Tu cuenta tiene verificación en dos pasos activa.
              </p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                Entrar
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
