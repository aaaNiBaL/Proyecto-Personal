import { z } from 'zod'
import { BookOpenText, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { SiteHeader } from '../components/layout/SiteHeader'
import { useAuth } from '../features/auth/AuthContext'

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
})

const usernameSchema = z.string()
  .trim()
  .toLowerCase()
  .min(3, 'El nombre de usuario debe tener entre 3 y 24 caracteres.')
  .max(24, 'El nombre de usuario debe tener entre 3 y 24 caracteres.')
  .regex(/^[a-z0-9_]+$/, 'Usa solo letras, números y guion bajo en el nombre de usuario.')

function getSafeRedirect(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/biblioteca'
  }
  const destination = new URL(value, window.location.origin)
  if (
    destination.origin !== window.location.origin ||
    destination.pathname === '/cuenta' ||
    destination.pathname === '/registro'
  ) {
    return '/biblioteca'
  }
  return `${destination.pathname}${destination.search}${destination.hash}`
}

export function AccountPage() {
  const {
    configured,
    loading,
    user,
    error: sessionError,
    signIn,
    signUp,
    requestPasswordReset,
    updatePassword,
  } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isRegistering = location.pathname === '/registro'
  const isRecovery = new URLSearchParams(location.search).get('recovery') === '1'
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationNotice, setConfirmationNotice] = useState(false)
  const [resetNotice, setResetNotice] = useState(false)
  const [forgotPassword, setForgotPassword] = useState(false)
  const [rememberEmail, setRememberEmail] = useState(Boolean(window.localStorage.getItem('mangaverse-remembered-email')))

  if (!loading && user && !isRecovery) {
    return <Navigate to={getSafeRedirect(new URLSearchParams(location.search).get('redirect'))} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setConfirmationNotice(false)

    const formData = new FormData(event.currentTarget)
    if (isRecovery) {
      const password = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.')
        .safeParse(formData.get('password'))
      if (!password.success) {
        setError(password.error.issues[0]?.message ?? 'Revisa la contraseña.')
        return
      }
      setPending(true)
      try {
        await updatePassword(password.data)
        navigate('/biblioteca', { replace: true })
      } catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : 'No se pudo actualizar la contraseña.')
      } finally {
        setPending(false)
      }
      return
    }

    const email = z.email().safeParse(formData.get('email'))
    if (!email.success) {
      setError('Ingresa un correo electrónico válido.')
      return
    }
    if (forgotPassword) {
      setPending(true)
      try {
        await requestPasswordReset(email.data, `${window.location.origin}/cuenta?recovery=1`)
        setResetNotice(true)
      } catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : 'No se pudo enviar el correo de recuperación.')
      } finally {
        setPending(false)
      }
      return
    }

    const parsed = credentialsSchema.safeParse({
      email: email.data,
      password: formData.get('password'),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisa los datos ingresados.')
      return
    }

    setPending(true)
    try {
      if (isRegistering) {
        const username = usernameSchema.safeParse(formData.get('username'))
        if (!username.success) {
          setError(username.error.issues[0]?.message ?? 'Revisa el nombre de usuario.')
          setPending(false)
          return
        }
        if (formData.get('accept_terms') !== 'on') {
          setError('Debes aceptar las condiciones y la política de privacidad.')
          setPending(false)
          return
        }
        const hasSession = await signUp(parsed.data.email, parsed.data.password, username.data)
        if (hasSession) {
          navigate(getSafeRedirect(new URLSearchParams(location.search).get('redirect')))
        } else {
          setConfirmationNotice(true)
        }
      } else {
        await signIn(parsed.data.email, parsed.data.password)
        if (rememberEmail) {
          window.localStorage.setItem('mangaverse-remembered-email', parsed.data.email)
        } else {
          window.localStorage.removeItem('mangaverse-remembered-email')
        }
        navigate(getSafeRedirect(new URLSearchParams(location.search).get('redirect')))
      }
    } catch (cause: unknown) {
      const causeMessage = cause instanceof Error ? cause.message : ''
      setError(
        isRegistering && causeMessage.includes('Database error saving new user')
          ? 'No se pudo crear la cuenta. Revisa que el nombre de usuario no esté ocupado y que la migración de registro esté aplicada en Supabase.'
          : causeMessage || 'No se pudo completar la solicitud.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="auth-page" tabIndex={-1}>
        <section className="auth-layout" aria-label="Acceso a MangaVerse">
          <div className="auth-intro">
            <Link className="auth-logo" to="/" aria-label="MangaVerse, inicio">
              <BookOpenText size={22} aria-hidden="true" />
            </Link>
            <p className="eyebrow">MangaVerse</p>
            <h1>{isRecovery ? 'Nueva contraseña.' : 'Tu biblioteca, tu ritmo.'}</h1>
            <p className="auth-intro-copy">
              Una cuenta gratuita te permite llevar el progreso de lectura, escribir notas y guardar enlaces personales. Todo es privado por defecto.
            </p>
            <ul>
              <li>Biblioteca privada con estados de lectura</li>
              <li>Notas y enlaces que solo tú ves</li>
              <li>Propuestas de cambios para la wiki</li>
            </ul>
          </div>

          <section className="auth-panel">
            {!isRecovery && (
              <nav className="auth-tabs" aria-label="Acceso o registro">
                <Link className={!isRegistering ? 'is-active' : ''} to={`/cuenta${location.search}`}>
                  Iniciar sesión
                </Link>
                <Link className={isRegistering ? 'is-active' : ''} to={`/registro${location.search}`}>
                  Crear cuenta
                </Link>
              </nav>
            )}
            <h2>
              {isRecovery ? 'Restablecer contraseña' : forgotPassword ? 'Recuperar contraseña' : isRegistering ? 'Crear cuenta' : 'Iniciar sesión'}
            </h2>
            {!configured && (
              <p className="error-message" role="alert">
                Configura Supabase en `.env.local` para activar las cuentas.
              </p>
            )}
            {sessionError && <p className="error-message" role="alert">{sessionError}</p>}
            {confirmationNotice && (
              <p className="success-message" role="status">
                Cuenta creada. Revisa tu correo y confirma la dirección antes de iniciar sesión.
              </p>
            )}
            {resetNotice && (
              <p className="success-message" role="status">
                Si el correo corresponde a una cuenta, recibirás un enlace para restablecer tu contraseña.
              </p>
            )}
            <form className={`auth-form${isRegistering ? ' is-registering' : ''}`} onSubmit={handleSubmit}>
              {!isRecovery && (
                isRegistering && (
                  <label>
                    Nombre de usuario
                    <span className="auth-input-wrap">
                      <UserRound size={15} aria-hidden="true" />
                      <input
                        name="username"
                        aria-label="Nombre de usuario"
                        type="text"
                        autoComplete="username"
                        minLength={3}
                        maxLength={24}
                        pattern="[a-zA-Z0-9_]+"
                        required
                        placeholder="lector_anonimo"
                        disabled={!configured || pending}
                      />
                    </span>
                    <span className="auth-field-hint">De 3 a 24 caracteres; letras, números y guion bajo.</span>
                  </label>
                )
              )}
              {!isRecovery && (
                <label>
                  Correo electrónico
                  <span className="auth-input-wrap">
                    <Mail size={15} aria-hidden="true" />
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      defaultValue={window.localStorage.getItem('mangaverse-remembered-email') ?? ''}
                      disabled={!configured || pending}
                    />
                  </span>
                </label>
              )}
              {!forgotPassword && (
                <label>
                  {isRecovery ? 'Nueva contraseña' : 'Contraseña'}
                  <span className="auth-input-wrap">
                    <LockKeyhole size={15} aria-hidden="true" />
                    <input
                      name="password"
                      type="password"
                      autoComplete={isRecovery || isRegistering ? 'new-password' : 'current-password'}
                      minLength={8}
                      required={!forgotPassword}
                      disabled={!configured || pending}
                    />
                  </span>
                </label>
              )}
              {(isRegistering || isRecovery) && (
                <p className="form-hint">Usa una contraseña de al menos 8 caracteres.</p>
              )}
              {isRegistering && (
                <label className="auth-consent">
                  <input
                    name="accept_terms"
                    type="checkbox"
                    aria-label="Acepto las condiciones y la política de privacidad."
                    required
                    disabled={!configured || pending}
                  />
                  <span>Acepto las condiciones y la política de privacidad.</span>
                </label>
              )}
              {!isRegistering && !isRecovery && !forgotPassword && (
                <div className="auth-options">
                  <label className="auth-remember">
                    <input
                      type="checkbox"
                      checked={rememberEmail}
                      onChange={(event) => setRememberEmail(event.target.checked)}
                      disabled={!configured || pending}
                    />
                    Recordarme
                  </label>
                  <button className="auth-forgot-link" type="button" onClick={() => {
                    setForgotPassword(true)
                    setError(null)
                    setResetNotice(false)
                  }}>
                    ¿Olvidaste la contraseña?
                  </button>
                </div>
              )}
              {error && <p className="error-message" role="alert">{error}</p>}
              <button className="primary-button" type="submit" disabled={!configured || pending}>
                {pending ? 'Procesando…' : isRecovery ? 'Guardar contraseña' : forgotPassword ? 'Enviar enlace' : isRegistering ? 'Crear cuenta' : 'Entrar'}
              </button>
            </form>
            {forgotPassword ? (
              <button className="auth-secondary-link" type="button" onClick={() => {
                setForgotPassword(false)
                setResetNotice(false)
                setError(null)
              }}>
                Volver a iniciar sesión
              </button>
            ) : !isRecovery ? (
              <p className="auth-footnote">Diseño de ejemplo · Tus datos se mantienen privados.</p>
            ) : null}
          </section>
        </section>
      </main>
    </>
  )
}
