import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SiteHeader } from '../components/layout/SiteHeader'
import { useAuth } from '../features/auth/AuthContext'
import {
  listOwnContributions,
  type ContributionStatus,
  type OwnContribution,
} from '../services/wiki/wikiService'

type StatusFilter = 'all' | ContributionStatus

const statusLabels: Record<ContributionStatus, string> = {
  pending: 'En revisión',
  approved: 'Aprobada',
  rejected: 'Rechazada',
}

const filterLabels: Record<StatusFilter, string> = {
  all: 'Todas',
  pending: 'Pendientes',
  approved: 'Aprobadas',
  rejected: 'Rechazadas',
}

const fieldLabels: Record<string, string> = {
  canonical_title: 'Título',
  synopsis: 'Sinopsis',
  publication_status: 'Estado de publicación',
  start_year: 'Año de inicio',
  end_year: 'Año de finalización',
  title: 'Título alternativo',
  language_code: 'Idioma',
  script_code: 'Sistema de escritura',
  title_type: 'Tipo de título',
}

const publicationStatusLabels: Record<string, string> = {
  ongoing: 'En publicación',
  completed: 'Finalizada',
  hiatus: 'En pausa',
  cancelled: 'Cancelada',
  unknown: 'Desconocido',
}

function formatValue(field: string, value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  if (field === 'publication_status' && typeof value === 'string') {
    return publicationStatusLabels[value] ?? value
  }
  if (field === 'title_type' && typeof value === 'string') {
    return ({
      translated: 'Traducido',
      romanized: 'Romanizado',
      original: 'Original',
      alternate: 'Alternativo',
    } as Record<string, string>)[value] ?? value
  }
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : JSON.stringify(value)
}

function relativeDate(value: string) {
  const date = new Date(value)
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  if (days < 30) return `Hace ${Math.floor(days / 7)} ${Math.floor(days / 7) === 1 ? 'semana' : 'semanas'}`
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(date)
}

function contributionKind(item: OwnContribution) {
  return item.contribution_type === 'alias' ? 'Título alternativo' : 'Corrección de ficha'
}

export function ContributionsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<OwnContribution[]>([])
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let active = true
    listOwnContributions(user.id)
      .then((contributions) => {
        if (active) setItems(contributions)
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar tus propuestas.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [user])

  const counts = useMemo(() => ({
    all: items.length,
    pending: items.filter((item) => item.status === 'pending').length,
    approved: items.filter((item) => item.status === 'approved').length,
    rejected: items.filter((item) => item.status === 'rejected').length,
  }), [items])
  const visibleItems = filter === 'all'
    ? items
    : items.filter((item) => item.status === filter)

  return (
    <main id="main-content" className="page-shell contributions-page" tabIndex={-1}>
      <SiteHeader />
      <header className="contributions-heading">
        <p className="eyebrow">Mi espacio · Wiki</p>
        <h1>Mis propuestas</h1>
        <p>Tus correcciones y aportes a la wiki. Una propuesta pendiente nunca reemplaza los datos aprobados hasta que se revise.</p>
      </header>

      <section className="contributions-content" aria-label="Tus propuestas">
        {loading && <p role="status">Cargando propuestas…</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <div className="empty-state contributions-empty">
            <h2>Aún no has enviado propuestas</h2>
            <p>Elige una obra del catálogo para sugerir una corrección con una fuente verificable.</p>
            <Link className="secondary-button" to="/explorar">Explorar catálogo</Link>
          </div>
        )}
        {!loading && !error && items.length > 0 && (
          <>
            <div className="contributions-toolbar">
              <span>{items.length} {items.length === 1 ? 'propuesta' : 'propuestas'}</span>
              <Link className="primary-button" to="/explorar">
                <Plus size={16} aria-hidden="true" />
                Nueva propuesta
              </Link>
            </div>
            <div className="contribution-filters" role="tablist" aria-label="Filtrar propuestas">
              {(Object.keys(filterLabels) as StatusFilter[]).map((status) => (
                <button
                  key={status}
                  id={`contribution-filter-${status}`}
                  role="tab"
                  type="button"
                  aria-selected={filter === status}
                  aria-controls="contribution-results"
                  onClick={() => setFilter(status)}
                >
                  {filterLabels[status]}
                  <span>{counts[status]}</span>
                </button>
              ))}
            </div>
            {visibleItems.length === 0 ? (
              <div className="contributions-filter-empty">
                No tienes propuestas {filterLabels[filter].toLocaleLowerCase()}.
              </div>
            ) : (
              <ul className="contribution-list contributions-results" id="contribution-results" role="tabpanel" aria-labelledby={`contribution-filter-${filter}`}>
                {visibleItems.map((item) => (
                  <li className="contribution-card" key={item.id}>
                    <article>
                      <div className="contribution-card-heading">
                        <p className="contribution-meta">{relativeDate(item.created_at)} · {contributionKind(item)}</p>
                        <span className={`contribution-status status-${item.status}`}>
                          {statusLabels[item.status]}
                        </span>
                      </div>
                      <h2><Link to={`/manga/${item.manga_id}`}>{item.manga_title}</Link></h2>
                      <dl className="contribution-change">
                        <div>
                          <dt>Dato actual</dt>
                          <dd>No disponible</dd>
                        </div>
                        <div>
                          <dt>Tu propuesta</dt>
                          <dd>
                            {Object.entries(item.proposed_changes).map(([field, value]) => (
                              <span className="contribution-proposed-value" key={field}>
                                {Object.keys(item.proposed_changes).length > 1 && (
                                  <span>{fieldLabels[field] ?? field}: </span>
                                )}
                                {formatValue(field, value)}
                              </span>
                            ))}
                          </dd>
                        </div>
                      </dl>
                      <div className="contribution-card-footer">
                        <a href={item.source_url} target="_blank" rel="noreferrer">Ver fuente</a>
                        {item.note && <span>Tu nota: {item.note}</span>}
                      </div>
                      {item.review_note && (
                        <p className="contribution-review-note">Nota del revisor: {item.review_note}</p>
                      )}
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </main>
  )
}
