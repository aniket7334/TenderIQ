'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  FileCode,
  AlertTriangle,
  RefreshCw,
  X,
  CheckCircle,
  Star,
  Upload,
  Eye,
  Calendar,
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

interface TemplateItem {
  id: string;
  name: string;
  description: string | null;
  template_type: string;
  is_default: boolean;
  placeholders: { detected?: string[] } | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface PlaceholderInfo {
  field_name: string;
  display_name: string;
  sample_value: string;
}

export default function TemplatesPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const hydrated = useHydrated();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadIsDefault, setUploadIsDefault] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Placeholders modal
  const [showPlaceholdersModal, setShowPlaceholdersModal] = useState(false);
  const [placeholders, setPlaceholders] = useState<PlaceholderInfo[]>([]);
  const [loadingPlaceholders, setLoadingPlaceholders] = useState(false);
  const [placeholderTemplateName, setPlaceholderTemplateName] = useState('');

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/templates');
      setTemplates(res.data.items || res.data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load templates';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleUpload = async () => {
    if (!uploadFile) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', uploadFile);

      // Upload the file first
      const res = await api.post('/templates/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Then update name/description if provided
      const templateId = res.data.id;
      if (uploadName || uploadDescription || uploadIsDefault) {
        const updatePayload: Record<string, unknown> = {};
        if (uploadName) updatePayload.name = uploadName;
        if (uploadDescription) updatePayload.description = uploadDescription;
        if (uploadIsDefault) updatePayload.is_default = true;
        await api.patch(`/templates/${templateId}`, updatePayload);
      }

      setToast('Template uploaded successfully');
      setShowUploadModal(false);
      setUploadName('');
      setUploadDescription('');
      setUploadFile(null);
      setUploadIsDefault(false);
      fetchTemplates();
    } catch {
      // handled by interceptor
    } finally {
      setUploading(false);
    }
  };

  const openEditModal = (template: TemplateItem) => {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditDescription(template.description || '');
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    if (!editingTemplate) return;
    try {
      setEditSaving(true);
      await api.patch(`/templates/${editingTemplate.id}`, {
        name: editName,
        description: editDescription,
      });
      setToast('Template updated');
      setShowEditModal(false);
      fetchTemplates();
    } catch {
      // handled by interceptor
    } finally {
      setEditSaving(false);
    }
  };

  const handleSetDefault = async (templateId: string) => {
    try {
      await api.patch(`/templates/${templateId}`, { is_default: true });
      setTemplates((prev) => prev.map((t) => ({ ...t, is_default: t.id === templateId })));
      setToast('Default template updated');
    } catch {
      // handled by interceptor
    }
  };

  const handleDelete = async (template: TemplateItem) => {
    if (!confirm(`Delete template "${template.name}"?`)) return;
    try {
      await api.delete(`/templates/${template.id}`);
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
      setToast('Template deleted');
    } catch {
      // handled by interceptor
    }
  };

  const viewPlaceholders = async (template: TemplateItem) => {
    setPlaceholderTemplateName(template.name);
    setShowPlaceholdersModal(true);
    setLoadingPlaceholders(true);
    try {
      const res = await api.get(`/templates/${template.id}/placeholders`);
      setPlaceholders(res.data.items || res.data || []);
    } catch {
      setPlaceholders([]);
    } finally {
      setLoadingPlaceholders(false);
    }
  };

  const getPlaceholderCount = (template: TemplateItem) => {
    return template.placeholders?.detected?.length || 0;
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
            <p className="eyebrow mb-1">Admiralty &middot; 07 &middot; {templates.length.toLocaleString('en-IN')} templates</p>
            <h2 className="font-display text-[26px] font-normal tracking-[-0.02em] text-ink">
              Brief templates.
            </h2>
          </div>
          <Button onClick={() => setShowUploadModal(true)} variant="primary" size="md">
            <Upload className="h-4 w-4" />
            Upload Template
          </Button>
        </div>

        {/* Template grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-navy" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertTriangle className="mb-3 h-10 w-10 text-signal" />
            <p className="text-sm text-ink-soft">{error}</p>
            <Button onClick={fetchTemplates} variant="outline" size="sm" className="mt-3">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileCode className="mb-3 h-10 w-10 text-ink-muted/60" />
            <p className="text-sm font-medium text-ink-soft">No templates uploaded</p>
            <p className="mt-1 text-sm text-ink-muted">Upload a .docx template to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <div key={template.id} className="doc p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode className="h-5 w-5 text-navy" />
                    <h3 className="text-sm font-semibold text-ink">{template.name}</h3>
                  </div>
                  {template.is_default && (
                    <Badge variant="warning">
                      <Star className="mr-1 h-3 w-3" />
                      Default
                    </Badge>
                  )}
                </div>

                {template.description && (
                  <p className="mt-2 text-sm text-ink-soft line-clamp-2">{template.description}</p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  <span className="flex items-center gap-1">
                    <FileCode className="h-3 w-3" />
                    {getPlaceholderCount(template)} placeholders
                  </span>
                  <span>&middot;</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(template.created_at)}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-1 border-t border-rule-soft pt-3">
                  <button
                    onClick={() => viewPlaceholders(template)}
                    title="View Placeholders"
                    className="rounded-lg p-1.5 text-ink-muted hover:bg-paper-tint hover:text-ink-soft"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  {!template.is_default && (
                    <button
                      onClick={() => handleSetDefault(template.id)}
                      title="Set as Default"
                      className="rounded-lg p-1.5 text-ink-muted hover:bg-amber/10 hover:text-amber"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => openEditModal(template)}
                    title="Edit"
                    className="rounded-lg p-1.5 text-ink-muted hover:bg-paper-tint hover:text-ink-soft"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(template)}
                    title="Delete"
                    className="rounded-lg p-1.5 text-ink-muted hover:bg-signal/5 hover:text-signal"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Template Modal */}
      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} title="Upload Template" size="lg">
        <div className="space-y-4">
          <div>
            <label className="eyebrow mb-2 block">Name</label>
            <Input value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="Template name (optional, defaults to filename)" />
          </div>
          <div>
            <label className="eyebrow mb-2 block">Description</label>
            <textarea
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              rows={3}
              placeholder="Brief description of the template..."
              className="block w-full rounded-lg border border-rule-strong bg-canvas px-3 py-2 text-sm focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink"
            />
          </div>
          <div>
            <label className="eyebrow mb-2 block">Template File (.docx) *</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-ink-soft file:mr-4 file:rounded-lg file:border-0 file:bg-canvas-tint file:px-4 file:py-2 file:text-sm file:font-medium file:text-navy hover:file:bg-canvas-tint"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_default"
              checked={uploadIsDefault}
              onChange={(e) => setUploadIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-rule-strong text-navy focus:ring-ink"
            />
            <label htmlFor="is_default" className="text-sm font-medium text-ink-soft">Set as default template</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowUploadModal(false)}>Cancel</Button>
            <Button onClick={handleUpload} loading={uploading} disabled={!uploadFile}>
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Template Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Template">
        <div className="space-y-4">
          <div>
            <label className="eyebrow mb-2 block">Name</label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Template name" />
          </div>
          <div>
            <label className="eyebrow mb-2 block">Description</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
              placeholder="Brief description..."
              className="block w-full rounded-lg border border-rule-strong bg-canvas px-3 py-2 text-sm focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={handleEditSave} loading={editSaving}>Update</Button>
          </div>
        </div>
      </Modal>

      {/* Placeholders Modal */}
      <Modal isOpen={showPlaceholdersModal} onClose={() => setShowPlaceholdersModal(false)} title={`Placeholders - ${placeholderTemplateName}`} size="lg">
        {loadingPlaceholders ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-navy" />
          </div>
        ) : placeholders.length === 0 ? (
          <div className="py-10 text-center text-sm text-ink-muted">No placeholders detected in this template</div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-rule-soft bg-paper-tint/60">
                  <th className="px-4 py-2 text-left text-xs font-medium text-ink-muted">Placeholder</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-ink-muted">Display Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-ink-muted">Maps To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule-soft">
                {placeholders.map((p) => (
                  <tr key={p.field_name}>
                    <td className="px-4 py-2 text-sm font-mono text-navy">{`{{${p.field_name}}}`}</td>
                    <td className="px-4 py-2 text-sm text-ink-soft">{p.display_name}</td>
                    <td className="px-4 py-2 text-xs text-ink-muted">{p.sample_value}</td>
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
