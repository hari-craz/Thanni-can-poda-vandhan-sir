import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import { api } from './services/api';

// Page imports
import PublicWaterMap from './pages/PublicWaterMap';
import UnifiedLogin from './pages/UnifiedLogin';
import UserDashboard from './pages/UserDashboard';
import OperationsDashboard from './pages/OperationsDashboard';
import FleetMap from './pages/FleetMap';
import AlertsManagement from './pages/AlertsManagement';
import DeviceTelemetry from './pages/DeviceTelemetry';
import ValveControl from './pages/ValveControl';
import IntelligenceAnomalies from './pages/IntelligenceAnomalies';
import ReportsGenerator from './pages/ReportsGenerator';
import SuperAdminOverview from './pages/SuperAdminOverview';
import NodeManagement from './pages/NodeManagement';
import HardwareProvisioning from './pages/HardwareProvisioning';
import FirmwareOTA from './pages/FirmwareOTA';
import UserAccessManagement from './pages/UserAccessManagement';
import SecurityAuditLogs from './pages/SecurityAuditLogs';
import AIModelConfig from './pages/AIModelConfig';

// Role Guard Component
function RoleGuard({ allowedRoles, children }) {
  const user = api.getCurrentUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!allowedRoles.includes(user.role)) {
    // Redirect unauthorized roles to their default home page
    if (user.role === 'superadmin') {
      return <Navigate to="/superadmin/overview" replace />;
    } else if (user.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    } else {
      return <Navigate to="/user/dashboard" replace />;
    }
  }
  return children;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PublicWaterMap />} />
        <Route path="/login" element={<UnifiedLogin />} />
        
        <Route element={<AppLayout />}>
          {/* User Routes */}
          <Route path="/user/dashboard" element={
            <RoleGuard allowedRoles={['user', 'admin', 'superadmin']}>
              <UserDashboard />
            </RoleGuard>
          } />

          {/* Admin Routes */}
          <Route path="/admin/dashboard" element={
            <RoleGuard allowedRoles={['admin', 'superadmin']}>
              <OperationsDashboard />
            </RoleGuard>
          } />
          <Route path="/admin/fleet" element={
            <RoleGuard allowedRoles={['admin', 'superadmin']}>
              <FleetMap />
            </RoleGuard>
          } />
          <Route path="/admin/alerts" element={
            <RoleGuard allowedRoles={['admin', 'superadmin']}>
              <AlertsManagement />
            </RoleGuard>
          } />
          <Route path="/admin/device/:id/telemetry" element={
            <RoleGuard allowedRoles={['admin', 'superadmin']}>
              <DeviceTelemetry />
            </RoleGuard>
          } />
          <Route path="/admin/device/:id/control" element={
            <RoleGuard allowedRoles={['admin', 'superadmin']}>
              <ValveControl />
            </RoleGuard>
          } />
          <Route path="/admin/intelligence" element={
            <RoleGuard allowedRoles={['admin', 'superadmin']}>
              <IntelligenceAnomalies />
            </RoleGuard>
          } />
          <Route path="/admin/reports" element={
            <RoleGuard allowedRoles={['admin', 'superadmin']}>
              <ReportsGenerator />
            </RoleGuard>
          } />
          
          {/* Super Admin Routes */}
          <Route path="/superadmin/overview" element={
            <RoleGuard allowedRoles={['superadmin']}>
              <SuperAdminOverview />
            </RoleGuard>
          } />
          <Route path="/superadmin/nodes" element={
            <RoleGuard allowedRoles={['superadmin', 'admin']}>
              <NodeManagement />
            </RoleGuard>
          } />
          <Route path="/superadmin/devices/new" element={
            <RoleGuard allowedRoles={['superadmin', 'admin']}>
              <HardwareProvisioning />
            </RoleGuard>
          } />
          <Route path="/superadmin/firmware" element={
            <RoleGuard allowedRoles={['superadmin', 'admin']}>
              <FirmwareOTA />
            </RoleGuard>
          } />
          <Route path="/superadmin/users" element={
            <RoleGuard allowedRoles={['superadmin']}>
              <UserAccessManagement />
            </RoleGuard>
          } />
          <Route path="/superadmin/audit" element={
            <RoleGuard allowedRoles={['superadmin']}>
              <SecurityAuditLogs />
            </RoleGuard>
          } />
          <Route path="/superadmin/ml-settings" element={
            <RoleGuard allowedRoles={['superadmin']}>
              <AIModelConfig />
            </RoleGuard>
          } />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
