import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountPage } from './AccountPage'

const { signIn, signUp, requestPasswordReset, updatePassword } = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
}))

vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({
    configured: true,
    loading: false,
    user: null,
    error: null,
    signIn,
    signUp,
    requestPasswordReset,
    updatePassword,
    signOut: vi.fn(),
  }),
}))

function renderAccount(path = '/cuenta') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/cuenta" element={<AccountPage />} />
        <Route path="/registro" element={<AccountPage />} />
        <Route path="/biblioteca" element={<p>Biblioteca privada</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AccountPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    signIn.mockResolvedValue(undefined)
    signUp.mockResolvedValue(true)
    requestPasswordReset.mockResolvedValue(undefined)
    updatePassword.mockResolvedValue(undefined)
  })

  it('shows the main site navigation on the sign-in and registration pages', () => {
    renderAccount('/registro')

    const navigation = screen.getByRole('navigation', { name: 'Navegación principal' })
    expect(navigation).toHaveTextContent('Inicio')
    expect(navigation).toHaveTextContent('Explorar')
    expect(navigation).toHaveTextContent('Wiki')
    expect(navigation).toHaveTextContent('Comunidad')
    expect(navigation).toHaveTextContent('Mi biblioteca')
    expect(screen.getByRole('banner').querySelector('.header-account-button'))
      .toHaveAttribute('href', '/cuenta')
  })

  it('signs in and redirects to the requested internal page', async () => {
    const user = userEvent.setup()
    renderAccount('/cuenta?redirect=%2Fbiblioteca')

    await user.type(screen.getByLabelText('Correo electrónico'), 'reader@example.com')
    await user.type(screen.getByLabelText('Contraseña'), 'secure-password')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Biblioteca privada')).toBeInTheDocument()
    expect(signIn).toHaveBeenCalledWith('reader@example.com', 'secure-password')
  })

  it('does not redirect to an external URL after sign-in', async () => {
    const user = userEvent.setup()
    renderAccount('/cuenta?redirect=%2F%2Fevil.example')

    await user.type(screen.getByLabelText('Correo electrónico'), 'reader@example.com')
    await user.type(screen.getByLabelText('Contraseña'), 'secure-password')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Biblioteca privada')).toBeInTheDocument()
  })

  it('requires a valid email and a minimum password length', async () => {
    renderAccount()
    fireEvent.submit(screen.getByRole('button', { name: 'Entrar' }).closest('form')!)

    expect(await screen.findByText('Ingresa un correo electrónico válido.')).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })

  it('asks new users to confirm their email when sign-up has no session', async () => {
    const user = userEvent.setup()
    signUp.mockResolvedValue(false)
    renderAccount('/registro')

    await user.type(screen.getByLabelText('Nombre de usuario'), 'Lector_anonimo')
    await user.type(screen.getByLabelText('Correo electrónico'), 'new@example.com')
    await user.type(screen.getByLabelText('Contraseña'), 'secure-password')
    await user.click(screen.getByLabelText('Acepto las condiciones y la política de privacidad.'))
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByRole('status')).toHaveTextContent(/Revisa tu correo/)
    await waitFor(() => expect(signUp).toHaveBeenCalledWith(
      'new@example.com',
      'secure-password',
      'lector_anonimo',
    ))
  })

  it('requires username and consent for registration', async () => {
    renderAccount('/registro')
    const submitButton = screen.getByRole('button', { name: 'Crear cuenta' })
    fireEvent.submit(submitButton.closest('form')!)

    expect(signUp).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Nombre de usuario')).toBeRequired()
    expect(screen.getByLabelText('Acepto las condiciones y la política de privacidad.')).toBeRequired()
  })

  it('remembers only the email when requested', async () => {
    const user = userEvent.setup()
    renderAccount()

    await user.type(screen.getByLabelText('Correo electrónico'), 'reader@example.com')
    await user.type(screen.getByLabelText('Contraseña'), 'secure-password')
    await user.click(screen.getByLabelText('Recordarme'))
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Biblioteca privada')).toBeInTheDocument()
    expect(window.localStorage.getItem('mangaverse-remembered-email')).toBe('reader@example.com')
  })

  it('requests a password reset email', async () => {
    const user = userEvent.setup()
    renderAccount()

    await user.click(screen.getByRole('button', { name: '¿Olvidaste la contraseña?' }))
    await user.type(screen.getByLabelText('Correo electrónico'), 'reader@example.com')
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }))

    expect(await screen.findByRole('status')).toHaveTextContent(/recibirás un enlace/)
    expect(requestPasswordReset).toHaveBeenCalledWith(
      'reader@example.com',
      `${window.location.origin}/cuenta?recovery=1`,
    )
  })

  it('lets a signed-in recovery session set a new password', async () => {
    const user = userEvent.setup()
    renderAccount('/cuenta?recovery=1')

    await user.type(screen.getByLabelText('Nueva contraseña'), 'new-secure-password')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    expect(await screen.findByText('Biblioteca privada')).toBeInTheDocument()
    expect(updatePassword).toHaveBeenCalledWith('new-secure-password')
  })
})
