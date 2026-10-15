import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountSettingsPage } from './AccountSettingsPage'

const { getOwnProfile, updateOwnProfile, deleteOwnAccount } = vi.hoisted(() => ({
  getOwnProfile: vi.fn(),
  updateOwnProfile: vi.fn(),
  deleteOwnAccount: vi.fn(),
}))

vi.mock('../services/profiles/profileService', () => ({ getOwnProfile, updateOwnProfile }))
vi.mock('../services/profiles/accountService', () => ({ deleteOwnAccount }))
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'a242eaa0-a5b2-4ce0-97cd-2792fb127fcb' },
    signOut: vi.fn(),
  }),
}))

describe('AccountSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    getOwnProfile.mockResolvedValue({
      user_id: 'a242eaa0-a5b2-4ce0-97cd-2792fb127fcb',
      username: 'lector_anonimo',
      display_name: 'Lector',
      bio: '',
      is_public: true,
      show_favorites: false,
      show_achievements: false,
      notify_contributions: true,
      notify_news: false,
      created_at: '2026-01-01T12:00:00+00:00',
      updated_at: '2026-01-01T12:00:00+00:00',
    })
    updateOwnProfile.mockResolvedValue(undefined)
    deleteOwnAccount.mockResolvedValue(undefined)
  })

  it('saves privacy preferences and the selected theme together', async () => {
    render(
      <MemoryRouter>
        <AccountSettingsPage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('link', { name: 'Ver mi perfil' })).toHaveAttribute(
      'href',
      '/perfil',
    )
    expect(screen.getByRole('link', { name: 'Editar perfil' })).toHaveAttribute(
      'href',
      '/perfil/editar',
    )
    const favorites = await screen.findByRole('checkbox', { name: /Mostrar mis favoritos/ })
    fireEvent.click(favorites)
    fireEvent.change(screen.getByRole('combobox', { name: 'Tema de la interfaz' }), {
      target: { value: 'light' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(updateOwnProfile).toHaveBeenCalledWith(
      'a242eaa0-a5b2-4ce0-97cd-2792fb127fcb',
      expect.objectContaining({ showFavorites: true }),
    ))
    expect(await screen.findByRole('status')).toHaveTextContent('Tus ajustes se guardaron correctamente.')
    await waitFor(() => {
      expect(window.localStorage.getItem('mangaverse-theme')).toBe('light')
      expect(document.documentElement.dataset.theme).toBe('light')
    })
  })

  it('requires an explicit phrase before requesting account deletion', async () => {
    render(<MemoryRouter><AccountSettingsPage /></MemoryRouter>)

    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar cuenta' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: 'Eliminar definitivamente' })
    expect(confirm).toBeDisabled()

    fireEvent.change(screen.getByRole('textbox', { name: 'Escribe ELIMINAR para confirmar' }), {
      target: { value: 'ELIMINAR' },
    })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)

    await waitFor(() => expect(deleteOwnAccount).toHaveBeenCalledOnce())
  })
})
