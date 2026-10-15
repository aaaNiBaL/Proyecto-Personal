import { z } from 'zod'
import { createSupabaseClient } from '../supabase/client'
import {
  catalogGenreSchema,
  catalogSearchResultSchema,
  homepageCatalogItemSchema,
  mangaDetailSchema,
  popularCatalogItemSchema,
  type CatalogSearchParams,
} from './types'

const PAGE_SIZE = 24

function throwIfError(error: { message: string } | null) {
  if (error) {
    if (error.message.includes('schema cache')) {
      throw new Error(
        'No se encontraron las funciones del catálogo en Supabase. Aplica la migración supabase/migrations/20261014210000_catalog.sql desde SQL Editor y vuelve a intentar.',
      )
    }
    throw new Error(`No se pudo cargar el catálogo: ${error.message}`)
  }
}

export async function searchCatalog(params: CatalogSearchParams) {
  const client = createSupabaseClient()
  const { data, error } = await client.rpc('search_manga', {
    search_query: params.query.trim() || null,
    filter_status: params.status || null,
    filter_year: params.year,
    filter_genre: params.genre || null,
    result_limit: PAGE_SIZE + 1,
    result_offset: Math.max(0, params.page - 1) * PAGE_SIZE,
  })

  throwIfError(error)
  const results = z.array(catalogSearchResultSchema).parse(data)
  return {
    items: results.slice(0, PAGE_SIZE),
    hasMore: results.length > PAGE_SIZE,
  }
}

export async function getCatalogGenres() {
  const client = createSupabaseClient()
  const { data, error } = await client.rpc('list_catalog_genres')

  throwIfError(error)
  return z.array(catalogGenreSchema).parse(data)
}

export async function getHomepageCatalog() {
  const client = createSupabaseClient()
  const columns = 'id, canonical_title, publication_status, start_year, created_at, updated_at'
  const [recentResult, updatedResult] = await Promise.all([
    client
      .from('manga')
      .select(columns)
      .order('created_at', { ascending: false })
      .limit(6),
    client
      .from('manga')
      .select(columns)
      .order('updated_at', { ascending: false })
      .limit(4),
  ])

  if (recentResult.error) {
    throw new Error(`No se pudieron cargar las incorporaciones recientes: ${recentResult.error.message}`)
  }
  if (updatedResult.error) {
    throw new Error(`No se pudieron cargar las fichas actualizadas: ${updatedResult.error.message}`)
  }

  return {
    recent: z.array(homepageCatalogItemSchema).parse(recentResult.data),
    updated: z.array(homepageCatalogItemSchema).parse(updatedResult.data),
  }
}

export async function getPopularManga() {
  const client = createSupabaseClient()
  const { data, error } = await client.rpc('get_popular_manga', {
    result_limit: 4,
  })

  if (error) {
    if (error.message.includes('schema cache')) {
      throw new Error(
        'La clasificación de populares no está disponible. Aplica la migración supabase/migrations/20261015010000_homepage_popular_manga.sql desde SQL Editor y vuelve a intentar.',
      )
    }
    throw new Error(`No se pudo cargar la clasificación: ${error.message}`)
  }
  return popularCatalogItemSchema.array().parse(data)
}

export async function getRelatedManga(id: string, genreNames: string[]) {
  if (genreNames.length === 0) return []

  const availableGenres = await getCatalogGenres()
  for (const name of genreNames) {
    const genre = availableGenres.find(
      (item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    )
    if (!genre) continue

    const result = await searchCatalog({
      query: '',
      status: '',
      year: null,
      genre: genre.slug,
      page: 1,
    })
    return result.items.filter((item) => item.id !== id).slice(0, 4)
  }
  return []
}

export async function getMangaDetail(id: string) {
  const validId = z.uuid().safeParse(id)
  if (!validId.success) return null

  const client = createSupabaseClient()
  const { data, error } = await client.rpc('get_manga_detail', {
    manga_id: validId.data,
  })

  throwIfError(error)
  if (data === null) return null
  return mangaDetailSchema.parse(data)
}
