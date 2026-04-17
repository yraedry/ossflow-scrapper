import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useProviders } from './useOracle'

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useProviders', () => {
  it('lists providers', async () => {
    const { result } = renderHook(() => useProviders(), { wrapper: wrap() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const list = Array.isArray(result.current.data)
      ? result.current.data
      : result.current.data?.providers
    expect(list?.[0]?.id).toBe('bjjfanatics')
  })
})
