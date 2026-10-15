import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { SiteHeader } from './SiteHeader'

vi.mock('../../features/auth/AuthContext', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
}))

describe('SiteHeader', () => {
  it('provides a keyboard skip link to the main landmark', () => {
    render(
      <MemoryRouter>
        <SiteHeader />
        <main id="main-content" tabIndex={-1}>Contenido</main>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Saltar al contenido' }))
      .toHaveAttribute('href', '#main-content')
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1')
  })

  it('shows the design notice and accessible account shortcut', () => {
    render(
      <MemoryRouter>
        <SiteHeader />
      </MemoryRouter>,
    )

    expect(screen.getByRole('note')).toHaveTextContent('Vista de diseño')
    expect(screen.getByRole('link', { name: 'Acceder a mi cuenta' }))
      .toHaveAttribute('href', '/cuenta')
  })
})
