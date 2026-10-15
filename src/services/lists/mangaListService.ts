import { z } from 'zod'
import { createSupabaseClient } from '../supabase/client'

const mangaSummarySchema = z.object({
  id: z.uuid(),
  canonical_title: z.string(),
  synopsis: z.string().nullable(),
  publication_status: z.enum(['ongoing', 'completed', 'hiatus', 'cancelled', 'unknown']),
  start_year: z.number().int().nullable(),
})

const listItemRowSchema = z.object({
  list_id: z.uuid(),
  manga_id: z.uuid(),
  created_at: z.iso.datetime({ offset: true }),
})

const ownListRowSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  title: z.string(),
  description: z.string(),
  is_public: z.boolean(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
})

const publicListSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  created_at: z.iso.datetime({ offset: true }),
  username: z.string(),
  display_name: z.string(),
  items: z.array(mangaSummarySchema).max(100),
})

export const mangaListInputSchema = z.object({
  title: z.string().trim().min(1, 'Escribe un nombre para la lista.').max(80),
  description: z.string().trim().max(500),
  isPublic: z.boolean(),
})

export type MangaSummary = z.infer<typeof mangaSummarySchema>
export type MangaListInput = z.infer<typeof mangaListInputSchema>
export type PublicMangaList = z.infer<typeof publicListSchema>
export type OwnMangaList = z.infer<typeof ownListRowSchema> & {
  items: Array<MangaSummary & { added_at: string }>
}

function throwIfError(error: { message: string; code?: string } | null, action: string) {
  if (error) {
    if (
      error.message.includes('schema cache') ||
      error.message.includes('Could not find the function') ||
      error.message.includes('Could not find the table')
    ) {
      throw new Error(
        `${action}: aplica supabase/migrations/20261014234000_public_manga_lists.sql en Supabase.`,
      )
    }
    if (error.code === '23505') {
      throw new Error('Ya tienes una lista con ese nombre.')
    }
    throw new Error(`${action}: ${error.message}`)
  }
}

export async function listOwnMangaLists(userId: string): Promise<OwnMangaList[]> {
  const client = createSupabaseClient()
  const { data, error } = await client
    .from('manga_lists')
    .select('id,user_id,title,description,is_public,created_at,updated_at')
    .eq('user_id', z.uuid().parse(userId))
    .order('created_at', { ascending: false })
  throwIfError(error, 'No se pudieron cargar tus listas')

  const lists = z.array(ownListRowSchema).parse(data)
  if (lists.length === 0) return []

  const { data: rawItems, error: itemsError } = await client
    .from('manga_list_items')
    .select('list_id,manga_id,created_at')
    .in('list_id', lists.map((list) => list.id))
    .order('created_at', { ascending: true })
  throwIfError(itemsError, 'No se pudieron cargar las obras de tus listas')

  const itemRows = z.array(listItemRowSchema).parse(rawItems)
  if (itemRows.length === 0) return lists.map((list) => ({ ...list, items: [] }))

  const { data: rawManga, error: mangaError } = await client
    .from('manga')
    .select('id,canonical_title,synopsis,publication_status,start_year')
    .in('id', [...new Set(itemRows.map((item) => item.manga_id))])
    .eq('visibility', 'published')
  throwIfError(mangaError, 'No se pudieron cargar las fichas de tus listas')

  const mangaById = new Map(
    z.array(mangaSummarySchema).parse(rawManga).map((manga) => [manga.id, manga]),
  )
  const itemsByList = new Map<string, OwnMangaList['items']>()
  for (const item of itemRows) {
    const manga = mangaById.get(item.manga_id)
    if (!manga) continue
    const listItems = itemsByList.get(item.list_id) ?? []
    listItems.push({ ...manga, added_at: item.created_at })
    itemsByList.set(item.list_id, listItems)
  }
  return lists.map((list) => ({ ...list, items: itemsByList.get(list.id) ?? [] }))
}

export async function createMangaList(userId: string, values: MangaListInput) {
  const parsed = mangaListInputSchema.parse(values)
  const { error } = await createSupabaseClient().from('manga_lists').insert({
    user_id: z.uuid().parse(userId),
    title: parsed.title,
    description: parsed.description,
    is_public: parsed.isPublic,
  })
  throwIfError(error, 'No se pudo crear la lista')
}

export async function updateMangaList(
  listId: string,
  userId: string,
  values: MangaListInput,
) {
  const parsed = mangaListInputSchema.parse(values)
  const { error } = await createSupabaseClient()
    .from('manga_lists')
    .update({
      title: parsed.title,
      description: parsed.description,
      is_public: parsed.isPublic,
    })
    .eq('id', z.uuid().parse(listId))
    .eq('user_id', z.uuid().parse(userId))
  throwIfError(error, 'No se pudo actualizar la lista')
}

export async function deleteMangaList(listId: string, userId: string) {
  const { error } = await createSupabaseClient()
    .from('manga_lists')
    .delete()
    .eq('id', z.uuid().parse(listId))
    .eq('user_id', z.uuid().parse(userId))
  throwIfError(error, 'No se pudo eliminar la lista')
}

export async function addMangaToList(listId: string, mangaId: string) {
  const { error } = await createSupabaseClient().rpc('add_manga_to_list', {
    target_list_id: z.uuid().parse(listId),
    target_manga_id: z.uuid().parse(mangaId),
  })
  throwIfError(error, 'No se pudo añadir la obra')
}

export async function removeMangaFromList(listId: string, mangaId: string) {
  const { error } = await createSupabaseClient()
    .from('manga_list_items')
    .delete()
    .eq('list_id', z.uuid().parse(listId))
    .eq('manga_id', z.uuid().parse(mangaId))
  throwIfError(error, 'No se pudo quitar la obra de la lista')
}

export async function getPublicMangaList(listId: string): Promise<PublicMangaList | null> {
  const validId = z.uuid().safeParse(listId)
  if (!validId.success) return null
  const { data, error } = await createSupabaseClient().rpc('get_public_manga_list', {
    target_list_id: validId.data,
  })
  throwIfError(error, 'No se pudo cargar la lista pública')
  if (data === null) return null
  return publicListSchema.parse(data)
}
