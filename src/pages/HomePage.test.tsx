import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HomePage } from './HomePage'

describe('HomePage', () => {
  it('describes the project without implying the catalog is available', () => {
    render(<HomePage />)

    expect(
      screen.getByRole('heading', { name: 'Una biblioteca hecha para lectores.' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/El catálogo y las cuentas aún no están disponibles/),
    ).toBeInTheDocument()
  })
})
