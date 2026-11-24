'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Edit,
  Trash2,
  Play,
  Power,
  PowerOff,
  History,
  Loader2,
  Globe,
  AlertTriangle,
  RefreshCw,
  X,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import AppLayout from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import useAuth from '@/hooks/useAuth';
import useHydrated from '@/hooks/useHydrated';

interface SourceItem {
  id: string;
  name: string;
  adapter_type: string;
  base_url: string;
  is_active: boolean;
  status: string;
  last_scraped_at: string | null;
  success_rate: number | null;
  scrape_interval_minutes: number;
  config: Record<string, unknown> | null;
  total_tenders: number;
  created_at: string;
}

interface ScrapeRun {
  id: string;
  source_id: string;
  status: string;
  tenders_found: number;
  tenders_new: number;
  started_at: string | null;
  completed_at: string | null;
  error_log: string | null;
}

const ADAPTER_TYPES = [
  { value: 'gem', label: 'GeM' },
  { value: 'cppp', label: 'CPPP' },
  { value: 'ireps', label: 'IREPS' },
  { value: 'generic', label: 'Generic' },
];

export default function SourcesPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const hydrated = useHydrated();
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form modal
  const [showModal, setShowModal] = useState(false);
  const [editingSource, setEditingSource] = useState<SourceItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    adapter_type: 'generic',
    base_url: '',
    config: '{}',
    scrape_interval_minutes: 60,
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  // Scrape history modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historySource, setHistorySource] = useState<SourceItem | null>(null);
  const [scrapeRuns, setScrapeRuns] = useState<ScrapeRun[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  const fetchSources = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/sources');
      const raw: SourceItem[] = res.data.items || res.data || [];
      const unique = Array.from(new Map(raw.map((s) => [s.id, s])).values());
      setSources(unique);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load sources';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const openAddModal = () => {
    setEditingSource(null);
    setFormData({ name: '', adapter_type: 'generic', base_url: '', config: '{}', scrape_interval_minutes: 60, is_active: true });
    setShowModal(true);
  };

  const openEditModal = (source: SourceItem) => {
    setEditingSource(source);
    setFormData({
      name: source.name,
      adapter_type: source.adapter_type || 'generic',
      base_url: source.base_url || '',
      config: source.config ? JSON.stringify(source.config, null, 2) : '{}',
      scrape_interval_minutes: source.scrape_interval_minutes || 60,
      is_active: source.is_active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      let parsedConfig = {};
      try {
        parsedConfig = JSON.parse(formData.config);
      } catch {
        setToast('Invalid JSON in config field');
        setSaving(false);
        return;
      }

      const payload = {
        name: formData.name,
        adapter_type: formData.adapter_type,
        base_url: formData.base_url,
        config: parsedConfig,
        scrape_interval_minutes: formData.scrape_interval_minutes,
        is_active: formData.is_active,
      };

      if (editingSource) {
        await api.patch(`/sources/${editingSource.id}`, payload);
        setToast('Source updated successfully');
      } else {
        await api.post('/sources', payload);
        setToast('Source created successfully');
      }
      setShowModal(false);
      fetchSources();
    } catch {
      // handled by interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (source: SourceItem) => {
    try {
      await api.patch(`/sources/${source.id}`, { is_active: !source.is_active });
      setSources((prev) => prev.map((s) => s.id === source.id ? { ...s, is_active: !s.is_active } : s));
      setToast(`Source ${source.is_active ? 'deactivated' : 'activated'}`);
    } catch {
      // handled by interceptor
    }
  };

  const handleTriggerScrape = async (source: SourceItem) => {
    try {
      await api.post(`/sources/${source.id}/scrape`);
      setToast(`Scrape task queued for "${source.name}"`);
    } catch {
      // handled by interceptor
    }
  };

  const handleDelete = async (source: SourceItem) => {
    if (!confirm(`Delete source "${source.name}"?`)) return;
    try {
      await api.delete(`/sources/${source.id}`);
      setSources((prev) => prev.filter((s) => s.id !== source.id));
      setToast('Source deleted');
    } catch {
      // handled by interceptor
    }
  };

  const openHistoryModal = async (source: SourceItem) => {
    setHistorySource(source);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const res = await api.get(`/sources/${source.id}/runs`);
      setScrapeRuns(res.data.items || res.data || []);
    } catch {
      setScrapeRuns([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const getStatusBadge = (source: SourceItem) => {
    if (!source.is_active) return <Badge variant="default">Inactive</Badge>;
    if (source.status === 'error') return <Badge variant="danger">Error</Badge>;
    return <Badge variant="success">Active</Badge>;
  };

  if (!hydrated || authLoading || !user) {
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
            <p className="eyebrow mb-1">Admiralty &middot; 05 &middot; {sources.length.toLocaleString('en-IN')} portals</p>
            <h2 className="font-display text-[26px] font-normal tracking-[-0.02em] text-ink">
              The watched portals.
            </h2>
          </div>
          <Button onClick={openAddModal} variant="primary" size="md">
            <Plus className="h-4 w-4" />
            Add Source
          </Button>
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
              <Button onClick={fetchSources} variant="outline" size="sm" className="mt-3">
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : sources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Globe className="mb-3 h-10 w-10 text-ink-muted/60" />
              <p className="text-sm font-medium text-ink-soft">No sources configured</p>
              <p className="mt-1 text-sm text-ink-muted">Add a source to start scraping tenders</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-rule-soft bg-paper-tint/60">
                    <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Name</th>
                    <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Adapter</th>
                    <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Base URL</th>
                    <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Status</th>
                    <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Last Scraped</th>
                    <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Success Rate</th>
                    <th className="px-6 py-3 text-right font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule-soft">
                  {sources.map((source) => (
                    <tr key={source.id} className="hover:bg-paper-tint/60 transition-colors">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-ink">{source.name}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-ink-soft">
                        <Badge variant="info">{source.adapter_type?.toUpperCase() || 'N/A'}</Badge>
                      </td>
                      <td className="max-w-xs truncate px-6 py-4 text-sm text-ink-soft font-mono">
                        {source.base_url || '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">{getStatusBadge(source)}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-ink-soft">
                        {source.last_scraped_at ? formatDate(source.last_scraped_at) : 'Never'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-ink-soft">
                        {source.success_rate != null ? `${Math.round(source.success_rate * 100)}%` : '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditModal(source)} title="Edit" className="rounded-lg p-1.5 text-ink-muted hover:bg-paper-tint hover:text-ink-soft">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleToggleActive(source)} title={source.is_active ? 'Deactivate' : 'Activate'} className="rounded-lg p-1.5 text-ink-muted hover:bg-paper-tint hover:text-ink-soft">
                            {source.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleTriggerScrape(source)}
                            title="Trigger Scrape"
                            disabled={!source.is_active}
                            className="rounded-lg p-1.5 text-ink-muted hover:bg-green-50 hover:text-moss disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                          <button onClick={() => openHistoryModal(source)} title="View Scrape History" className="rounded-lg p-1.5 text-ink-muted hover:bg-paper-tint hover:text-ink-soft">
                            <History className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(source)} title="Delete" className="rounded-lg p-1.5 text-ink-muted hover:bg-signal/5 hover:text-signal">
                            <Trash2 className="h-4 w-4" />
                          </button>
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

      {/* Add/Edit Source Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingSource ? 'Edit Source' : 'Add Source'} size="lg">
        <div className="space-y-4">
          <div>
            <label className="eyebrow mb-2 block">Name *</label>
            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Source name" />
          </div>
          <div>
            <label className="eyebrow mb-2 block">Adapter Type *</label>
            <select
              value={formData.adapter_type}
              onChange={(e) => setFormData({ ...formData, adapter_type: e.target.value })}
              className="block w-full rounded-lg border border-rule-strong bg-canvas px-3 py-2 text-sm focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink"
            >
              {ADAPTER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="eyebrow mb-2 block">Base URL *</label>
            <Input value={formData.base_url} onChange={(e) => setFormData({ ...formData, base_url: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <label className="eyebrow mb-2 block">Config (JSON)</label>
            <textarea
              value={formData.config}
              onChange={(e) => setFormData({ ...formData, config: e.target.value })}
              rows={4}
              className="block w-full rounded-lg border border-rule-strong bg-canvas px-3 py-2 text-sm font-mono focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink"
            />
          </div>
          <div>
            <label className="eyebrow mb-2 block">Scrape Interval (minutes)</label>
            <Input
              type="number"
              value={String(formData.scrape_interval_minutes)}
              onChange={(e) => setFormData({ ...formData, scrape_interval_minutes: Number(e.target.value) })}
              min={5}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="h-4 w-4 rounded border-rule-strong text-navy focus:ring-ink"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-ink-soft">Active</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!formData.name || !formData.base_url}>
              {editingSource ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Scrape History Modal */}
      <Modal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} title={`Scrape History - ${historySource?.name}`} size="lg">
        {loadingHistory ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-navy" />
          </div>
        ) : scrapeRuns.length === 0 ? (
          <div className="py-10 text-center text-sm text-ink-muted">No scrape history found</div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-rule-soft bg-paper-tint/60">
                  <th className="px-4 py-2 text-left text-xs font-medium text-ink-muted">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-ink-muted">Started</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-ink-muted">Found</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-ink-muted">New</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-ink-muted">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule-soft">
                {scrapeRuns.map((run) => (
                  <tr key={run.id}>
                    <td className="px-4 py-2">
                      <Badge variant={run.status === 'completed' ? 'success' : run.status === 'failed' ? 'danger' : 'warning'}>
                        {run.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-xs text-ink-soft">{run.started_at ? formatDate(run.started_at) : '-'}</td>
                    <td className="px-4 py-2 text-sm text-ink-soft">{run.tenders_found}</td>
                    <td className="px-4 py-2 text-sm text-ink-soft">{run.tenders_new}</td>
                    <td className="max-w-xs truncate px-4 py-2 text-xs text-signal">{run.error_log || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </AppLayout>
  );
}
