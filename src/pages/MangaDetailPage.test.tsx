import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MangaDetailPage } from './MangaDetailPage'

const { getMangaDetail, getRelatedManga } = vi.hoisted(() => ({
  getMangaDetail: vi.fn(),
  getRelatedManga: vi.fn(),
}))

vi.mock('../services/catalog/catalogService', () => ({ getMangaDetail, getRelatedManga }))
vi.mock('../services/library/favoriteService', () => ({
  addMangaFavorite: vi.fn(),
  isMangaFavorite: vi.fn().mockResolvedValue(false),
  removeMangaFavorite: vi.fn(),
}))
vi.mock('../services/supabase/client', () => ({
  hasSupabaseConfig: () => true,
}))
vi.mock('../features/comments/CommunityComments', () => ({
  CommunityComments: () => <section aria-label="Comentarios de la obra" />,
}))
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
}))

describe('MangaDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getRelatedManga.mockResolvedValue([{
      id: '74b0bf64-1d89-4d39-8de6-bba0b966572f',
      canonical_title: 'Obra relacionada',
      original_title: null,
      publication_status: 'ongoing',
      start_year: 2023,
      aliases: [],
      genres: ['Aventura'],
      creators: [],
      match_title: null,
    }])
    getMangaDetail.mockResolvedValue({
      id: '66a4bf64-1d89-4d39-8de6-bba0b966572f',
      canonical_title: 'Obra de prueba',
      original_title: '試験作品',
      synopsis: 'Sinopsis verificada.',
      publication_status: 'completed',
      start_year: 2019,
      end_year: 2021,
      verification_status: 'verified',
      aliases: [
        {
          title: 'Test Work',
          language_code: 'en',
          script_code: 'Latino',
          title_type: 'translated',
        },
      ],
      genres: ['Aventura'],
      credits: [{ person_name: 'Autora de prueba', role: 'author' }],
      sources: [{
        name: 'Editorial de prueba',
        source_url: 'https://example.org/manga',
        field_key: 'publication',
        verified_at: '2026-10-01T12:00:00+00:00',
      }],
    })
  })

  it('shows organized title information, cited sources and community sections', async () => {
    render(
      <MemoryRouter initialEntries={['/manga/66a4bf64-1d89-4d39-8de6-bba0b966572f']}>
        <Routes>
          <Route path="/manga/:id" element={<MangaDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Obra de prueba' }))
      .toBeInTheDocument()
    expect(screen.getByText('Test Work')).toBeInTheDocument()
    expect(screen.getByText('Autora de prueba')).toBeInTheDocument()
    expect(screen.getByText('試験作品')).toBeInTheDocument()
    expect(screen.getByText('Latino')).toBeInTheDocument()
    expect(screen.getByText('Escritura')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Comunidad' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Puntuaciones y reseñas' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Inicia sesión para reportar información' }))
      .toHaveAttribute('href', '/cuenta')
    expect(screen.getByRole('link', { name: /Editorial de prueba/ }))
      .toHaveAttribute('rel', 'noreferrer')
    expect(screen.getByText('Sinopsis verificada.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Obras relacionadas' })).toBeInTheDocument()
    expect(screen.getByText('No disponible')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Obra relacionada/ })).toHaveAttribute(
      'href',
      '/manga/74b0bf64-1d89-4d39-8de6-bba0b966572f',
    )
    expect(getRelatedManga).toHaveBeenCalledWith(
      '66a4bf64-1d89-4d39-8de6-bba0b966572f',
      ['Aventura'],
    )
  })
})
