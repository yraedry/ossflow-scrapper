import { describe, it, expect } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSettings, useUpdateSettings } from './useSettings'

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useSettings', () => {
  it('loads settings', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper: wrap() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.library_path).toBe('/media/instruccionales')
  })

  it('updates settings via mutation', async () => {
    const { result } = renderHook(() => useUpdateSettings(), { wrapper: wrap() })
    let returned
    await act(async () => {
      returned = await result.current.mutateAsync({ library_path: '/new' })
    })
    expect(returned?.library_path).toBe('/new')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
