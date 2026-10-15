import { z } from 'zod'

const publicationStatusSchema = z.enum([
  'ongoing',
  'completed',
  'hiatus',
  'cancelled',
  'unknown',
])

export const catalogSearchResultSchema = z.object({
  id: z.uuid(),
  canonical_title: z.string(),
  original_title: z.string().nullable(),
  publication_status: publicationStatusSchema,
  start_year: z.number().int().nullable(),
  aliases: z.array(z.string()),
  genres: z.array(z.string()),
  creators: z.array(z.string()),
  match_title: z.string().nullable(),
})

export const catalogGenreSchema = z.object({
  slug: z.string(),
  name: z.string(),
})

export const homepageCatalogItemSchema = z.object({
  id: z.uuid(),
  canonical_title: z.string(),
  publication_status: publicationStatusSchema,
  start_year: z.number().int().nullable(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
})

export const popularCatalogItemSchema = z.object({
  id: z.uuid(),
  canonical_title: z.string(),
  average_rating: z.number().min(1).max(5),
  rating_count: z.number().int().min(3),
})

export const mangaDetailSchema = z.object({
  id: z.uuid(),
  canonical_title: z.string(),
  original_title: z.string().nullable(),
  synopsis: z.string().nullable(),
  publication_status: publicationStatusSchema,
  start_year: z.number().int().nullable(),
  end_year: z.number().int().nullable(),
  verification_status: z.enum([
    'unverified',
    'partially_verified',
    'verified',
  ]),
  aliases: z.array(z.object({
    title: z.string(),
    language_code: z.string().nullable(),
    script_code: z.string().nullable().optional(),
    title_type: z.enum(['translated', 'romanized', 'original', 'alternate']),
  })),
  genres: z.array(z.string()),
  credits: z.array(z.object({
    person_name: z.string(),
    role: z.enum(['author', 'illustrator', 'creator', 'other']),
  })),
  sources: z.array(z.object({
    name: z.string(),
    source_url: z.url(),
    field_key: z.string(),
    verified_at: z.iso.datetime({ offset: true }).nullable(),
  })),
})

export type CatalogSearchResult = z.infer<typeof catalogSearchResultSchema>
export type CatalogGenre = z.infer<typeof catalogGenreSchema>
export type HomepageCatalogItem = z.infer<typeof homepageCatalogItemSchema>
export type PopularCatalogItem = z.infer<typeof popularCatalogItemSchema>
export type MangaDetail = z.infer<typeof mangaDetailSchema>

export interface CatalogSearchParams {
  query: string
  status: string
  year: number | null
  genre: string
  page: number
}
