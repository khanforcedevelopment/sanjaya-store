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
const CartPage = lazy(() => import('@/pages/CartPage').then((m) => ({ default: m.CartPage })))
const CheckoutPage = lazy(() => import('@/pages/checkout/CheckoutPage').then((m) => ({ default: m.CheckoutPage })))
const OrderPlacedPage = lazy(() => import('@/pages/checkout/OrderPlacedPage').then((m) => ({ default: m.OrderPlacedPage })))
const DeliveryPage = lazy(() => import('@/pages/DeliveryPage').then((m) => ({ default: m.DeliveryPage })))
const CategoriesPage = lazy(() => import('@/pages/CategoriesPage').then((m) => ({ default: m.CategoriesPage })))

const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })))
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })))
const AdminOrders = lazy(() => import('@/pages/admin/AdminOrders').then((m) => ({ default: m.AdminOrders })))
const AdminOrderDetail = lazy(() => import('@/pages/admin/AdminOrderDetail').then((m) => ({ default: m.AdminOrderDetail })))
const AdminProducts = lazy(() => import('@/pages/admin/AdminProducts').then((m) => ({ default: m.AdminProducts })))
const AdminProductEdit = lazy(() => import('@/pages/admin/AdminProducts').then((m) => ({ default: m.AdminProductEdit })))
const AdminImport = lazy(() => import('@/pages/admin/AdminImport').then((m) => ({ default: m.AdminImport })))
const AdminMarketing = lazy(() => import('@/pages/admin/AdminMarketing').then((m) => ({ default: m.AdminMarketing })))
const AdminDelivery = lazy(() => import('@/pages/admin/AdminDelivery').then((m) => ({ default: m.AdminDelivery })))
const AdminStaff = lazy(() => import('@/pages/admin/AdminStaff').then((m) => ({ default: m.AdminStaff })))
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings').then((m) => ({ default: m.AdminSettings })))
const AdminCollections = lazy(() => import('@/pages/admin/AdminCollections').then((m) => ({ default: m.AdminCollections })))
const InstallmentsPage = lazy(() => import('@/pages/account/InstallmentsPage').then((m) => ({ default: m.InstallmentsPage })))
const InstallmentsInfoPage = lazy(() => import('@/pages/InstallmentsInfoPage').then((m) => ({ default: m.InstallmentsInfoPage })))
const AdminKyc = lazy(() => import('@/pages/admin/AdminKyc').then((m) => ({ default: m.AdminKyc })))
const VerifyIdentityPage = lazy(() => import('@/pages/account/VerifyIdentityPage').then((m) => ({ default: m.VerifyIdentityPage })))
const RiderQueue = lazy(() => import('@/pages/admin/RiderQueue').then((m) => ({ default: m.RiderQueue })))

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
      { path: 'delivery', element: <DeliveryPage /> },
      { path: 'installments', element: <InstallmentsInfoPage /> },
      { path: 'cart', element: <CartPage /> },
      { path: 'checkout', element: <RequireAuth><CheckoutPage /></RequireAuth> },
      { path: 'order/:id', element: <RequireAuth><OrderPlacedPage /></RequireAuth> },
      { path: 'login', element: <LoginPage /> },
      {
        path: 'account',
        element: <RequireAuth><AccountLayout /></RequireAuth>,
        children: [
          { index: true, element: <AccountOverview /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'addresses', element: <AddressesPage /> },
          { path: 'wishlist', element: <WishlistPage /> },
          { path: 'installments', element: <InstallmentsPage /> },
          { path: 'verify', element: <VerifyIdentityPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: 'admin',
    element: <RequireAuth roles={[]}><AdminLayout /></RequireAuth>,
    children: [
      { index: true, element: <RequireAuth roles={['operations', 'support', 'collections']}><AdminDashboard /></RequireAuth> },
      { path: 'orders', element: <RequireAuth roles={['operations', 'support']}><AdminOrders /></RequireAuth> },
      { path: 'orders/:id', element: <RequireAuth roles={['operations', 'support']}><AdminOrderDetail /></RequireAuth> },
      { path: 'collections', element: <RequireAuth roles={['collections']}><AdminCollections /></RequireAuth> },
      { path: 'rider', element: <RequireAuth roles={['delivery']}><RiderQueue /></RequireAuth> },
      { path: 'products', element: <RequireAuth roles={['operations']}><AdminProducts /></RequireAuth> },
      { path: 'products/:id', element: <RequireAuth roles={['operations']}><AdminProductEdit /></RequireAuth> },
      { path: 'import', element: <RequireAuth roles={['operations']}><AdminImport /></RequireAuth> },
      { path: 'marketing', element: <RequireAuth roles={['operations']}><AdminMarketing /></RequireAuth> },
      { path: 'delivery', element: <RequireAuth roles={['operations']}><AdminDelivery /></RequireAuth> },
      { path: 'kyc', element: <RequireAuth roles={['super_admin']}><AdminKyc /></RequireAuth> },
      { path: 'staff', element: <RequireAuth roles={['super_admin']}><AdminStaff /></RequireAuth> },
      { path: 'settings', element: <RequireAuth roles={['super_admin']}><AdminSettings /></RequireAuth> },
    ],
  },
]

export const router = createBrowserRouter(routes)
