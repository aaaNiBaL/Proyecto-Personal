import { describe, expect, it } from 'vitest'
import { reviewInputSchema } from './reviewService'

describe('reviewInputSchema', () => {
  it('accepts a rating with an optional review and spoiler flag', () => {
    expect(reviewInputSchema.safeParse({
      rating: 5,
      reviewText: 'Una historia excelente.',
      containsSpoilers: false,
    }).success).toBe(true)
    expect(reviewInputSchema.safeParse({
      rating: 3,
      reviewText: null,
      containsSpoilers: false,
    }).success).toBe(true)
  })

  it('rejects ratings outside 1-5, fractional values, and oversized reviews', () => {
    for (const rating of [0, 6, 2.5]) {
      expect(reviewInputSchema.safeParse({
        rating,
        reviewText: null,
        containsSpoilers: false,
      }).success).toBe(false)
    }
    expect(reviewInputSchema.safeParse({
      rating: 5,
      reviewText: 'a'.repeat(10001),
      containsSpoilers: false,
    }).success).toBe(false)
  })
})
