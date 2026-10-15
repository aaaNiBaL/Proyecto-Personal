import { z } from 'zod'
import { createSupabaseClient } from '../supabase/client'

const reviewSchema = z.object({
  id: z.uuid(),
  author_id: z.uuid(),
  username: z.string(),
  rating: z.number().int().min(1).max(5),
  review_text: z.string().nullable(),
  contains_spoilers: z.boolean(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
})

const myReviewSchema = z.object({
  id: z.uuid(),
  manga_id: z.uuid(),
  author_id: z.uuid(),
  rating: z.number().int().min(1).max(5),
  review_text: z.string().nullable(),
  contains_spoilers: z.boolean(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
})

const reviewListSchema = z.object({
  average_rating: z.number().min(0).max(5),
  rating_count: z.number().int().nonnegative(),
  reviews: z.array(reviewSchema),
})

export const reviewInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().trim().max(10000).nullable(),
  containsSpoilers: z.boolean(),
})

export type MangaReview = z.infer<typeof reviewSchema>
export type MyMangaReview = z.infer<typeof myReviewSchema>
export type ReviewInput = z.infer<typeof reviewInputSchema>
export type MangaReviewList = z.infer<typeof reviewListSchema>

function throwIfError(error: { message: string } | null, action: string) {
  if (error) {
    if (
      error.message.includes('schema cache') ||
      error.message.includes('Could not find the table')
    ) {
      throw new Error(
        `${action}: aplica supabase/migrations/20261014232000_reviews_ratings.sql en Supabase.`,
      )
    }
    throw new Error(`${action}: ${error.message}`)
  }
}

export async function listMangaReviews(mangaId: string): Promise<MangaReviewList> {
  const { data, error } = await createSupabaseClient().rpc('get_manga_reviews', {
    target_manga_id: z.uuid().parse(mangaId),
  })
  throwIfError(error, 'No se pudieron cargar las reseñas')
  if (data === null) throw new Error('La obra no está disponible para reseñas.')
  return reviewListSchema.parse(data)
}

export async function getMyMangaReview(
  mangaId: string,
  userId: string,
): Promise<MyMangaReview | null> {
  const { data, error } = await createSupabaseClient()
    .from('manga_reviews')
    .select('id,manga_id,author_id,rating,review_text,contains_spoilers,created_at,updated_at')
    .eq('manga_id', z.uuid().parse(mangaId))
    .eq('author_id', z.uuid().parse(userId))
    .maybeSingle()
  throwIfError(error, 'No se pudo cargar tu reseña')
  return data === null ? null : myReviewSchema.parse(data)
}

export async function saveMangaReview(
  mangaId: string,
  userId: string,
  values: ReviewInput,
) {
  const parsed = reviewInputSchema.parse(values)
  const { error } = await createSupabaseClient()
    .from('manga_reviews')
    .upsert({
      manga_id: z.uuid().parse(mangaId),
      author_id: z.uuid().parse(userId),
      rating: parsed.rating,
      review_text: parsed.reviewText || null,
      contains_spoilers: parsed.containsSpoilers,
    }, { onConflict: 'manga_id,author_id' })
  throwIfError(error, 'No se pudo guardar tu reseña')
}

export async function deleteMangaReview(reviewId: string, userId: string) {
  const { error } = await createSupabaseClient()
    .from('manga_reviews')
    .delete()
    .eq('id', z.uuid().parse(reviewId))
    .eq('author_id', z.uuid().parse(userId))
  throwIfError(error, 'No se pudo eliminar tu reseña')
}
