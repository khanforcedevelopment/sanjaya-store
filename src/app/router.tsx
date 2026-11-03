import { lazy } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { SiteLayout } from '@/components/layout/SiteLayout'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ListingPage } from '@/pages/ListingPage'
import { RequireAuth } from '@/features/account/RequireAuth'

const ProductPage = lazy(() => import('@/pages/ProductPage').then((m) => ({ default: m.ProductPage })))
const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })))
const AccountLayout = lazy(() => import('@/pages/account/AccountLayout').then((m) => ({ default: m.AccountLayout })))
const AccountOverview = lazy(() => import('@/pages/account/AccountOverview').then((m) => ({ default: m.AccountOverview })))
const ProfilePage = lazy(() => import('@/pages/account/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const AddressesPage = lazy(() => import('@/pages/account/AddressesPage').then((m) => ({ default: m.AddressesPage })))
const WishlistPage = lazy(() => import('@/pages/account/WishlistPage').then((m) => ({ default: m.WishlistPage })))
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
      { path: 'login', element: <LoginPage /> },
      {
        path: 'account',
        element: <RequireAuth><AccountLayout /></RequireAuth>,
        children: [
          { index: true, element: <AccountOverview /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'addresses', element: <AddressesPage /> },
          { path: 'wishlist', element: <WishlistPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
