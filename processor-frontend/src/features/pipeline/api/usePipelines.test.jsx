import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePipelines } from './usePipeline'

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('usePipelines', () => {
  it('fetches pipelines list', async () => {
    const { result } = renderHook(() => usePipelines(), { wrapper: wrap() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const list = Array.isArray(result.current.data)
      ? result.current.data
      : result.current.data?.pipelines
    expect(list?.length).toBeGreaterThan(0)
  })
})
