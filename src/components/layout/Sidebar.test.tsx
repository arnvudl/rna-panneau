import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Sidebar } from './Sidebar'

const mockUsePathname = vi.fn()
const mockUseSession = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
  signOut: vi.fn(),
}))

const adminSession = {
  data: { user: { email: 'admin@example.com', role: 'ADMIN' } },
  status: 'authenticated' as const,
}

const userSession = {
  data: { user: { email: 'user@example.com', role: 'USER' } },
  status: 'authenticated' as const,
}

beforeEach(() => {
  localStorage.clear()
  mockUsePathname.mockReturnValue('/dashboard')
  mockUseSession.mockReturnValue(adminSession)
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ notifications: [], unreadCount: 0 }), { status: 200 })
  )
})

describe('Sidebar', () => {
  it('renders collapsed (icon-only) by default when localStorage is empty', () => {
    render(<Sidebar />)
    expect(localStorage.getItem('rna-sidebar-collapsed')).toBeNull()
    expect(screen.queryByText('Tableau de bord')).not.toBeInTheDocument()
    expect(screen.queryByText('Clients')).not.toBeInTheDocument()
  })

  it('shows labels after the collapse toggle is clicked, and persists the new state', () => {
    render(<Sidebar />)
    const toggle = screen.getByRole('button', { name: /développer le menu/i })
    fireEvent.click(toggle)

    expect(screen.getByText('Tableau de bord')).toBeInTheDocument()
    expect(screen.getByText('Clients')).toBeInTheDocument()
    expect(localStorage.getItem('rna-sidebar-collapsed')).toBe('false')
  })

  it('reads a previously-stored expanded state back on mount', () => {
    localStorage.setItem('rna-sidebar-collapsed', 'false')
    render(<Sidebar />)
    expect(screen.getByText('Tableau de bord')).toBeInTheDocument()
  })

  it('highlights the link matching the current pathname and not the others', () => {
    localStorage.setItem('rna-sidebar-collapsed', 'false')
    mockUsePathname.mockReturnValue('/database')
    const { container } = render(<Sidebar />)

    const active = container.querySelector('a[href="/database"]')
    const inactive = container.querySelector('a[href="/dashboard"]')

    expect(active?.className).toContain('border-l-primary')
    expect(inactive?.className).not.toContain('border-l-primary')
  })

  it('shows the Réglages link for a role with view_settings permission', () => {
    localStorage.setItem('rna-sidebar-collapsed', 'false')
    mockUseSession.mockReturnValue(adminSession)
    const { container } = render(<Sidebar />)

    expect(container.querySelector('a[href="/settings/regions"]')).not.toBeNull()
  })

  it('hides the Réglages link for a role without view_settings permission', () => {
    localStorage.setItem('rna-sidebar-collapsed', 'false')
    mockUseSession.mockReturnValue(userSession)
    const { container } = render(<Sidebar />)

    expect(container.querySelector('a[href="/settings/regions"]')).toBeNull()
  })

  it('includes a working link to /account/password in the Mon Compte dropdown', () => {
    localStorage.setItem('rna-sidebar-collapsed', 'false')
    render(<Sidebar />)

    fireEvent.click(screen.getByText('Mon Compte'))

    const link = screen.getByRole('menuitem', { name: 'Mon compte' })
    expect(link.closest('a')).toHaveAttribute('href', '/account/password')
  })
})
