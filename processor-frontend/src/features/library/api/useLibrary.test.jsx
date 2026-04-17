import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useLibrary, useInstructional, posterUrl } from './useLibrary'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useLibrary', () => {
  it('unpacks .instructionals from backend payload', async () => {
    const { result } = renderHook(() => useLibrary(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(Array.isArray(result.current.data)).toBe(true)
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data[0].name).toMatch(/Tripod/)
  })

  it('useInstructional fetches detail by name', async () => {
    const { result } = renderHook(() => useInstructional('Foo'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.seasons).toBeDefined()
  })

  it('posterUrl encodes name', () => {
    expect(posterUrl('A B')).toBe('/api/library/A%20B/poster')
  })
})
