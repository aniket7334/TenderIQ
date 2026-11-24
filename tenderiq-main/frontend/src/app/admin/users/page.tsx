'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Loader2,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  X,
  Power,
  PowerOff,
  Shield,
} from 'lucide-react';
import AppLayout from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import useAuth from '@/hooks/useAuth';
import useHydrated from '@/hooks/useHydrated';
import type { User } from '@/lib/types';

const ROLES = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'admin', label: 'Admin' },
];

function getRoleBadge(role: string) {
  switch (role) {
    case 'admin': return <Badge variant="danger">{role}</Badge>;
    case 'analyst': return <Badge variant="info">{role}</Badge>;
    case 'manager': return <Badge variant="warning">{role}</Badge>;
    default: return <Badge variant="default">{role}</Badge>;
  }
}

export default function UsersPage() {
  const router = useRouter();
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const hydrated = useHydrated();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/admin/users');
      setUsers(res.data.items || res.data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load users';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole as User['role'] } : u));
      setToast('Role updated successfully');
    } catch {
      // handled by interceptor
    }
  };

  const handleToggleActive = async (userId: number, isActive: boolean) => {
    try {
      await api.patch(`/admin/users/${userId}/role`, { is_active: !isActive });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_active: !isActive } : u));
      setToast(`User ${isActive ? 'deactivated' : 'activated'}`);
    } catch {
      // handled by interceptor
    }
  };

  if (!hydrated || authLoading || !currentUser) {
    return (
      <AppLayout>
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-ink-muted" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <AlertTriangle className="h-10 w-10 text-amber" />
          <p className="text-lg font-medium text-ink">Access Denied</p>
          <p className="text-sm text-ink-muted">You need admin privileges to access this page.</p>
          <Button onClick={() => router.push('/dashboard')} variant="outline" size="sm">Go to Dashboard</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Toast */}
        {toast && (
          <div className="fixed right-4 top-20 z-50 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <CheckCircle className="h-4 w-4" />
            {toast}
            <button onClick={() => setToast(null)} className="ml-2 text-moss hover:text-green-800">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-4 adm-rise">
          <div>
            <p className="eyebrow mb-1">Admiralty &middot; 08 &middot; {users.length.toLocaleString('en-IN')} seats</p>
            <h2 className="font-display text-[26px] font-normal tracking-[-0.02em] text-ink">
              Desk access.
            </h2>
          </div>
        </div>

        {/* Data table */}
        <div className="doc">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-navy" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertTriangle className="mb-3 h-10 w-10 text-signal" />
              <p className="text-sm text-ink-soft">{error}</p>
              <Button onClick={fetchUsers} variant="outline" size="sm" className="mt-3">
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Users className="mb-3 h-10 w-10 text-ink-muted/60" />
              <p className="text-sm font-medium text-ink-soft">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-rule-soft bg-paper-tint/60">
                    <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Name</th>
                    <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Email</th>
                    <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Role</th>
                    <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Status</th>
                    <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Created</th>
                    <th className="px-6 py-3 text-right font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule-soft">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-paper-tint/60 transition-colors">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-canvas-tint text-sm font-semibold text-navy">
                            {u.full_name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                          </div>
                          <span className="text-sm font-medium text-ink">{u.full_name}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-ink-soft">{u.email}</td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          disabled={u.id === currentUser?.id}
                          className="rounded-lg border border-rule-strong bg-canvas px-2 py-1 text-xs font-medium focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <Badge variant={u.is_active ? 'success' : 'default'}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-ink-soft">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {u.id !== currentUser?.id && (
                            <button
                              onClick={() => handleToggleActive(u.id, u.is_active)}
                              title={u.is_active ? 'Deactivate' : 'Activate'}
                              className="rounded-lg p-1.5 text-ink-muted hover:bg-paper-tint hover:text-ink-soft"
                            >
                              {u.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
