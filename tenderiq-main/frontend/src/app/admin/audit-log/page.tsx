'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Shield,
  AlertTriangle,
  RefreshCw,
  X,
  Download,
  Filter,
  ChevronDown,
} from 'lucide-react';
import AppLayout from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import useAuth from '@/hooks/useAuth';
import useHydrated from '@/hooks/useHydrated';
import type { PaginatedResponse, User } from '@/lib/types';

interface AuditLogItem {
  id: string;
  user_id: string | null;
  user_name?: string;
  entity_type: string;
  entity_id: string;
  action: string;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

const ENTITY_TYPE_OPTIONS = [
  { value: '', label: 'All Entity Types' },
  { value: 'tender', label: 'Tender' },
  { value: 'source', label: 'Source' },
  { value: 'keyword', label: 'Keyword' },
  { value: 'template', label: 'Template' },
  { value: 'user', label: 'User' },
  { value: 'alert', label: 'Alert' },
  { value: 'tender_note', label: 'Tender Note' },
];

export default function AuditLogPage() {
  const router = useRouter();
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const hydrated = useHydrated();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  // Filters
  const [entityType, setEntityType] = useState('');
  const [userId, setUserId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const pageSize = 20;

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const isAdmin = currentUser?.role === 'admin';

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string | number> = { page, page_size: pageSize };
      if (entityType) params.entity_type = entityType;
      if (userId) params.user_id = userId;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const res = await api.get<PaginatedResponse<AuditLogItem>>('/admin/audit-logs', { params });
      setLogs(res.data.items || []);
      setTotal(res.data.total);
      setTotalPages(res.data.total_pages);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load audit logs';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [entityType, userId, dateFrom, dateTo, page]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data.items || res.data || []);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setEntityType('');
    setUserId('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasActiveFilters = entityType || userId || dateFrom || dateTo;

  const handleExport = () => {
    // Placeholder: In a real implementation, this would call an export API endpoint
    alert('Export functionality coming soon. This will export audit logs as CSV.');
  };

  const getActionBadge = (action: string) => {
    if (action.includes('create') || action.includes('add')) return <Badge variant="success">{action}</Badge>;
    if (action.includes('delete') || action.includes('remove')) return <Badge variant="danger">{action}</Badge>;
    if (action.includes('update') || action.includes('change') || action.includes('edit')) return <Badge variant="warning">{action}</Badge>;
    return <Badge variant="default">{action}</Badge>;
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
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-4 adm-rise">
          <div>
            <p className="eyebrow mb-1">Admiralty &middot; 09 &middot; {total.toLocaleString('en-IN')} entries</p>
            <h2 className="font-display text-[26px] font-normal tracking-[-0.02em] text-ink">
              The desk journal.
            </h2>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExport} variant="outline" size="md">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button
              variant={showFilters ? 'primary' : 'outline'}
              size="md"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-canvas-tint text-xs text-navy">!</span>
              )}
            </Button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="doc p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-muted">Entity Type</label>
                <select
                  value={entityType}
                  onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
                  className="block w-full rounded-lg border border-rule-strong bg-canvas px-3 py-2 text-sm focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink"
                >
                  {ENTITY_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-muted">User</label>
                <select
                  value={userId}
                  onChange={(e) => { setUserId(e.target.value); setPage(1); }}
                  className="block w-full rounded-lg border border-rule-strong bg-canvas px-3 py-2 text-sm focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink"
                >
                  <option value="">All Users</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-muted">From Date</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-muted">To Date</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                />
              </div>
            </div>
            {hasActiveFilters && (
              <div className="mt-3 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4" />
                  Clear all filters
                </Button>
              </div>
            )}
          </div>
        )}

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
              <Button onClick={fetchLogs} variant="outline" size="sm" className="mt-3">
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Shield className="mb-3 h-10 w-10 text-ink-muted/60" />
              <p className="text-sm font-medium text-ink-soft">No audit log entries</p>
              <p className="mt-1 text-sm text-ink-muted">Activity will appear here</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-rule-soft bg-paper-tint/60">
                      <th className="w-8 px-3 py-3" />
                      <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Timestamp</th>
                      <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">User</th>
                      <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Action</th>
                      <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Entity Type</th>
                      <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Entity ID</th>
                      <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule-soft">
                    {logs.map((log) => (
                      <React.Fragment key={log.id}>
                        <tr className="hover:bg-paper-tint/60 transition-colors">
                          <td className="px-3 py-4">
                            {log.changes && Object.keys(log.changes).length > 0 && (
                              <button
                                onClick={() => toggleRow(log.id)}
                                className="rounded p-0.5 text-ink-muted hover:bg-paper-tint hover:text-ink-soft"
                              >
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform ${
                                    expandedRows.has(log.id) ? 'rotate-180' : ''
                                  }`}
                                />
                              </button>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-ink-soft">
                            {formatDate(log.created_at, 'dd MMM yyyy HH:mm:ss')}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-ink">
                            {log.user_name || (log.user_id ? users.find((u) => String(u.id) === log.user_id)?.full_name : null) || log.user_id || 'System'}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            {getActionBadge(log.action)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            <Badge variant="info">{log.entity_type}</Badge>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-ink-soft">
                            {log.entity_id ? `${String(log.entity_id).slice(0, 8)}...` : '-'}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-ink-soft">
                            {log.ip_address || '-'}
                          </td>
                        </tr>
                        {expandedRows.has(log.id) && log.changes && (
                          <tr>
                            <td colSpan={7} className="bg-paper-tint px-10 py-3">
                              <div className="rounded-lg bg-canvas border border-rule p-4">
                                <h4 className="mb-2 text-xs font-semibold uppercase text-ink-muted">Changes</h4>
                                <pre className="overflow-x-auto text-xs text-ink-soft font-mono">
                                  {JSON.stringify(log.changes, null, 2)}
                                </pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-rule px-6 py-4">
                <p className="text-sm text-ink-muted">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} entries
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-ink-soft">Page {page} of {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
