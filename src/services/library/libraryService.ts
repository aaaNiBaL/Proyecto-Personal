import { z } from 'zod'
import { createSupabaseClient } from '../supabase/client'

export const readingStatusSchema = z.enum([
  'to_read',
  'reading',
  'paused',
  'completed',
  'dropped',
])

const libraryEntrySchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  manga_id: z.uuid(),
  reading_status: readingStatusSchema,
  last_chapter: z.string().nullable(),
  private_notes: z.string().nullable(),
  personal_rating: z.number().nullable(),
  started_on: z.iso.date().nullable(),
  finished_on: z.iso.date().nullable(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
})

const mangaSummarySchema = z.object({
  id: z.uuid(),
  canonical_title: z.string(),
})

const personalLinkSchema = z.object({
  id: z.uuid(),
  library_entry_id: z.uuid(),
  label: z.string(),
  url: z.url().refine(isHttpUrl),
  created_at: z.iso.datetime({ offset: true }),
})

const libraryUpdateSchema = z.object({
  reading_status: readingStatusSchema,
  last_chapter: z.string().trim().max(80).nullable(),
  private_notes: z.string().max(5000).nullable(),
  personal_rating: z.number().min(1).max(10).nullable(),
})

export const personalLinkInputSchema = z.object({
  label: z.string().trim().min(1).max(80),
  url: z.string().trim().min(1).max(2048).url().refine(
    isHttpUrl,
    'El enlace debe usar http o https.',
  ),
})

function isHttpUrl(value: string) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

export type ReadingStatus = z.infer<typeof readingStatusSchema>
export type PersonalLink = z.infer<typeof personalLinkSchema>
export type LibraryEntry = z.infer<typeof libraryEntrySchema> & {
  manga: z.infer<typeof mangaSummarySchema>
  links: PersonalLink[]
}
export type LibraryEntryUpdate = z.infer<typeof libraryUpdateSchema>

function throwIfError(error: { message: string } | null, action: string) {
  if (error) {
    if (
      error.message.includes('schema cache') ||
      error.message.includes('Could not find the table')
    ) {
      throw new Error(
        `${action}: falta aplicar supabase/migrations/20261014220000_private_library.sql en este proyecto Supabase.`,
      )
    }
    throw new Error(`${action}: ${error.message}`)
  }
}

export async function listLibrary(userId: string): Promise<LibraryEntry[]> {
  const client = createSupabaseClient()
  const { data: rawEntries, error: entriesError } = await client
    .from('library_entries')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  throwIfError(entriesError, 'No se pudo cargar tu biblioteca')
  const entries = z.array(libraryEntrySchema).parse(rawEntries)
  if (entries.length === 0) return []

  const entryIds = entries.map((entry) => entry.id)
  const mangaIds = [...new Set(entries.map((entry) => entry.manga_id))]
  const [mangaResult, linksResult] = await Promise.all([
    client.from('manga').select('id,canonical_title').in('id', mangaIds),
    client.from('personal_links').select('*').in('library_entry_id', entryIds),
  ])

  throwIfError(mangaResult.error, 'No se pudieron cargar las obras de tu biblioteca')
  throwIfError(linksResult.error, 'No se pudieron cargar tus enlaces privados')

  const mangas = z.array(mangaSummarySchema).parse(mangaResult.data)
  const links = z.array(personalLinkSchema).parse(linksResult.data)
  const mangaById = new Map(mangas.map((manga) => [manga.id, manga]))
  const linksByEntry = new Map<string, PersonalLink[]>()

  for (const link of links) {
    const entryLinks = linksByEntry.get(link.library_entry_id) ?? []
    entryLinks.push(link)
    linksByEntry.set(link.library_entry_id, entryLinks)
  }

  return entries.map((entry) => {
    const manga = mangaById.get(entry.manga_id)
    if (!manga) {
      throw new Error(
        `No se pudo resolver la obra asociada a la entrada ${entry.id}.`,
      )
    }
    return { ...entry, manga, links: linksByEntry.get(entry.id) ?? [] }
  })
}

export async function addToLibrary(userId: string, mangaId: string) {
  const client = createSupabaseClient()
  const { error } = await client
    .from('library_entries')
    .upsert(
      { user_id: userId, manga_id: z.uuid().parse(mangaId) },
      { onConflict: 'user_id,manga_id', ignoreDuplicates: true },
    )
  throwIfError(error, 'No se pudo agregar la obra a tu biblioteca')
}

export async function updateLibraryEntry(
  entryId: string,
  values: LibraryEntryUpdate,
) {
  const parsedValues = libraryUpdateSchema.parse(values)
  const client = createSupabaseClient()
  const { error } = await client
    .from('library_entries')
    .update(parsedValues)
    .eq('id', z.uuid().parse(entryId))
  throwIfError(error, 'No se pudieron guardar los cambios')
}

export async function removeLibraryEntry(entryId: string) {
  const client = createSupabaseClient()
  const { error } = await client
    .from('library_entries')
    .delete()
    .eq('id', z.uuid().parse(entryId))
  throwIfError(error, 'No se pudo quitar la obra de tu biblioteca')
}

export async function addPersonalLink(entryId: string, values: {
  label: string
  url: string
}) {
  const validValues = personalLinkInputSchema.parse(values)
  const client = createSupabaseClient()
  const { error } = await client.from('personal_links').insert({
    library_entry_id: z.uuid().parse(entryId),
    ...validValues,
  })
  throwIfError(error, 'No se pudo guardar el enlace privado')
}

export async function removePersonalLink(linkId: string) {
  const client = createSupabaseClient()
  const { error } = await client
    .from('personal_links')
    .delete()
    .eq('id', z.uuid().parse(linkId))
  throwIfError(error, 'No se pudo eliminar el enlace')
}
