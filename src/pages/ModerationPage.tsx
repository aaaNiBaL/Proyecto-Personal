import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SiteHeader } from '../components/layout/SiteHeader'
import { CommunityReportsQueue } from '../features/reports/CommunityReportsQueue'
import {
  isCatalogModerator,
  listPendingContributions,
  reviewContribution,
  type PendingContribution,
} from '../services/wiki/wikiService'

export function ModerationPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [items, setItems] = useState<PendingContribution[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    const moderator = await isCatalogModerator()
    const contributions = moderator ? await listPendingContributions() : []
    return { moderator, contributions }
  }, [])

  useEffect(() => {
    let active = true
    loadItems()
      .then(({ moderator, contributions }) => {
        if (active) {
          setAuthorized(moderator)
          setItems(contributions)
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'No se pudo comprobar el acceso.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [loadItems])

  async function handleReview(
    contribution: PendingContribution,
    decision: 'approved' | 'rejected',
    form: HTMLFormElement,
  ) {
    setPendingId(contribution.id)
    setError(null)
    setMessage(null)
    const note = String(new FormData(form).get('moderator_note') ?? '')
    try {
      await reviewContribution(contribution.id, decision, note)
      setMessage(decision === 'approved' ? 'Propuesta aprobada.' : 'Propuesta rechazada.')
      const { moderator, contributions } = await loadItems()
      setAuthorized(moderator)
      setItems(contributions)
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo revisar la propuesta.')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <main id="main-content" className="page-shell" tabIndex={-1}>
      <SiteHeader />
      <section className="content-section">
        <p className="eyebrow">Herramientas editoriales</p>
        <h1 className="page-title">Moderación</h1>
        {loading && <p role="status">Comprobando permisos…</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
        {!loading && authorized === false && (
          <div className="notice-panel" role="alert">
            <h2>Acceso restringido</h2>
            <p>Tu cuenta no tiene rol de moderador o administrador.</p>
          </div>
        )}
        {message && <p className="success-message" role="status">{message}</p>}
        {!loading && authorized && !error && items.length === 0 && (
          <div className="empty-state"><h2>No hay propuestas pendientes</h2></div>
        )}
        <ul className="contribution-list">
          {items.map((item) => (
            <li className="contribution-card" key={item.id}>
              <div className="contribution-card-heading">
                <h2>{item.contribution_type === 'alias' ? 'Título alternativo' : 'Corrección de ficha'}</h2>
                <Link to={`/manga/${item.manga_id}`}>{item.manga_title}</Link>
              </div>
              <dl>
                {Object.entries(item.proposed_changes).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value === null ? '—' : String(value)}</dd>
                  </div>
                ))}
              </dl>
              <p><a href={item.source_url} target="_blank" rel="noreferrer">Abrir fuente verificada por el proponente</a></p>
              {item.note && <p className="muted-copy">Nota: {item.note}</p>}
              <form
                className="wiki-form moderation-form"
                onSubmit={(event) => event.preventDefault()}
              >
                <label>Nota de moderación (opcional)<textarea name="moderator_note" maxLength={2000} rows={2} /></label>
                <div className="moderation-actions">
                  <button
                    className="primary-button"
                    type="button"
                    disabled={pendingId !== null}
                    onClick={(event) => {
                      const form = event.currentTarget.form
                      if (form) void handleReview(item, 'approved', form)
                    }}
                  >
                    {pendingId === item.id ? 'Guardando…' : 'Aprobar'}
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={pendingId !== null}
                    onClick={(event) => {
                      const form = event.currentTarget.form
                      if (form) void handleReview(item, 'rejected', form)
                    }}
                  >
                    Rechazar
                  </button>
                </div>
              </form>
            </li>
          ))}
        </ul>
        {authorized && <CommunityReportsQueue />}
      </section>
    </main>
  )
}
