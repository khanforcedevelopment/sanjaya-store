import { lazy } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { SiteLayout } from '@/components/layout/SiteLayout'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ListingPage } from '@/pages/ListingPage'

const ProductPage = lazy(() => import('@/pages/ProductPage').then((m) => ({ default: m.ProductPage })))
const CategoriesPage = lazy(() => import('@/pages/CategoriesPage').then((m) => ({ default: m.CategoriesPage })))

/**
 * Client-side routes. Netlify serves index.html for every path (public/_redirects),
 * so deep links such as /p/some-product work after a drag-and-drop deploy.
 */
export const routes: RouteObject[] = [
  {
    element: <SiteLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'c/:slug', element: <ListingPage mode="category" /> },
      { path: 'search', element: <ListingPage mode="search" /> },
      { path: 'deals', element: <ListingPage mode="deals" /> },
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'p/:slug', element: <ProductPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
