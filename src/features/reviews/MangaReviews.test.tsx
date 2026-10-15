import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MangaReviews } from './MangaReviews'

const { deleteMangaReview, getMyMangaReview, listMangaReviews, saveMangaReview } = vi.hoisted(() => ({
  deleteMangaReview: vi.fn(),
  getMyMangaReview: vi.fn(),
  listMangaReviews: vi.fn(),
  saveMangaReview: vi.fn(),
}))
const { listCommunityComments } = vi.hoisted(() => ({
  listCommunityComments: vi.fn(),
}))

vi.mock('../../services/reviews/reviewService', () => ({
  deleteMangaReview,
  getMyMangaReview,
  listMangaReviews,
  saveMangaReview,
}))
vi.mock('../../services/comments/communityCommentService', () => ({
  listCommunityComments,
}))
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
}))

function renderReviews(userId: string | null = null) {
  return render(
    <MemoryRouter>
      <MangaReviews
        mangaId="66a4bf64-1d89-4d39-8de6-bba0b966572f"
        userId={userId}
      />
    </MemoryRouter>,
  )
}

describe('MangaReviews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMyMangaReview.mockResolvedValue(null)
    listCommunityComments.mockResolvedValue([])
    listMangaReviews.mockResolvedValue({
      average_rating: 4,
      rating_count: 2,
      reviews: [{
        id: '68de7ab9-090e-4a9c-8ea6-954c5d8c356a',
        author_id: '6bbe10c1-e0f3-42a6-a494-244e7e1393b4',
        username: 'lector',
        rating: 4,
        review_text: 'El protagonista descubre un secreto importante.',
        contains_spoilers: true,
        created_at: '2026-10-14T12:00:00+00:00',
        updated_at: '2026-10-14T12:00:00+00:00',
      }],
    })
  })

  it('conceals spoiler text until the reader chooses to reveal it', async () => {
    renderReviews()

    expect(await screen.findByText('@lector')).toBeInTheDocument()
    expect(screen.getByText('4.0')).toBeInTheDocument()
    expect(screen.getByText('2 puntuaciones')).toBeInTheDocument()
    expect(screen.queryByText('El protagonista descubre un secreto importante.'))
      .not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar reseña' }))
    expect(screen.getByText('El protagonista descubre un secreto importante.'))
      .toBeInTheDocument()
  })

  it('offers a session link to visitors who are not signed in', async () => {
    renderReviews()
    expect(await screen.findByRole('link', { name: 'Inicia sesión' })).toHaveAttribute('href', '/cuenta')
  })

  it('lets signed-in readers publish a rating and review', async () => {
    const userId = '6bbe10c1-e0f3-42a6-a494-244e7e1393b4'
    renderReviews(userId)
    await screen.findByRole('heading', { name: 'Deja tu reseña' })
    fireEvent.change(screen.getByLabelText('Tu puntuación'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Reseña (opcional)'), {
      target: { value: 'Muy recomendable.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar reseña' }))

    expect(await screen.findByText('Tu puntuación y reseña se guardaron.'))
      .toBeInTheDocument()
    expect(saveMangaReview).toHaveBeenCalledWith(
      '66a4bf64-1d89-4d39-8de6-bba0b966572f',
      userId,
      { rating: 4, reviewText: 'Muy recomendable.', containsSpoilers: false },
    )
  })
})
