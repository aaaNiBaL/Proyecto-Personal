import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfileSettingsPage } from './ProfileSettingsPage'

const {
  getOwnProfile,
  updateOwnProfile,
  listLibrary,
  listFavoriteManga,
  removeMangaFavorite,
  listOwnContributions,
  listMyReadingAchievements,
} = vi.hoisted(() => ({
  getOwnProfile: vi.fn(),
  updateOwnProfile: vi.fn(),
  listLibrary: vi.fn(),
  listFavoriteManga: vi.fn(),
  removeMangaFavorite: vi.fn(),
  listOwnContributions: vi.fn(),
  listMyReadingAchievements: vi.fn(),
}))

vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'a242eaa0-a5b2-4ce0-97cd-2792fb127fcb' } }),
}))
vi.mock('../services/profiles/profileService', () => ({
  getOwnProfile,
  updateOwnProfile,
}))
vi.mock('../services/library/libraryService', () => ({ listLibrary }))
vi.mock('../services/library/favoriteService', () => ({
  listFavoriteManga,
  removeMangaFavorite,
}))
vi.mock('../services/wiki/wikiService', () => ({ listOwnContributions }))
vi.mock('../services/library/achievementService', () => ({ listMyReadingAchievements }))

describe('ProfileSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getOwnProfile.mockResolvedValue({
      user_id: 'a242eaa0-a5b2-4ce0-97cd-2792fb127fcb',
      username: 'lector_anonimo',
      display_name: '',
      bio: 'Aficionado a las historias de mar y faros.',
      is_public: true,
      show_favorites: false,
      show_achievements: false,
      notify_contributions: true,
      notify_news: false,
      created_at: '2026-01-01T12:00:00+00:00',
      updated_at: '2026-01-01T12:00:00+00:00',
    })
    listLibrary.mockResolvedValue([{
      id: '5ab7a4a9-d55d-4f90-9080-8109430de99b',
      user_id: 'a242eaa0-a5b2-4ce0-97cd-2792fb127fcb',
      manga_id: '66a4bf64-1d89-4d39-8de6-bba0b966572f',
      reading_status: 'reading',
      last_chapter: null,
      private_notes: null,
      personal_rating: null,
      started_on: null,
      finished_on: null,
      created_at: '2026-01-01T12:00:00+00:00',
      updated_at: '2026-01-01T12:00:00+00:00',
      manga: {
        id: '66a4bf64-1d89-4d39-8de6-bba0b966572f',
        canonical_title: 'Obra de biblioteca',
      },
      links: [],
    }])
    listFavoriteManga.mockResolvedValue([{
      id: '74b0bf64-1d89-4d39-8de6-bba0b966572f',
      canonical_title: 'Faro de Tinta',
      publication_status: 'ongoing',
      start_year: 2024,
    }])
    listOwnContributions.mockResolvedValue([{
      id: '68de7ab9-090e-4a9c-8ea6-954c5d8c356a',
      manga_id: '66a4bf64-1d89-4d39-8de6-bba0b966572f',
      contribution_type: 'metadata',
      proposed_changes: { synopsis: 'Una corrección.' },
      source_url: 'https://example.org/source',
      note: null,
      status: 'approved',
      review_note: null,
      reviewed_at: '2026-01-02T12:00:00+00:00',
      created_at: '2026-01-02T12:00:00+00:00',
    }])
    listMyReadingAchievements.mockResolvedValue([{
      id: 'd1f9da60-f933-4f04-8cb3-b5e9afdf1ec0',
      slug: 'first_manga',
      title: 'Primera obra',
      description: 'Añade tu primera obra a la biblioteca.',
      criteria_type: 'library_count',
      threshold: 1,
      sort_order: 1,
      unlocked_at: '2026-01-02T12:00:00+00:00',
    }])
    removeMangaFavorite.mockResolvedValue(undefined)
  })

  it('shows profile stats and switches between favorites, contributions, and badges', async () => {
    render(<MemoryRouter><ProfileSettingsPage /></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: 'lector_anonimo' })).toBeInTheDocument()
    expect(screen.getByText('Aficionado a las historias de mar y faros.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Editar perfil' })).toHaveAttribute(
      'href',
      '/perfil/editar',
    )
    expect(screen.queryByRole('textbox', { name: 'Biografía (opcional)' })).not.toBeInTheDocument()
    expect(screen.getByText('En biblioteca')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Favoritos' })).toBeInTheDocument()
    const favoriteLinks = await screen.findAllByRole('link', { name: 'Faro de Tinta' })
    expect(favoriteLinks[0]).toHaveAttribute(
      'href',
      '/manga/74b0bf64-1d89-4d39-8de6-bba0b966572f',
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Contribuciones' }))
    expect(await screen.findByText('Corrección de ficha')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /Insignias/ }))
    expect(await screen.findByText('Primera obra')).toBeInTheDocument()
  })

  it('removes a favorite from the profile', async () => {
    render(<MemoryRouter><ProfileSettingsPage /></MemoryRouter>)
    await screen.findAllByRole('link', { name: 'Faro de Tinta' })
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Faro de Tinta de favoritos' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Se quitó de tus favoritos.')
    expect(removeMangaFavorite).toHaveBeenCalledWith(
      'a242eaa0-a5b2-4ce0-97cd-2792fb127fcb',
      '74b0bf64-1d89-4d39-8de6-bba0b966572f',
    )
  })
})
