import { describe, expect, it } from 'vitest'
import { mangaListInputSchema } from './mangaListService'

describe('mangaListInputSchema', () => {
  it('accepts a named list with optional description and visibility', () => {
    expect(mangaListInputSchema.safeParse({
      title: '  Lecturas de aventura  ',
      description: 'Historias con grandes viajes.',
      isPublic: true,
    })).toMatchObject({
      success: true,
      data: {
        title: 'Lecturas de aventura',
        description: 'Historias con grandes viajes.',
        isPublic: true,
      },
    })
  })

  it('rejects blank titles and oversized list fields', () => {
    expect(mangaListInputSchema.safeParse({
      title: '   ',
      description: '',
      isPublic: false,
    }).success).toBe(false)
    expect(mangaListInputSchema.safeParse({
      title: 'A'.repeat(81),
      description: '',
      isPublic: false,
    }).success).toBe(false)
    expect(mangaListInputSchema.safeParse({
      title: 'Lista',
      description: 'x'.repeat(501),
      isPublic: false,
    }).success).toBe(false)
  })
})
