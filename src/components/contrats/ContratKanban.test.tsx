import { describe, it, expect } from 'vitest'
import { handlePatchResponse, nextPendingApprovalIds } from './ContratKanban'
import type { KanbanContrat } from './ContratCard'

const baseContrat: KanbanContrat = {
  id: 'c1',
  numero: 'CTR-001',
  statut: 'DRAFT',
  dateDebut: null,
  dateFin: null,
  client: { id: 'cl1', name: 'Client A' },
  billboard: { id: 'b1', reference: 'PAN-001' },
  faces: [{ face: 'BOTH' }],
}

describe('handlePatchResponse', () => {
  it('applies the new status and shows a success toast on 200', async () => {
    const res = new Response(JSON.stringify({ ...baseContrat, statut: 'SIGNED' }), { status: 200 })
    const result = await handlePatchResponse(res, baseContrat)
    expect(result.nextStatut).toBe('SIGNED')
    expect(result.toast.type).toBe('success')
  })

  it('does not change status and shows an info toast on 202 (pending approval)', async () => {
    const res = new Response(null, { status: 202 })
    const result = await handlePatchResponse(res, baseContrat)
    expect(result.nextStatut).toBeNull()
    expect(result.toast.type).toBe('info')
    expect(result.toast.message).toMatch(/approbation/i)
  })

  it('does not change status and shows an error toast with the server message on 400', async () => {
    const res = new Response(JSON.stringify({ error: 'Transition invalide : DRAFT -> ACTIVE' }), { status: 400 })
    const result = await handlePatchResponse(res, baseContrat)
    expect(result.nextStatut).toBeNull()
    expect(result.toast.type).toBe('error')
    expect(result.toast.message).toBe('Transition invalide : DRAFT -> ACTIVE')
  })

  it('does not change status and shows an error toast with the server message on 409 (double-booking)', async () => {
    const res = new Response(JSON.stringify({ error: 'Cette face du panneau est déjà occupée' }), { status: 409 })
    const result = await handlePatchResponse(res, baseContrat)
    expect(result.nextStatut).toBeNull()
    expect(result.toast.type).toBe('error')
    expect(result.toast.message).toBe('Cette face du panneau est déjà occupée')
  })

  it('falls back to a generic error message on an unexpected status code', async () => {
    const res = new Response(null, { status: 500 })
    const result = await handlePatchResponse(res, baseContrat)
    expect(result.nextStatut).toBeNull()
    expect(result.toast.type).toBe('error')
  })

  it('falls back to a generic error message when the 400 body has no error field', async () => {
    const res = new Response(JSON.stringify({}), { status: 400 })
    const result = await handlePatchResponse(res, baseContrat)
    expect(result.toast.type).toBe('error')
    expect(result.toast.message).toBe('Transition refusée')
  })
})

describe('nextPendingApprovalIds', () => {
  it('adds the contrat id on a 202 response (queued for approval)', () => {
    const next = nextPendingApprovalIds(new Set(), 'c1', { nextStatut: null }, 202)
    expect(next.has('c1')).toBe(true)
  })

  it('removes the contrat id once a real status transition resolves', () => {
    const prev = new Set(['c1'])
    const next = nextPendingApprovalIds(prev, 'c1', { nextStatut: 'SIGNED' }, 200)
    expect(next.has('c1')).toBe(false)
  })

  it('leaves the set unchanged for a 400/409/500 response with no nextStatut', () => {
    const prev = new Set(['other'])
    for (const status of [400, 409, 500]) {
      const next = nextPendingApprovalIds(prev, 'c1', { nextStatut: null }, status)
      expect(next.has('c1')).toBe(false)
      expect(Array.from(next)).toEqual(['other'])
    }
  })

  it('preserves unrelated existing ids in prev across all cases', () => {
    const prev = new Set(['other'])
    expect(Array.from(nextPendingApprovalIds(prev, 'c1', { nextStatut: null }, 202)).sort()).toEqual(['c1', 'other'])
    const prevWithBoth = new Set(['c1', 'other'])
    expect(Array.from(nextPendingApprovalIds(prevWithBoth, 'c1', { nextStatut: 'SIGNED' }, 200))).toEqual(['other'])
  })
})
