import { ArrowRight, BookOpenText, ListChecks, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SiteHeader } from '../components/layout/SiteHeader'

const spaces = [
  {
    icon: Star,
    title: 'Reseñas',
    description: 'Lee opiniones y puntuaciones en las fichas de cada obra.',
    action: 'Explorar mangas',
    to: '/explorar',
  },
  {
    icon: ListChecks,
    title: 'Listas de la comunidad',
    description: 'Descubre selecciones compartidas desde los perfiles públicos.',
    action: 'Ver perfiles públicos',
    to: '/explorar',
  },
  {
    icon: BookOpenText,
    title: 'Logros',
    description: 'Registra tu lectura y desbloquea hitos en tu biblioteca privada.',
    action: 'Abrir mi biblioteca',
    to: '/biblioteca',
  },
]

export function CommunityPage() {
  return (
    <main id="main-content" className="page-shell editorial-page" tabIndex={-1}>
      <SiteHeader />
      <section className="editorial-intro">
        <p className="eyebrow">Etapa 2</p>
        <h1>Comunidad</h1>
        <p>Reseñas, listas compartidas y progreso de lectura, construidos por quienes leen.</p>
      </section>
      <section className="community-spaces" aria-label="Espacios de la comunidad">
        {spaces.map(({ icon: Icon, title, description, action, to }) => (
          <article className="community-space-card" key={title}>
            <Icon size={20} aria-hidden="true" />
            <h2>{title}</h2>
            <p>{description}</p>
            <Link to={to}>{action} <ArrowRight size={15} aria-hidden="true" /></Link>
          </article>
        ))}
      </section>
      <footer className="site-footer">
        Comparte con respeto; el contenido denunciado puede ser revisado por moderación.
      </footer>
    </main>
  )
}
