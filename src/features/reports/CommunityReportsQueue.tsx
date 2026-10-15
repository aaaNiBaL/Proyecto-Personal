import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listPendingCommunityReports,
  reportReasonLabels,
  reviewCommunityReport,
  type PendingCommunityReport,
} from '../../services/reports/communityReportService'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function CommunityReportsQueue() {
  const [reports, setReports] = useState<PendingCommunityReport[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function refresh() {
    const nextReports = await listPendingCommunityReports()
    setReports(nextReports)
  }

  useEffect(() => {
    let active = true
    listPendingCommunityReports()
      .then((nextReports) => {
        if (active) setReports(nextReports)
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las denuncias.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  async function handleReview(
    report: PendingCommunityReport,
    decision: 'resolved' | 'dismissed',
    form: HTMLFormElement,
  ) {
    setPendingId(report.id)
    setError(null)
    setMessage(null)
    const note = String(new FormData(form).get('moderator_note') ?? '')
    try {
      await reviewCommunityReport(report.id, decision, note)
      await refresh()
      setMessage(decision === 'resolved' ? 'Denuncia marcada como atendida.' : 'Denuncia descartada.')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo revisar la denuncia.')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section className="community-reports-section" aria-labelledby="community-reports-heading">
      <p className="eyebrow">Moderación comunitaria</p>
      <h2 id="community-reports-heading">Denuncias pendientes</h2>
      {loading && <p role="status">Cargando denuncias…</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {message && <p className="success-message" role="status">{message}</p>}
      {!loading && !error && reports.length === 0 && (
        <p className="muted-copy">No hay denuncias pendientes.</p>
      )}
      <ul className="community-reports-list">
        {reports.map((report) => (
          <li className="community-report-card" key={report.id}>
            <header className="community-report-card-header">
              <div>
                <p className="eyebrow">Denuncia de @{report.reporter_username}</p>
                <h3>{report.target_title ?? 'Contenido eliminado o no disponible'}</h3>
              </div>
              <time dateTime={report.created_at}>{formatDate(report.created_at)}</time>
            </header>
            <dl className="community-report-meta">
              <div><dt>Tipo</dt><dd>{
                report.target_type === 'review' ? 'Reseña'
                  : report.target_type === 'profile' ? 'Perfil'
                    : report.target_type === 'list' ? 'Lista'
                      : report.target_type === 'manga' ? 'Ficha de manga'
                        : 'Comentario'
              }</dd></div>
              <div><dt>Motivo</dt><dd>{reportReasonLabels[report.reason]}</dd></div>
              {report.target_path && (
                <div>
                  <dt>Contenido</dt>
                  <dd><Link to={report.target_path}>Abrir contenido</Link></dd>
                </div>
              )}
            </dl>
            {report.target_excerpt && (
              <blockquote className="reported-content">{report.target_excerpt}</blockquote>
            )}
            {report.details && <p><strong>Detalles de quien denuncia:</strong> {report.details}</p>}
            <form className="community-report-review-form" onSubmit={(event) => event.preventDefault()}>
              <label>
                Nota de moderación (opcional)
                <textarea name="moderator_note" maxLength={1000} rows={2} />
              </label>
              <div className="moderation-actions">
                <button
                  className="primary-button"
                  type="button"
                  disabled={pendingId !== null}
                  onClick={(event) => {
                    const form = event.currentTarget.form
                    if (form) void handleReview(report, 'resolved', form)
                  }}
                >
                  {pendingId === report.id ? 'Guardando…' : 'Marcar atendida'}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={pendingId !== null}
                  onClick={(event) => {
                    const form = event.currentTarget.form
                    if (form) void handleReview(report, 'dismissed', form)
                  }}
                >
                  Descartar
                </button>
              </div>
            </form>
          </li>
        ))}
      </ul>
    </section>
  )
}
