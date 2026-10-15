import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicProfilePage } from './PublicProfilePage'

const { getPublicProfile } = vi.hoisted(() => ({ getPublicProfile: vi.fn() }))

vi.mock('../services/profiles/profileService', () => ({ getPublicProfile }))
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
}))

describe('PublicProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPublicProfile.mockResolvedValue({
      user_id: '15e3f394-c9a5-4122-bc42-2514868ca2e1',
      username: 'manga_reader',
      display_name: 'Lectora',
      bio: 'Me gustan las historias de aventura.',
      created_at: '2026-10-01T12:00:00+00:00',
      show_favorites: false,
      show_achievements: false,
      favorites: [],
      achievements: [],
      lists: [{
        id: 'd1f9da60-f933-4f04-8cb3-b5e9afdf1ec0',
        title: 'Aventuras favoritas',
        description: 'Historias recomendadas.',
        item_count: 2,
      }],
      reviews: [{
        manga_id: '66a4bf64-1d89-4d39-8de6-bba0b966572f',
        manga_title: 'Obra de prueba',
        rating: 4,
        review_text: 'Un giro inesperado.',
        contains_spoilers: true,
        created_at: '2026-10-14T12:00:00+00:00',
        updated_at: '2026-10-14T12:00:00+00:00',
      }],
    })
  })

  it('shows public profile information and protects spoiler reviews', async () => {
    render(
      <MemoryRouter initialEntries={['/usuario/manga_reader']}>
        <Routes>
          <Route path="/usuario/:username" element={<PublicProfilePage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Lectora' })).toBeInTheDocument()
    expect(screen.getByText('Me gustan las historias de aventura.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Aventuras favoritas/ })).toHaveAttribute(
      'href',
      '/listas/d1f9da60-f933-4f04-8cb3-b5e9afdf1ec0',
    )
    expect(screen.getByRole('link', { name: 'Obra de prueba' })).toHaveAttribute(
      'href',
      '/manga/66a4bf64-1d89-4d39-8de6-bba0b966572f',
    )
    expect(screen.getByText('Esta reseña contiene spoilers.')).toBeInTheDocument()
    expect(screen.queryByText('Un giro inesperado.')).not.toBeInTheDocument()
  })

  it('tells visitors when a profile is private or unavailable', async () => {
    getPublicProfile.mockResolvedValue(null)
    render(
      <MemoryRouter initialEntries={['/usuario/privado']}>
        <Routes>
          <Route path="/usuario/:username" element={<PublicProfilePage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Perfil no disponible' }))
      .toBeInTheDocument()
  })

  it('shows favorites and badges only when the profile owner enabled them', async () => {
    getPublicProfile.mockResolvedValue({
      user_id: '15e3f394-c9a5-4122-bc42-2514868ca2e1',
      username: 'manga_reader',
      display_name: 'Lectora',
      bio: '',
      created_at: '2026-10-01T12:00:00+00:00',
      show_favorites: true,
      show_achievements: true,
      lists: [],
      reviews: [],
      favorites: [{
        id: '66a4bf64-1d89-4d39-8de6-bba0b966572f',
        canonical_title: 'Obra favorita',
      }],
      achievements: [{
        slug: 'first_manga',
        title: 'Primera obra',
        unlocked_at: '2026-10-14T12:00:00+00:00',
      }],
    })
    render(
      <MemoryRouter initialEntries={['/usuario/manga_reader']}>
        <Routes>
          <Route path="/usuario/:username" element={<PublicProfilePage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Mangas favoritos' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Obra favorita' })).toHaveAttribute(
      'href',
      '/manga/66a4bf64-1d89-4d39-8de6-bba0b966572f',
    )
    expect(screen.getByRole('heading', { name: 'Insignias' })).toBeInTheDocument()
    expect(screen.getByText('Primera obra')).toBeInTheDocument()
  })
})
