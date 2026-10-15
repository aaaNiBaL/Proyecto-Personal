import { Globe2, ListPlus, LockKeyhole, Pencil, Plus, Share2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { SiteHeader } from '../components/layout/SiteHeader'
import { useAuth } from '../features/auth/AuthContext'
import {
  addMangaToList,
  createMangaList,
  deleteMangaList,
  listOwnMangaLists,
  mangaListInputSchema,
  removeMangaFromList,
  updateMangaList,
  type OwnMangaList,
} from '../services/lists/mangaListService'
import { searchCatalog } from '../services/catalog/catalogService'
import type { CatalogSearchResult } from '../services/catalog/types'

const exampleLists = [
  {
    title: 'Historias de mar y faros',
    description: 'Para leer con calma.',
    isPublic: false,
    items: ['El Faro de Tinta', 'Nube de Papel', 'Club de Astronomía Nocturna'],
  },
  {
    title: 'Recomendadas para empezar',
    description: 'Series cortas para quien llega nuevo.',
    isPublic: true,
    items: ['Ronin del Andén 9', 'Jardín sin Estaciones'],
  },
  {
    title: 'Pendientes del verano',
    description: '',
    isPublic: false,
    items: ['Forja de Ecos'],
  },
]

const coverTones = ['cover-tone-0', 'cover-tone-4', 'cover-tone-5', 'cover-tone-2']

export function MangaListsPage() {
  const { user } = useAuth()
  const [lists, setLists] = useState<OwnMangaList[]>([])
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [refreshCount, setRefreshCount] = useState(0)
  const loading = Boolean(user && loadedUserId !== user.id)

  useEffect(() => {
    if (!user) return
    let active = true
    listOwnMangaLists(user.id)
      .then((nextLists) => {
        if (active) {
          setLists(nextLists)
          setError(null)
          setLoadedUserId(user.id)
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'No se pudieron cargar tus listas.')
          setLoadedUserId(user.id)
        }
      })
    return () => { active = false }
  }, [user, refreshCount])

  function onChanged(nextMessage: string) {
    setMessage(nextMessage)
    setRefreshCount((count) => count + 1)
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setPending(true)
    setError(null)
    setMessage(null)
    try {
      const values = mangaListInputSchema.parse({
        title: form.get('title'),
        description: form.get('description') ?? '',
        isPublic: form.get('is_public') === 'on',
      })
      await createMangaList(user.id, values)
      formElement.reset()
      setCreateOpen(false)
      onChanged('Lista creada.')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear la lista.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main id="main-content" className="page-shell" tabIndex={-1}>
      <SiteHeader />
      <section className="catalog-heading">
        <p className="eyebrow">{user ? 'Mi espacio' : 'Mi espacio · ejemplo'}</p>
        <h1>Mis listas</h1>
        <p>Agrupa obras en listas. Son privadas por defecto; tú decides si alguna se comparte.</p>
      </section>
      <section className="manga-lists-toolbar" aria-label="Acciones de listas">
        <p>{user ? `${lists.length} ${lists.length === 1 ? 'lista' : 'listas'}` : '3 listas de ejemplo'}</p>
        {user ? (
          <button
            className="primary-button"
            type="button"
            onClick={() => setCreateOpen((open) => !open)}
            aria-expanded={createOpen}
            aria-controls="create-manga-list"
          >
            <Plus size={15} aria-hidden="true" />
            Nueva lista
          </button>
        ) : (
          <Link className="primary-button" to="/cuenta?redirect=%2Flistas">
            <Plus size={15} aria-hidden="true" />
            Nueva lista
          </Link>
        )}
      </section>
      {user && createOpen && (
        <form id="create-manga-list" className="manga-list-create-form" onSubmit={handleCreate}>
          <h2>Nueva lista</h2>
          <label>
            Nombre
            <input name="title" required minLength={1} maxLength={80} placeholder="Por ejemplo: Aventuras favoritas" />
          </label>
          <label>
            Descripción (opcional)
            <textarea name="description" maxLength={500} rows={2} placeholder="¿Qué reúne esta lista?" />
          </label>
          <label className="manga-list-visibility">
            <input name="is_public" type="checkbox" />
            Hacer pública y permitir compartirla
          </label>
          <div className="manga-list-actions">
            <button className="primary-button" type="submit" disabled={pending}>
              {pending ? 'Creando…' : 'Crear lista'}
            </button>
            <button className="secondary-button" type="button" onClick={() => setCreateOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
      {error && <p className="error-message" role="alert">{error}</p>}
      {message && <p className="success-message" role="status">{message}</p>}
      {loading && <p role="status">Cargando tus listas…</p>}
      {!loading && !error && user && lists.length === 0 && (
        <div className="empty-state">
          <h2>Aún no tienes listas</h2>
          <p>Crea una lista y añade obras desde el catálogo.</p>
        </div>
      )}
      {!loading && !error && user && lists.length > 0 && (
        <section className="manga-lists-own" aria-label="Mis listas de manga">
          {lists.map((list) => (
            <OwnMangaListCard
              key={`${list.id}-${list.updated_at}`}
              list={list}
              userId={user?.id ?? ''}
              onChanged={onChanged}
            />
          ))}
        </section>
      )}
      {!user && (
        <section className="manga-lists-own" aria-label="Listas de ejemplo">
          {exampleLists.map((list, index) => (
            <ExampleMangaList key={list.title} list={list} index={index} />
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

function ExampleMangaList({
  list,
  index,
}: {
  list: (typeof exampleLists)[number]
  index: number
}) {
  return (
    <article className="manga-list-card manga-list-card-preview">
      <header className="manga-list-card-header">
        <div>
          <h2>{list.title}</h2>
          {list.description && <p>{list.description}</p>}
        </div>
        <span className="manga-list-visibility-badge">
          {list.isPublic ? <Globe2 size={12} aria-hidden="true" /> : <LockKeyhole size={12} aria-hidden="true" />}
          {list.isPublic ? 'Pública' : 'Privada'}
        </span>
      </header>
      <ul className="manga-list-preview-items">
        {list.items.map((title, itemIndex) => (
          <li key={title}>
            <div className={`library-cover ${coverTones[(index + itemIndex) % coverTones.length]}`} aria-hidden="true">
              <span>{title}</span>
            </div>
            <span>{title}</span>
          </li>
        ))}
        <li className="manga-list-add-tile" aria-hidden="true">
          <ListPlus size={18} />
        </li>
      </ul>
      <footer className="manga-list-preview-actions">
        <Link className="secondary-button" to="/cuenta?redirect=%2Flistas">
          <Pencil size={14} aria-hidden="true" />
          Editar
        </Link>
        <Link className="secondary-button" to="/cuenta?redirect=%2Flistas">
          <Share2 size={14} aria-hidden="true" />
          Compartir
        </Link>
      </footer>
    </article>
  )
}

function OwnMangaListCard({
  list,
  userId,
  onChanged,
}: {
  list: OwnMangaList
  userId: string
  onChanged: (message: string) => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogSearchResult[]>([])
  const [searchPending, setSearchPending] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError(null)
    try {
      await updateMangaList(list.id, userId, {
        title: String(form.get('title') ?? ''),
        description: String(form.get('description') ?? ''),
        isPublic: form.get('is_public') === 'on',
      })
      setEditOpen(false)
      onChanged('Cambios de la lista guardados.')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar la lista.')
    } finally {
      setPending(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar la lista «${list.title}» y sus elementos?`)) return
    setPending(true)
    setError(null)
    try {
      await deleteMangaList(list.id, userId)
      onChanged('Lista eliminada.')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar la lista.')
      setPending(false)
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSearchPending(true)
    setError(null)
    try {
      const result = await searchCatalog({
        query,
        status: '',
        year: null,
        genre: '',
        page: 1,
      })
      const existingIds = new Set(list.items.map((item) => item.id))
      setResults(result.items.filter((item) => !existingIds.has(item.id)))
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo buscar en el catálogo.')
    } finally {
      setSearchPending(false)
    }
  }

  async function handleAdd(mangaId: string) {
    setPending(true)
    setError(null)
    try {
      await addMangaToList(list.id, mangaId)
      setResults((current) => current.filter((result) => result.id !== mangaId))
      onChanged('Obra añadida a la lista.')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo añadir la obra.')
      setPending(false)
    }
  }

  async function handleRemove(mangaId: string, title: string) {
    setPending(true)
    setError(null)
    try {
      await removeMangaFromList(list.id, mangaId)
      onChanged(`«${title}» se quitó de la lista.`)
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo quitar la obra.')
      setPending(false)
    }
  }

  return (
    <article className="manga-list-card">
      <header className="manga-list-card-header">
        <div>
          <h2>{list.title}</h2>
          {list.description && <p>{list.description}</p>}
        </div>
        <span className="manga-list-visibility-badge">
          {list.is_public ? <Globe2 size={12} aria-hidden="true" /> : <LockKeyhole size={12} aria-hidden="true" />}
          {list.is_public ? 'Pública' : 'Privada'}
        </span>
      </header>
      <ul className="manga-list-preview-items">
        {list.items.map((item, index) => (
          <li key={item.id}>
            <Link to={`/manga/${item.id}`}>
              <div className={`library-cover ${coverTones[index % coverTones.length]}`} aria-hidden="true">
                <span>{item.canonical_title}</span>
              </div>
              <span>{item.canonical_title}</span>
            </Link>
          </li>
        ))}
        <li className="manga-list-add-tile">
          <Link to="/explorar" aria-label={`Añadir obras a ${list.title}`}>
            <ListPlus size={18} aria-hidden="true" />
          </Link>
        </li>
      </ul>
      <footer className="manga-list-preview-actions">
        <button
          className="secondary-button"
          type="button"
          onClick={() => setEditOpen((open) => !open)}
          aria-expanded={editOpen}
        >
          <Pencil size={14} aria-hidden="true" />
          Editar
        </button>
        {list.is_public ? (
          <Link className="secondary-button" to={`/listas/${list.id}`}>
            <Share2 size={14} aria-hidden="true" />
            Compartir
          </Link>
        ) : (
          <button className="secondary-button" type="button" disabled title="Haz pública la lista para compartirla">
            <Share2 size={14} aria-hidden="true" />
            Compartir
          </button>
        )}
      </footer>
      {editOpen && <form className="manga-list-edit-form" onSubmit={handleUpdate}>
        <label>
          Nombre
          <input name="title" required maxLength={80} defaultValue={list.title} disabled={pending} />
        </label>
        <label>
          Descripción
          <textarea name="description" maxLength={500} rows={2} defaultValue={list.description} disabled={pending} />
        </label>
        <label className="manga-list-visibility">
          <input name="is_public" type="checkbox" defaultChecked={list.is_public} disabled={pending} />
          Pública
        </label>
        <div className="manga-list-actions">
          <button className="secondary-button" type="submit" disabled={pending}>Guardar cambios</button>
          {list.is_public && (
            <Link className="text-button" to={`/listas/${list.id}`}>Ver enlace público</Link>
          )}
          <button className="text-button danger-text-button" type="button" disabled={pending} onClick={() => void handleDelete()}>
            Eliminar lista
          </button>
        </div>
      </form>
      }
      <form className="manga-list-search-form" onSubmit={handleSearch}>
        <label>
          Añadir obras desde el catálogo
          <span className="manga-list-search-input">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por título"
            />
            <button className="secondary-button" type="submit" disabled={searchPending || !query.trim()}>
              {searchPending ? 'Buscando…' : 'Buscar'}
            </button>
          </span>
        </label>
      </form>
      {results.length > 0 && (
        <ul className="manga-list-search-results">
          {results.map((result) => (
            <li key={result.id}>
              <Link to={`/manga/${result.id}`}>{result.canonical_title}</Link>
              <button className="text-button" type="button" disabled={pending} onClick={() => void handleAdd(result.id)}>
                Añadir
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="error-message" role="alert">{error}</p>}
      {list.items.length > 0 ? (
        <ul className="manga-list-items">
          {list.items.map((item) => (
            <li key={item.id}>
              <Link to={`/manga/${item.id}`}>{item.canonical_title}</Link>
              {item.start_year && <span>{item.start_year}</span>}
              <button
                className="text-button danger-text-button"
                type="button"
                disabled={pending}
                onClick={() => void handleRemove(item.id, item.canonical_title)}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted-copy">Esta lista todavía no tiene obras.</p>
      )}
    </article>
  )
}
