import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SiteHeader } from '../components/layout/SiteHeader'
import {
  getPublicProfile,
  type PublicProfile,
} from '../services/profiles/profileService'
import { CommunityReportForm } from '../features/reports/CommunityReportForm'
import { useAuth } from '../features/auth/AuthContext'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(value))
}

export function PublicProfilePage() {
  const { username = '' } = useParams()
  const { user } = useAuth()
  const [state, setState] = useState<{
    username: string
    loading: boolean
    profile: PublicProfile | null
    error: string | null
  }>({ username: '', loading: true, profile: null, error: null })
  const isCurrent = state.username === username
  const loading = !isCurrent || state.loading
  const profile = isCurrent ? state.profile : null
  const error = isCurrent ? state.error : null

  useEffect(() => {
    let active = true
    getPublicProfile(username)
      .then((nextProfile) => {
        if (active) {
          setState({
            username,
            loading: false,
            profile: nextProfile,
            error: null,
          })
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setState({
            username,
            loading: false,
            profile: null,
            error: cause instanceof Error ? cause.message : 'No se pudo cargar el perfil.',
          })
        }
      })
    return () => { active = false }
  }, [username])

  return (
    <main id="main-content" className="page-shell" tabIndex={-1}>
      <SiteHeader />
      {loading && <p role="status">Cargando perfil…</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {!loading && !error && !profile && (
        <div className="empty-state profile-not-found">
          <h1>Perfil no disponible</h1>
          <p>Puede que no exista o que su dueño lo haya mantenido privado.</p>
          <Link className="secondary-button" to="/explorar">Explorar MangaVerse</Link>
        </div>
      )}
      {profile && (
        <article className="public-profile">
          <header className="public-profile-header">
            <div className="profile-avatar" aria-hidden="true">
              {(profile.display_name || profile.username).slice(0, 1).toLocaleUpperCase()}
            </div>
            <div>
              <p className="eyebrow">Perfil público</p>
              <h1>{profile.display_name || `@${profile.username}`}</h1>
              <p className="public-profile-username">@{profile.username}</p>
              <p className="muted-copy">En MangaVerse desde {formatDate(profile.created_at)}</p>
              {profile.user_id && user?.id !== profile.user_id && (
                <CommunityReportForm targetType="profile" targetId={profile.user_id} />
              )}
            </div>
          </header>
          {profile.bio && (
            <section className="detail-section">
              <h2>Sobre mí</h2>
              <p className="public-profile-bio">{profile.bio}</p>
            </section>
          )}
          <section className="detail-section">
            <h2>Listas públicas</h2>
            {profile.lists.length === 0 ? (
              <p className="muted-copy">Todavía no hay listas públicas.</p>
            ) : (
              <ul className="public-profile-lists">
                {profile.lists.map((list) => (
                  <li key={list.id}>
                    <Link to={`/listas/${list.id}`}>
                      <strong>{list.title}</strong>
                      {list.description && <span>{list.description}</span>}
                      <span>{list.item_count} {list.item_count === 1 ? 'obra' : 'obras'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {profile.show_favorites && (
            <section className="detail-section">
              <h2>Mangas favoritos</h2>
              {profile.favorites.length === 0 ? (
                <p className="muted-copy">Todavía no hay favoritos para mostrar.</p>
              ) : (
                <ul className="public-profile-favorites">
                  {profile.favorites.map((favorite) => (
                    <li key={favorite.id}>
                      <Link to={`/manga/${favorite.id}`}>{favorite.canonical_title}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {profile.show_achievements && (
            <section className="detail-section">
              <h2>Insignias</h2>
              {profile.achievements.length === 0 ? (
                <p className="muted-copy">Todavía no hay insignias desbloqueadas.</p>
              ) : (
                <ul className="public-profile-achievements">
                  {profile.achievements.map((achievement) => (
                    <li key={achievement.slug}>
                      <strong>{achievement.title}</strong>
                      <time dateTime={achievement.unlocked_at}>
                        {formatDate(achievement.unlocked_at)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          <section className="detail-section">
            <h2>Reseñas recientes</h2>
            {profile.reviews.length === 0 ? (
              <p className="muted-copy">Todavía no hay reseñas públicas.</p>
            ) : (
              <ul className="review-list">
                {profile.reviews.map((review) => (
                  <PublicProfileReview key={`${review.manga_id}-${review.created_at}`} review={review} />
                ))}
              </ul>
            )}
          </section>
        </article>
      )}
    </main>
  )
}

function PublicProfileReview({
  review,
}: {
  review: PublicProfile['reviews'][number]
}) {
  const [spoilersRevealed, setSpoilersRevealed] = useState(false)
  const hideContent = review.contains_spoilers && !spoilersRevealed

  return (
    <li className="review-card">
      <header>
        <Link to={`/manga/${review.manga_id}`}>{review.manga_title}</Link>
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
    </li>
  )
}
