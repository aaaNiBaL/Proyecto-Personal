import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }))

vi.mock('../supabase/client', () => ({
  createSupabaseClient: () => ({ rpc: rpcMock }),
}))

import { submitContribution } from './wikiService'

const mangaId = '143b7c47-4c26-4358-97aa-c0728a1a0501'

describe('submitContribution', () => {
  beforeEach(() => {
    rpcMock.mockReset()
    rpcMock.mockResolvedValue({
      data: '2f370f84-999e-4dfd-8c86-13d13f3b5314',
      error: null,
    })
  })

  it('sends validated metadata and requires HTTPS references', async () => {
    await expect(submitContribution({
      mangaId,
      type: 'metadata',
      changes: { canonical_title: 'One Piece' },
      sourceUrl: 'https://publisher.example/one-piece',
      note: '',
    })).resolves.toBe('2f370f84-999e-4dfd-8c86-13d13f3b5314')
    expect(rpcMock).toHaveBeenCalledWith('submit_catalog_contribution', {
      target_manga_id: mangaId,
      requested_type: 'metadata',
      changes: { canonical_title: 'One Piece' },
      reference_url: 'https://publisher.example/one-piece',
      contributor_note: null,
    })

    await expect(submitContribution({
      mangaId,
      type: 'alias',
      changes: { title: 'One Piece' },
      sourceUrl: 'http://publisher.example/one-piece',
      note: '',
    })).rejects.toThrow()
    expect(rpcMock).toHaveBeenCalledTimes(1)
  })

  it('rejects empty or invalid changes before calling Supabase', async () => {
    const emptyMetadata = submitContribution({
      mangaId,
      type: 'metadata',
      changes: {},
      sourceUrl: 'https://publisher.example/one-piece',
      note: '',
    })
    await expect(emptyMetadata).rejects.toThrow('Indica al menos un dato para la corrección.')
    await expect(submitContribution({
      mangaId,
      type: 'alias',
      changes: { title: '   ' },
      sourceUrl: 'https://publisher.example/one-piece',
      note: '',
    })).rejects.toThrow()
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
