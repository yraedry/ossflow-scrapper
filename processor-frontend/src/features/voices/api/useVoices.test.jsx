import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useVoices } from './useVoices'

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useVoices', () => {
  it('lists voices (empty)', async () => {
    const { result } = renderHook(() => useVoices(), { wrapper: wrap() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const list = Array.isArray(result.current.data)
      ? result.current.data
      : result.current.data?.voices
    expect(Array.isArray(list)).toBe(true)
  })
})
