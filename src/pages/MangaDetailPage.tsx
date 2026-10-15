import { ExternalLink, Flag, Heart } from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SiteHeader } from '../components/layout/SiteHeader'
import { useAuth } from '../features/auth/AuthContext'
import { getMangaDetail, getRelatedManga } from '../services/catalog/catalogService'
import type { CatalogSearchResult } from '../services/catalog/types'
import { addToLibrary } from '../services/library/libraryService'
import type { MangaDetail } from '../services/catalog/types'
import { hasSupabaseConfig } from '../services/supabase/client'
import { WikiContributionForm } from '../features/wiki/WikiContributionForm'
import {
  listCatalogRevisions,
  type CatalogRevision,
} from '../services/wiki/wikiService'
import { MangaReviews } from '../features/reviews/MangaReviews'
import { CommunityComments } from '../features/comments/CommunityComments'
import { CommunityReportForm } from '../features/reports/CommunityReportForm'
import {
  addMangaFavorite,
  isMangaFavorite,
  removeMangaFavorite,
} from '../services/library/favoriteService'

function MangaFavoriteButton({
  mangaId,
  userId,
}: {
  mangaId: string
  userId: string | null
}) {
  const [favoriteState, setFavoriteState] = useState<{
    mangaId: string
    isFavorite: boolean
    loading: boolean
    error: string | null
  }>({ mangaId: '', isFavorite: false, loading: true, error: null })
  const [pending, setPending] = useState(false)
  const isCurrent = favoriteState.mangaId === mangaId
  const isFavorite = isCurrent && favoriteState.isFavorite
  const loading = Boolean(userId) && (!isCurrent || favoriteState.loading)
  const error = isCurrent ? favoriteState.error : null

  useEffect(() => {
    if (!userId) return
    let active = true
    isMangaFavorite(userId, mangaId)
      .then((favorite) => {
        if (active) {
          setFavoriteState({ mangaId, isFavorite: favorite, loading: false, error: null })
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setFavoriteState({
            mangaId,
            isFavorite: false,
            loading: false,
            error: cause instanceof Error ? cause.message : 'No se pudo cargar tu estado de favoritos.',
          })
        }
      })
    return () => { active = false }
  }, [mangaId, userId])

  async function toggleFavorite() {
    if (!userId) return
    setPending(true)
    setFavoriteState((current) => ({ ...current, error: null }))
    try {
      if (isFavorite) {
        await removeMangaFavorite(userId, mangaId)
        setFavoriteState({ mangaId, isFavorite: false, loading: false, error: null })
      } else {
        await addMangaFavorite(userId, mangaId)
        setFavoriteState({ mangaId, isFavorite: true, loading: false, error: null })
      }
    } catch (cause: unknown) {
      setFavoriteState((current) => ({
        ...current,
        error: cause instanceof Error ? cause.message : 'No se pudo actualizar tus favoritos.',
      }))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      {userId ? (
        <button
          className={`secondary-button detail-favorite-button${isFavorite ? ' is-favorite' : ''}`}
          type="button"
          disabled={loading || pending}
          aria-pressed={isFavorite}
          onClick={() => void toggleFavorite()}
        >
          <Heart size={14} aria-hidden="true" />
          {loading ? 'Cargando…' : pending ? 'Guardando…' : isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
        </button>
      ) : (
        <Link
          className="secondary-button detail-favorite-button"
          to={`/cuenta?redirect=${encodeURIComponent(`/manga/${mangaId}`)}`}
        >
          <Heart size={14} aria-hidden="true" />
          Inicia sesión para guardar favoritos
        </Link>
      )}
      {error && <p className="error-message" role="alert">{error}</p>}
    </>
  )
}

const statusLabels: Record<MangaDetail['publication_status'], string> = {
  ongoing: 'En publicación',
  completed: 'Finalizado',
  hiatus: 'En pausa',
  cancelled: 'Cancelado',
  unknown: 'Desconocido',
}

const verificationLabels: Record<MangaDetail['verification_status'], string> = {
  unverified: 'Sin verificar',
  partially_verified: 'Verificación parcial',
  verified: 'Verificado',
}

const creditLabels: Record<MangaDetail['credits'][number]['role'], string> = {
  author: 'Autoría',
  illustrator: 'Ilustración',
  creator: 'Creación',
  other: 'Otro crédito',
}

const titleTypeLabels: Record<MangaDetail['aliases'][number]['title_type'], string> = {
  translated: 'Traducido',
  romanized: 'Romanizado',
  original: 'Original',
  alternate: 'Alternativo',
}

function getTitleSubtitle(manga: MangaDetail) {
  const title = manga.original_title ?? manga.aliases[0]?.title
  return title && title !== manga.canonical_title ? title : null
}

export function MangaDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const [addPending, setAddPending] = useState(false)
  const [libraryMessage, setLibraryMessage] = useState<string | null>(null)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const [revisionState, setRevisionState] = useState<{
    mangaId: string
    items: CatalogRevision[]
    error: string | null
  }>({ mangaId: '', items: [], error: null })
  const [detailState, setDetailState] = useState<{
    id: string
    loading: boolean
    manga: MangaDetail | null
    error: string | null
  }>({ id: '', loading: true, manga: null, error: null })
  const [relatedState, setRelatedState] = useState<{
    mangaId: string
    items: CatalogSearchResult[]
    error: string | null
  }>({ mangaId: '', items: [], error: null })
  const [configured] = useState(hasSupabaseConfig)
  const stateIsCurrent = detailState.id === id
  const loading = configured && (!stateIsCurrent || detailState.loading)
  const manga = stateIsCurrent ? detailState.manga : null
  const error = stateIsCurrent ? detailState.error : null

  async function addMangaToLibrary() {
    if (!user || !manga) return
    setAddPending(true)
    setLibraryError(null)
    setLibraryMessage(null)
    try {
      await addToLibrary(user.id, manga.id)
      setLibraryMessage('La obra está en tu biblioteca.')
    } catch (cause: unknown) {
      setLibraryError(cause instanceof Error ? cause.message : 'No se pudo agregar la obra.')
    } finally {
      setAddPending(false)
    }
  }

  useEffect(() => {
    let active = true
    if (!configured) {
      return () => { active = false }
    }

    getMangaDetail(id)
      .then((detail) => {
        if (active) {
          setDetailState({ id, loading: false, manga: detail, error: null })
        }
      })
      .catch((cause: unknown) => {
        if (!active) return
        setDetailState({
          id,
          loading: false,
          manga: null,
          error: cause instanceof Error
            ? cause.message
            : 'Ocurrió un error inesperado al cargar la ficha.',
        })
      })
    return () => { active = false }
  }, [configured, id])

  useEffect(() => {
    if (!manga) return
    let active = true
    listCatalogRevisions(manga.id)
      .then((items) => {
        if (active) setRevisionState({ mangaId: manga.id, items, error: null })
      })
      .catch((cause: unknown) => {
        if (active) {
          setRevisionState({
            mangaId: manga.id,
            items: [],
            error: cause instanceof Error ? cause.message : 'No se pudo cargar el historial.',
          })
        }
      })
    return () => { active = false }
  }, [manga])

  useEffect(() => {
    if (!manga) return
    let active = true
    getRelatedManga(manga.id, manga.genres)
      .then((items) => {
        if (active) setRelatedState({ mangaId: manga.id, items, error: null })
      })
      .catch((cause: unknown) => {
        if (active) {
          setRelatedState({
            mangaId: manga.id,
            items: [],
            error: cause instanceof Error ? cause.message : 'No se pudieron cargar obras relacionadas.',
          })
        }
      })
    return () => { active = false }
  }, [manga])

  return (
    <main id="main-content" className="page-shell" tabIndex={-1}>
      <SiteHeader />
      {!configured && (
        <div className="notice-panel" role="status">
          <h1>La ficha aún no está disponible</h1>
          <p>Conecta Supabase y publica fichas verificadas para consultar el catálogo.</p>
        </div>
      )}
      {loading && configured && <p role="status">Cargando ficha…</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {!loading && configured && !error && !manga && (
        <div className="empty-state">
          <h1>La obra no está disponible</h1>
          <p>Puede que la ficha no exista o todavía no esté publicada.</p>
        </div>
      )}
      {manga && !error && (
        <article className="manga-detail">
          <div className="manga-detail-layout">
            <aside className="manga-detail-sidebar" aria-label={`Portada y acciones de ${manga.canonical_title}`}>
              <div
                className={`detail-cover cover-tone-${(manga.canonical_title.codePointAt(0) ?? 0) % 6}`}
                role="img"
                aria-label={`Cubierta tipográfica de ${manga.canonical_title}`}
              >
                <span className="detail-cover-title">{manga.canonical_title}</span>
                <span className="detail-cover-mark" aria-hidden="true">{manga.canonical_title.slice(0, 1)}</span>
              </div>
              <p className="detail-cover-note">Portada alternativa; no hay imagen oficial autorizada.</p>
              <div className="detail-library-action">
              {user ? (
                <button
                  className="primary-button"
                  type="button"
                  disabled={addPending}
                  onClick={addMangaToLibrary}
                >
                  {addPending ? 'Agregando…' : 'Añadir a mi biblioteca'}
                </button>
              ) : (
                <Link
                  className="primary-button"
                  to={`/cuenta?redirect=${encodeURIComponent('/biblioteca')}`}
                >
                  Iniciar sesión
                </Link>
              )}
              {libraryMessage && <p className="success-message" role="status">{libraryMessage}</p>}
              {libraryError && <p className="error-message" role="alert">{libraryError}</p>}
              </div>
              <MangaFavoriteButton mangaId={manga.id} userId={user?.id ?? null} />
              {user && (
                <a className="secondary-button detail-sidebar-link" href="#detail-contribution">
                  Proponer corrección
                </a>
              )}
              <div className="detail-report-action">
                <Flag size={13} aria-hidden="true" />
                <CommunityReportForm
                  targetType="manga"
                  targetId={manga.id}
                  triggerLabel="Reportar información"
                />
              </div>
            </aside>

            <div className="manga-detail-content">
              <header className="detail-heading">
                <div className="detail-badges">
                  <span className="manga-status">{verificationLabels[manga.verification_status]}</span>
                  <span className="manga-status">{statusLabels[manga.publication_status]}</span>
                </div>
                <h1>{manga.canonical_title}</h1>
                {getTitleSubtitle(manga) && (
                  <p className="original-title">{getTitleSubtitle(manga)}</p>
                )}
                <dl className="detail-facts">
                  <div>
                    <dt>Autoría</dt>
                    <dd>{manga.credits.filter((credit) => credit.role === 'author' || credit.role === 'creator').map((credit) => credit.person_name).join(', ') || 'No disponible'}</dd>
                  </div>
                  <div>
                    <dt>Ilustración</dt>
                    <dd>{manga.credits.filter((credit) => credit.role === 'illustrator').map((credit) => credit.person_name).join(', ') || 'No disponible'}</dd>
                  </div>
                  <div>
                    <dt>Estado</dt>
                    <dd>{statusLabels[manga.publication_status]}</dd>
                  </div>
                  <div>
                    <dt>Inicio</dt>
                    <dd>
                      {manga.start_year
                        ? `${manga.start_year}${manga.end_year ? `–${manga.end_year}` : ''}`
                        : 'No disponible'}
                    </dd>
                  </div>
                </dl>
              </header>

              <section className="detail-section">
                <h2>Sinopsis</h2>
                <p>{manga.synopsis || 'Todavía no hay una sinopsis registrada.'}</p>
              </section>
              <section className="detail-section">
                <h2>Títulos alternativos</h2>
                {manga.aliases.length === 0 ? (
                  <p className="muted-copy">No hay títulos alternativos registrados.</p>
                ) : (
                  <ul className="detail-alias-list">
                    <li className="detail-alias-header" aria-hidden="true">
                      <span>Alias</span><span>Idioma</span><span>Escritura</span><span>Tipo</span>
                    </li>
                    {manga.aliases.map((alias) => (
                      <li key={`${alias.title}-${alias.language_code}-${alias.title_type}`}>
                        <strong>{alias.title}</strong>
                        <span>{alias.language_code ?? 'No indicado'}</span>
                        <span>{alias.script_code ?? 'No indicada'}</span>
                        <span>{titleTypeLabels[alias.title_type]}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="detail-section">
                <h2>Géneros y etiquetas</h2>
                {manga.genres.length === 0 ? (
                  <p className="muted-copy">No hay géneros registrados.</p>
                ) : (
                  <ul className="genre-list">
                    {manga.genres.map((genre) => <li key={genre}>{genre}</li>)}
                  </ul>
                )}
              </section>
              {manga.credits.some((credit) => !['author', 'creator', 'illustrator'].includes(credit.role)) && (
                <section className="detail-section">
                  <h2>Otros créditos</h2>
                  <ul className="detail-list">
                    {manga.credits
                      .filter((credit) => !['author', 'creator', 'illustrator'].includes(credit.role))
                      .map((credit) => (
                        <li key={`${credit.role}-${credit.person_name}`}>
                          <strong>{credit.person_name}</strong>
                          <span>{creditLabels[credit.role]}</span>
                        </li>
                      ))}
                  </ul>
                </section>
              )}
              <section className="detail-section">
                <h2>Fuentes consultadas</h2>
                {manga.sources.length === 0 ? (
                  <div className="detail-source-empty">
                    <p>Esta ficha todavía no tiene fuentes registradas.</p>
                    <small>La información debe verificarse antes de considerarse definitiva.</small>
                  </div>
                ) : (
                  <ul className="source-list">
                    {manga.sources.map((source) => (
                      <li key={`${source.source_url}-${source.field_key}`}>
                        <a href={source.source_url} target="_blank" rel="noreferrer">
                          {source.name} <ExternalLink size={14} aria-label="Enlace externo" />
                        </a>
                        <span>{source.field_key}</span>
                        <span>
                          {source.verified_at
                            ? `Verificada el ${new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(source.verified_at))}`
                            : 'Sin fecha de verificación'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <Fragment key={manga.id}>
                <section className="detail-section detail-community" aria-labelledby="detail-community-title">
                  <h2 id="detail-community-title">Comunidad</h2>
                  <MangaReviews mangaId={manga.id} userId={user?.id ?? null} compact />
                  <CommunityComments
                    targetType="manga"
                    targetId={manga.id}
                    userId={user?.id ?? null}
                    compact
                  />
                </section>
              </Fragment>
              {user && (
                <section id="detail-contribution" className="detail-section">
                  <h2>Proponer una corrección</h2>
                  <p className="muted-copy">Las propuestas requieren una fuente HTTPS y solo se publican tras revisión.</p>
                  <WikiContributionForm mangaId={manga.id} />
                </section>
              )}
              <section className="detail-section">
                <h2>Obras relacionadas</h2>
                {relatedState.mangaId !== manga.id && <p role="status">Buscando obras de géneros similares…</p>}
                {relatedState.mangaId === manga.id && relatedState.error && (
                  <p className="error-message" role="alert">{relatedState.error}</p>
                )}
                {relatedState.mangaId === manga.id && !relatedState.error && relatedState.items.length === 0 && (
                  <p className="muted-copy">Todavía no hay otras obras publicadas con géneros coincidentes.</p>
                )}
                {relatedState.mangaId === manga.id && relatedState.items.length > 0 && (
                  <div className="related-manga-grid">
                    {relatedState.items.map((work, index) => (
                      <Link className={`related-manga-card cover-tone-${index % 6}`} key={work.id} to={`/manga/${work.id}`}>
                        <span className="related-manga-cover">
                          <span>{work.canonical_title}</span>
                          <span aria-hidden="true">{work.canonical_title.slice(0, 1)}</span>
                        </span>
                        <strong>{work.canonical_title}</strong>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
              <section className="detail-section">
                <h2>Historial de cambios</h2>
                {revisionState.mangaId !== manga.id && <p role="status">Cargando historial…</p>}
                {revisionState.mangaId === manga.id && revisionState.error && (
                  <p className="error-message" role="alert">{revisionState.error}</p>
                )}
                {revisionState.mangaId === manga.id && !revisionState.error && revisionState.items.length === 0 && (
                  <p className="muted-copy">Todavía no hay cambios aprobados registrados.</p>
                )}
                {revisionState.mangaId === manga.id && revisionState.items.length > 0 && (
                  <ul className="revision-list">
                    {revisionState.items.map((revision) => (
                      <li key={revision.id}>
                        <strong>{revision.field_key}</strong>
                        <span>
                          {revision.previous_value === null ? '—' : String(revision.previous_value)}
                          {' → '}
                          {revision.new_value === null ? '—' : String(revision.new_value)}
                        </span>
                        <time dateTime={revision.created_at}>
                          {new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(revision.created_at))}
                        </time>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </article>
      )}
    </main>
  )
}
