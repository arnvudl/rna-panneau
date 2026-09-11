import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ContratCard, handleDeleteResponse, type KanbanContrat } from './ContratCard'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

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

describe('handleDeleteResponse', () => {
  it('reports deleted + success toast on 200', async () => {
    const res = new Response(JSON.stringify({ status: 'deleted' }), { status: 200 })
    const result = await handleDeleteResponse(res)
    expect(result.deleted).toBe(true)
    expect(result.toast.type).toBe('success')
  })

  it('reports not-deleted + error toast with the server message on 400', async () => {
    const res = new Response(
      JSON.stringify({ error: 'Seuls les contrats en brouillon peuvent être supprimés définitivement' }),
      { status: 400 }
    )
    const result = await handleDeleteResponse(res)
    expect(result.deleted).toBe(false)
    expect(result.toast.type).toBe('error')
    expect(result.toast.message).toMatch(/brouillon/i)
  })

  it('reports not-deleted + error toast on 404', async () => {
    const res = new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
    const result = await handleDeleteResponse(res)
    expect(result.deleted).toBe(false)
    expect(result.toast.type).toBe('error')
  })

  it('falls back to a generic error message on an unexpected status code', async () => {
    const res = new Response(null, { status: 500 })
    const result = await handleDeleteResponse(res)
    expect(result.deleted).toBe(false)
    expect(result.toast.type).toBe('error')
  })
})

describe('ContratCard delete affordance', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('uses a flat tonal ring (not a shadow) on the resting card, per DESIGN.md\'s Flat-Content rule', () => {
    const { container } = render(<ContratCard contrat={baseContrat} pending={false} />)
    const card = container.querySelector('[data-slot="card"]')
    expect(card).not.toBeNull()
    expect(card).toHaveClass('ring-1', 'ring-foreground/10')
    expect(card?.className).not.toMatch(/shadow-sm/)
  })

  it('renders the delete button for a DRAFT contrat', () => {
    render(<ContratCard contrat={baseContrat} pending={false} />)
    expect(screen.getByText('Supprimer')).toBeInTheDocument()
  })

  it('does not render the delete button for a non-DRAFT contrat', () => {
    render(<ContratCard contrat={{ ...baseContrat, statut: 'SIGNED' }} pending={false} />)
    expect(screen.queryByText('Supprimer')).not.toBeInTheDocument()
  })

  it('requires confirmation before firing the DELETE call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    render(<ContratCard contrat={baseContrat} pending={false} />)

    fireEvent.click(screen.getByText('Supprimer'))

    await waitFor(() => {
      expect(screen.getByText('Confirmer la suppression ?')).toBeInTheDocument()
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('calls DELETE and removes the card from state via onDeleted on confirm', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'deleted' }), { status: 200 })
    )
    const onDeleted = vi.fn()
    render(<ContratCard contrat={baseContrat} pending={false} onDeleted={onDeleted} />)

    fireEvent.click(screen.getByText('Supprimer'))
    await waitFor(() => {
      expect(screen.getByText('Confirmer la suppression ?')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression' }))

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/contrats/c1', { method: 'DELETE' })
      expect(onDeleted).toHaveBeenCalledWith('c1')
    })
  })

  // The near/far/no-dateFin/non-ACTIVE date-window branches of
  // isContratExpiringSoon are exhaustively covered as a pure function in
  // status-labels.test.ts. These two cases just confirm the badge actually
  // renders (or doesn't) from that result at the component level.
  it('shows the "Échéance proche" badge for an ACTIVE contrat expiring within the window', () => {
    const soon = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
    render(
      <ContratCard contrat={{ ...baseContrat, statut: 'ACTIVE', dateFin: soon }} pending={false} />
    )
    expect(screen.getByText('Échéance proche')).toBeInTheDocument()
  })

  it('does not show the "Échéance proche" badge for an ACTIVE contrat with no dateFin', () => {
    render(<ContratCard contrat={{ ...baseContrat, statut: 'ACTIVE', dateFin: null }} pending={false} />)
    expect(screen.queryByText('Échéance proche')).not.toBeInTheDocument()
  })

  it('renders long client name/billboard reference text with a tooltip so the truncated full value can still be read', async () => {
    const longContrat: KanbanContrat = {
      ...baseContrat,
      client: { id: 'cl1', name: 'Société Anonyme Internationale de Distribution et Logistique' },
      billboard: { id: 'b1', reference: 'PAN-MADAGASCAR-ANTANANARIVO-2026-000123456789' },
    }
    render(<ContratCard contrat={longContrat} pending={false} />)
    // Confirms the truncation this fix is meant to compensate for: both
    // lines are visually clipped (CSS `truncate`), so recovering the full
    // value requires the Tooltip wrapping added below them.
    const clientNode = screen.getByText(longContrat.client.name)
    const billboardNode = screen.getByText(longContrat.billboard.reference)
    expect(clientNode).toHaveClass('truncate')
    expect(billboardNode).toHaveClass('truncate')
    // Each is wrapped in a Tooltip trigger, so the full value is still
    // reachable (via hover) rather than lost.
    expect(clientNode.closest('[data-slot="tooltip-trigger"]')).not.toBeNull()
    expect(billboardNode.closest('[data-slot="tooltip-trigger"]')).not.toBeNull()
  })

  it('shows an error toast and keeps the card when the DELETE call fails', async () => {
    const { toast } = await import('sonner')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Transition invalide' }), { status: 400 })
    )
    const onDeleted = vi.fn()
    render(<ContratCard contrat={baseContrat} pending={false} onDeleted={onDeleted} />)

    fireEvent.click(screen.getByText('Supprimer'))
    await waitFor(() => {
      expect(screen.getByText('Confirmer la suppression ?')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
      expect(onDeleted).not.toHaveBeenCalled()
    })
  })
})
