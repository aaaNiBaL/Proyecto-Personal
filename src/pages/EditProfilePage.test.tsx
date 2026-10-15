import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EditProfilePage } from './EditProfilePage'

const { getOwnProfile, updateOwnProfile } = vi.hoisted(() => ({
  getOwnProfile: vi.fn(),
  updateOwnProfile: vi.fn(),
}))

vi.mock('../services/profiles/profileService', () => ({ getOwnProfile, updateOwnProfile }))
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'a242eaa0-a5b2-4ce0-97cd-2792fb127fcb' },
    signOut: vi.fn(),
  }),
}))

describe('EditProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getOwnProfile.mockResolvedValue({
      user_id: 'a242eaa0-a5b2-4ce0-97cd-2792fb127fcb',
      username: 'lector_anonimo',
      display_name: 'Lector',
      bio: 'Mi presentación',
      is_public: true,
      show_favorites: false,
      show_achievements: false,
      notify_contributions: true,
      notify_news: false,
      created_at: '2026-01-01T12:00:00+00:00',
      updated_at: '2026-01-01T12:00:00+00:00',
    })
    updateOwnProfile.mockResolvedValue(undefined)
  })

  it('saves profile details in a separate edit page', async () => {
    render(<MemoryRouter><EditProfilePage /></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: 'Editar perfil' })).toBeInTheDocument()
    const username = screen.getByRole('textbox', { name: 'Nombre de usuario' })
    expect(username).toHaveValue('lector_anonimo')
    expect(username).not.toHaveValue('@lector_anonimo')
    fireEvent.change(screen.getByRole('textbox', { name: 'Presentación' }), {
      target: { value: 'Me gustan los mangas de aventura.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(updateOwnProfile).toHaveBeenCalledWith(
      'a242eaa0-a5b2-4ce0-97cd-2792fb127fcb',
      expect.objectContaining({
        username: 'lector_anonimo',
        displayName: 'Lector',
        bio: 'Me gustan los mangas de aventura.',
      }),
    ))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Los cambios de tu perfil se guardaron correctamente.',
    )
  })
})
