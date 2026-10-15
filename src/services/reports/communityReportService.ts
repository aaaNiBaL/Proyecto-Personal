import { z } from 'zod'
import { createSupabaseClient } from '../supabase/client'

export const reportTargetTypeSchema = z.enum(['review', 'profile', 'list', 'comment', 'manga'])
export const reportReasonSchema = z.enum([
  'spam',
  'harassment',
  'spoilers',
  'inappropriate',
  'other',
])
export const reportReasonLabels: Record<ReportReason, string> = {
  spam: 'Spam o publicidad',
  harassment: 'Acoso o ataque personal',
  spoilers: 'Spoilers sin advertencia',
  inappropriate: 'Contenido inapropiado',
  other: 'Otro motivo',
}

const pendingReportSchema = z.object({
  id: z.uuid(),
  target_type: reportTargetTypeSchema,
  target_id: z.uuid(),
  target_title: z.string().nullable(),
  target_excerpt: z.string().nullable(),
  target_path: z.string().nullable(),
  reporter_username: z.string(),
  reason: reportReasonSchema,
  details: z.string(),
  created_at: z.iso.datetime({ offset: true }),
})

export const communityReportInputSchema = z.object({
  targetType: reportTargetTypeSchema,
  targetId: z.uuid(),
  reason: reportReasonSchema,
  details: z.string().trim().max(1000),
})

export type ReportTargetType = z.infer<typeof reportTargetTypeSchema>
export type ReportReason = z.infer<typeof reportReasonSchema>
export type PendingCommunityReport = z.infer<typeof pendingReportSchema>

function throwIfError(error: { message: string; code?: string } | null, action: string) {
  if (error) {
    if (
      error.message.includes('schema cache') ||
      error.message.includes('Could not find the function')
    ) {
      throw new Error(
        `${action}: aplica supabase/migrations/20261014235000_community_reports.sql en Supabase.`,
      )
    }
    if (
      error.message.includes('El tipo de contenido no se puede denunciar') ||
      error.message.includes('community_reports_target_type_check')
    ) {
      throw new Error(
        `${action}: aplica supabase/migrations/20261015030000_report_manga_information.sql en Supabase.`,
      )
    }
    if (error.code === '23505') {
      throw new Error('Ya enviaste una denuncia pendiente sobre este contenido.')
    }
    throw new Error(`${action}: ${error.message}`)
  }
}

export async function submitCommunityReport(input: {
  targetType: ReportTargetType
  targetId: string
  reason: ReportReason
  details: string
}) {
  const parsed = communityReportInputSchema.parse(input)
  const { data, error } = await createSupabaseClient().rpc('submit_community_report', {
    target_type: parsed.targetType,
    target_id: parsed.targetId,
    reason: parsed.reason,
    details: parsed.details,
  })
  throwIfError(error, 'No se pudo enviar la denuncia')
  return z.uuid().parse(data)
}

export async function listPendingCommunityReports(): Promise<PendingCommunityReport[]> {
  const { data, error } = await createSupabaseClient()
    .rpc('list_pending_community_reports')
  throwIfError(error, 'No se pudieron cargar las denuncias')
  return z.array(pendingReportSchema).parse(data)
}

export async function reviewCommunityReport(
  reportId: string,
  decision: 'resolved' | 'dismissed',
  moderatorNote: string,
) {
  const { error } = await createSupabaseClient().rpc('review_community_report', {
    target_report_id: z.uuid().parse(reportId),
    decision,
    moderator_note: z.string().max(1000).nullable().parse(moderatorNote.trim() || null),
  })
  throwIfError(error, 'No se pudo actualizar la denuncia')
}
