import { describe, expect, it } from 'vitest'
import { profileUpdateSchema } from './profileService'

const validProfile = {
  username: 'manga_reader',
  displayName: 'Manga Reader',
  bio: 'Me encantan las historias de aventura.',
  isPublic: true,
  showFavorites: false,
  showAchievements: false,
  notifyContributions: true,
  notifyNews: false,
}

describe('profileUpdateSchema', () => {
  it('normalizes usernames and accepts optional public information', () => {
    expect(profileUpdateSchema.parse({
      ...validProfile,
      username: '  MANGA_READER ',
    })).toEqual(validProfile)
  })

  it('rejects invalid usernames and oversized profile fields', () => {
    for (const username of ['ab', 'has space', 'invalid-name', 'ñandú']) {
      expect(profileUpdateSchema.safeParse({ ...validProfile, username }).success).toBe(false)
    }
    expect(profileUpdateSchema.safeParse({
      ...validProfile,
      bio: 'a'.repeat(501),
    }).success).toBe(false)
    expect(profileUpdateSchema.safeParse({
      ...validProfile,
      displayName: 'a'.repeat(81),
    }).success).toBe(false)
  })
})
