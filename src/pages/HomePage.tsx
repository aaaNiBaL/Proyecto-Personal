import { BookOpenText, HeartHandshake, Search } from 'lucide-react'

export function HomePage() {
  return (
    <main className="page-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="MangaVerse, inicio">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span>MangaVerse</span>
        </a>
        <span className="status-badge">En desarrollo</span>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">Tu espacio para descubrir y seguir mangas</p>
        <h1 id="hero-title">Una biblioteca hecha para lectores.</h1>
        <p className="hero-copy">
          MangaVerse reunirá un catálogo con fuentes, búsqueda por títulos y
          alias, y una biblioteca personal privada para que puedas organizar tu
          lectura.
        </p>
        <p className="development-note">
          La aplicación está en su etapa inicial. El catálogo y las cuentas aún
          no están disponibles.
        </p>
      </section>

      <section className="principles" aria-label="Principios de MangaVerse">
        <article className="principle-card">
          <Search aria-hidden="true" />
          <h2>Descubrir</h2>
          <p>Buscar obras por títulos y nombres alternativos.</p>
        </article>
        <article className="principle-card">
          <BookOpenText aria-hidden="true" />
          <h2>Organizar</h2>
          <p>Conservar tu progreso en una biblioteca privada.</p>
        </article>
        <article className="principle-card">
          <HeartHandshake aria-hidden="true" />
          <h2>Colaborar</h2>
          <p>Ayudar a mantener información bibliográfica con fuentes.</p>
        </article>
      </section>

      <footer className="site-footer">
        Información bibliográfica y herramientas comunitarias; no alojamos
        capítulos.
      </footer>
    </main>
  )
}
