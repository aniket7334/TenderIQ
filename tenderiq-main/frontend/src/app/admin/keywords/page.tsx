'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  Tag,
  AlertTriangle,
  RefreshCw,
  X,
  CheckCircle,
  Upload,
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

interface KeywordItem {
  id: string;
  keyword: string;
  category: string;
  priority: number;
  is_active: boolean;
  match_count: number;
  created_at: string;
}

const CATEGORIES = [
  { value: 'scope', label: 'Scope' },
  { value: 'sector', label: 'Sector' },
  { value: 'service', label: 'Service' },
  { value: 'location', label: 'Location' },
  { value: 'exclude', label: 'Exclude' },
];

export default function KeywordsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const hydrated = useHydrated();
  const [keywords, setKeywords] = useState<KeywordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'include' | 'exclude'>('include');

  // Form modal
  const [showModal, setShowModal] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<KeywordItem | null>(null);
  const [formData, setFormData] = useState({ keyword: '', category: 'scope', priority: 3 });
  const [saving, setSaving] = useState(false);

  // Bulk add modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkCategory, setBulkCategory] = useState('scope');
  const [bulkSaving, setBulkSaving] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  const fetchKeywords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/keywords');
      setKeywords(res.data.items || res.data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load keywords';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeywords();
  }, [fetchKeywords]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const includeKeywords = keywords.filter((k) => k.category !== 'exclude');
  const excludeKeywords = keywords.filter((k) => k.category === 'exclude');
  const displayedKeywords = activeTab === 'include' ? includeKeywords : excludeKeywords;

  const openAddModal = () => {
    setEditingKeyword(null);
    setFormData({ keyword: '', category: activeTab === 'exclude' ? 'exclude' : 'scope', priority: 3 });
    setShowModal(true);
  };

  const openEditModal = (kw: KeywordItem) => {
    setEditingKeyword(kw);
    setFormData({ keyword: kw.keyword, category: kw.category, priority: kw.priority || 3 });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.keyword.trim()) return;
    try {
      setSaving(true);
      if (editingKeyword) {
        await api.patch(`/keywords/${editingKeyword.id}`, {
          keyword: formData.keyword,
          category: formData.category,
          priority: formData.priority,
        });
        setToast('Keyword updated');
      } else {
        await api.post('/keywords', {
          keyword: formData.keyword,
          category: formData.category,
          priority: formData.priority,
        });
        setToast('Keyword created');
      }
      setShowModal(false);
      fetchKeywords();
    } catch {
      // handled by interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleBulkAdd = async () => {
    const words = bulkText.split(',').map((w) => w.trim()).filter(Boolean);
    if (words.length === 0) return;
    try {
      setBulkSaving(true);
      await api.post('/keywords/bulk', {
        keywords: words.map((w) => ({ keyword: w, category: bulkCategory })),
      });
      setToast(`${words.length} keywords added`);
      setShowBulkModal(false);
      setBulkText('');
      fetchKeywords();
    } catch {
      // handled by interceptor
    } finally {
      setBulkSaving(false);
    }
  };

  const handleDelete = async (kw: KeywordItem) => {
    if (!confirm(`Delete keyword "${kw.keyword}"?`)) return;
    try {
      await api.delete(`/keywords/${kw.id}`);
      setKeywords((prev) => prev.filter((k) => k.id !== kw.id));
      setToast('Keyword deleted');
    } catch {
      // handled by interceptor
    }
  };

  const getPriorityBadge = (priority: number) => {
    if (priority >= 4) return <Badge variant="danger">{priority}</Badge>;
    if (priority >= 3) return <Badge variant="warning">{priority}</Badge>;
    return <Badge variant="default">{priority}</Badge>;
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
            <p className="eyebrow mb-1">
              Admiralty &middot; 06 &middot; {includeKeywords.length} include &middot; {excludeKeywords.length} exclude
            </p>
            <h2 className="font-display text-[26px] font-normal tracking-[-0.02em] text-ink">
              The filter book.
            </h2>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowBulkModal(true)} variant="outline" size="md">
              <Upload className="h-4 w-4" />
              Bulk Add
            </Button>
            <Button onClick={openAddModal} variant="primary" size="md">
              <Plus className="h-4 w-4" />
              Add Keyword
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-rule">
          <nav className="flex gap-6">
            <button
              onClick={() => setActiveTab('include')}
              className={`border-b-2 pb-3 pt-1 text-sm font-medium transition-colors ${
                activeTab === 'include'
                  ? 'border-blue-600 text-navy'
                  : 'border-transparent text-ink-muted hover:border-rule-strong hover:text-ink-soft'
              }`}
            >
              Include Keywords ({includeKeywords.length})
            </button>
            <button
              onClick={() => setActiveTab('exclude')}
              className={`border-b-2 pb-3 pt-1 text-sm font-medium transition-colors ${
                activeTab === 'exclude'
                  ? 'border-blue-600 text-navy'
                  : 'border-transparent text-ink-muted hover:border-rule-strong hover:text-ink-soft'
              }`}
            >
              Exclude Keywords ({excludeKeywords.length})
            </button>
          </nav>
        </div>

        {/* Keyword list */}
        <div className="doc">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-navy" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertTriangle className="mb-3 h-10 w-10 text-signal" />
              <p className="text-sm text-ink-soft">{error}</p>
              <Button onClick={fetchKeywords} variant="outline" size="sm" className="mt-3">
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : displayedKeywords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Tag className="mb-3 h-10 w-10 text-ink-muted/60" />
              <p className="text-sm font-medium text-ink-soft">No {activeTab} keywords</p>
              <p className="mt-1 text-sm text-ink-muted">Add keywords to filter tenders</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-rule-soft bg-paper-tint/60">
                    <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Keyword</th>
                    <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Category</th>
                    <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Priority</th>
                    <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Matches</th>
                    <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Created</th>
                    <th className="px-6 py-3 text-right font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule-soft">
                  {displayedKeywords.map((kw) => (
                    <tr key={kw.id} className="hover:bg-paper-tint/60 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-ink">{kw.keyword}</td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <Badge variant={kw.category === 'exclude' ? 'danger' : 'info'}>
                          {kw.category}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">{getPriorityBadge(kw.priority)}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-ink-soft">{kw.match_count}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-ink-soft">{formatDate(kw.created_at)}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditModal(kw)} title="Edit" className="rounded-lg p-1.5 text-ink-muted hover:bg-paper-tint hover:text-ink-soft">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(kw)} title="Delete" className="rounded-lg p-1.5 text-ink-muted hover:bg-signal/5 hover:text-signal">
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

      {/* Add/Edit Keyword Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingKeyword ? 'Edit Keyword' : 'Add Keyword'}>
        <div className="space-y-4">
          <div>
            <label className="eyebrow mb-2 block">Word / Phrase *</label>
            <Input
              value={formData.keyword}
              onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
              placeholder="Enter keyword or phrase"
            />
          </div>
          <div>
            <label className="eyebrow mb-2 block">Category *</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="block w-full rounded-lg border border-rule-strong bg-canvas px-3 py-2 text-sm focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="eyebrow mb-2 block">Priority (1-5)</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={5}
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
                className="flex-1"
              />
              <span className="w-8 text-center text-sm font-medium text-ink-soft">{formData.priority}</span>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!formData.keyword.trim()}>
              {editingKeyword ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Add Modal */}
      <Modal isOpen={showBulkModal} onClose={() => setShowBulkModal(false)} title="Bulk Add Keywords" size="lg">
        <div className="space-y-4">
          <div>
            <label className="eyebrow mb-2 block">Category</label>
            <select
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
              className="block w-full rounded-lg border border-rule-strong bg-canvas px-3 py-2 text-sm focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="eyebrow mb-2 block">Keywords (comma-separated)</label>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={6}
              placeholder="keyword1, keyword2, keyword3..."
              className="block w-full rounded-lg border border-rule-strong bg-canvas px-3 py-2 text-sm focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink"
            />
            <p className="mt-1 text-xs text-ink-muted">
              {bulkText.split(',').map((w) => w.trim()).filter(Boolean).length} keywords detected
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowBulkModal(false)}>Cancel</Button>
            <Button onClick={handleBulkAdd} loading={bulkSaving} disabled={!bulkText.trim()}>
              <Upload className="h-4 w-4" />
              Add All
            </Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
