import { describe, expect, it } from 'vitest'
import { personalLinkInputSchema } from './libraryService'

describe('personalLinkInputSchema', () => {
  it('accepts HTTP and HTTPS links', () => {
    expect(personalLinkInputSchema.safeParse({
      label: 'Referencia',
      url: 'https://example.org/manga',
    }).success).toBe(true)
    expect(personalLinkInputSchema.safeParse({
      label: 'Referencia',
      url: 'http://example.org/manga',
    }).success).toBe(true)
  })

  it('rejects unsafe URL schemes and malformed URLs without throwing', () => {
    expect(personalLinkInputSchema.safeParse({
      label: 'Enlace',
      url: 'javascript:alert(1)',
    }).success).toBe(false)
    expect(personalLinkInputSchema.safeParse({
      label: 'Enlace',
      url: 'not a URL',
    }).success).toBe(false)
  })
})
