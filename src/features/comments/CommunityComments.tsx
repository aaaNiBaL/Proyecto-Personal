import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  createCommunityComment,
  deleteCommunityComment,
  listCommunityComments,
  type CommentTargetType,
  type CommunityComment,
} from '../../services/comments/communityCommentService'
import { CommunityReportForm } from '../reports/CommunityReportForm'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(value))
}

export function CommunityComments({
  targetType,
  targetId,
  userId,
  compact = false,
}: {
  targetType: CommentTargetType
  targetId: string
  userId: string | null
  compact?: boolean
}) {
  const [comments, setComments] = useState<CommunityComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const headingId = `community-comments-title-${targetType}-${targetId}`

  useEffect(() => {
    let active = true
    listCommunityComments(targetType, targetId)
      .then((nextComments) => {
        if (active) {
          setComments(nextComments)
          setError(null)
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los comentarios.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [targetId, targetType])

  async function refreshComments() {
    setComments(await listCommunityComments(targetType, targetId))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!userId) return
    setPending(true)
    setError(null)
    setMessage(null)
    try {
      await createCommunityComment(targetType, targetId, commentText)
      setCommentText('')
      await refreshComments()
      setMessage('Tu comentario se publicó.')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo publicar el comentario.')
    } finally {
      setPending(false)
    }
  }

  async function handleDelete(comment: CommunityComment) {
    if (!userId || comment.author_id !== userId) return
    setDeletingId(comment.id)
    setError(null)
    setMessage(null)
    try {
      await deleteCommunityComment(comment.id, userId)
      await refreshComments()
      setMessage('Tu comentario se eliminó.')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el comentario.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section
      className={`community-comments${compact ? ' community-comments-compact' : ''}`}
      aria-labelledby={headingId}
    >
      <h3 id={headingId}>Conversación ({comments.length})</h3>
      {loading && <p role="status">Cargando comentarios…</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {message && <p className="success-message" role="status">{message}</p>}
      {!loading && !error && comments.length === 0 && (
        <p className="muted-copy">Todavía no hay comentarios.</p>
      )}
      <ul className="community-comment-list">
        {comments.map((comment) => (
          <li className="community-comment" key={comment.id}>
            <header>
              <Link to={`/usuario/${comment.username}`}>@{comment.username}</Link>
              <time dateTime={comment.created_at}>{formatDate(comment.created_at)}</time>
            </header>
            <p>{comment.comment_text}</p>
            {comment.author_id === userId ? (
              <button
                className="text-button"
                type="button"
                disabled={deletingId !== null}
                onClick={() => void handleDelete(comment)}
              >
                {deletingId === comment.id ? 'Eliminando…' : 'Eliminar'}
              </button>
            ) : (
              <CommunityReportForm targetType="comment" targetId={comment.id} />
            )}
          </li>
        ))}
      </ul>
      {userId ? (
        <form className="community-comment-form" onSubmit={handleSubmit}>
          <label htmlFor={`comment-${targetType}-${targetId}`}>Escribe un comentario</label>
          <textarea
            id={`comment-${targetType}-${targetId}`}
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Mantén la conversación respetuosa."
            disabled={pending || loading}
          />
          <div className="community-comment-form-footer">
            <span>{commentText.length}/2000</span>
            <button
              className="secondary-button"
              type="submit"
              disabled={pending || loading || commentText.trim().length === 0}
            >
              {pending ? 'Publicando…' : 'Comentar'}
            </button>
          </div>
        </form>
      ) : (
        <p className="muted-copy">
          <Link to="/cuenta">Inicia sesión</Link> para comentar.
        </p>
      )}
    </section>
  )
}
