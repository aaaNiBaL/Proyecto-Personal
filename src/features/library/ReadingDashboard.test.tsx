import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReadingDashboard } from './ReadingDashboard'
import type { LibraryEntry } from '../../services/library/libraryService'

const { listMyReadingAchievements } = vi.hoisted(() => ({
  listMyReadingAchievements: vi.fn(),
}))

vi.mock('../../services/library/achievementService', () => ({
  listMyReadingAchievements,
}))

const userId = 'a242eaa0-a5b2-4ce0-97cd-2792fb127fcb'

const entry = {
  id: '5ab7a4a9-d55d-4f90-9080-8109430de99b',
  user_id: userId,
  manga_id: '66a4bf64-1d89-4d39-8de6-bba0b966572f',
  reading_status: 'reading',
  last_chapter: '12',
  private_notes: null,
  personal_rating: null,
  started_on: null,
  finished_on: null,
  created_at: '2026-10-01T12:00:00+00:00',
  updated_at: '2026-10-01T12:00:00+00:00',
  manga: { id: '66a4bf64-1d89-4d39-8de6-bba0b966572f', canonical_title: 'Obra' },
  links: [],
} satisfies LibraryEntry

describe('ReadingDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('summarizes private reading progress and displays unlocked achievements', async () => {
    listMyReadingAchievements.mockResolvedValue([{
      id: 'de129f12-5a73-4338-bba6-0159ac0a6a20',
      slug: 'first_steps',
      title: 'Primeros pasos',
      description: 'Marca una obra como En lectura.',
      criteria_type: 'reading_count',
      threshold: 1,
      sort_order: 1,
      unlocked_at: '2026-10-14T12:00:00+00:00',
    }, {
      id: '51177f5f-d347-4ec4-9de0-d1274425f645',
      slug: 'first_finish',
      title: '¡Finalizado!',
      description: 'Marca tu primera obra como Terminada.',
      criteria_type: 'completed_count',
      threshold: 1,
      sort_order: 2,
      unlocked_at: null,
    }])

    render(<ReadingDashboard userId={userId} entries={[entry]} />)

    expect(await screen.findByText('Primeros pasos')).toBeInTheDocument()
    expect(screen.getByText('1 de 2 logros')).toBeInTheDocument()
    expect(screen.getByText('Desbloqueado el 14 oct 2026')).toBeInTheDocument()
    expect(screen.getByLabelText('Progreso de ¡Finalizado!: 0 de 1'))
      .toHaveAttribute('value', '0')
    expect(screen.getByText('0/1')).toBeInTheDocument()
  })

  it('reports achievement service errors instead of hiding them', async () => {
    listMyReadingAchievements.mockRejectedValue(new Error('permission denied'))
    render(<ReadingDashboard userId={userId} entries={[]} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('permission denied')
  })
})
