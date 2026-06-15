import { createBrowserRouter } from 'react-router-dom'
import { PublicLayout } from '@/components/shared/PublicLayout'
import { AdminLayout } from '@/components/shared/AdminLayout'
import { FullscreenLayout } from '@/components/shared/FullscreenLayout'
import { ProtectedRoute } from '@/components/shared/ProtectedRoute'

// Public pages
import { HomePage } from '@/pages/public/HomePage'
import { LivePage } from '@/pages/public/LivePage'
import { DevicesPage } from '@/pages/public/DevicesPage'
import { DeviceDetailPage } from '@/pages/public/DeviceDetailPage'
import { StatusPage } from '@/pages/public/StatusPage'
import { AboutPage } from '@/pages/public/AboutPage'
import { LoginPage } from '@/pages/auth/LoginPage'

// Admin pages
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage'
import { AdminDevicesPage } from '@/pages/admin/AdminDevicesPage'
import { AlertsPage } from '@/pages/admin/AlertsPage'
import { AnomaliesPage } from '@/pages/admin/AnomaliesPage'
import { AnalyticsPage } from '@/pages/admin/AnalyticsPage'
import { ReportsPage } from '@/pages/admin/ReportsPage'
import { ProvisioningPage } from '@/pages/admin/ProvisioningPage'
import { UsersPage } from '@/pages/admin/UsersPage'
import { ApiKeysPage } from '@/pages/admin/ApiKeysPage'
import { AuditPage } from '@/pages/admin/AuditPage'
import { SettingsPage } from '@/pages/admin/SettingsPage'

export const router = createBrowserRouter([
  // 1. Public Layout Routes
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'devices', element: <DevicesPage /> },
      { path: 'devices/:deviceId', element: <DeviceDetailPage /> },
      { path: 'status', element: <StatusPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'login', element: <LoginPage /> },
    ],
  },
  
  // 2. Fullscreen Live dashboard
  {
    path: '/live',
    element: <FullscreenLayout />,
    children: [
      { index: true, element: <LivePage /> },
    ],
  },

  // 3. Protected Admin routes
  {
    path: '/admin',
    element: <ProtectedRoute allowedRoles={['admin', 'superadmin']} />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: 'devices', element: <AdminDevicesPage /> },
          { path: 'alerts', element: <AlertsPage /> },
          { path: 'anomalies', element: <AnomaliesPage /> },
          { path: 'analytics', element: <AnalyticsPage /> },
          { path: 'reports', element: <ReportsPage /> },
          
          // Superadmin operations
          {
            element: <ProtectedRoute allowedRoles={['superadmin']} />,
            children: [
              { path: 'provisioning', element: <ProvisioningPage /> },
              { path: 'users', element: <UsersPage /> },
              { path: 'api-keys', element: <ApiKeysPage /> },
              { path: 'audit', element: <AuditPage /> },
              { path: 'settings', element: <SettingsPage /> },
            ],
          },
        ],
      },
    ],
  },
])
