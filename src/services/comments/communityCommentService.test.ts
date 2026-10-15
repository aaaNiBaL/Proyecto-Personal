import { describe, expect, it } from 'vitest'
import { communityCommentInputSchema } from './communityCommentService'

describe('communityCommentInputSchema', () => {
  it('accepts a comment attached to a manga or review', () => {
    const targetId = '66a4bf64-1d89-4d39-8de6-bba0b966572f'
    for (const targetType of ['manga', 'review']) {
      expect(communityCommentInputSchema.safeParse({
        targetType,
        targetId,
        commentText: '  Buen comentario.  ',
      }).success).toBe(true)
    }
  })

  it('rejects blank, oversized, or invalid target comments', () => {
    const base = {
      targetType: 'manga',
      targetId: '66a4bf64-1d89-4d39-8de6-bba0b966572f',
      commentText: 'Comentario',
    }
    expect(communityCommentInputSchema.safeParse({ ...base, commentText: '  ' }).success).toBe(false)
    expect(communityCommentInputSchema.safeParse({ ...base, commentText: 'x'.repeat(2001) }).success).toBe(false)
    expect(communityCommentInputSchema.safeParse({ ...base, targetType: 'profile' }).success).toBe(false)
  })
})
