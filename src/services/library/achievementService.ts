import { z } from 'zod'
import { createSupabaseClient } from '../supabase/client'

const achievementDefinitionSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  criteria_type: z.enum([
    'library_count',
    'reading_count',
    'completed_count',
    'chapter_count',
  ]),
  threshold: z.number().int().positive(),
  sort_order: z.number().int(),
})

const unlockedAchievementSchema = z.object({
  achievement_id: z.uuid(),
  unlocked_at: z.iso.datetime({ offset: true }),
})

export type ReadingAchievement = z.infer<typeof achievementDefinitionSchema> & {
  unlocked_at: string | null
}

function throwIfError(error: { message: string } | null, action: string) {
  if (error) {
    if (
      error.message.includes('schema cache') ||
      error.message.includes('Could not find the table')
    ) {
      throw new Error(
        `${action}: aplica supabase/migrations/20261015000000_reading_achievements.sql en Supabase.`,
      )
    }
    throw new Error(`${action}: ${error.message}`)
  }
}

export async function listMyReadingAchievements(
  userId: string,
): Promise<ReadingAchievement[]> {
  const validUserId = z.uuid().parse(userId)
  const client = createSupabaseClient()
  const [definitionsResult, unlockedResult] = await Promise.all([
    client
      .from('achievements')
      .select('id,slug,title,description,criteria_type,threshold,sort_order')
      .order('sort_order', { ascending: true }),
    client
      .from('user_achievements')
      .select('achievement_id,unlocked_at')
      .eq('user_id', validUserId),
  ])

  throwIfError(definitionsResult.error, 'No se pudieron cargar los logros')
  throwIfError(unlockedResult.error, 'No se pudo cargar tu progreso de logros')

  const definitions = z.array(achievementDefinitionSchema).parse(definitionsResult.data)
  const unlocked = z.array(unlockedAchievementSchema).parse(unlockedResult.data)
  const unlockedById = new Map(
    unlocked.map((achievement) => [achievement.achievement_id, achievement.unlocked_at]),
  )
  return definitions.map((achievement) => ({
    ...achievement,
    unlocked_at: unlockedById.get(achievement.id) ?? null,
  }))
}
