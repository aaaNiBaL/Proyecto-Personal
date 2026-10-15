import { z } from 'zod'
import { createSupabaseClient } from '../supabase/client'

const usernameSchema = z.string()
  .trim()
  .toLowerCase()
  .min(3, 'El usuario debe tener entre 3 y 24 caracteres.')
  .max(24, 'El usuario debe tener entre 3 y 24 caracteres.')
  .regex(/^[a-z0-9_]+$/, 'Usa solo letras minúsculas, números y guion bajo.')

const ownProfileSchema = z.object({
  user_id: z.uuid(),
  username: usernameSchema,
  display_name: z.string().max(80),
  bio: z.string().max(500),
  is_public: z.boolean(),
  show_favorites: z.boolean(),
  show_achievements: z.boolean(),
  notify_contributions: z.boolean(),
  notify_news: z.boolean(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
})

const publicReviewSchema = z.object({
  manga_id: z.uuid(),
  manga_title: z.string(),
  rating: z.number().int().min(1).max(5),
  review_text: z.string().nullable(),
  contains_spoilers: z.boolean(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
})

const publicListSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  item_count: z.number().int().nonnegative(),
})

const publicFavoriteSchema = z.object({
  id: z.uuid(),
  canonical_title: z.string(),
})

const publicAchievementSchema = z.object({
  slug: z.string(),
  title: z.string(),
  unlocked_at: z.iso.datetime({ offset: true }),
})

const publicProfileSchema = z.object({
  user_id: z.uuid().optional(),
  username: usernameSchema,
  display_name: z.string().max(80),
  bio: z.string().max(500),
  created_at: z.iso.datetime({ offset: true }),
  show_favorites: z.boolean(),
  show_achievements: z.boolean(),
  reviews: z.array(publicReviewSchema).max(20),
  lists: z.array(publicListSchema),
  favorites: z.array(publicFavoriteSchema),
  achievements: z.array(publicAchievementSchema),
})

export const profileUpdateSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().max(80, 'El nombre público no puede superar 80 caracteres.'),
  bio: z.string().trim().max(500, 'La biografía no puede superar 500 caracteres.'),
  isPublic: z.boolean(),
  showFavorites: z.boolean().default(false),
  showAchievements: z.boolean().default(false),
  notifyContributions: z.boolean().default(true),
  notifyNews: z.boolean().default(false),
})

export type OwnProfile = z.infer<typeof ownProfileSchema>
export type PublicProfile = z.infer<typeof publicProfileSchema>
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>

function throwIfError(error: { message: string; code?: string } | null, action: string) {
  if (error) {
    if (
      error.message.includes('schema cache') ||
      error.message.includes('Could not find the function') ||
      error.message.includes('column') && error.message.includes('does not exist')
    ) {
      throw new Error(
        `${action}: aplica las migraciones pendientes de supabase/migrations en Supabase.`,
      )
    }
    if (error.code === '23505') {
      throw new Error('Ese nombre de usuario ya está en uso. Elige otro.')
    }
    throw new Error(`${action}: ${error.message}`)
  }
}

export async function getOwnProfile(userId: string): Promise<OwnProfile> {
  const { data, error } = await createSupabaseClient()
    .from('profiles')
    .select('user_id,username,display_name,bio,is_public,show_favorites,show_achievements,notify_contributions,notify_news,created_at,updated_at')
    .eq('user_id', z.uuid().parse(userId))
    .single()
  throwIfError(error, 'No se pudo cargar tu perfil')
  return ownProfileSchema.parse(data)
}

export async function updateOwnProfile(userId: string, values: ProfileUpdate) {
  const parsed = profileUpdateSchema.parse(values)
  const { error } = await createSupabaseClient()
    .from('profiles')
    .update({
      username: parsed.username,
      display_name: parsed.displayName,
      bio: parsed.bio,
      is_public: parsed.isPublic,
      show_favorites: parsed.showFavorites,
      show_achievements: parsed.showAchievements,
      notify_contributions: parsed.notifyContributions,
      notify_news: parsed.notifyNews,
    })
    .eq('user_id', z.uuid().parse(userId))
  throwIfError(error, 'No se pudo guardar tu perfil')
}

export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  const validUsername = usernameSchema.safeParse(username)
  if (!validUsername.success) return null

  const { data, error } = await createSupabaseClient().rpc('get_public_profile', {
    target_username: validUsername.data,
  })
  throwIfError(error, 'No se pudo cargar el perfil público')
  if (data === null) return null
  return publicProfileSchema.parse(data)
}
