import React, { useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import useAuth from './hooks/useAuth';
import AppLayout from './components/layout/app-layout';
import AdminLayout from './components/layout/admin-layout';
import LoginPage from './pages/login';
import RegisterPage from './pages/register';
import DashboardPage from './pages/dashboard';
import TendersPage from './pages/tenders';
import TenderDetailPage from './pages/tender-detail';
import TenderNotesPage from './pages/tender-notes';
import TenderNoteDetailPage from './pages/tender-note-detail';
import AlertsPage from './pages/alerts';
import AdminSourcesPage from './pages/admin/sources';
import AdminKeywordsPage from './pages/admin/keywords';
import AdminUsersPage from './pages/admin/users';
import AdminTemplatesPage from './pages/admin/templates';
import AdminAuditLogPage from './pages/admin/audit-log';
import { Shield } from 'lucide-react';
import { Button } from './components/ui/button';
import { Link } from 'react-router-dom';

function ProtectedRoute() {
  const token = localStorage.getItem('tenderiq_token');
  if (!token) return <Navigate to="/login" replace />;
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

function AdminGuard() {
  const user = useAuth((s) => s.user);
  const role = user?.role;

  if (role === 'admin' || role === 'manager') {
    return (
      <AdminLayout>
        <Outlet />
      </AdminLayout>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Shield className="mb-4 h-12 w-12 text-amber-500" />
      <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
      <p className="mt-2 text-sm text-gray-500">
        You need admin or manager privileges to access this page.
      </p>
      <p className="mt-1 text-xs text-gray-400">
        Your current role: <span className="font-medium">{role || 'unknown'}</span>
      </p>
      <Link to="/dashboard">
        <Button variant="outline" className="mt-4">Go to Dashboard</Button>
      </Link>
    </div>
  );
}

export default function App() {
  const loadUser = useAuth((s) => s.loadUser);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/tenders" element={<TendersPage />} />
        <Route path="/tenders/:id" element={<TenderDetailPage />} />
        <Route path="/tender-notes" element={<TenderNotesPage />} />
        <Route path="/tender-notes/:id" element={<TenderNoteDetailPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/admin" element={<AdminGuard />}>
          <Route index element={<Navigate to="/admin/sources" replace />} />
          <Route path="sources" element={<AdminSourcesPage />} />
          <Route path="keywords" element={<AdminKeywordsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="templates" element={<AdminTemplatesPage />} />
          <Route path="audit-log" element={<AdminAuditLogPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
