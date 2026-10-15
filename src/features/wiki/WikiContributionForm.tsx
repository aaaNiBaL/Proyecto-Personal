import { useState, type FormEvent } from 'react'
import {
  contributionTypeSchema,
  submitContribution,
  type ContributionType,
} from '../../services/wiki/wikiService'

export function WikiContributionForm({ mangaId }: { mangaId: string }) {
  const [type, setType] = useState<ContributionType>('metadata')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    setMessage(null)
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const optionalNumber = (value: FormDataEntryValue | null) => {
      const text = String(value ?? '').trim()
      return text ? Number(text) : null
    }
    const changes = type === 'metadata'
      ? {
          canonical_title: String(form.get('canonical_title') ?? '').trim() || undefined,
          synopsis: String(form.get('synopsis') ?? '').trim() || undefined,
          publication_status: String(form.get('publication_status') ?? '') || undefined,
          start_year: optionalNumber(form.get('start_year')) ?? undefined,
          end_year: optionalNumber(form.get('end_year')) ?? undefined,
        }
      : {
          title: String(form.get('title') ?? '').trim(),
          language_code: String(form.get('language_code') ?? '').trim() || null,
          title_type: String(form.get('title_type') ?? 'alternate'),
        }

    try {
      await submitContribution({
        mangaId,
        type,
        changes,
        sourceUrl: String(form.get('source_url') ?? ''),
        note: String(form.get('note') ?? ''),
      })
      formElement.reset()
      setMessage('Propuesta enviada. Quedará pendiente hasta que la revise un moderador.')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo enviar la propuesta.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="wiki-form" onSubmit={handleSubmit}>
      <label>
        Tipo de propuesta
        <select
          value={type}
          onChange={(event) => setType(contributionTypeSchema.parse(event.target.value))}
          disabled={pending}
        >
          <option value="metadata">Corregir datos de la ficha</option>
          <option value="alias">Añadir título alternativo</option>
        </select>
      </label>

      {type === 'metadata' ? (
        <>
          <label>Título oficial propuesto<input name="canonical_title" maxLength={240} /></label>
          <label>Sinopsis propuesta<textarea name="synopsis" maxLength={10000} rows={4} /></label>
          <label>
            Estado de publicación
            <select name="publication_status" defaultValue="">
              <option value="">Sin cambios</option>
              <option value="ongoing">En publicación</option>
              <option value="completed">Finalizado</option>
              <option value="hiatus">En pausa</option>
              <option value="cancelled">Cancelado</option>
              <option value="unknown">Desconocido</option>
            </select>
          </label>
          <div className="wiki-year-fields">
            <label>Año inicial<input name="start_year" type="number" min="1" max="9999" /></label>
            <label>Año final<input name="end_year" type="number" min="1" max="9999" /></label>
          </div>
        </>
      ) : (
        <>
          <label>Título alternativo<input name="title" required maxLength={240} /></label>
          <label>Código de idioma<input name="language_code" maxLength={20} placeholder="ja, en, es" /></label>
          <label>
            Tipo de título
            <select name="title_type" defaultValue="alternate">
              <option value="alternate">Alternativo</option>
              <option value="translated">Traducido</option>
              <option value="romanized">Romanizado</option>
              <option value="original">Original</option>
            </select>
          </label>
        </>
      )}

      <label>Fuente HTTPS<input name="source_url" type="url" required placeholder="https://…" /></label>
      <label>Nota para revisión (opcional)<textarea name="note" maxLength={2000} rows={2} /></label>
      <p className="form-hint">La propuesta no cambia el catálogo hasta ser aprobada.</p>
      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? 'Enviando…' : 'Enviar propuesta'}
      </button>
      {message && <p className="success-message" role="status">{message}</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
    </form>
  )
}
