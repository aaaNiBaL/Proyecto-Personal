import { z } from 'zod'
import { createSupabaseClient } from '../supabase/client'

const favoriteRowSchema = z.object({
  manga_id: z.uuid(),
  created_at: z.iso.datetime({ offset: true }),
})

const favoriteMangaSchema = z.object({
  id: z.uuid(),
  canonical_title: z.string(),
  publication_status: z.enum(['ongoing', 'completed', 'hiatus', 'cancelled', 'unknown']),
  start_year: z.number().int().nullable(),
})

export type FavoriteManga = z.infer<typeof favoriteMangaSchema>

function throwIfError(error: { message: string } | null, action: string) {
  if (!error) return
  if (
    error.message.includes('schema cache') ||
    error.message.includes('Could not find the table')
  ) {
    throw new Error(
      `${action}: aplica supabase/migrations/20261015040000_profile_favorites.sql en Supabase.`,
    )
  }
  throw new Error(`${action}: ${error.message}`)
}

export async function listFavoriteManga(userId: string): Promise<FavoriteManga[]> {
  const validUserId = z.uuid().parse(userId)
  const client = createSupabaseClient()
  const { data: favoriteData, error: favoriteError } = await client
    .from('manga_favorites')
    .select('manga_id,created_at')
    .eq('user_id', validUserId)
    .order('created_at', { ascending: false })

  throwIfError(favoriteError, 'No se pudieron cargar tus favoritos')
  const favorites = z.array(favoriteRowSchema).parse(favoriteData)
  if (favorites.length === 0) return []

  const { data: mangaData, error: mangaError } = await client
    .from('manga')
    .select('id,canonical_title,publication_status,start_year')
    .in('id', favorites.map((favorite) => favorite.manga_id))

  throwIfError(mangaError, 'No se pudieron cargar tus mangas favoritos')
  const mangas = z.array(favoriteMangaSchema).parse(mangaData)
  const mangaById = new Map(mangas.map((manga) => [manga.id, manga]))
  return favorites.flatMap((favorite) => {
    const manga = mangaById.get(favorite.manga_id)
    return manga ? [manga] : []
  })
}

export async function isMangaFavorite(userId: string, mangaId: string): Promise<boolean> {
  const validUserId = z.uuid().parse(userId)
  const validMangaId = z.uuid().parse(mangaId)
  const { data, error } = await createSupabaseClient()
    .from('manga_favorites')
    .select('manga_id')
    .eq('user_id', validUserId)
    .eq('manga_id', validMangaId)
    .maybeSingle()

  throwIfError(error, 'No se pudo comprobar si el manga está en favoritos')
  return data !== null
}

export async function addMangaFavorite(userId: string, mangaId: string) {
  const { error } = await createSupabaseClient()
    .from('manga_favorites')
    .upsert({
      user_id: z.uuid().parse(userId),
      manga_id: z.uuid().parse(mangaId),
    }, { onConflict: 'user_id,manga_id', ignoreDuplicates: true })

  throwIfError(error, 'No se pudo guardar el manga en favoritos')
}

export async function removeMangaFavorite(userId: string, mangaId: string) {
  const { error } = await createSupabaseClient()
    .from('manga_favorites')
    .delete()
    .eq('user_id', z.uuid().parse(userId))
    .eq('manga_id', z.uuid().parse(mangaId))

  throwIfError(error, 'No se pudo quitar el manga de favoritos')
}
