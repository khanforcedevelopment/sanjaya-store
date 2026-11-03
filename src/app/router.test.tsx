import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { SiteLayout } from '@/components/layout/SiteLayout'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'

const routes = [
  { element: <SiteLayout />, children: [{ index: true, element: <HomePage /> }, { path: '*', element: <NotFoundPage /> }] },
]

describe('routing', () => {
  it('renders the home page', () => {
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/'] })} />)
    expect(screen.getByRole('heading', { name: 'Sanjaya Store' })).toBeInTheDocument()
    expect(screen.getByTestId('backend-status')).toHaveTextContent('not configured yet')
  })

  it('renders 404 for unknown deep links', () => {
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/p/unknown'] })} />)
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})
