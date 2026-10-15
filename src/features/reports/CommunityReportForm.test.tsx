import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommunityReportForm } from './CommunityReportForm'

const { submitCommunityReport } = vi.hoisted(() => ({
  submitCommunityReport: vi.fn(),
}))
const userId = '15e3f394-c9a5-4122-bc42-2514868ca2e1'

vi.mock('../../services/reports/communityReportService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../services/reports/communityReportService')>()
  return { ...original, submitCommunityReport }
})
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: userId } }),
}))

describe('CommunityReportForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    submitCommunityReport.mockResolvedValue('68de7ab9-090e-4a9c-8ea6-954c5d8c356a')
  })

  it('submits a report for the displayed content and confirms receipt', async () => {
    render(
      <MemoryRouter>
        <CommunityReportForm
          targetType="list"
          targetId="66a4bf64-1d89-4d39-8de6-bba0b966572f"
        />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Denunciar' }))
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'spam' } })
    fireEvent.change(screen.getByLabelText('Detalles (opcional)'), {
      target: { value: 'Publicidad repetida.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar denuncia' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Denuncia enviada.')
    expect(submitCommunityReport).toHaveBeenCalledWith({
      targetType: 'list',
      targetId: '66a4bf64-1d89-4d39-8de6-bba0b966572f',
      reason: 'spam',
      details: 'Publicidad repetida.',
    })
  })

  it('can submit a report about a manga information page', async () => {
    render(
      <MemoryRouter>
        <CommunityReportForm
          targetType="manga"
          targetId="66a4bf64-1d89-4d39-8de6-bba0b966572f"
          triggerLabel="Reportar información"
        />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reportar información' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar denuncia' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Denuncia enviada.')
    expect(submitCommunityReport).toHaveBeenCalledWith({
      targetType: 'manga',
      targetId: '66a4bf64-1d89-4d39-8de6-bba0b966572f',
      reason: 'inappropriate',
      details: '',
    })
  })
})
