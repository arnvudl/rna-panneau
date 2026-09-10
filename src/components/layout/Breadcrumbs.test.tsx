import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Breadcrumbs } from './Breadcrumbs'

describe('Breadcrumbs', () => {
  it('renders a 2-level list-page breadcrumb with the first segment as a link', () => {
    render(<Breadcrumbs segments={[{ label: 'Accueil', href: '/dashboard' }, { label: 'Clients' }]} />)

    const home = screen.getByRole('link', { name: 'Accueil' })
    expect(home).toHaveAttribute('href', '/dashboard')

    const current = screen.getByText('Clients')
    expect(current.tagName).toBe('SPAN')
  })

  it('renders a 3-level detail-page breadcrumb using the display name, not an id', () => {
    render(
      <Breadcrumbs
        segments={[
          { label: 'Accueil', href: '/dashboard' },
          { label: 'Clients', href: '/clients' },
          { label: 'Orange' },
        ]}
      />
    )

    expect(screen.getByRole('link', { name: 'Accueil' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: 'Clients' })).toHaveAttribute('href', '/clients')
    const current = screen.getByText('Orange')
    expect(current.tagName).toBe('SPAN')
    expect(screen.queryByRole('link', { name: 'Orange' })).not.toBeInTheDocument()
  })

  it('renders nothing for an empty segment list', () => {
    const { container } = render(<Breadcrumbs segments={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
