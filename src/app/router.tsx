import { createBrowserRouter } from 'react-router-dom'
import { SiteLayout } from '@/components/layout/SiteLayout'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'

/**
 * Client-side routes. Storefront, account and admin routes are added phase by
 * phase. Netlify serves index.html for every path (public/_redirects), so deep
 * links such as /p/some-product work after a drag-and-drop deploy.
 */
export const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
