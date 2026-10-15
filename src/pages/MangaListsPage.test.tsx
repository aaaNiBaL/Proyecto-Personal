import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MangaListsPage } from './MangaListsPage'

const { authUser, listOwnMangaLists } = vi.hoisted(() => ({
  authUser: { current: { id: 'a242eaa0-a5b2-4ce0-97cd-2792fb127fcb' } as { id: string } | null },
  listOwnMangaLists: vi.fn(),
}))

vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ user: authUser.current }),
}))

vi.mock('../services/lists/mangaListService', () => ({
  addMangaToList: vi.fn(),
  createMangaList: vi.fn(),
  deleteMangaList: vi.fn(),
  listOwnMangaLists,
  mangaListInputSchema: {
    parse: (value: unknown) => value,
  },
  removeMangaFromList: vi.fn(),
  updateMangaList: vi.fn(),
}))

vi.mock('../services/catalog/catalogService', () => ({
  searchCatalog: vi.fn(),
}))

const ownList = {
  id: '5ab7a4a9-d55d-4f90-9080-8109430de99b',
  user_id: 'a242eaa0-a5b2-4ce0-97cd-2792fb127fcb',
  title: 'Lecturas tranquilas',
  description: 'Para leer con calma.',
  is_public: true,
  created_at: '2026-10-01T12:00:00+00:00',
  updated_at: '2026-10-01T12:00:00+00:00',
  items: [
    {
      id: '66a4bf64-1d89-4d39-8de6-bba0b966572f',
      canonical_title: 'Faro del norte',
      synopsis: null,
      publication_status: 'completed' as const,
      start_year: 2024,
      added_at: '2026-10-01T12:00:00+00:00',
    },
  ],
}

function renderLists() {
  return render(
    <MemoryRouter>
      <MangaListsPage />
    </MemoryRouter>,
  )
}

describe('MangaListsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authUser.current = { id: 'a242eaa0-a5b2-4ce0-97cd-2792fb127fcb' }
    listOwnMangaLists.mockResolvedValue([])
  })

  it('shows illustrative lists without exposing or loading private user lists when signed out', async () => {
    authUser.current = null
    renderLists()

    expect(screen.getByRole('heading', { name: 'Historias de mar y faros' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Recomendadas para empezar' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pendientes del verano' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Nueva lista' })).toHaveAttribute(
      'href',
      '/cuenta?redirect=%2Flistas',
    )
    expect(listOwnMangaLists).not.toHaveBeenCalled()
  })

  it('shows real list cards with editing and sharing actions for signed-in users', async () => {
    const user = userEvent.setup()
    listOwnMangaLists.mockResolvedValue([ownList])
    renderLists()

    expect(await screen.findByRole('heading', { name: 'Lecturas tranquilas' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Compartir' })).toHaveAttribute(
      'href',
      `/listas/${ownList.id}`,
    )
    await user.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.getByDisplayValue('Lecturas tranquilas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()
    await waitFor(() => expect(listOwnMangaLists).toHaveBeenCalledWith(ownList.user_id))
  })
})
