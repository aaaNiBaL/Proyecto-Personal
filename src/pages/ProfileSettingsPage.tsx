import { Award, BookOpen, Heart, Library, PenLine, Settings, Star, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SiteHeader } from '../components/layout/SiteHeader'
import { useAuth } from '../features/auth/AuthContext'
import {
  listMyReadingAchievements,
  type ReadingAchievement,
} from '../services/library/achievementService'
import {
  listLibrary,
  type LibraryEntry,
} from '../services/library/libraryService'
import {
  listFavoriteManga,
  removeMangaFavorite,
  type FavoriteManga,
} from '../services/library/favoriteService'
import {
  getOwnProfile,
  type OwnProfile,
} from '../services/profiles/profileService'
import {
  listOwnContributions,
  type OwnContribution,
} from '../services/wiki/wikiService'

const contributionStatusLabels: Record<OwnContribution['status'], string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
}

type ProfileTab = 'favorites' | 'contributions' | 'badges'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(value))
}

function getAchievementProgress(
  achievement: ReadingAchievement,
  entries: LibraryEntry[],
) {
  switch (achievement.criteria_type) {
    case 'library_count':
      return entries.length
    case 'reading_count':
      return entries.filter((entry) => entry.reading_status === 'reading').length
    case 'completed_count':
      return entries.filter((entry) => entry.reading_status === 'completed').length
    case 'chapter_count':
      return entries.filter((entry) => Boolean(entry.last_chapter?.trim())).length
  }
}

