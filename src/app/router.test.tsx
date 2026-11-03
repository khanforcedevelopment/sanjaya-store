import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Providers } from './providers'
import { routes } from './router'

const renderAt = (path: string) =>
  render(<Providers><RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} /></Providers>)

describe('routing (no backend configured)', () => {
  it('renders the home page with an opening-soon notice', async () => {
    renderAt('/')
    expect(await screen.findByRole('heading', { level: 1, name: /Luxury, delivered across India/ })).toBeInTheDocument()
    expect(screen.getByText(/opening soon/i)).toBeInTheDocument()
  })

  it('renders 404 for unknown deep links', async () => {
    renderAt('/nothing/here')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})
