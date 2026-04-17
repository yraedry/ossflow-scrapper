import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/renderWithProviders'
import { PosterCard } from './PosterCard'

describe('PosterCard', () => {
  it('renders img when has_poster true', () => {
    renderWithProviders(
      <PosterCard
        instructional={{ name: 'Show A', has_poster: true, mtime: 123, author: 'X' }}
      />,
    )
    const img = screen.getByRole('img', { name: /Show A/i })
    expect(img).toBeInTheDocument()
    expect(img.getAttribute('src')).toContain('/api/library/Show%20A/poster')
    expect(img.getAttribute('src')).toContain('v=123')
  })

  it('renders fallback when no poster', () => {
    renderWithProviders(
      <PosterCard instructional={{ name: 'NoPoster', has_poster: false }} />,
    )
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('accepts poster_filename fallback without has_poster', () => {
    renderWithProviders(
      <PosterCard instructional={{ name: 'Old', poster_filename: 'poster.jpg' }} />,
    )
    expect(screen.getByRole('img', { name: /Old/i })).toBeInTheDocument()
  })
})
