import { BookOpenText, Search, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'

export function SiteHeader() {
  const { user, signOut } = useAuth()
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  function searchCatalog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    navigate(`/explorar${params.size ? `?${params}` : ''}`)
  }

  async function handleSignOut() {
    setSignOutError(null)
    try {
      await signOut()
    } catch (cause: unknown) {
      setSignOutError(cause instanceof Error ? cause.message : 'No se pudo cerrar sesión.')
    }
  }

  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <div className="site-notice" role="note">
        <span>Vista de diseño</span>
        <span aria-hidden="true">•</span>
        <span>Algunas fichas pueden contener datos de prueba; consulta sus fuentes.</span>
      </div>
      <div className="site-header-inner">
        <Link className="brand" to="/" aria-label="MangaVerse, inicio">
          <span className="brand-mark" aria-hidden="true">
            <BookOpenText size={19} />
          </span>
          <span>MangaVerse</span>
        </Link>
        <nav className="site-nav" aria-label="Navegación principal">
          <NavLink to="/" end>Inicio</NavLink>
          <NavLink to="/explorar">Explorar</NavLink>
          <NavLink to="/wiki">Wiki</NavLink>
          <NavLink to="/comunidad">Comunidad</NavLink>
          <NavLink to="/biblioteca">Mi biblioteca</NavLink>
          {user && <NavLink to="/listas">Mis listas</NavLink>}
          {user && <NavLink to="/contribuciones">Mis propuestas</NavLink>}
          {user && <NavLink to="/moderacion">Moderación</NavLink>}
        </nav>
        <div className="header-actions">
          <form className="header-search" role="search" onSubmit={searchCatalog}>
            <Search size={15} aria-hidden="true" />
            <label className="visually-hidden" htmlFor="header-manga-search">
              Buscar manga
            </label>
            <input
              id="header-manga-search"
              type="search"
              placeholder="Buscar manga…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </form>
          <Link
            className="header-profile-link"
            to={user ? '/perfil' : '/cuenta'}
            aria-label={user ? 'Mi perfil' : 'Acceder a mi cuenta'}
            title={user ? 'Mi perfil' : 'Acceder a mi cuenta'}
          >
            <UserRound size={15} aria-hidden="true" />
          </Link>
          {user ? (
            <button className="header-account-button" type="button" onClick={handleSignOut}>
              Cerrar sesión
            </button>
          ) : (
            <Link className="header-account-button" to="/cuenta">Iniciar sesión</Link>
          )}
        </div>
      </div>
      {signOutError && <span className="header-error" role="alert">{signOutError}</span>}
    </header>
  )
}
