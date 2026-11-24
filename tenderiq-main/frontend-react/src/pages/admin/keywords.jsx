import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import useAuth from '@/hooks/useAuth';

const CATEGORIES = [
  { value: 'scope', label: 'Scope' },
  { value: 'sector', label: 'Sector' },
  { value: 'service', label: 'Service' },
  { value: 'location', label: 'Location' },
  { value: 'exclude', label: 'Exclude' },
];

export default function KeywordsPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('include');

  // Form modal
  const [showModal, setShowModal] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState(null);
  const [formData, setFormData] = useState({ keyword: '', category: 'scope', priority: 3 });
  const [saving, setSaving] = useState(false);

  // Bulk add modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkCategory, setBulkCategory] = useState('scope');
  const [bulkSaving, setBulkSaving] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);

  const isAdmin = user?.role === 'admin' || authLoading;

  const fetchKeywords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/keywords');
      setKeywords(res.data.items || res.data || []);
    } catch (err) {
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

  const openEditModal = (kw) => {
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

  const handleDelete = async (kw) => {
    if (!confirm(`Delete keyword "${kw.keyword}"?`)) return;
    try {
      await api.post(`/keywords/${kw.id}/delete`);
      setKeywords((prev) => prev.filter((k) => k.id !== kw.id));
      setToast('Keyword deleted');
    } catch {
      // handled by interceptor
    }
  };

  const getPriorityBadge = (priority) => {
    if (priority >= 4) return <Badge variant="danger">{priority}</Badge>;
    if (priority >= 3) return <Badge variant="warning">{priority}</Badge>;
    return <Badge variant="default">{priority}</Badge>;
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
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Keyword Management</h1>
            <p className="mt-1 text-sm text-gray-500">
              {includeKeywords.length} include keywords, {excludeKeywords.length} exclude keywords
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowBulkModal(true)} variant="outline" size="md">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Bulk Add</span>
              <span className="sm:hidden">Bulk</span>
            </Button>
            <Button onClick={openAddModal} variant="primary" size="md">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Keyword</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-6">
            <button
              onClick={() => setActiveTab('include')}
              className={`border-b-2 pb-3 pt-1 text-sm font-medium transition-colors ${
                activeTab === 'include'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              Include Keywords ({includeKeywords.length})
            </button>
            <button
              onClick={() => setActiveTab('exclude')}
              className={`border-b-2 pb-3 pt-1 text-sm font-medium transition-colors ${
                activeTab === 'exclude'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              Exclude Keywords ({excludeKeywords.length})
            </button>
          </nav>
        </div>

        {/* Keyword list */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertTriangle className="mb-3 h-10 w-10 text-red-500" />
              <p className="text-sm text-gray-600">{error}</p>
              <Button onClick={fetchKeywords} variant="outline" size="sm" className="mt-3">
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : displayedKeywords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Tag className="mb-3 h-10 w-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">No {activeTab} keywords</p>
              <p className="mt-1 text-sm text-gray-400">Add keywords to filter tenders</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">Keyword</th>
                    <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">Priority</th>
                    <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Created</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayedKeywords.map((kw) => (
                    <tr key={kw.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-4 text-sm font-medium text-gray-900 sm:px-6">
                        <span className="line-clamp-2 sm:line-clamp-none">{kw.keyword}</span>
                      </td>
                      <td className="hidden sm:table-cell whitespace-nowrap px-6 py-4">
                        <Badge variant={kw.category === 'exclude' ? 'danger' : 'info'}>
                          {kw.category}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 sm:px-6">{getPriorityBadge(kw.priority)}</td>
                      <td className="hidden md:table-cell whitespace-nowrap px-6 py-4 text-sm text-gray-600">{formatDate(kw.created_at)}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-right sm:px-6">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditModal(kw)} title="Edit" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(kw)} title="Delete" className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500">
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
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Word / Phrase *</label>
            <Input
              value={formData.keyword}
              onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
              placeholder="Enter keyword or phrase"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Category *</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Priority (1-5)</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={5}
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
                className="flex-1"
              />
              <span className="w-8 text-center text-sm font-medium text-gray-700">{formData.priority}</span>
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
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Category</label>
            <select
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Keywords (comma-separated)</label>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={6}
              placeholder="keyword1, keyword2, keyword3..."
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <p className="mt-1 text-xs text-gray-400">
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
    </>
  );
}
