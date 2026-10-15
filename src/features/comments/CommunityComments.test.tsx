import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommunityComments } from './CommunityComments'

const {
  createCommunityComment,
  deleteCommunityComment,
  listCommunityComments,
} = vi.hoisted(() => ({
  createCommunityComment: vi.fn(),
  deleteCommunityComment: vi.fn(),
  listCommunityComments: vi.fn(),
}))

vi.mock('../../services/comments/communityCommentService', () => ({
  createCommunityComment,
  deleteCommunityComment,
  listCommunityComments,
}))
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
}))

const mangaId = '66a4bf64-1d89-4d39-8de6-bba0b966572f'
const userId = '6bbe10c1-e0f3-42a6-a494-244e7e1393b4'

function renderComments(viewerId: string | null = userId) {
  return render(
    <MemoryRouter>
      <CommunityComments targetType="manga" targetId={mangaId} userId={viewerId} />
    </MemoryRouter>,
  )
}

describe('CommunityComments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listCommunityComments.mockResolvedValue([])
    createCommunityComment.mockResolvedValue('68de7ab9-090e-4a9c-8ea6-954c5d8c356a')
    deleteCommunityComment.mockResolvedValue(undefined)
  })

  it('lets signed-in readers publish a comment', async () => {
    renderComments()
    const textarea = await screen.findByLabelText('Escribe un comentario')
    await screen.findByText('Todavía no hay comentarios.')
    fireEvent.change(textarea, {
      target: { value: 'Me gustó mucho esta obra.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Comentar' }))

    expect(await screen.findByText('Tu comentario se publicó.')).toBeInTheDocument()
    expect(createCommunityComment).toHaveBeenCalledWith(
      'manga',
      mangaId,
      'Me gustó mucho esta obra.',
    )
  })

  it('offers a sign-in link to visitors', async () => {
    renderComments(null)
    expect(await screen.findByRole('link', { name: 'Inicia sesión' }))
      .toHaveAttribute('href', '/cuenta')
  })
})
