import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="not-found">
      <p className="eyebrow">404</p>
      <h1>Esta página no existe.</h1>
      <Link to="/">Volver al inicio</Link>
    </main>
  )
}
