import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMetrics } from './useMetrics'

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useMetrics', () => {
  it('returns cpu/ram/disk', async () => {
    const { result } = renderHook(() => useMetrics(), { wrapper: wrap() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.cpu_percent).toBeDefined()
    expect(result.current.data?.ram_percent).toBeDefined()
  })
})
