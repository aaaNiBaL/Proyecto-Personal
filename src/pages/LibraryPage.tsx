import { ExternalLink, LockKeyhole, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { SiteHeader } from '../components/layout/SiteHeader'
import { useAuth } from '../features/auth/AuthContext'
import {
  addPersonalLink,
  listLibrary,
  readingStatusSchema,
  removeLibraryEntry,
  removePersonalLink,
  updateLibraryEntry,
  type LibraryEntry,
  type LibraryEntryUpdate,
  type ReadingStatus,
} from '../services/library/libraryService'

const statusOptions: Array<[ReadingStatus, string]> = [
  ['to_read', 'Por leer'],
  ['reading', 'Leyendo'],
  ['paused', 'En pausa'],
  ['completed', 'Terminado'],
  ['dropped', 'Abandonado'],
]

const statusLabels = new Map(statusOptions)
const previewEntries: Array<{
  title: string
  status: ReadingStatus
  chapter: string
}> = [
  { title: 'El Faro de Tinta', status: 'reading', chapter: '42' },
  { title: 'Nube de Papel', status: 'completed', chapter: '88' },
  { title: 'Ronin del Andén 9', status: 'paused', chapter: '12' },
]

function LibraryPreviewEntry({
  title,
  status,
  chapter,
  index,
}: (typeof previewEntries)[number] & { index: number }) {
  return (
    <article className="library-entry is-preview">
      <div className={`library-cover cover-tone-${index}`} aria-hidden="true">
        <span>{title}</span>
      </div>
      <header className="library-entry-heading">
        <div className="library-entry-copy">
          <h2>{title}</h2>
          <p className="library-entry-summary">
            <span>Último capítulo registrado por ti: {chapter}</span>
          </p>
        </div>
        <label className="library-status-control">
          <span className="visually-hidden">Estado de lectura de {title}</span>
          <select
            aria-label={`Estado de lectura de ejemplo: ${title}`}
            value={status}
            disabled
          >
            {statusOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </header>
    </article>
  )
}

function LibraryEntryCard({
  entry,
  onChanged,
}: {
  entry: LibraryEntry
  onChanged: (message: string) => void
}) {
  const [status, setStatus] = useState(entry.reading_status)
  const [chapter, setChapter] = useState(entry.last_chapter ?? '')
  const [notes, setNotes] = useState(entry.private_notes ?? '')
  const [rating, setRating] = useState(
    entry.personal_rating === null ? '' : String(entry.personal_rating),
  )
  const [pending, setPending] = useState(false)
  const [linkPending, setLinkPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveProgress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const values: LibraryEntryUpdate = {
        reading_status: readingStatusSchema.parse(status),
        last_chapter: chapter.trim() || null,
        private_notes: notes || null,
        personal_rating: rating === '' ? null : Number(rating),
      }
      await updateLibraryEntry(entry.id, values)
      onChanged('Progreso guardado.')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el progreso.')
    } finally {
      setPending(false)
    }
  }

  async function addLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    setLinkPending(true)
    setError(null)
    const form = new FormData(formElement)
    try {
      await addPersonalLink(entry.id, {
        label: String(form.get('link-label') ?? ''),
        url: String(form.get('link-url') ?? ''),
      })
      formElement.reset()
      onChanged('Enlace privado guardado.')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el enlace.')
    } finally {
      setLinkPending(false)
    }
  }

  async function changeStatus(nextStatus: ReadingStatus) {
    setPending(true)
    setError(null)
    setStatus(nextStatus)
    try {
      await updateLibraryEntry(entry.id, {
        reading_status: nextStatus,
        last_chapter: chapter.trim() || null,
        private_notes: notes || null,
        personal_rating: rating === '' ? null : Number(rating),
      })
      onChanged(`Estado actualizado: ${statusLabels.get(nextStatus)}.`)
    } catch (cause: unknown) {
      setStatus(entry.reading_status)
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el estado.')
    } finally {
      setPending(false)
    }
  }

  async function deleteEntry() {
    if (!window.confirm(`¿Quitar ${entry.manga.canonical_title} y sus datos privados de tu biblioteca?`)) {
      return
    }
    setPending(true)
    setError(null)
    try {
      await removeLibraryEntry(entry.id)
      onChanged('Obra quitada de tu biblioteca.')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo quitar la obra.')
      setPending(false)
    }
  }

  async function deleteLink(linkId: string) {
    setError(null)
    try {
      await removePersonalLink(linkId)
      onChanged('Enlace eliminado.')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el enlace.')
    }
  }

  return (
    <article className="library-entry">
      <div className={`library-cover cover-tone-${entry.manga.canonical_title.length % 6}`} aria-hidden="true">
        <span>{entry.manga.canonical_title}</span>
      </div>
      <header className="library-entry-heading">
        <div className="library-entry-copy">
          <h2>{entry.manga.canonical_title}</h2>
          <p className="library-entry-summary">
            {entry.last_chapter && <span>Último capítulo registrado por ti: {entry.last_chapter}</span>}
            {entry.private_notes && <span className="library-entry-note">{entry.private_notes}</span>}
          </p>
        </div>
        <label className="library-status-control">
          <span className="visually-hidden">Estado de lectura de {entry.manga.canonical_title}</span>
          <select
            aria-label={`Cambiar estado de lectura de ${entry.manga.canonical_title}`}
            value={status}
            disabled={pending}
            onChange={(event) => void changeStatus(event.target.value as ReadingStatus)}
          >
            {statusOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </header>

      <details className="library-entry-details">
        <summary>Editar seguimiento y datos privados</summary>
      <button
        className="text-button danger-button"
        type="button"
        disabled={pending}
        onClick={deleteEntry}
        aria-label={`Quitar ${entry.manga.canonical_title} de mi biblioteca`}
      >
        <Trash2 size={15} aria-hidden="true" />
        Quitar de mi biblioteca
      </button>
      <form className="library-form" onSubmit={saveProgress}>
        <label>
          Estado de lectura
          <select value={status} onChange={(event) => setStatus(event.target.value as ReadingStatus)}>
            {statusOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          Último capítulo registrado
          <input
            value={chapter}
            maxLength={80}
            onChange={(event) => setChapter(event.target.value)}
            placeholder="Por ejemplo: 12.5"
          />
          <span className="form-hint">
            Es tu referencia personal, no un dato oficial de publicación.
          </span>
        </label>
        <label>
          Mi puntuación (1 a 10)
          <input
            type="number"
            min="1"
            max="10"
            step="0.1"
            value={rating}
            onChange={(event) => setRating(event.target.value)}
            placeholder="Sin puntuar"
          />
        </label>
        <label className="full-width-field">
          Notas privadas
          <textarea
            value={notes}
            maxLength={5000}
            rows={3}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Solo tú puedes ver estas notas."
          />
        </label>
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar progreso'}
        </button>
      </form>

      <section className="private-links">
        <h3>Mis enlaces privados</h3>
        {entry.links.length > 0 ? (
          <ul className="private-link-list">
            {entry.links.map((link) => (
              <li key={link.id}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  {link.label}<ExternalLink size={14} aria-label="Enlace externo" />
                </a>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => deleteLink(link.id)}
                  aria-label={`Eliminar enlace ${link.label}`}
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted-copy">No has guardado enlaces para esta obra.</p>
        )}
        <form className="private-link-form" onSubmit={addLink}>
          <label>
            Nombre del enlace
            <input name="link-label" maxLength={80} required placeholder="Mi referencia" />
          </label>
          <label>
            URL externa (http o https)
            <input
              name="link-url"
              type="url"
              pattern="https?://.+"
              maxLength={2048}
              required
              placeholder="https://..."
            />
          </label>
          <button className="secondary-button" type="submit" disabled={linkPending}>
            {linkPending ? 'Guardando…' : 'Guardar enlace privado'}
          </button>
        </form>
        <p className="form-hint">Los sitios externos tienen sus propias condiciones y políticas.</p>
      </section>
      </details>
      {error && <p className="error-message" role="alert">{error}</p>}
    </article>
  )
}

export function LibraryPage() {
  const { user } = useAuth()
  const [libraryState, setLibraryState] = useState<{
    userId: string
    loading: boolean
    entries: LibraryEntry[]
    error: string | null
  }>({ userId: '', loading: true, entries: [], error: null })
  const [refreshCount, setRefreshCount] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const userId = user?.id ?? ''
  const isCurrent = libraryState.userId === userId
  const loading = Boolean(user) && (!isCurrent || libraryState.loading)
  const entries = user && isCurrent ? libraryState.entries : []
  const error = user && isCurrent ? libraryState.error : null
  const visibleEntries = user ? entries : previewEntries
  const countForStatus = (status: ReadingStatus) =>
    previewEntries.filter((entry) => entry.status === status).length

  useEffect(() => {
    if (!userId) return
    let active = true
    listLibrary(userId)
      .then((nextEntries) => {
        if (active) {
          setLibraryState({
            userId,
            loading: false,
            entries: nextEntries,
            error: null,
          })
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setLibraryState({
            userId,
            loading: false,
            entries: [],
            error: cause instanceof Error ? cause.message : 'No se pudo cargar la biblioteca.',
          })
        }
      })
    return () => { active = false }
  }, [userId, refreshCount])

  function handleChanged(nextMessage: string) {
    setMessage(nextMessage)
    setRefreshCount((count) => count + 1)
  }

  return (
    <main id="main-content" className="page-shell" tabIndex={-1}>
      <SiteHeader />
      <section className="catalog-heading">
        <p className="eyebrow">Privada por defecto</p>
        <h1>Mi biblioteca</h1>
        <p className="library-privacy-note">
          <LockKeyhole size={14} aria-hidden="true" />
          {user
            ? 'Tu seguimiento, notas y enlaces solo son visibles para ti.'
            : 'Vista de ejemplo. Al iniciar sesión, solo tú verás tus registros, notas y enlaces.'}
        </p>
      </section>
      {message && <p className="success-message" role="status">{message}</p>}
      {loading && <p role="status">Cargando tu biblioteca…</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {!loading && !error && (
        <section className="library-status-summary" aria-label="Resumen de estados de lectura">
          {statusOptions.map(([status, label]) => (
            <div className={`library-status-count status-count-${status}`} key={status}>
              <span>{label}</span>
              <strong>{user
                ? entries.filter((entry) => entry.reading_status === status).length
                : countForStatus(status)}
              </strong>
            </div>
          ))}
        </section>
      )}
      {!loading && !error && user && entries.length === 0 && (
        <section className="empty-state">
          <h2>Tu biblioteca está vacía</h2>
          <p>Explora el catálogo y añade obras para registrar tu lectura.</p>
          <Link className="primary-button" to="/explorar">Explorar mangas</Link>
        </section>
      )}
      {!loading && !error && visibleEntries.length > 0 && (
        <section className="library-list" aria-label="Obras de mi biblioteca">
          {user
            ? entries.map((entry) => (
              <LibraryEntryCard
                key={`${entry.id}-${entry.updated_at}-${entry.links.length}`}
                entry={entry}
                onChanged={handleChanged}
              />
            ))
            : previewEntries.map((entry, index) => (
              <LibraryPreviewEntry {...entry} index={index} key={entry.title} />
            ))}
        </section>
      )}
      <footer className="site-footer">
        <div className="site-footer-inner">
            <div>
              <Link className="site-footer-brand" to="/">MangaVerse</Link>
              <p>Wiki, catálogo y biblioteca personal. No alojamos capítulos ni scans.</p>
            </div>
            <nav aria-label="Enlaces del pie de página">
              <Link to="/explorar">Explorar catálogo</Link>
              <Link to="/wiki">Cómo colaborar</Link>
              <Link to="/biblioteca">Mi biblioteca</Link>
            </nav>
            <p className="site-footer-note">
              Información bibliográfica para lectores. Respeta las fuentes,
              la privacidad y los derechos de autor.
            </p>
        </div>
      </footer>
    </main>
  )
}
