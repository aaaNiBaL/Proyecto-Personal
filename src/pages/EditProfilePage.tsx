import { ArrowLeft, Save } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { SiteHeader } from '../components/layout/SiteHeader'
import { useAuth } from '../features/auth/AuthContext'
import { getOwnProfile, updateOwnProfile, type OwnProfile } from '../services/profiles/profileService'

export function EditProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<OwnProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let active = true
    getOwnProfile(user.id)
      .then((nextProfile) => {
        if (active) setProfile(nextProfile)
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !profile) return

    const form = new FormData(event.currentTarget)
    setPending(true)
    setError(null)
    setMessage(null)
    try {
      await updateOwnProfile(user.id, {
        username: String(form.get('username') ?? ''),
        displayName: String(form.get('display_name') ?? ''),
        bio: String(form.get('bio') ?? ''),
        isPublic: profile.is_public,
        showFavorites: profile.show_favorites,
        showAchievements: profile.show_achievements,
        notifyContributions: profile.notify_contributions,
        notifyNews: profile.notify_news,
      })
      const nextProfile = await getOwnProfile(user.id)
      setProfile(nextProfile)
      setMessage('Los cambios de tu perfil se guardaron correctamente.')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron guardar los cambios.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main id="main-content" className="page-shell edit-profile-page" tabIndex={-1}>
      <SiteHeader />
      <header className="edit-profile-heading">
        <Link className="settings-back-link" to="/perfil">
          <ArrowLeft size={15} aria-hidden="true" />
          Volver a mi perfil
        </Link>
        <p className="eyebrow">Tu cuenta</p>
        <h1>Editar perfil</h1>
        <p className="muted-copy">Actualiza cómo te presentas en MangaVerse.</p>
      </header>

      {loading && <p role="status">Cargando perfil…</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {message && <p className="success-message" role="status">{message}</p>}

      {profile && (
        <form className="edit-profile-card" onSubmit={handleSubmit}>
          <h2>Perfil</h2>
          <label>
            Nombre de usuario
            <input
              className="edit-profile-username-input"
              name="username"
              required
              minLength={3}
              maxLength={24}
              pattern="[a-zA-Z0-9_]+"
              defaultValue={profile.username}
              disabled={pending}
            />
          </label>
          <p className="form-hint">De 3 a 24 caracteres; solo letras, números y guion bajo.</p>
          <label>
            Nombre para mostrar
            <input
              name="display_name"
              maxLength={80}
              defaultValue={profile.display_name}
              disabled={pending}
              placeholder="Cómo quieres que te llamen"
            />
          </label>
          <label>
            Presentación
            <textarea
              name="bio"
              maxLength={500}
              rows={4}
              defaultValue={profile.bio}
              disabled={pending}
              placeholder="Cuéntale a la comunidad un poco sobre ti…"
            />
          </label>
          <div className="edit-profile-actions">
            <button className="primary-button" type="submit" disabled={pending}>
              <Save size={15} aria-hidden="true" />
              {pending ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <Link className="secondary-button" to="/perfil">Cancelar</Link>
            {profile.is_public && (
              <Link className="edit-profile-public-link" to={`/usuario/${profile.username}`}>
                Ver perfil público
              </Link>
            )}
          </div>
        </form>
      )}
    </main>
  )
}
