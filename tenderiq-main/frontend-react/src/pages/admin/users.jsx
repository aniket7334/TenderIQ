import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Loader2,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  X,
  Power,
  PowerOff,
  Plus,
  Edit,
  Check,
  UserX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import useAuth from '@/hooks/useAuth';

const ROLES = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
];

export default function UsersPage() {
  const navigate = useNavigate();
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState([]);
  // 'all' or 'pending' (sign-ups waiting for approval)
  const [view, setView] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'viewer',
  });

  const isAdmin = currentUser?.role === 'admin' || authLoading;

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/admin/users');
      setUsers(res.data.items || res.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load users';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }
  }, [toast]);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({ full_name: '', email: '', password: '', role: 'viewer' });
    setShowModal(true);
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    setFormData({ full_name: u.full_name, email: u.email, password: '', role: u.role });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.full_name.trim() || !formData.email.trim()) return;
    if (!editingUser && !formData.password.trim()) return;
    try {
      setSaving(true);
      if (editingUser) {
        const payload = {
          full_name: formData.full_name,
          email: formData.email,
          role: formData.role,
        };
        if (formData.password) payload.password = formData.password;
        await api.patch(`/admin/users/${editingUser.id}`, payload);
        setToast('User updated successfully');
      } else {
        await api.post('/admin/users', {
          full_name: formData.full_name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        });
        setToast('User created successfully');
      }
      setShowModal(false);
      fetchUsers();
    } catch {
      // handled by interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
      setToast('Role updated');
    } catch { }
  };

  /* ---- Sign-up approval ---- */
  const handleApprove = async (u) => {
    try {
      await api.post(`/admin/users/${u.id}/approve`, { role: u.role || 'viewer' });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, signup_status: 'approved', is_active: true } : x)));
      setToast(`${u.full_name} approved as ${(ROLES.find((r) => r.value === (u.role || 'viewer')) || {}).label || u.role}`);
    } catch { }
  };
  const handleReject = async (u) => {
    if (!confirm(`Reject the sign-up of ${u.full_name} (${u.email})? They won't be able to sign in.`)) return;
    try {
      await api.post(`/admin/users/${u.id}/reject`);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, signup_status: 'rejected', is_active: false } : x)));
      setToast(`Sign-up of ${u.full_name} rejected`);
    } catch { }
  };
  const pendingCount = users.filter((u) => u.signup_status === 'pending').length;
  const shown = view === 'pending' ? users.filter((u) => u.signup_status === 'pending') : users;

  const handleToggleActive = async (userId, isActive) => {
    try {
      await api.patch(`/admin/users/${userId}/role`, { is_active: !isActive });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_active: !isActive } : u));
      setToast(`User ${isActive ? 'deactivated' : 'activated'}`);
    } catch { }
  };

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <p className="text-lg font-medium text-gray-900">Access Denied</p>
        <p className="text-sm text-gray-500">You need admin privileges to access this page.</p>
        <Button onClick={() => navigate('/dashboard')} variant="outline" size="sm">Go to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed right-4 top-20 z-50 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 shadow-lg">
          <CheckCircle className="h-4 w-4" />
          {toast}
          <button onClick={() => setToast(null)} className="ml-2 text-green-600 hover:text-green-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">User Management</h1>
          <p className="mt-1 text-sm text-gray-500">{users.length} users</p>
        </div>
        <Button onClick={openCreateModal} variant="primary" size="md" className="self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingUser ? 'Edit User' : 'Add User'}>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Full Name *</label>
            <Input
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email *</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="user@company.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Password {editingUser ? '(leave blank to keep current)' : '*'}
            </label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder={editingUser ? '••••••••' : 'Enter password'}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Role *</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setShowModal(false)} variant="outline" size="sm">Cancel</Button>
            <Button
              onClick={handleSave}
              variant="primary"
              size="sm"
              loading={saving}
              disabled={!formData.full_name.trim() || !formData.email.trim() || (!editingUser && !formData.password.trim())}
            >
              {editingUser ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* All users / waiting for approval */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          ['all', `All users (${users.length})`],
          ['pending', `Waiting for approval (${pendingCount})`],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              view === key ? 'border-brand-700 bg-brand-700 text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
        {pendingCount > 0 && view !== 'pending' && (
          <span className="text-xs text-gray-500">New sign-ups can't sign in until you approve them.</span>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertTriangle className="mb-3 h-10 w-10 text-red-500" />
            <p className="text-sm text-gray-600">{error}</p>
            <Button onClick={fetchUsers} variant="outline" size="sm" className="mt-3">
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">{view === 'pending' ? 'No sign-ups waiting for approval' : 'No users found'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">Name</th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">Role</th>
                  <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Created</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-4 sm:px-6 sm:whitespace-nowrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                          {u.full_name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">{u.full_name}</p>
                          <p className="truncate text-xs text-gray-500 md:hidden">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell whitespace-nowrap px-6 py-4 text-sm text-gray-600">{u.email}</td>
                    <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={u.id === currentUser?.id}
                        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="hidden sm:table-cell whitespace-nowrap px-6 py-4">
                      {u.signup_status === 'pending' ? (
                        <Badge variant="info">Pending approval</Badge>
                      ) : u.signup_status === 'rejected' ? (
                        <Badge variant="default">Rejected</Badge>
                      ) : (
                        <Badge variant={u.is_active ? 'success' : 'default'}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      )}
                    </td>
                    <td className="hidden lg:table-cell whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right sm:px-6">
                      <div className="flex items-center justify-end gap-1">
                        {u.signup_status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(u)}
                              title={`Approve as ${(ROLES.find((r) => r.value === u.role) || {}).label || 'Viewer'} (change the role first if needed)`}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              <Check className="h-3.5 w-3.5" /> Approve
                            </button>
                            <button
                              onClick={() => handleReject(u)}
                              title="Reject this sign-up"
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              <UserX className="h-3.5 w-3.5" /> Reject
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => openEditModal(u)}
                          title="Edit user"
                          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {u.id !== currentUser?.id && u.signup_status !== 'pending' && (
                          <button
                            onClick={() => handleToggleActive(u.id, u.is_active)}
                            title={u.is_active ? 'Deactivate' : 'Activate'}
                            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
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
  );
}
