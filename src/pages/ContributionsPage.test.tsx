import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ContributionsPage } from './ContributionsPage'

const { listOwnContributions } = vi.hoisted(() => ({
  listOwnContributions: vi.fn(),
}))

vi.mock('../services/wiki/wikiService', () => ({ listOwnContributions }))
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'a242eaa0-a5b2-4ce0-97cd-2792fb127fcb' } }),
}))

describe('ContributionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listOwnContributions.mockResolvedValue([
      {
        id: '68de7ab9-090e-4a9c-8ea6-954c5d8c356a',
        manga_id: '66a4bf64-1d89-4d39-8de6-bba0b966572f',
        manga_title: 'El Faro de Tinta',
        contribution_type: 'alias',
        proposed_changes: { title: 'Lighthouse of Ink' },
        source_url: 'https://example.org/source',
        note: null,
        status: 'pending',
        review_note: null,
        reviewed_at: null,
        created_at: new Date().toISOString(),
      },
      {
        id: '74b0bf64-1d89-4d39-8de6-bba0b966572f',
        manga_id: '5ab7a4a9-d55d-4f90-9080-8109430de99b',
        manga_title: 'Nube de Papel',
        contribution_type: 'metadata',
        proposed_changes: { start_year: 2019 },
        source_url: 'https://example.org/source',
        note: null,
        status: 'approved',
        review_note: null,
        reviewed_at: null,
        created_at: '2026-10-14T12:00:00+00:00',
      },
      {
        id: '85c1cf75-2b5b-41b1-8d7b-0cd6d09f326b',
        manga_id: '96e9c88d-2f11-4276-aab6-fccf6324b442',
        manga_title: 'Forja de Ecos',
        contribution_type: 'metadata',
        proposed_changes: { publication_status: 'completed' },
        source_url: 'https://example.org/source',
        note: null,
        status: 'rejected',
        review_note: 'Falta una fuente verificable.',
        reviewed_at: null,
        created_at: '2026-10-13T12:00:00+00:00',
      },
    ])
  })

  it('shows proposals with manga names, status filters, and reviewer notes', async () => {
    render(<MemoryRouter><ContributionsPage /></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: 'Mis propuestas' })).toBeInTheDocument()
    expect(screen.getByText('3 propuestas')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Nueva propuesta' })).toHaveAttribute('href', '/explorar')
    expect(screen.getByRole('link', { name: 'El Faro de Tinta' })).toHaveAttribute(
      'href',
      '/manga/66a4bf64-1d89-4d39-8de6-bba0b966572f',
    )
    expect(screen.getByText('Lighthouse of Ink')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /Aprobadas/ }))
    expect(screen.getByRole('link', { name: 'Nube de Papel' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'El Faro de Tinta' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /Rechazadas/ }))
    expect(screen.getByText('Nota del revisor: Falta una fuente verificable.')).toBeInTheDocument()
  })
})
