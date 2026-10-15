import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CatalogPage } from './CatalogPage'

const { getCatalogGenres, searchCatalog } = vi.hoisted(() => ({
  getCatalogGenres: vi.fn(),
  searchCatalog: vi.fn(),
}))

vi.mock('../services/catalog/catalogService', () => ({
  getCatalogGenres,
  searchCatalog,
}))

vi.mock('../services/supabase/client', () => ({
  hasSupabaseConfig: () => true,
}))

vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
}))

const manga = {
  id: '66a4bf64-1d89-4d39-8de6-bba0b966572f',
  canonical_title: 'Obra de prueba',
  original_title: null,
  publication_status: 'ongoing' as const,
  start_year: 2022,
  aliases: ['Test Work'],
  genres: ['Aventura'],
  creators: ['Autora de prueba'],
  match_title: 'Test Work',
}

function renderCatalog(initialEntry = '/explorar') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/explorar" element={<CatalogPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CatalogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCatalogGenres.mockResolvedValue([{ slug: 'adventure', name: 'Aventura' }])
    searchCatalog.mockResolvedValue({ items: [manga], hasMore: false })
  })

  it('searches by title and shows matching aliases', async () => {
    const user = userEvent.setup()
    renderCatalog()

    expect(await screen.findByRole('heading', { name: 'Obra de prueba' })).toBeInTheDocument()
    expect(screen.getByText('Coincidencia: Test Work')).toBeInTheDocument()

    const searchInput = screen.getByRole('searchbox', { name: 'Buscar por título o alias' })
    await user.type(searchInput, 'Test Work')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    await waitFor(() => {
      expect(searchCatalog).toHaveBeenLastCalledWith(
        expect.objectContaining({ query: 'Test Work', page: 1 }),
      )
    })
  })

  it('shows an actionable empty state', async () => {
    searchCatalog.mockResolvedValue({ items: [], hasMore: false })
    renderCatalog('/explorar?q=missing')

    expect(await screen.findByRole('heading', { name: 'No encontramos mangas' }))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Limpiar búsqueda y filtros' }))
      .toBeInTheDocument()
  })

  it('applies the selected status filter', async () => {
    renderCatalog()
    await screen.findByRole('heading', { name: 'Obra de prueba' })

    fireEvent.change(screen.getByRole('combobox', { name: 'Estado de publicación' }), {
      target: { value: 'completed' },
    })

    await waitFor(() => {
      expect(searchCatalog).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'completed', page: 1 }),
      )
    })
  })

  it('only enables the next page when another result exists', async () => {
    const user = userEvent.setup()
    searchCatalog.mockResolvedValue({ items: [manga], hasMore: true })
    renderCatalog()
    await screen.findByRole('heading', { name: 'Obra de prueba' })

    await user.click(screen.getByRole('button', { name: 'Siguiente' }))

    await waitFor(() => {
      expect(searchCatalog).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      )
    })
    expect(await screen.findByText('Página 2')).toBeInTheDocument()
  })
})
