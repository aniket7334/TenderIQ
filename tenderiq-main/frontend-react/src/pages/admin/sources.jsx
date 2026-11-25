import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import useAuth from '@/hooks/useAuth';

const ADAPTER_TYPES = [
  { value: 'gem', label: 'GeM' },
  { value: 'cppp', label: 'CPPP' },
  { value: 'ireps', label: 'IREPS' },
  { value: 'generic', label: 'Generic' },
];

export default function SourcesPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [sources, setSources] = useState([]);
  // Live sources (TED for Europe) aren't in the database; they're listed in the same table
  const [liveSources, setLiveSources] = useState([]);
  const [checkingLive, setCheckingLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form modal
  const [showModal, setShowModal] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
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
  const [historySource, setHistorySource] = useState(null);
  const [scrapeRuns, setScrapeRuns] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);

  const isAdmin = user?.role === 'admin' || authLoading;

  const fetchSources = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [res, live] = await Promise.all([
        api.get('/sources'),
        api.get('/sources/live', { timeout: 60000 }).catch(() => null),
      ]);
      setSources(res.data.items || res.data || []);
      setLiveSources(live?.data?.items || []);
    } catch (err) {
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

  const openEditModal = (source) => {
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

  const handleToggleActive = async (source) => {
    try {
      await api.patch(`/sources/${source.id}`, { is_active: !source.is_active });
      setSources((prev) => prev.map((s) => s.id === source.id ? { ...s, is_active: !s.is_active } : s));
      setToast(`Source ${source.is_active ? 'deactivated' : 'activated'}`);
    } catch {
      // handled by interceptor
    }
  };

  const handleTriggerScrape = async (source) => {
    try {
      await api.post(`/sources/${source.id}/scrape`);
      setToast(`Scrape task queued for "${source.name}"`);
    } catch {
      // handled by interceptor
    }
  };

  const handleDelete = async (source) => {
    if (!confirm(`Delete source "${source.name}"?`)) return;
    try {
      await api.post(`/sources/${source.id}/delete`);
      setSources((prev) => prev.filter((s) => s.id !== source.id));
      setToast('Source deleted');
    } catch {
      // handled by interceptor
    }
  };

  const openHistoryModal = async (source) => {
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

  // Ask TED again now (one small request) and update its row
  const handleCheckLive = async () => {
    try {
      setCheckingLive(true);
      const res = await api.get('/sources/live', { params: { fresh: 1 }, timeout: 60000 });
      const items = res.data.items || [];
      setLiveSources(items);
      const ted = items[0];
      setToast(ted?.status === 'online' ? `TED is online — ${(ted.open_tenders ?? 0).toLocaleString()} open tenders` : 'TED did not answer — try again shortly');
    } catch {
      // handled by interceptor
    } finally {
      setCheckingLive(false);
    }
  };

  // TED shown as a normal row: name, adapter, URL, status, last checked, success rate
  const rows = [
    ...sources,
    ...liveSources.map((s) => ({
      id: `live-${s.id}`,
      live: true,
      name: 'TED',
      adapter_type: 'ted',
      base_url: 'https://ted.europa.eu',
      is_active: true,
      status: s.status,
      last_scraped_at: s.last_ok_at,
      success_rate: s.success_rate,
      open_tenders: s.open_tenders,
    })),
  ];

  const getStatusBadge = (source) => {
    if (source.live) {
      if (source.status === 'online') return <Badge variant="success">Active</Badge>;
      return <Badge variant="default">{source.status === 'busy' ? 'Busy' : 'Unreachable'}</Badge>;
    }
    if (!source.is_active) return <Badge variant="default">Inactive</Badge>;
    if (source.status === 'error') return <Badge variant="danger">Error</Badge>;
    return <Badge variant="success">Active</Badge>;
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
    <>
      <div className="space-y-4">
        {/* Toast */}
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
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Source Management</h1>
            <p className="mt-1 text-sm text-gray-500">{rows.length} sources configured</p>
          </div>
          <Button onClick={openAddModal} variant="primary" size="md" className="self-start sm:self-auto">
            <Plus className="h-4 w-4" />
            Add Source
          </Button>
        </div>

        {/* Data table */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertTriangle className="mb-3 h-10 w-10 text-red-500" />
              <p className="text-sm text-gray-600">{error}</p>
              <Button onClick={fetchSources} variant="outline" size="sm" className="mt-3">
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Globe className="mb-3 h-10 w-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">No sources configured</p>
              <p className="mt-1 text-sm text-gray-400">Add a source to start scraping tenders</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">Name</th>
                    <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Adapter</th>
                    <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Base URL</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">Status</th>
                    <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Last Scraped</th>
                    <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Success Rate</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((source) => (
                    <tr key={source.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-4 text-sm font-medium text-gray-900 sm:px-6 sm:whitespace-nowrap">
                        <span className="line-clamp-2 sm:line-clamp-none">{source.name}</span>
                        {source.live && (
                          <span className="block text-xs font-normal text-gray-500">
                            Europe · live, not stored{source.open_tenders != null ? ` · ${source.open_tenders.toLocaleString()} open` : ''}
                          </span>
                        )}
                      </td>
                      <td className="hidden sm:table-cell whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                        <Badge variant="info">{source.adapter_type?.toUpperCase() || 'N/A'}</Badge>
                      </td>
                      <td className="hidden lg:table-cell max-w-xs truncate px-6 py-4 text-sm text-gray-600 font-mono">
                        {source.base_url || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 sm:px-6">{getStatusBadge(source)}</td>
                      <td className="hidden md:table-cell whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                        {source.last_scraped_at ? formatDate(source.last_scraped_at) : 'Never'}
                      </td>
                      <td className="hidden lg:table-cell whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                        {source.success_rate != null ? `${Math.round(source.success_rate)}%` : '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right sm:px-6">
                        {source.live ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={handleCheckLive}
                            disabled={checkingLive}
                            title="Check TED now"
                            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
                          >
                            {checkingLive ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => navigate('/tenders?country=Europe')}
                            title="Open Europe tenders"
                            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>
                        ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditModal(source)} title="Edit" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleToggleActive(source)} title={source.is_active ? 'Deactivate' : 'Activate'} className="hidden sm:inline-flex rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                            {source.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleTriggerScrape(source)}
                            title="Trigger Scrape"
                            disabled={!source.is_active}
                            className="rounded-lg p-2 text-gray-400 hover:bg-green-50 hover:text-green-600 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                          <button onClick={() => openHistoryModal(source)} title="View Scrape History" className="hidden sm:inline-flex rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                            <History className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(source)} title="Delete" className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        )}
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
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Name *</label>
            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Source name" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Adapter Type *</label>
            <select
              value={formData.adapter_type}
              onChange={(e) => setFormData({ ...formData, adapter_type: e.target.value })}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {ADAPTER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Base URL *</label>
            <Input value={formData.base_url} onChange={(e) => setFormData({ ...formData, base_url: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Config (JSON)</label>
            <textarea
              value={formData.config}
              onChange={(e) => setFormData({ ...formData, config: e.target.value })}
              rows={4}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Scrape Interval (minutes)</label>
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
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Active</label>
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
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : scrapeRuns.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">No scrape history found</div>
        ) : (
          <div className="max-h-96 overflow-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Started</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Found</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">New</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scrapeRuns.map((run) => (
                  <tr key={run.id}>
                    <td className="px-4 py-2">
                      <Badge variant={run.status === 'completed' ? 'success' : run.status === 'failed' ? 'danger' : 'warning'}>
                        {run.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600">{run.started_at ? formatDate(run.started_at) : '-'}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{run.tenders_found}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{run.tenders_new}</td>
                    <td className="max-w-xs truncate px-4 py-2 text-xs text-red-500">{run.error_log || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </>
  );
}
