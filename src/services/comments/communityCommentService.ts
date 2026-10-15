import { z } from 'zod'
import { createSupabaseClient } from '../supabase/client'

export const commentTargetTypeSchema = z.enum(['manga', 'review'])

const communityCommentSchema = z.object({
  id: z.uuid(),
  author_id: z.uuid(),
  username: z.string(),
  comment_text: z.string().min(1).max(2000),
  created_at: z.iso.datetime({ offset: true }),
})

export const communityCommentInputSchema = z.object({
  targetType: commentTargetTypeSchema,
  targetId: z.uuid(),
  commentText: z.string().trim().min(1).max(2000),
})

export type CommentTargetType = z.infer<typeof commentTargetTypeSchema>
export type CommunityComment = z.infer<typeof communityCommentSchema>

function throwIfError(error: { message: string } | null, action: string) {
  if (error) {
    if (
      error.message.includes('schema cache') ||
      error.message.includes('Could not find the function')
    ) {
      throw new Error(
        `${action}: aplica supabase/migrations/20261014236000_community_comments.sql en Supabase.`,
      )
    }
    throw new Error(`${action}: ${error.message}`)
  }
}

export async function listCommunityComments(
  targetType: CommentTargetType,
  targetId: string,
): Promise<CommunityComment[]> {
  const { data, error } = await createSupabaseClient().rpc('get_community_comments', {
    comment_target_type: commentTargetTypeSchema.parse(targetType),
    comment_target_id: z.uuid().parse(targetId),
  })
  throwIfError(error, 'No se pudieron cargar los comentarios')
  return z.array(communityCommentSchema).parse(data)
}

export async function createCommunityComment(
  targetType: CommentTargetType,
  targetId: string,
  commentText: string,
) {
  const parsed = communityCommentInputSchema.parse({ targetType, targetId, commentText })
  const { data, error } = await createSupabaseClient().rpc('create_community_comment', {
    comment_target_type: parsed.targetType,
    comment_target_id: parsed.targetId,
    comment_body: parsed.commentText,
  })
  throwIfError(error, 'No se pudo publicar el comentario')
  return z.uuid().parse(data)
}

export async function deleteCommunityComment(commentId: string, userId: string) {
  const { error } = await createSupabaseClient()
    .from('community_comments')
    .delete()
    .eq('id', z.uuid().parse(commentId))
    .eq('author_id', z.uuid().parse(userId))
  throwIfError(error, 'No se pudo eliminar el comentario')
}
