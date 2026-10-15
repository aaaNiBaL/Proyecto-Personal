import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from './HomePage'

const {
  hasSupabaseConfigMock,
  getCatalogGenresMock,
  getHomepageCatalogMock,
  getPopularMangaMock,
} = vi.hoisted(() => ({
  hasSupabaseConfigMock: vi.fn(() => false),
  getCatalogGenresMock: vi.fn(),
  getHomepageCatalogMock: vi.fn(),
  getPopularMangaMock: vi.fn(),
}))

vi.mock('../services/supabase/client', () => ({
  hasSupabaseConfig: hasSupabaseConfigMock,
}))
vi.mock('../services/catalog/catalogService', () => ({
  getCatalogGenres: getCatalogGenresMock,
  getHomepageCatalog: getHomepageCatalogMock,
  getPopularManga: getPopularMangaMock,
}))
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
}))

describe('HomePage', () => {
  beforeEach(() => {
    hasSupabaseConfigMock.mockReturnValue(false)
    getCatalogGenresMock.mockReset()
    getHomepageCatalogMock.mockReset()
    getPopularMangaMock.mockReset()
  })

  it('introduces the project and links to its catalog', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { name: 'Cada manga, con todos sus nombres.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('link', { name: 'Descubrir mangas' })).toHaveAttribute(
      'href',
      '/explorar',
    )
    expect(screen.getByText(/Conecta Supabase para explorar.*No mostramos datos ficticios\./))
      .toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Populares y mejor valoradas' }))
      .toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ayuda a mantener la wiki' }))
      .toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Apoya el proyecto' }))
      .toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toHaveTextContent('No alojamos capítulos ni scans.')
  })

  it('shows real recent works, update dates, and available genre shortcuts', async () => {
    hasSupabaseConfigMock.mockReturnValue(true)
    getCatalogGenresMock.mockResolvedValue([{ slug: 'action', name: 'Acción' }])
    getHomepageCatalogMock.mockResolvedValue({
      recent: [{
        id: '96e9c88d-2f11-4276-aab6-fccf6324b442',
        canonical_title: 'Forja de Ecos',
        publication_status: 'ongoing',
        start_year: 2024,
        created_at: '2026-10-12T00:00:00+00:00',
        updated_at: '2026-10-12T00:00:00+00:00',
      }],
      updated: [{
        id: '96e9c88d-2f11-4276-aab6-fccf6324b442',
        canonical_title: 'Forja de Ecos',
        publication_status: 'ongoing',
        start_year: 2024,
        created_at: '2026-10-12T00:00:00+00:00',
        updated_at: '2026-10-14T00:00:00+00:00',
      }],
    })
    getPopularMangaMock.mockResolvedValue([{
      id: '96e9c88d-2f11-4276-aab6-fccf6324b442',
      canonical_title: 'Forja de Ecos',
      average_rating: 4.8,
      rating_count: 7,
    }])

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Incorporadas recientemente' }))
      .toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Forja de Ecos' }).every(
      (link) => link.getAttribute('href') === '/manga/96e9c88d-2f11-4276-aab6-fccf6324b442',
    )).toBe(true)
    expect(screen.getByText('actualizada 2026-10-14')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Acción' })).toHaveAttribute(
      'href',
      '/explorar?genre=action',
    )
    expect(await screen.findByText('★ 4.8 · 7 valoraciones')).toBeInTheDocument()
  })
})
