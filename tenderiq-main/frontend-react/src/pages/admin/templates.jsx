import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import useAuth from '@/hooks/useAuth';

export default function TemplatesPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const fileInputRef = useRef(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadIsDefault, setUploadIsDefault] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Placeholders modal
  const [showPlaceholdersModal, setShowPlaceholdersModal] = useState(false);
  const [placeholders, setPlaceholders] = useState([]);
  const [loadingPlaceholders, setLoadingPlaceholders] = useState(false);
  const [placeholderTemplateName, setPlaceholderTemplateName] = useState('');

  // Toast
  const [toast, setToast] = useState(null);

  const isAdmin = user?.role === 'admin' || authLoading;

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/templates');
      setTemplates(res.data.items || res.data || []);
    } catch (err) {
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
        const updatePayload = {};
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

  const openEditModal = (template) => {
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

  const handleSetDefault = async (templateId) => {
    try {
      await api.patch(`/templates/${templateId}`, { is_default: true });
      setTemplates((prev) => prev.map((t) => ({ ...t, is_default: t.id === templateId })));
      setToast('Default template updated');
    } catch {
      // handled by interceptor
    }
  };

  const handleDelete = async (template) => {
    if (!confirm(`Delete template "${template.name}"?`)) return;
    try {
      await api.post(`/templates/${template.id}/delete`);
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
      setToast('Template deleted');
    } catch {
      // handled by interceptor
    }
  };

  const viewPlaceholders = async (template) => {
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

  const getPlaceholderCount = (template) => {
    return template.placeholders?.detected?.length || 0;
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
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Template Management</h1>
            <p className="mt-1 text-sm text-gray-500">{templates.length} templates</p>
          </div>
          <Button onClick={() => setShowUploadModal(true)} variant="primary" size="md" className="self-start sm:self-auto">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Upload Template</span>
            <span className="sm:hidden">Upload</span>
          </Button>
        </div>

        {/* Template grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertTriangle className="mb-3 h-10 w-10 text-red-500" />
            <p className="text-sm text-gray-600">{error}</p>
            <Button onClick={fetchTemplates} variant="outline" size="sm" className="mt-3">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileCode className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">No templates uploaded</p>
            <p className="mt-1 text-sm text-gray-400">Upload a .docx template to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <div key={template.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode className="h-5 w-5 text-blue-500" />
                    <h3 className="text-sm font-semibold text-gray-900">{template.name}</h3>
                  </div>
                  {template.is_default && (
                    <Badge variant="warning">
                      <Star className="mr-1 h-3 w-3" />
                      Default
                    </Badge>
                  )}
                </div>

                {template.description && (
                  <p className="mt-2 text-sm text-gray-600 line-clamp-2">{template.description}</p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-400">
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

                <div className="mt-4 flex items-center gap-1 border-t border-gray-100 pt-3">
                  <button
                    onClick={() => viewPlaceholders(template)}
                    title="View Placeholders"
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  {!template.is_default && (
                    <button
                      onClick={() => handleSetDefault(template.id)}
                      title="Set as Default"
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-500"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => openEditModal(template)}
                    title="Edit"
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(template)}
                    title="Delete"
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
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
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Name</label>
            <Input value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="Template name (optional, defaults to filename)" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              rows={3}
              placeholder="Brief description of the template..."
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Template File (.docx) *</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_default"
              checked={uploadIsDefault}
              onChange={(e) => setUploadIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is_default" className="text-sm font-medium text-gray-700">Set as default template</label>
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
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Name</label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Template name" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
              placeholder="Brief description..."
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : placeholders.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">No placeholders detected in this template</div>
        ) : (
          <div className="max-h-96 overflow-auto">
            <table className="w-full min-w-[420px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Placeholder</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Display Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Maps To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {placeholders.map((p) => (
                  <tr key={p.field_name}>
                    <td className="px-4 py-2 text-sm font-mono text-blue-600">{`{{${p.field_name}}}`}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{p.display_name}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{p.sample_value}</td>
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
