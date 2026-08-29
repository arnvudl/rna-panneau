import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { OccupancyForm } from './OccupancyForm'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), info: vi.fn() },
}))

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    return new Response(JSON.stringify([]), { status: 200 })
  })
})

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  billboardId: 'bb1',
  sides: 1 as number,
  availableFaces: ['BOTH' as const],
}

describe('OccupancyForm', () => {
  it('renders both date labels', async () => {
    render(<OccupancyForm {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Date de début (optionnel)')).toBeInTheDocument()
      expect(screen.getByText('Date de fin (optionnel)')).toBeInTheDocument()
    })
  })

  it('renders dialog title', async () => {
    render(<OccupancyForm {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Nouveau contrat')).toBeInTheDocument()
    })
  })

  it('does not show face selector for single-sided billboard', async () => {
    render(<OccupancyForm {...defaultProps} sides={1} />)
    await waitFor(() => {
      expect(screen.getByText('Nouveau contrat')).toBeInTheDocument()
    })
    expect(screen.queryByText('Face')).not.toBeInTheDocument()
  })

  it('shows face selector for double-sided billboard', async () => {
    render(
      <OccupancyForm
        {...defaultProps}
        sides={2}
        availableFaces={['FACE_1', 'FACE_2', 'BOTH']}
      />
    )
    await waitFor(() => {
      expect(screen.getByText('Face')).toBeInTheDocument()
    })
  })

  it('disables submit button when no client selected', async () => {
    render(<OccupancyForm {...defaultProps} />)
    await waitFor(() => {
      const button = screen.getByText('Créer le contrat')
      expect(button).toBeDisabled()
    })
  })

  it('renders contract ref field', async () => {
    render(<OccupancyForm {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Référence du contrat (optionnel)')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('ex: Contrat-2026-014.pdf')).toBeInTheDocument()
    })
  })

  it('does not render when dialog is closed', () => {
    render(<OccupancyForm {...defaultProps} open={false} />)
    expect(screen.queryByText('Nouveau contrat')).not.toBeInTheDocument()
  })
})
