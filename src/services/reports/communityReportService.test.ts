import { describe, expect, it } from 'vitest'
import { communityReportInputSchema } from './communityReportService'

describe('communityReportInputSchema', () => {
  it('accepts a valid report with a reason and optional details', () => {
    expect(communityReportInputSchema.safeParse({
      targetType: 'review',
      targetId: '66a4bf64-1d89-4d39-8de6-bba0b966572f',
      reason: 'spoilers',
      details: 'No tiene aviso de spoilers.',
    }).success).toBe(true)
    expect(communityReportInputSchema.safeParse({
      targetType: 'comment',
      targetId: '66a4bf64-1d89-4d39-8de6-bba0b966572f',
      reason: 'inappropriate',
      details: '',
    }).success).toBe(true)
    expect(communityReportInputSchema.safeParse({
      targetType: 'manga',
      targetId: '66a4bf64-1d89-4d39-8de6-bba0b966572f',
      reason: 'inappropriate',
      details: '',
    }).success).toBe(true)
  })

  it('rejects unsupported targets, reasons, identifiers, and oversized details', () => {
    const base = {
      targetType: 'review',
      targetId: '66a4bf64-1d89-4d39-8de6-bba0b966572f',
      reason: 'spam',
      details: '',
    }
    expect(communityReportInputSchema.safeParse({ ...base, targetType: 'chapter' }).success).toBe(false)
    expect(communityReportInputSchema.safeParse({ ...base, targetId: 'invalid' }).success).toBe(false)
    expect(communityReportInputSchema.safeParse({ ...base, reason: 'threats' }).success).toBe(false)
    expect(communityReportInputSchema.safeParse({ ...base, details: 'x'.repeat(1001) }).success).toBe(false)
  })
})
