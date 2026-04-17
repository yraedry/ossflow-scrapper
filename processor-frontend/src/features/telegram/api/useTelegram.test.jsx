import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTelegramStatus } from './useTelegram'

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useTelegramStatus', () => {
  it('returns auth status', async () => {
    const { result } = renderHook(() => useTelegramStatus(), { wrapper: wrap() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.state).toBe('disconnected')
  })
})
