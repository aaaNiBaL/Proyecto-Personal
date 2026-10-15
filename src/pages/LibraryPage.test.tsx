import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LibraryPage } from './LibraryPage'

const {
  listLibrary,
  updateLibraryEntry,
  addPersonalLink,
  listMyReadingAchievements,
  authUser,
} = vi.hoisted(() => ({
  listLibrary: vi.fn(),
  updateLibraryEntry: vi.fn(),
  addPersonalLink: vi.fn(),
  listMyReadingAchievements: vi.fn(),
  authUser: { current: { id: 'a242eaa0-a5b2-4ce0-97cd-2792fb127fcb' } as { id: string } | null },
}))

vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({
    user: authUser.current,
  }),
}))

vi.mock('../services/library/libraryService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/library/libraryService')>()
  return { ...actual, listLibrary, updateLibraryEntry, addPersonalLink }
})
vi.mock('../services/library/achievementService', () => ({
  listMyReadingAchievements,
}))

const exampleEntry = {
  id: '5ab7a4a9-d55d-4f90-9080-8109430de99b',
  user_id: 'a242eaa0-a5b2-4ce0-97cd-2792fb127fcb',
  manga_id: '66a4bf64-1d89-4d39-8de6-bba0b966572f',
  reading_status: 'reading' as const,
  last_chapter: null,
  private_notes: null,
  personal_rating: null,
  started_on: null,
  finished_on: null,
  created_at: '2026-10-01T12:00:00+00:00',
  updated_at: '2026-10-01T12:00:00+00:00',
  manga: {
    id: '66a4bf64-1d89-4d39-8de6-bba0b966572f',
    canonical_title: 'Obra privada',
  },
  links: [],
}

describe('LibraryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authUser.current = { id: 'a242eaa0-a5b2-4ce0-97cd-2792fb127fcb' }
    updateLibraryEntry.mockResolvedValue(undefined)
    addPersonalLink.mockResolvedValue(undefined)
    listLibrary.mockResolvedValue([])
    listMyReadingAchievements.mockResolvedValue([])
  })

  it('shows the private empty state and links to explore', async () => {
    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Tu biblioteca está vacía' }))
      .toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Explorar mangas' }))
      .toHaveAttribute('href', '/explorar')
    expect(listLibrary).toHaveBeenCalledWith('a242eaa0-a5b2-4ce0-97cd-2792fb127fcb')
  })

  it('shows a non-editable example library when signed out', async () => {
    authUser.current = null
    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/Vista de ejemplo/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'El Faro de Tinta' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nube de Papel' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ronin del Andén 9' })).toBeInTheDocument()
    expect(screen.getByLabelText('Estado de lectura de ejemplo: El Faro de Tinta'))
      .toBeDisabled()
    expect(listLibrary).not.toHaveBeenCalled()
  })

  it('displays explicit database errors', async () => {
    listLibrary.mockRejectedValue(new Error('RLS denied'))
    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('RLS denied')
  })

  it('shows status totals and updates a reading status from the library row', async () => {
    const user = userEvent.setup()
    listLibrary.mockResolvedValue([exampleEntry])
    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'Obra privada' })
    expect(screen.getByRole('region', { name: 'Resumen de estados de lectura' }))
      .toHaveTextContent('Leyendo1')
    await user.selectOptions(
      screen.getByLabelText('Cambiar estado de lectura de Obra privada'),
      'completed',
    )

    await waitFor(() => expect(updateLibraryEntry).toHaveBeenCalledWith(
      exampleEntry.id,
      {
        reading_status: 'completed',
        last_chapter: null,
        private_notes: null,
        personal_rating: null,
      },
    ))
  })

  it('saves reading progress and private notes for the entry', async () => {
    const user = userEvent.setup()
    listLibrary.mockResolvedValue([exampleEntry])
    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'Obra privada' })
    await user.click(screen.getByText('Editar seguimiento y datos privados'))
    await user.selectOptions(screen.getByLabelText('Estado de lectura'), 'completed')
    await user.type(
      screen.getByRole('textbox', { name: /Último capítulo registrado/ }),
      '42',
    )
    await user.type(screen.getByLabelText('Notas privadas'), 'Leer el volumen final')
    await user.click(screen.getByRole('button', { name: 'Guardar progreso' }))

    await waitFor(() => expect(updateLibraryEntry).toHaveBeenCalledWith(
      exampleEntry.id,
      {
        reading_status: 'completed',
        last_chapter: '42',
        private_notes: 'Leer el volumen final',
        personal_rating: null,
      },
    ))
  })

  it('saves private links and only permits http or https URLs', async () => {
    const user = userEvent.setup()
    listLibrary.mockResolvedValue([exampleEntry])
    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'Obra privada' })
    await user.click(screen.getByText('Editar seguimiento y datos privados'))
    await user.type(screen.getByLabelText('Nombre del enlace'), 'Mi sitio')
    await user.type(screen.getByLabelText('URL externa (http o https)'), 'https://example.org/reader')
    await user.click(screen.getByRole('button', { name: 'Guardar enlace privado' }))

    await waitFor(() => expect(addPersonalLink).toHaveBeenCalledWith(
      exampleEntry.id,
      { label: 'Mi sitio', url: 'https://example.org/reader' },
    ))
  })
})
