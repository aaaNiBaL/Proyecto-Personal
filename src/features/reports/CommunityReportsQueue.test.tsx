import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommunityReportsQueue } from './CommunityReportsQueue'

const { listPendingCommunityReports, reviewCommunityReport } = vi.hoisted(() => ({
  listPendingCommunityReports: vi.fn(),
  reviewCommunityReport: vi.fn(),
}))

vi.mock('../../services/reports/communityReportService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../services/reports/communityReportService')>()
  return { ...original, listPendingCommunityReports, reviewCommunityReport }
})

describe('CommunityReportsQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listPendingCommunityReports
      .mockResolvedValueOnce([{
        id: '68de7ab9-090e-4a9c-8ea6-954c5d8c356a',
        target_type: 'comment',
        target_id: 'd1f9da60-f933-4f04-8cb3-b5e9afdf1ec0',
        target_title: 'Obra de prueba',
        target_excerpt: 'Comentario denunciado.',
        target_path: '/manga/d1f9da60-f933-4f04-8cb3-b5e9afdf1ec0',
        reporter_username: 'lector',
        reason: 'spoilers',
        details: 'No está marcada con spoiler.',
        created_at: '2026-10-14T12:00:00+00:00',
      }])
      .mockResolvedValueOnce([])
    reviewCommunityReport.mockResolvedValue(undefined)
  })

  it('lets moderators mark a report as resolved', async () => {
    render(
      <MemoryRouter>
        <CommunityReportsQueue />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Obra de prueba' })).toBeInTheDocument()
    expect(screen.getByText('Comentario denunciado.')).toBeInTheDocument()
    expect(screen.getByText('Comentario')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Marcar atendida' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Denuncia marcada como atendida.')
    expect(reviewCommunityReport).toHaveBeenCalledWith(
      '68de7ab9-090e-4a9c-8ea6-954c5d8c356a',
      'resolved',
      '',
    )
    expect(await screen.findByText('No hay denuncias pendientes.')).toBeInTheDocument()
  })
})
