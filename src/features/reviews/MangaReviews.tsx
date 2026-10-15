import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  deleteMangaReview,
  getMyMangaReview,
  listMangaReviews,
  saveMangaReview,
  type MangaReviewList,
  type MyMangaReview,
} from '../../services/reviews/reviewService'
import { CommunityReportForm } from '../reports/CommunityReportForm'
import { CommunityComments } from '../comments/CommunityComments'

const emptyReviews: MangaReviewList = {
  average_rating: 0,
  rating_count: 0,
  reviews: [],
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(value))
}

export function MangaReviews({
  mangaId,
  userId,
  compact = false,
}: {
  mangaId: string
  userId: string | null
  compact?: boolean
}) {
  const [reviewList, setReviewList] = useState<MangaReviewList>(emptyReviews)
  const [myReview, setMyReview] = useState<MyMangaReview | null>(null)
  const [rating, setRating] = useState('5')
  const [reviewText, setReviewText] = useState('')
  const [containsSpoilers, setContainsSpoilers] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([
      listMangaReviews(mangaId),
      userId ? getMyMangaReview(mangaId, userId) : Promise.resolve(null),
    ])
      .then(([nextReviewList, nextMyReview]) => {
        if (!active) return
        setReviewList(nextReviewList)
        setMyReview(nextMyReview)
        setRating(String(nextMyReview?.rating ?? 5))
        setReviewText(nextMyReview?.review_text ?? '')
        setContainsSpoilers(nextMyReview?.contains_spoilers ?? false)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las reseñas.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [mangaId, userId])

  async function refreshReviews() {
    const [nextReviewList, nextMyReview] = await Promise.all([
      listMangaReviews(mangaId),
      userId ? getMyMangaReview(mangaId, userId) : Promise.resolve(null),
    ])
    setReviewList(nextReviewList)
    setMyReview(nextMyReview)
    setRating(String(nextMyReview?.rating ?? 5))
    setReviewText(nextMyReview?.review_text ?? '')
    setContainsSpoilers(nextMyReview?.contains_spoilers ?? false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!userId) return
    setPending(true)
    setError(null)
    setMessage(null)
    try {
      await saveMangaReview(mangaId, userId, {
        rating: Number(rating),
        reviewText: reviewText.trim() || null,
        containsSpoilers,
      })
      await refreshReviews()
      setMessage('Tu puntuación y reseña se guardaron.')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la reseña.')
    } finally {
      setPending(false)
    }
  }

  async function handleDelete() {
    if (!userId || !myReview) return
    setPending(true)
    setError(null)
    setMessage(null)
    try {
      await deleteMangaReview(myReview.id, userId)
      await refreshReviews()
      setMessage('Tu reseña se eliminó.')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar la reseña.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section
      className={`detail-section review-section${compact ? ' review-section-compact' : ''}`}
      aria-labelledby="reviews-title"
    >
      <h3 id="reviews-title">Puntuaciones y reseñas</h3>
      {loading && <p role="status">Cargando reseñas…</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {!loading && !error && (
        <div className="review-summary" aria-live="polite">
          <strong>{reviewList.rating_count ? reviewList.average_rating.toFixed(1) : '—'}</strong>
          <span aria-label={`${reviewList.average_rating} de 5 estrellas`}>
            {'★'.repeat(Math.round(reviewList.average_rating))}
            {'☆'.repeat(5 - Math.round(reviewList.average_rating))}
          </span>
          <span>
            {reviewList.rating_count} {reviewList.rating_count === 1 ? 'puntuación' : 'puntuaciones'}
          </span>
        </div>
      )}

      {userId ? (
        <form className="review-form" onSubmit={handleSubmit}>
          <h3>{myReview ? 'Editar tu reseña' : 'Deja tu reseña'}</h3>
          <label>
            Tu puntuación
            <select
              value={rating}
              onChange={(event) => setRating(event.target.value)}
              disabled={pending || loading}
            >
              <option value="5">5 — Me encantó</option>
              <option value="4">4 — Me gustó</option>
              <option value="3">3 — Estuvo bien</option>
              <option value="2">2 — No me gustó</option>
              <option value="1">1 — No la recomiendo</option>
            </select>
          </label>
          <label>
            Reseña (opcional)
            <textarea
              value={reviewText}
              onChange={(event) => setReviewText(event.target.value)}
              maxLength={10000}
              rows={4}
              placeholder="Comparte qué te pareció esta obra…"
              disabled={pending || loading}
            />
          </label>
          <label className="review-spoiler-toggle">
            <input
              type="checkbox"
              checked={containsSpoilers}
              onChange={(event) => setContainsSpoilers(event.target.checked)}
              disabled={pending || loading}
            />
            Esta reseña contiene spoilers
          </label>
          <div className="review-form-actions">
            <button className="primary-button" type="submit" disabled={pending || loading}>
              {pending ? 'Guardando…' : myReview ? 'Actualizar reseña' : 'Publicar reseña'}
            </button>
            {myReview && (
              <button
                className="secondary-button"
                type="button"
                disabled={pending}
                onClick={() => void handleDelete()}
              >
                Eliminar mi reseña
              </button>
            )}
          </div>
        </form>
      ) : (
        <p className="muted-copy">
          <Link to="/cuenta">Inicia sesión</Link> para puntuar y reseñar esta obra.
        </p>
      )}
      {message && <p className="success-message" role="status">{message}</p>}

      {!loading && !error && reviewList.reviews.length === 0 && (
        <p className="muted-copy">Todavía no hay reseñas para esta obra.</p>
      )}
      <ul className="review-list">
        {reviewList.reviews.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            viewerId={userId}
          />
        ))}
      </ul>
    </section>
  )
}

function ReviewCard({
  review,
  viewerId,
}: {
  review: MangaReviewList['reviews'][number]
  viewerId: string | null
}) {
  const [spoilersRevealed, setSpoilersRevealed] = useState(false)
  const hideContent = review.contains_spoilers && !spoilersRevealed

  return (
    <li className="review-card">
      <header>
        <Link to={`/usuario/${review.username}`}>@{review.username}</Link>
        <span className="review-card-rating" aria-label={`${review.rating} de 5 estrellas`}>
          {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
        </span>
        <time dateTime={review.updated_at}>{formatDate(review.updated_at)}</time>
      </header>
      {hideContent ? (
        <div className="spoiler-warning">
          <p>Esta reseña contiene spoilers.</p>
          <button className="text-button" type="button" onClick={() => setSpoilersRevealed(true)}>
            Mostrar reseña
          </button>
        </div>
      ) : review.review_text ? (
        <p className="review-card-text">{review.review_text}</p>
      ) : (
        <p className="muted-copy">Puntuación sin comentario.</p>
      )}
      {viewerId !== review.author_id && (
        <CommunityReportForm targetType="review" targetId={review.id} />
      )}
      <CommunityComments targetType="review" targetId={review.id} userId={viewerId} />
    </li>
  )
}
