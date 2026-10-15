import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SiteHeader } from '../components/layout/SiteHeader'

const steps = [
  ['01', 'Envía una propuesta', 'Sugiere una corrección o un título alternativo desde una ficha.'],
  ['02', 'Aporta una fuente', 'Toda propuesta debe incluir un enlace HTTPS que respalde el cambio.'],
  ['03', 'Queda pendiente', 'La información actual sigue publicada mientras se revisa la propuesta.'],
  ['04', 'Un editor la revisa', 'El equipo editorial comprueba el cambio y la fuente.'],
  ['05', 'Se aprueba o se devuelve', 'La propuesta puede aprobarse o rechazarse con una nota.'],
  ['06', 'Queda en el historial', 'Los cambios aprobados se registran en la ficha del manga.'],
]

export function WikiPage() {
  return (
    <main id="main-content" className="page-shell editorial-page" tabIndex={-1}>
      <SiteHeader />
      <section className="editorial-intro">
        <p className="eyebrow">Colabora</p>
        <h1>Wiki</h1>
        <p>Las propuestas nunca reemplazan datos verificados sin revisión.</p>
      </section>
      <section className="wiki-steps" aria-label="Cómo funciona la wiki colaborativa">
        {steps.map(([number, title, description]) => (
          <article className="wiki-step-card" key={number}>
            <span>{number}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>
      <div className="editorial-cta">
        <p>¿Listo para colaborar?</p>
        <Link className="primary-button" to="/explorar">
          Explorar el catálogo <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <footer className="site-footer">
        Cada cambio editorial conserva su fuente y un historial de revisión.
      </footer>
    </main>
  )
}
