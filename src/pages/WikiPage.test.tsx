import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { WikiPage } from './WikiPage'

vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
}))

describe('WikiPage', () => {
  it('explains the editorial workflow and links to the catalog', () => {
    render(<MemoryRouter><WikiPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Wiki' })).toBeInTheDocument()
    expect(screen.getByText('Aporta una fuente')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Explorar el catálogo/ }))
      .toHaveAttribute('href', '/explorar')
  })
})
