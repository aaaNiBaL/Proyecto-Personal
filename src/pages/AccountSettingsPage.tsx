import { Bell, Eye, MonitorCog, ShieldAlert, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SiteHeader } from '../components/layout/SiteHeader'
import { useAuth } from '../features/auth/AuthContext'
import { listMyReadingAchievements } from '../services/library/achievementService'
import { listLibrary } from '../services/library/libraryService'
import { listFavoriteManga } from '../services/library/favoriteService'
import { getOwnProfile, updateOwnProfile, type OwnProfile } from '../services/profiles/profileService'
import { deleteOwnAccount } from '../services/profiles/accountService'
import { listOwnContributions } from '../services/wiki/wikiService'

type Theme = 'dark' | 'light'

function readTheme(): Theme {
  return window.localStorage.getItem('mangaverse-theme') === 'light' ? 'light' : 'dark'
}

export function AccountSettingsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<OwnProfile | null>(null)
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [loading, setLoading] = useState(true)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState(false)
  const [deletePhrase, setDeletePhrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    if (!user) return
    let active = true
    getOwnProfile(user.id)
      .then((nextProfile) => {
        if (active) {
          setProfile(nextProfile)
          setError(null)
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los ajustes.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [user])

  function updatePreference(
    changes: Partial<Pick<OwnProfile, 'is_public' | 'show_favorites' | 'show_achievements' | 'notify_contributions' | 'notify_news'>>,
  ) {
    if (!profile) return
    setProfile((current) => current ? { ...current, ...changes } : current)
    setError(null)
    setMessage(null)
  }

  async function saveSettings() {
    if (!user || !profile || pendingKey) return
    setPendingKey('save')
    setError(null)
    setMessage(null)
    try {
      await updateOwnProfile(user.id, {
        username: profile.username,
        displayName: profile.display_name,
        bio: profile.bio,
        isPublic: profile.is_public,
        showFavorites: profile.show_favorites,
        showAchievements: profile.show_achievements,
        notifyContributions: profile.notify_contributions,
        notifyNews: profile.notify_news,
      })
      window.localStorage.setItem('mangaverse-theme', theme)
      setMessage('Tus ajustes se guardaron correctamente.')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron guardar tus ajustes.')
    } finally {
      setPendingKey(null)
    }
  }

  async function handleDeleteAccount() {
    if (!user || deletePhrase !== 'ELIMINAR' || pendingKey) return
    setPendingKey('delete')
    setError(null)
    setMessage(null)
    try {
      await deleteOwnAccount()
      navigate('/cuenta', { replace: true })
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar la cuenta.')
      setPendingKey(null)
    }
  }

  async function exportAccountData() {
    if (!user || !profile || pendingKey) return
    setPendingKey('export')
    setError(null)
    setMessage(null)
    try {
      const [library, favorites, contributions, achievements] = await Promise.all([
        listLibrary(user.id),
        listFavoriteManga(user.id),
        listOwnContributions(user.id),
        listMyReadingAchievements(user.id),
      ])
      const payload = {
        exported_at: new Date().toISOString(),
        profile,
        library,
        favorites,
        contributions,
        achievements,
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `mangaverse-datos-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      setMessage('Se descargó una copia de tus datos.')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron exportar tus datos.')
    } finally {
      setPendingKey(null)
    }
  }

  return (
    <main id="main-content" className="page-shell account-settings-page" tabIndex={-1}>
      <SiteHeader />
      <header className="settings-page-heading">
        <Link className="settings-back-link" to="/perfil">← Volver a mi perfil</Link>
        <p className="eyebrow">Tu cuenta</p>
        <h1>Ajustes</h1>
        <p className="muted-copy">Administra tu perfil, privacidad y preferencias de MangaVerse.</p>
      </header>

      {loading && <p role="status">Cargando ajustes…</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {message && <p className="success-message" role="status">{message}</p>}

      {profile && (
        <div className="settings-sections">
          <section className="settings-card">
            <div className="settings-card-icon" aria-hidden="true"><UserRound size={18} /></div>
            <div className="settings-card-content">
              <div className="settings-card-heading">
                <div>
                  <h2>Perfil</h2>
                  <p>Consulta tu perfil o edita por separado tu presentación.</p>
                </div>
              </div>
              <div className="settings-profile-summary">
                <span className="profile-avatar" aria-hidden="true">
                  {(profile.display_name || profile.username).slice(0, 1).toLocaleUpperCase()}
                </span>
                <div>
                  <strong>{profile.display_name || profile.username}</strong>
                  <span>@{profile.username}</span>
                  <span>{profile.is_public ? 'Perfil público' : 'Perfil privado'}</span>
                </div>
              </div>
              <nav className="settings-profile-links" aria-label="Acciones del perfil">
                <Link className="secondary-button" to="/perfil">Ver mi perfil</Link>
                <Link className="secondary-button" to="/perfil/editar">Editar perfil</Link>
              </nav>
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-card-icon" aria-hidden="true"><MonitorCog size={18} /></div>
            <div className="settings-card-content">
              <div className="settings-card-heading">
                <div>
                  <h2>Idioma y apariencia</h2>
                  <p>Personaliza cómo se ve MangaVerse en este dispositivo.</p>
                </div>
              </div>
              <div className="settings-appearance-grid">
                <label>
                  <span>Idioma de la interfaz</span>
                  <select aria-label="Idioma de la interfaz" value="es" disabled>
                    <option value="es">Español</option>
                  </select>
                </label>
                <label>
                  <span>Tema</span>
                  <select
                    aria-label="Tema de la interfaz"
                    value={theme}
                    onChange={(event) => setTheme(event.target.value === 'light' ? 'light' : 'dark')}
                  >
                    <option value="dark">Oscuro (tinta)</option>
                    <option value="light">Claro</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-card-icon" aria-hidden="true"><Eye size={18} /></div>
            <div className="settings-card-content">
              <div className="settings-card-heading">
                <div>
                  <h2>Privacidad</h2>
                  <p>Elige qué información se comparte en tu perfil público.</p>
                </div>
              </div>
              <SettingToggle
                title="Perfil público"
                description="Permite que otras personas encuentren tu perfil y vean tus reseñas y listas públicas."
                checked={profile.is_public}
                disabled={pendingKey !== null}
                onChange={(checked) => updatePreference({ is_public: checked })}
              />
              <SettingToggle
                title="Mostrar mis favoritos"
                description="Muestra tus mangas favoritos en tu perfil público."
                checked={profile.show_favorites}
                disabled={!profile.is_public || pendingKey !== null}
                onChange={(checked) => updatePreference({ show_favorites: checked })}
              />
              <SettingToggle
                title="Mostrar mis insignias"
                description="Muestra los logros que has desbloqueado en tu perfil público."
                checked={profile.show_achievements}
                disabled={!profile.is_public || pendingKey !== null}
                onChange={(checked) => updatePreference({ show_achievements: checked })}
              />
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-card-icon" aria-hidden="true"><Bell size={18} /></div>
            <div className="settings-card-content">
              <div className="settings-card-heading">
                <div>
                  <h2>Notificaciones</h2>
                  <p>Guarda tus preferencias para futuras notificaciones por correo.</p>
                </div>
              </div>
              <SettingToggle
                title="Actualizaciones de mis propuestas"
                description="Guarda tu preferencia para avisos de aprobación o rechazo; el envío de correos aún no está habilitado."
                checked={profile.notify_contributions}
                disabled={pendingKey !== null}
                onChange={(checked) => updatePreference({ notify_contributions: checked })}
              />
              <SettingToggle
                title="Novedades de MangaVerse"
                description="Guarda tu preferencia para novedades; el envío de correos aún no está habilitado."
                checked={profile.notify_news}
                disabled={pendingKey !== null}
                onChange={(checked) => updatePreference({ notify_news: checked })}
              />
            </div>
          </section>

          <section className="settings-card settings-danger-card">
            <div className="settings-card-icon" aria-hidden="true"><ShieldAlert size={18} /></div>
            <div className="settings-card-content">
              <div className="settings-card-heading">
                <div>
                  <h2>Zona delicada</h2>
                  <p>Descarga tus datos o elimina tu cuenta.</p>
                </div>
              </div>
              <div className="settings-danger-actions">
                <div>
                  <strong>Exportar mis datos</strong>
                  <span>Descarga tu perfil, biblioteca, favoritos, propuestas y logros en JSON.</span>
                </div>
                <button className="secondary-button" type="button" disabled={pendingKey !== null} onClick={exportAccountData}>
                  {pendingKey === 'export' ? 'Preparando…' : 'Descargar mis datos'}
                </button>
              </div>
              <div className="settings-danger-actions">
                <div>
                  <strong>Eliminar cuenta</strong>
                  <span>Esta acción es permanente. Requiere desplegar la función segura de eliminación en Supabase.</span>
                </div>
                <button className="danger-button" type="button" disabled={pendingKey !== null} onClick={() => setDeleteConfirmation(true)}>
                  Eliminar cuenta
                </button>
              </div>
            </div>
          </section>
          <div className="settings-save-actions">
            <button className="primary-button" type="button" disabled={pendingKey !== null} onClick={() => void saveSettings()}>
              {pendingKey === 'save' ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}
      {deleteConfirmation && (
        <div className="settings-confirmation-backdrop">
          <section
            className="settings-confirmation-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            aria-describedby="delete-account-description"
          >
            <h2 id="delete-account-title">Eliminar cuenta permanentemente</h2>
            <p id="delete-account-description">
              Se borrarán tu cuenta, perfil, biblioteca, favoritos y demás datos asociados. Esta acción no se puede deshacer.
            </p>
            <label>
              Escribe ELIMINAR para confirmar
              <input
                autoComplete="off"
                value={deletePhrase}
                onChange={(event) => setDeletePhrase(event.target.value)}
              />
            </label>
            {error && <p className="error-message" role="alert">{error}</p>}
            <div className="settings-confirmation-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={pendingKey === 'delete'}
                onClick={() => {
                  setDeleteConfirmation(false)
                  setDeletePhrase('')
                  setError(null)
                }}
              >
                Cancelar
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={deletePhrase !== 'ELIMINAR' || pendingKey !== null}
                onClick={() => void handleDeleteAccount()}
              >
                {pendingKey === 'delete' ? 'Eliminando…' : 'Eliminar definitivamente'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

function SettingToggle({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="settings-toggle-row">
      <span><strong>{title}</strong><span>{description}</span></span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  )
}