export function ProfileSettingsPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<OwnProfile | null>(null)
  const [entries, setEntries] = useState<LibraryEntry[]>([])
  const [favorites, setFavorites] = useState<FavoriteManga[]>([])
  const [contributions, setContributions] = useState<OwnContribution[]>([])
  const [achievements, setAchievements] = useState<ReadingAchievement[]>([])
  const [activeTab, setActiveTab] = useState<ProfileTab>('favorites')
  const [loading, setLoading] = useState(true)
  const [removingFavorite, setRemovingFavorite] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let active = true
    Promise.all([
      getOwnProfile(user.id),
      listLibrary(user.id),
      listFavoriteManga(user.id),
      listOwnContributions(user.id),
      listMyReadingAchievements(user.id),
    ])
      .then(([nextProfile, nextEntries, nextFavorites, nextContributions, nextAchievements]) => {
        if (!active) return
        setProfile(nextProfile)
        setEntries(nextEntries)
        setFavorites(nextFavorites)
        setContributions(nextContributions)
        setAchievements(nextAchievements)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'No se pudo cargar tu perfil.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [user])

  async function handleRemoveFavorite(mangaId: string) {
    if (!user) return
    setRemovingFavorite(mangaId)
    setError(null)
    setMessage(null)
    try {
      await removeMangaFavorite(user.id, mangaId)
      setFavorites((current) => current.filter((manga) => manga.id !== mangaId))
      setMessage('Se quitó de tus favoritos.')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo quitar el favorito.')
    } finally {
      setRemovingFavorite(null)
    }
  }

  const unlockedAchievements = achievements.filter((achievement) => achievement.unlocked_at)

  return (
    <main id="main-content" className="page-shell profile-page" tabIndex={-1}>
      <SiteHeader />
      {loading && <p role="status">Cargando tu perfil…</p>}
      {error && !profile && <p className="error-message profile-page-error" role="alert">{error}</p>}
      {profile && (
        <>
          <header className="profile-dashboard-header">
            <div className="profile-dashboard-avatar" aria-hidden="true">
              {profile.username.slice(0, 1).toLocaleUpperCase()}
            </div>
            <div className="profile-dashboard-identity">
              <p className="eyebrow">Tu perfil MangaVerse</p>
              <h1>{profile.display_name || profile.username}</h1>
              <p className="profile-dashboard-bio">
                {profile.bio || `@${profile.username} · Miembro desde ${new Date(profile.created_at).getFullYear()}`}
              </p>
              {profile.bio && (
                <p className="profile-dashboard-member">Miembro desde {new Date(profile.created_at).getFullYear()}</p>
              )}
              <div className="profile-dashboard-tags">
                <span className="profile-reader-tag"><Star size={12} aria-hidden="true" /> Lector</span>
                <span>{profile.is_public ? 'Perfil público' : 'Perfil privado'}</span>
                <span><Library size={12} aria-hidden="true" /> Biblioteca privada</span>
              </div>
            </div>
            <Link
              className="secondary-button profile-edit-trigger"
              to="/perfil/editar"
            >
              <Settings size={14} aria-hidden="true" />
              Editar perfil
            </Link>
          </header>

          <div className="profile-dashboard-content">
            {message && <p className="success-message" role="status">{message}</p>}
            {error && <p className="error-message" role="alert">{error}</p>}
            <section className="profile-stat-grid" aria-label="Resumen de tu cuenta">
              <div className="profile-stat-card">
                <BookOpen size={15} aria-hidden="true" />
                <strong>{entries.length}</strong>
                <span>En biblioteca</span>
              </div>
              <div className="profile-stat-card">
                <Heart size={15} aria-hidden="true" />
                <strong>{favorites.length}</strong>
                <span>Favoritos</span>
              </div>
              <div className="profile-stat-card">
                <PenLine size={15} aria-hidden="true" />
                <strong>{contributions.length}</strong>
                <span>Contribuciones</span>
              </div>
            </section>

            <nav className="profile-quick-links" aria-label="Accesos del perfil">
              <Link className="secondary-button" to="/biblioteca">Mi biblioteca</Link>
              <Link className="secondary-button" to="/listas">Mis listas</Link>
              <Link className="secondary-button" to="/contribuciones">Mis propuestas</Link>
              <Link className="secondary-button" to="/ajustes">
                Ajustes
              </Link>
            </nav>

            <div className="profile-tabs" role="tablist" aria-label="Contenido del perfil">
              <button
                id="profile-tab-favorites"
                role="tab"
                aria-selected={activeTab === 'favorites'}
                aria-controls="profile-panel"
                type="button"
                onClick={() => setActiveTab('favorites')}
              >
                Favoritos
              </button>
              <button
                id="profile-tab-contributions"
                role="tab"
                aria-selected={activeTab === 'contributions'}
                aria-controls="profile-panel"
                type="button"
                onClick={() => setActiveTab('contributions')}
              >
                Contribuciones
              </button>
              <button
                id="profile-tab-badges"
                role="tab"
                aria-selected={activeTab === 'badges'}
                aria-controls="profile-panel"
                type="button"
                onClick={() => setActiveTab('badges')}
              >
                Insignias
                {unlockedAchievements.length > 0 && (
                  <span className="profile-tab-count">{unlockedAchievements.length}</span>
                )}
              </button>
            </div>

            <section
              id="profile-panel"
              className="profile-tab-panel"
              role="tabpanel"
              aria-labelledby={`profile-tab-${activeTab}`}
              tabIndex={0}
            >
              {activeTab === 'favorites' && (
                favorites.length === 0 ? (
                  <div className="profile-empty-state">
                    <Heart size={22} aria-hidden="true" />
                    <h2>Todavía no tienes favoritos</h2>
                    <p>Guarda mangas desde su ficha con el botón “Añadir a favoritos”.</p>
                    <Link className="secondary-button" to="/explorar">Explorar mangas</Link>
                  </div>
                ) : (
                  <div className="profile-favorite-grid">
                    {favorites.map((manga, index) => (
                      <article className="profile-favorite-card" key={manga.id}>
                        <Link className="profile-favorite-cover-link" to={`/manga/${manga.id}`}>
                          <span className={`profile-favorite-cover cover-tone-${index % 6}`}>
                            <span>{manga.canonical_title}</span>
                            <span aria-hidden="true">{manga.canonical_title.slice(0, 1)}</span>
                          </span>
                        </Link>
                        <div className="profile-favorite-meta">
                          <Link to={`/manga/${manga.id}`}>{manga.canonical_title}</Link>
                          <span>
                            {manga.start_year ? `${manga.start_year} · ` : ''}
                            {manga.publication_status === 'ongoing' ? 'En publicación' : manga.publication_status === 'completed' ? 'Finalizada' : manga.publication_status === 'hiatus' ? 'En pausa' : manga.publication_status === 'cancelled' ? 'Cancelada' : 'Estado desconocido'}
                          </span>
                        </div>
                        <button
                          className="profile-favorite-remove"
                          type="button"
                          disabled={removingFavorite === manga.id}
                          aria-label={`Quitar ${manga.canonical_title} de favoritos`}
                          onClick={() => void handleRemoveFavorite(manga.id)}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </article>
                    ))}
                  </div>
                )
              )}

              {activeTab === 'contributions' && (
                contributions.length === 0 ? (
                  <div className="profile-empty-state">
                    <PenLine size={22} aria-hidden="true" />
                    <h2>Aún no has enviado propuestas</h2>
                    <p>Ayuda a mejorar las fichas y consulta aquí el estado de tus aportes.</p>
                    <Link className="secondary-button" to="/explorar">Explorar catálogo</Link>
                  </div>
                ) : (
                  <ul className="profile-contribution-list">
                    {contributions.map((contribution) => (
                      <li key={contribution.id}>
                        <div>
                          <strong>{contribution.contribution_type === 'alias' ? 'Título alternativo' : 'Corrección de ficha'}</strong>
                          <Link to={`/manga/${contribution.manga_id}`}>Abrir obra</Link>
                        </div>
                        <span className={`contribution-status status-${contribution.status}`}>
                          {contributionStatusLabels[contribution.status]}
                        </span>
                        <time dateTime={contribution.created_at}>{formatDate(contribution.created_at)}</time>
                      </li>
                    ))}
                  </ul>
                )
              )}

              {activeTab === 'badges' && (
                achievements.length === 0 ? (
                  <div className="profile-empty-state">
                    <Award size={22} aria-hidden="true" />
                    <h2>Insignias de lectura</h2>
                    <p>Añade obras y registra tu progreso para desbloquear insignias.</p>
                  </div>
                ) : (
                  <ul className="profile-badge-grid">
                    {achievements.map((achievement) => {
                      const progress = Math.min(
                        getAchievementProgress(achievement, entries),
                        achievement.threshold,
                      )
                      const unlocked = achievement.unlocked_at !== null
                      return (
                        <li className={unlocked ? 'is-unlocked' : ''} key={achievement.id}>
                          <Award size={19} aria-hidden="true" />
                          <strong>{achievement.title}</strong>
                          <span>{achievement.description}</span>
                          {unlocked ? (
                            <time dateTime={achievement.unlocked_at ?? undefined}>
                              Desbloqueada {formatDate(achievement.unlocked_at ?? '')}
                            </time>
                          ) : (
                            <span className="profile-badge-progress">{progress}/{achievement.threshold}</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )
              )}
            </section>
          </div>
        </>
      )}
    </main>
  )
}
