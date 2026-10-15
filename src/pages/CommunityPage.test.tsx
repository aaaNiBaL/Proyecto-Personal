import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { CommunityPage } from './CommunityPage'

vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
}))

describe('CommunityPage', () => {
  it('shows the community spaces and useful destinations', () => {
    render(<MemoryRouter><CommunityPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Comunidad' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Reseñas' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Listas de la comunidad' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Abrir mi biblioteca/ }))
      .toHaveAttribute('href', '/biblioteca')
  })
})
