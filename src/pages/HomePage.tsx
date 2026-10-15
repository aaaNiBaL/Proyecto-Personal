import { ArrowRight, BookOpenText, HeartHandshake, Search } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SiteHeader } from '../components/layout/SiteHeader'
import { hasSupabaseConfig } from '../services/supabase/client'
import {
  getCatalogGenres,
  getHomepageCatalog,
  getPopularManga,
} from '../services/catalog/catalogService'
import type {
  CatalogGenre,
  HomepageCatalogItem,
  PopularCatalogItem,
} from '../services/catalog/types'

const publicationLabels = {
  ongoing: 'En publicación',
  completed: 'Finalizada',
  hiatus: 'En pausa',
  cancelled: 'Cancelada',
  unknown: 'Estado sin confirmar',
} as const

export function HomePage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [recentWorks, setRecentWorks] = useState<HomepageCatalogItem[]>([])
  const [updatedWorks, setUpdatedWorks] = useState<HomepageCatalogItem[]>([])
  const [popularWorks, setPopularWorks] = useState<PopularCatalogItem[]>([])
  const [genres, setGenres] = useState<CatalogGenre[]>([])
  const [configured] = useState(hasSupabaseConfig)
  const [loading, setLoading] = useState(configured)
  const [error, setError] = useState<string | null>(null)
  const [popularError, setPopularError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!configured) {
      return () => { active = false }
    }
    Promise.allSettled([getHomepageCatalog(), getCatalogGenres(), getPopularManga()])
      .then(([catalogResult, genresResult, popularResult]) => {
        if (!active) return

        const errors: string[] = []
        if (catalogResult.status === 'fulfilled') {
          setRecentWorks(catalogResult.value.recent)
          setUpdatedWorks(catalogResult.value.updated)
        } else {
          errors.push(
            catalogResult.reason instanceof Error
              ? catalogResult.reason.message
              : 'No se pudo cargar el catálogo.',
          )
        }

        if (genresResult.status === 'fulfilled') {
          setGenres(genresResult.value)
        } else {
          errors.push(
            genresResult.reason instanceof Error
              ? genresResult.reason.message
              : 'No se pudieron cargar los géneros.',
          )
        }

        if (popularResult.status === 'fulfilled') {
          setPopularWorks(popularResult.value)
        } else {
          setPopularError(
            popularResult.reason instanceof Error
              ? popularResult.reason.message
              : 'No se pudieron cargar las valoraciones.',
          )
        }
        if (errors.length > 0) setError(errors.join(' '))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [configured])

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    navigate(`/explorar${params.size ? `?${params}` : ''}`)
  }

  return (
    <main id="main-content" className="page-shell home-page" tabIndex={-1}>
      <SiteHeader />

      <section className="home-hero" aria-labelledby="hero-title">
        <div className="home-hero-copy">
          <p className="eyebrow">Gratis · colaborativa · multilingüe</p>
          <h1 id="hero-title">Cada manga, con <span>todos</span> sus nombres.</h1>
          <p className="hero-copy">
            Encuentra obras en cualquier idioma, consulta fichas con fuentes y
            guarda tu progreso dondequiera que leas.
          </p>
          <form className="home-search" role="search" onSubmit={handleSearch}>
            <Search size={18} aria-hidden="true" />
            <label className="visually-hidden" htmlFor="home-manga-search">
              Buscar por título, alias o autor
            </label>
            <input
              id="home-manga-search"
              type="search"
              placeholder="Busca por título, alias, 日本語, romaji o autor…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className="home-search-submit" type="submit" aria-label="Buscar">
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>
          <div className="home-hero-actions">
            <Link className="primary-button" to="/explorar">Descubrir mangas</Link>
            {genres.slice(0, 3).map((genre) => (
              <Link
                className="home-genre-link"
                key={genre.slug}
                to={`/explorar?genre=${encodeURIComponent(genre.slug)}`}
              >
                {genre.name}
              </Link>
            ))}
            <Link className="text-button" to="/biblioteca">Mi biblioteca <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        </div>
        <div className="home-hero-art" aria-hidden="true">
          {(recentWorks.length > 0 ? recentWorks.slice(0, 3) : [null, null, null]).map((work, index) => (
            <div className={`paper-stack paper-stack-${['one', 'two', 'three'][index]}`} key={work?.id ?? index}>
              <span className="paper-topline" />
              <span className="paper-label">
                {work?.canonical_title ?? ['Título original', 'Alias · romaji', 'Ficha · fuentes'][index]}
              </span>
              <span className="paper-glyph">{work?.canonical_title.slice(0, 1) ?? ['漫', '読', '本'][index]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="home-shelf" aria-labelledby="home-shelf-title">
        <div className="section-heading">
          <div>
            <h2 id="home-shelf-title">Incorporadas recientemente</h2>
          </div>
          <Link to="/explorar">Ver catálogo <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
        {loading && <p role="status">Cargando catálogo…</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
        {!configured && (
          <p className="home-empty-state">
            Conecta Supabase para explorar las fichas publicadas. No mostramos datos ficticios.
          </p>
        )}
        {!loading && !error && configured && recentWorks.length === 0 && (
          <p className="home-empty-state">Todavía no hay obras publicadas en el catálogo.</p>
        )}
        {recentWorks.length > 0 && (
          <>
            <p className="home-cover-disclaimer">Composiciones tipográficas; no son portadas oficiales.</p>
            <div className="home-work-grid">
              {recentWorks.map((work, index) => (
                <Link
                  className={`home-work-card cover-tone-${index % 6}`}
                  key={work.id}
                  to={`/manga/${work.id}`}
                  viewTransition
                  aria-label={`Ver ficha de ${work.canonical_title}`}
                >
                  <span className="home-work-cover" aria-hidden="true">
                    <span className="home-cover-kicker">MANGAVERSE · FICHA</span>
                    <span className="home-cover-title">{work.canonical_title}</span>
                    <span className="home-cover-mark">{work.canonical_title.slice(0, 1)}</span>
                  </span>
                  <span className="home-work-title">{work.canonical_title}</span>
                  <span className="home-work-meta">
                    {work.start_year ? `${work.start_year} · ` : ''}
                    {publicationLabels[work.publication_status]}
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="home-shelf home-updated-shelf" aria-labelledby="home-updated-title">
        <div className="section-heading">
          <h2 id="home-updated-title">Fichas actualizadas</h2>
          <Link to="/explorar">Ver catálogo <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
        {!loading && !error && configured && updatedWorks.length > 0 && (
          <ul className="home-updated-list">
            {updatedWorks.map((work) => (
              <li key={work.id}>
                <Link to={`/manga/${work.id}`}>{work.canonical_title}</Link>
                <time dateTime={work.updated_at}>
                  actualizada {work.updated_at.slice(0, 10)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="home-shelf home-popular-shelf" aria-labelledby="home-popular-title">
        <div className="section-heading">
          <h2 id="home-popular-title">Populares y mejor valoradas</h2>
          <Link to="/comunidad">Ver comunidad <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
        {popularError && <p className="error-message" role="alert">{popularError}</p>}
        {!configured && (
          <p className="home-empty-state">
            Conecta Supabase para consultar las valoraciones publicadas.
          </p>
        )}
        {configured && !loading && !popularError && popularWorks.length === 0 && (
          <p className="home-empty-state">
            Aún no hay suficientes valoraciones para calcular una clasificación.
            Las métricas aparecerán cuando existan datos reales.
          </p>
        )}
        {popularWorks.length > 0 && (
          <ol className="home-popular-list">
            {popularWorks.map((work) => (
              <li key={work.id}>
                <Link to={`/manga/${work.id}`}>{work.canonical_title}</Link>
                <span aria-label={`${work.average_rating} de 5, ${work.rating_count} valoraciones`}>
                  ★ {work.average_rating.toFixed(1)} · {work.rating_count} valoraciones
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="home-lower-grid" aria-label="Conoce MangaVerse">
        <Link className="home-feature-card" to="/wiki">
          <BookOpenText size={20} aria-hidden="true" />
          <div>
            <h2>Ayuda a mantener la wiki</h2>
            <p>
              Propón fichas, añade alias, corrige datos y aporta fuentes.
              Cada cambio se revisa antes de publicarse.
            </p>
          </div>
          <span>Cómo colaborar <ArrowRight size={15} aria-hidden="true" /></span>
        </Link>
        <Link className="home-feature-card home-feature-card-accent" to="/wiki">
          <HeartHandshake size={20} aria-hidden="true" />
          <div>
            <h2>Apoya el proyecto</h2>
            <p>
              Las donaciones aún no están habilitadas. Por ahora, puedes ayudar
              proponiendo mejoras con fuentes y compartiendo MangaVerse.
            </p>
          </div>
          <span>Conoce cómo colaborar <ArrowRight size={15} aria-hidden="true" /></span>
        </Link>
      </section>

      <footer className="site-footer" id="site-footer">
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
