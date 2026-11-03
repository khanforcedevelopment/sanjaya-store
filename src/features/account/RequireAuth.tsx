import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { PageSpinner } from '@/components/layout/PageSpinner'
import { useAuth } from './AuthProvider'
import type { AppRole } from '@/lib/types'
import { EmptyState } from '@/components/ui/misc'
import { ShieldAlert } from 'lucide-react'

export function RequireAuth({ children, roles }: { children: ReactNode; roles?: AppRole[] }) {
  const { ready, user, hasRole, isStaff } = useAuth()
  const location = useLocation()
  if (!ready) return <PageSpinner />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  if (roles && !(roles.length === 0 ? isStaff : hasRole(...roles))) {
    return <EmptyState icon={<ShieldAlert />} title="No access">Your account does not have permission to open this page.</EmptyState>
  }
  return <>{children}</>
}
