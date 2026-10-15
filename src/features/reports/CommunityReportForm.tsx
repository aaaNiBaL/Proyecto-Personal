import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  reportReasonSchema,
  submitCommunityReport,
  type ReportTargetType,
  reportReasonLabels,
} from '../../services/reports/communityReportService'

export function CommunityReportForm({
  targetType,
  targetId,
  triggerLabel = 'Denunciar',
}: {
  targetType: ReportTargetType
  targetId: string
  triggerLabel?: string
}) {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setPending(true)
    setMessage(null)
    setError(null)
    try {
      await submitCommunityReport({
        targetType,
        targetId,
        reason: reportReasonSchema.parse(form.get('reason')),
        details: String(form.get('details') ?? ''),
      })
      formElement.reset()
      setExpanded(false)
      setMessage('Denuncia enviada. El equipo de moderación la revisará.')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo enviar la denuncia.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="community-report">
      {user ? (
        <>
          <button
            className="text-button"
            type="button"
            aria-expanded={expanded}
            onClick={() => {
              setExpanded((value) => !value)
              setError(null)
            }}
          >
            {triggerLabel}
          </button>
          {expanded && (
            <form className="community-report-form" onSubmit={handleSubmit}>
              <label>
                Motivo
                <select name="reason" required defaultValue="inappropriate">
                  {Object.entries(reportReasonLabels).map(([reason, label]) => (
                    <option key={reason} value={reason}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                Detalles (opcional)
                <textarea name="details" maxLength={1000} rows={3} />
              </label>
              <button className="secondary-button" type="submit" disabled={pending}>
                {pending ? 'Enviando…' : 'Enviar denuncia'}
              </button>
            </form>
          )}
        </>
      ) : (
        <Link
          className="text-button"
          to="/cuenta"
          aria-label={`Inicia sesión para ${triggerLabel.toLocaleLowerCase('es')}`}
          title="Inicia sesión para enviar una denuncia"
        >
          {triggerLabel}
        </Link>
      )}
      {message && <span className="success-message" role="status">{message}</span>}
      {error && <span className="error-message" role="alert">{error}</span>}
    </div>
  )
}
