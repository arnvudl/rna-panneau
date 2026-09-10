import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ContratCreateForm, handleCreateResponse } from './ContratCreateForm'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

describe('handleCreateResponse', () => {
  it('reports created + success toast on 201', async () => {
    const res = new Response(JSON.stringify({ id: 'c1' }), { status: 201 })
    const result = await handleCreateResponse(res)
    expect(result.created).toBe(true)
    expect(result.toast.type).toBe('success')
    expect(result.toast.message).toBe('Contrat créé')
  })

  it('reports not-created + info toast on 202 (pending approval)', async () => {
    const res = new Response(null, { status: 202 })
    const result = await handleCreateResponse(res)
    expect(result.created).toBe(false)
    expect(result.toast.type).toBe('info')
    expect(result.toast.message).toMatch(/approbation/i)
  })

  it('reports not-created + error toast with the server message on 400', async () => {
    const res = new Response(JSON.stringify({ error: 'Panneau introuvable' }), { status: 400 })
    const result = await handleCreateResponse(res)
    expect(result.created).toBe(false)
    expect(result.toast.type).toBe('error')
    expect(result.toast.message).toBe('Panneau introuvable')
  })

  it('reports not-created + error toast with the server message on 409 (face already taken)', async () => {
    const res = new Response(JSON.stringify({ error: 'Cette face du panneau est déjà occupée' }), { status: 409 })
    const result = await handleCreateResponse(res)
    expect(result.created).toBe(false)
    expect(result.toast.type).toBe('error')
    expect(result.toast.message).toBe('Cette face du panneau est déjà occupée')
  })

  it('falls back to a generic error message when the 400 body has no error field', async () => {
    const res = new Response(JSON.stringify({}), { status: 400 })
    const result = await handleCreateResponse(res)
    expect(result.toast.type).toBe('error')
    expect(result.toast.message).toBe('Requête invalide')
  })

  it('falls back to a generic error message on an unexpected status code', async () => {
    const res = new Response(null, { status: 500 })
    const result = await handleCreateResponse(res)
    expect(result.created).toBe(false)
    expect(result.toast.type).toBe('error')
  })
})

describe('ContratCreateForm', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/billboards')) {
        return new Response(
          JSON.stringify([
            { id: 'b1', reference: 'PAN-001', sides: 2, contrats: [] },
            { id: 'b2', reference: 'PAN-002', sides: 1, contrats: [] },
          ]),
          { status: 200 }
        )
      }
      if (url.includes('/api/clients')) {
        return new Response(JSON.stringify([{ id: 'cl1', name: 'Client A' }]), { status: 200 })
      }
      return new Response(JSON.stringify({}), { status: 200 })
    })
  })

  it('renders the dialog title and billboard/client pickers', async () => {
    render(<ContratCreateForm open onOpenChange={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Nouveau contrat')).toBeInTheDocument()
      expect(screen.getByText('Panneau')).toBeInTheDocument()
      expect(screen.getByText('Client')).toBeInTheDocument()
    })
  })

  it('disables submit until both a billboard and a client are selected', async () => {
    render(<ContratCreateForm open onOpenChange={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Créer le contrat')).toBeDisabled()
    })
  })

  it('does not render when the dialog is closed', () => {
    render(<ContratCreateForm open={false} onOpenChange={vi.fn()} />)
    expect(screen.queryByText('Nouveau contrat')).not.toBeInTheDocument()
  })

  it('renders the optional reference and date fields', async () => {
    render(<ContratCreateForm open onOpenChange={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Référence du contrat (optionnel)')).toBeInTheDocument()
      expect(screen.getByText('Date de début (optionnel)')).toBeInTheDocument()
      expect(screen.getByText('Date de fin (optionnel)')).toBeInTheDocument()
    })
  })
})
