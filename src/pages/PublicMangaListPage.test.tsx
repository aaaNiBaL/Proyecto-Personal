import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicMangaListPage } from './PublicMangaListPage'

const { getPublicMangaList } = vi.hoisted(() => ({ getPublicMangaList: vi.fn() }))

vi.mock('../services/lists/mangaListService', () => ({ getPublicMangaList }))
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
}))
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
}))

describe('PublicMangaListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPublicMangaList.mockResolvedValue({
      id: '66a4bf64-1d89-4d39-8de6-bba0b966572f',
      title: 'Aventuras favoritas',
      description: 'Historias inolvidables.',
      created_at: '2026-10-14T12:00:00+00:00',
      username: 'lector',
      display_name: 'Lector',
      items: [{
        id: 'd1f9da60-f933-4f04-8cb3-b5e9afdf1ec0',
        canonical_title: 'Obra de prueba',
        synopsis: 'Una aventura.',
        publication_status: 'completed',
        start_year: 2020,
      }],
    })
  })

  it('renders public list details and links the mangas', async () => {
    render(
      <MemoryRouter initialEntries={['/listas/66a4bf64-1d89-4d39-8de6-bba0b966572f']}>
        <Routes>
          <Route path="/listas/:id" element={<PublicMangaListPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Aventuras favoritas' }))
      .toBeInTheDocument()
    expect(screen.getByText('Historias inolvidables.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Obra de prueba/ })).toHaveAttribute(
      'href',
      '/manga/d1f9da60-f933-4f04-8cb3-b5e9afdf1ec0',
    )
    expect(screen.getByRole('link', { name: /Lector/ })).toHaveAttribute('href', '/usuario/lector')
  })

  it('does not reveal private or missing lists', async () => {
    getPublicMangaList.mockResolvedValue(null)
    render(
      <MemoryRouter initialEntries={['/listas/66a4bf64-1d89-4d39-8de6-bba0b966572f']}>
        <Routes>
          <Route path="/listas/:id" element={<PublicMangaListPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Lista no disponible' }))
      .toBeInTheDocument()
  })
})
