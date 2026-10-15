import { Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SiteHeader } from '../components/layout/SiteHeader'
import {
  getCatalogGenres,
  searchCatalog,
} from '../services/catalog/catalogService'
import type {
  CatalogGenre,
  CatalogSearchParams,
  CatalogSearchResult,
} from '../services/catalog/types'
import { hasSupabaseConfig } from '../services/supabase/client'

const statuses = [
  ['ongoing', 'En publicación'],
  ['completed', 'Finalizado'],
  ['hiatus', 'En pausa'],
  ['cancelled', 'Cancelado'],
  ['unknown', 'Desconocido'],
] as const

function readSearchParams(params: URLSearchParams): CatalogSearchParams {
  const rawYear = Number(params.get('year'))
  const rawPage = Number(params.get('page'))

  return {
    query: params.get('q') ?? '',
    status: params.get('status') ?? '',
    year:
      Number.isInteger(rawYear) && rawYear >= 1 && rawYear <= 9999
        ? rawYear
        : null,
    genre: params.get('genre') ?? '',
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
  }
}

function statusLabel(status: CatalogSearchResult['publication_status']) {
  return statuses.find(([value]) => value === status)?.[1] ?? 'Desconocido'
}

function ResultCard({ manga }: { manga: CatalogSearchResult }) {
  return (
    <article className="manga-card">
      <Link
        className="manga-card-link"
        to={`/manga/${manga.id}`}
        aria-label={`Ver ficha de ${manga.canonical_title}`}
      >
        <div className="cover-placeholder" aria-label="Representación tipográfica, no es una portada oficial">
          <span className="cover-monogram">
            {manga.canonical_title.slice(0, 1).toLocaleUpperCase()}
          </span>
          <span className="cover-note">Diseño tipográfico</span>
        </div>
        <div className="manga-card-content">
          <span className="manga-status">{statusLabel(manga.publication_status)}</span>
          <h2>{manga.canonical_title}</h2>
          {manga.start_year && <p className="manga-year">{manga.start_year}</p>}
          {manga.match_title && manga.match_title !== manga.canonical_title && (
            <p className="matched-title">Coincidencia: {manga.match_title}</p>
          )}
          {manga.aliases.length > 0 && (
            <p className="manga-aliases">{manga.aliases.slice(0, 2).join(' · ')}</p>
          )}
          {manga.creators.length > 0 && (
            <p className="manga-creators">{manga.creators.slice(0, 2).join(', ')}</p>
          )}
          {manga.genres.length > 0 && (
            <ul className="genre-list" aria-label="Géneros">
              {manga.genres.slice(0, 3).map((genre) => <li key={genre}>{genre}</li>)}
            </ul>
          )}
        </div>
      </Link>
    </article>
  )
}

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const searchKey = searchParams.toString()
  const filters = useMemo(
    () => readSearchParams(new URLSearchParams(searchKey)),
    [searchKey],
  )
  const [queryDraft, setQueryDraft] = useState({ forQuery: '', value: '' })
  const queryInput =
    queryDraft.forQuery === filters.query ? queryDraft.value : filters.query
  const requestKey = JSON.stringify(filters)
  const [catalogState, setCatalogState] = useState<{
    key: string
    loading: boolean
    results: CatalogSearchResult[]
    hasMore: boolean
    genres: CatalogGenre[]
    error: string | null
  }>({
    key: '',
    loading: true,
    results: [],
    hasMore: false,
    genres: [],
    error: null,
  })
  const [configured] = useState(hasSupabaseConfig)
  const stateIsCurrent = catalogState.key === requestKey
  const loading = configured && (!stateIsCurrent || catalogState.loading)
  const results = stateIsCurrent ? catalogState.results : []
  const hasMore = stateIsCurrent && catalogState.hasMore
  const genres = catalogState.genres
  const error = stateIsCurrent ? catalogState.error : null

  useEffect(() => {
    let active = true

    if (!configured) {
      return () => { active = false }
    }

    Promise.all([searchCatalog(filters), getCatalogGenres()])
      .then(([nextResults, nextGenres]) => {
        if (!active) return
        setCatalogState({
          key: requestKey,
          loading: false,
          results: nextResults.items,
          hasMore: nextResults.hasMore,
          genres: nextGenres,
          error: null,
        })
      })
      .catch((cause: unknown) => {
        if (!active) return
        setCatalogState({
          key: requestKey,
          loading: false,
          results: [],
          hasMore: false,
          genres: [],
          error: cause instanceof Error
            ? cause.message
            : 'Ocurrió un error inesperado al consultar el catálogo.',
        })
      })

    return () => { active = false }
  }, [configured, filters, requestKey])

  function updateFilters(next: Partial<CatalogSearchParams>) {
    const updated = { ...filters, ...next, page: 1 }
    const params = new URLSearchParams()
    if (updated.query) params.set('q', updated.query)
    if (updated.status) params.set('status', updated.status)
    if (updated.year) params.set('year', String(updated.year))
    if (updated.genre) params.set('genre', updated.genre)
    setSearchParams(params)
  }

  function clearFilters() {
    setQueryDraft({ forQuery: '', value: '' })
    setSearchParams({})
  }

  const canGoBack = filters.page > 1
  const canGoForward = hasMore

  function changePage(page: number) {
    const params = new URLSearchParams(searchParams)
    if (page > 1) params.set('page', String(page))
    else params.delete('page')
    setSearchParams(params)
  }

  return (
    <main id="main-content" className="page-shell" tabIndex={-1}>
      <SiteHeader />
      <section className="catalog-heading">
        <p className="eyebrow">Catálogo comunitario</p>
        <h1>Explora mangas</h1>
        <p>Busca por título o alias y filtra las obras con información disponible.</p>
      </section>

      <form
        className="catalog-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          updateFilters({ query: queryInput.trim() })
        }}
      >
        <label className="search-field">
          <Search aria-hidden="true" />
          <span className="visually-hidden">Buscar por título o alias</span>
          <input
            type="search"
            value={queryInput}
            onChange={(event) => setQueryDraft({
              forQuery: filters.query,
              value: event.target.value,
            })}
            placeholder="Título, nombre alternativo..."
          />
        </label>
        <button className="primary-button" type="submit">Buscar</button>
      </form>

      <section className="catalog-layout" aria-label="Resultados del catálogo">
        <aside className="filter-panel">
          <h2><SlidersHorizontal size={18} aria-hidden="true" /> Filtros</h2>
          <label>
            Estado de publicación
            <select
              value={filters.status}
              onChange={(event) => updateFilters({ status: event.target.value })}
            >
              <option value="">Todos los estados</option>
              {statuses.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Año de inicio
            <input
              type="number"
              min="1"
              max="9999"
              inputMode="numeric"
              value={filters.year ?? ''}
              onChange={(event) => {
                const value = event.target.value
                updateFilters({
                  year: value && Number.isInteger(Number(value)) ? Number(value) : null,
                })
              }}
              placeholder="Cualquier año"
            />
          </label>
          <label>
            Género
            <select
              value={filters.genre}
              onChange={(event) => updateFilters({ genre: event.target.value })}
            >
              <option value="">Todos los géneros</option>
              {genres.map((genre) => (
                <option key={genre.slug} value={genre.slug}>{genre.name}</option>
              ))}
            </select>
          </label>
          <button className="text-button" type="button" onClick={clearFilters}>
            Limpiar filtros
          </button>
        </aside>

        <div className="results-panel">
          <div className="results-toolbar" aria-live="polite">
            {!loading && !error && configured && (
              <span>{results.length} {results.length === 1 ? 'obra' : 'obras'} en esta página</span>
            )}
          </div>
          {!configured && (
            <div className="notice-panel" role="status">
              <h2>El catálogo todavía no está conectado</h2>
              <p>
                Configura un proyecto Supabase y aplica la migración del catálogo
                para cargar fichas publicadas. No se muestran datos de ejemplo como
                si fueran información real.
              </p>
            </div>
          )}
          {loading && configured && <p role="status">Cargando catálogo…</p>}
          {error && <p className="error-message" role="alert">{error}</p>}
          {!loading && !error && configured && results.length === 0 && (
            <div className="empty-state">
              <h2>No encontramos mangas</h2>
              <p>Prueba con otro título o quita algunos filtros.</p>
              <button className="text-button" type="button" onClick={clearFilters}>
                Limpiar búsqueda y filtros
              </button>
            </div>
          )}
          {results.length > 0 && !error && (
            <>
              <div className="manga-grid">
                {results.map((manga) => <ResultCard key={manga.id} manga={manga} />)}
              </div>
              <nav className="pagination" aria-label="Paginación de resultados">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!canGoBack || loading}
                  onClick={() => changePage(filters.page - 1)}
                >
                  Anterior
                </button>
                <span>Página {filters.page}</span>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!canGoForward || loading}
                  onClick={() => changePage(filters.page + 1)}
                >
                  Siguiente
                </button>
              </nav>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
