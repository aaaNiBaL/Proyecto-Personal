import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SiteHeader } from '../components/layout/SiteHeader'
import {
  getPublicMangaList,
  type PublicMangaList,
} from '../services/lists/mangaListService'
import { CommunityReportForm } from '../features/reports/CommunityReportForm'

export function PublicMangaListPage() {
  const { id = '' } = useParams()
  const [state, setState] = useState<{
    id: string
    loading: boolean
    list: PublicMangaList | null
    error: string | null
  }>({ id: '', loading: true, list: null, error: null })
  const isCurrent = state.id === id
  const loading = !isCurrent || state.loading
  const list = isCurrent ? state.list : null
  const error = isCurrent ? state.error : null

  useEffect(() => {
    let active = true
    getPublicMangaList(id)
      .then((nextList) => {
        if (active) setState({ id, loading: false, list: nextList, error: null })
      })
      .catch((cause: unknown) => {
        if (active) {
          setState({
            id,
            loading: false,
            list: null,
            error: cause instanceof Error ? cause.message : 'No se pudo cargar la lista.',
          })
        }
      })
    return () => { active = false }
  }, [id])

  return (
    <main id="main-content" className="page-shell" tabIndex={-1}>
      <SiteHeader />
      {loading && <p role="status">Cargando lista…</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {!loading && !error && !list && (
        <div className="empty-state profile-not-found">
          <h1>Lista no disponible</h1>
          <p>Puede que no exista o que su dueño la haya mantenido privada.</p>
          <Link className="secondary-button" to="/explorar">Explorar mangas</Link>
        </div>
      )}
      {list && (
        <article className="public-manga-list">
          <header className="public-manga-list-header">
            <p className="eyebrow">Lista pública</p>
            <h1>{list.title}</h1>
            {list.description && <p className="public-profile-bio">{list.description}</p>}
            <p className="muted-copy">
              Creada por <Link to={`/usuario/${list.username}`}>{list.display_name} (@{list.username})</Link>
              {' · '}{list.items.length} {list.items.length === 1 ? 'obra' : 'obras'}
            </p>
            <CommunityReportForm targetType="list" targetId={list.id} />
          </header>
          {list.items.length === 0 ? (
            <div className="empty-state"><h2>Esta lista aún no tiene obras</h2></div>
          ) : (
            <ul className="public-list-manga-items">
              {list.items.map((manga) => (
                <li className="public-list-manga-card" key={manga.id}>
                  <Link to={`/manga/${manga.id}`}>
                    <span className="cover-placeholder" aria-hidden="true">
                      <span className="cover-monogram">
                        {manga.canonical_title.slice(0, 1).toLocaleUpperCase()}
                      </span>
                      <span>Portada no disponible</span>
                    </span>
                    <span className="public-list-manga-info">
                      <strong>{manga.canonical_title}</strong>
                      {manga.start_year && <span>{manga.start_year}</span>}
                      {manga.synopsis && <span>{manga.synopsis}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>
      )}
    </main>
  )
}
