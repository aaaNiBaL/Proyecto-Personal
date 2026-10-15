import { z } from 'zod'
import { createSupabaseClient } from '../supabase/client'
import type { Json } from '../supabase/database.types'

export const contributionTypeSchema = z.enum(['metadata', 'alias'])
export const contributionStatusSchema = z.enum(['pending', 'approved', 'rejected'])

const metadataChangesSchema = z.object({
  canonical_title: z.string().trim().min(1).max(240).optional(),
  synopsis: z.string().max(10000).nullable().optional(),
  publication_status: z.enum([
    'ongoing',
    'completed',
    'hiatus',
    'cancelled',
    'unknown',
  ]).optional(),
  start_year: z.number().int().min(1).max(9999).nullable().optional(),
  end_year: z.number().int().min(1).max(9999).nullable().optional(),
}).strict().refine(
  (changes) => Object.values(changes).some((value) => value !== undefined),
  'Indica al menos un dato para la corrección.',
)

const aliasChangesSchema = z.object({
  title: z.string().trim().min(1).max(240),
  language_code: z.string().max(20).nullable().optional(),
  script_code: z.string().max(20).nullable().optional(),
  title_type: z.enum(['translated', 'romanized', 'original', 'alternate']).optional(),
}).strict()

const sourceUrlSchema = z.string().trim().url().max(2048).refine((url) => {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}, 'La fuente debe usar HTTPS.')

const ownContributionSchema = z.object({
  id: z.uuid(),
  manga_id: z.uuid(),
  contribution_type: contributionTypeSchema,
  proposed_changes: z.record(z.string(), z.unknown()),
  source_url: sourceUrlSchema,
  note: z.string().nullable(),
  status: contributionStatusSchema,
  review_note: z.string().nullable(),
  reviewed_at: z.iso.datetime({ offset: true }).nullable(),
  created_at: z.iso.datetime({ offset: true }),
})

const pendingContributionSchema = z.object({
  id: z.uuid(),
  manga_id: z.uuid(),
  manga_title: z.string(),
  author_id: z.uuid(),
  contribution_type: contributionTypeSchema,
  proposed_changes: z.record(z.string(), z.unknown()),
  source_url: sourceUrlSchema,
  note: z.string().nullable(),
  created_at: z.iso.datetime({ offset: true }),
})

const revisionSchema = z.object({
  id: z.uuid(),
  manga_id: z.uuid(),
  contribution_id: z.uuid(),
  actor_id: z.uuid(),
  field_key: z.string(),
  previous_value: z.unknown(),
  new_value: z.unknown(),
  created_at: z.iso.datetime({ offset: true }),
})

export type ContributionType = z.infer<typeof contributionTypeSchema>
export type ContributionStatus = z.infer<typeof contributionStatusSchema>
export type OwnContribution = z.infer<typeof ownContributionSchema> & {
  manga_title: string
}
export type PendingContribution = z.infer<typeof pendingContributionSchema>
export type CatalogRevision = z.infer<typeof revisionSchema>

function throwIfError(error: { message: string } | null, action: string) {
  if (error) {
    if (
      error.message.includes('schema cache') ||
      error.message.includes('Could not find the table')
    ) {
      throw new Error(
        `${action}: aplica supabase/migrations/20261014230000_wiki_contributions.sql en Supabase.`,
      )
    }
    throw new Error(`${action}: ${error.message}`)
  }
}

export async function submitContribution(input: {
  mangaId: string
  type: ContributionType
  changes: unknown
  sourceUrl: string
  note: string
}) {
  const mangaId = z.uuid().parse(input.mangaId)
  const sourceUrl = sourceUrlSchema.parse(input.sourceUrl)
  const note = z.string().max(2000).nullable().parse(input.note.trim() || null)
  const changes = input.type === 'metadata'
    ? metadataChangesSchema.parse(input.changes)
    : aliasChangesSchema.parse(input.changes)

  const { data, error } = await createSupabaseClient().rpc(
    'submit_catalog_contribution',
    {
      target_manga_id: mangaId,
      requested_type: input.type,
      changes: changes as Json,
      reference_url: sourceUrl,
      contributor_note: note,
    },
  )
  throwIfError(error, 'No se pudo enviar la propuesta')
  return z.uuid().parse(data)
}

export async function listOwnContributions(userId: string) {
  const client = createSupabaseClient()
  const { data, error } = await client
    .from('catalog_contributions')
    .select('id,manga_id,contribution_type,proposed_changes,source_url,note,status,review_note,reviewed_at,created_at')
    .eq('author_id', z.uuid().parse(userId))
    .order('created_at', { ascending: false })

  throwIfError(error, 'No se pudieron cargar tus propuestas')
  const contributions = z.array(ownContributionSchema).parse(data)
  if (contributions.length === 0) return []

  const { data: mangaData, error: mangaError } = await client
    .from('manga')
    .select('id,canonical_title')
    .in('id', [...new Set(contributions.map((contribution) => contribution.manga_id))])
  throwIfError(mangaError, 'No se pudieron cargar los títulos de tus propuestas')

  const mangas = z.array(z.object({
    id: z.uuid(),
    canonical_title: z.string(),
  })).parse(mangaData)
  const titlesById = new Map(mangas.map((manga) => [manga.id, manga.canonical_title]))
  return contributions.map((contribution) => {
    const mangaTitle = titlesById.get(contribution.manga_id)
    if (!mangaTitle) {
      throw new Error(`No se encontró el manga asociado a la propuesta ${contribution.id}.`)
    }
    return { ...contribution, manga_title: mangaTitle }
  })
}

export async function listPendingContributions() {
  const { data, error } = await createSupabaseClient()
    .rpc('list_pending_catalog_contributions')
  throwIfError(error, 'No se pudieron cargar las propuestas pendientes')
  return z.array(pendingContributionSchema).parse(data)
}

export async function reviewContribution(
  contributionId: string,
  decision: 'approved' | 'rejected',
  moderatorNote: string,
) {
  const { error } = await createSupabaseClient().rpc(
    'review_catalog_contribution',
    {
      target_contribution_id: z.uuid().parse(contributionId),
      decision,
      moderator_note: z.string().max(2000).parse(moderatorNote || null),
    },
  )
  throwIfError(error, 'No se pudo revisar la propuesta')
}

export async function isCatalogModerator() {
  const { data, error } = await createSupabaseClient().rpc('is_catalog_moderator')
  throwIfError(error, 'No se pudo comprobar el permiso de moderación')
  return z.boolean().parse(data)
}

export async function listCatalogRevisions(mangaId: string) {
  const { data, error } = await createSupabaseClient()
    .from('catalog_revisions')
    .select('id,manga_id,contribution_id,actor_id,field_key,previous_value,new_value,created_at')
    .eq('manga_id', z.uuid().parse(mangaId))
    .order('created_at', { ascending: false })
    .limit(50)
  throwIfError(error, 'No se pudo cargar el historial')
  return z.array(revisionSchema).parse(data)
}
