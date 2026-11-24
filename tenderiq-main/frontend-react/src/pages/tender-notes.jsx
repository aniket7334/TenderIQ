import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  FileDown,
  Eye,
  Edit,
  X,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';

export default function TenderNotesPage() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Generate modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [tenders, setTenders] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTender, setSelectedTender] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(null);

  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, page_size: pageSize };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/tender-notes', { params });
      setNotes(res.data.items || []);
      setTotal(res.data.total);
      setTotalPages(res.data.total_pages);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load tender notes';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const openGenerateModal = async () => {
    setShowGenerateModal(true);
    try {
      const [tendersRes, templatesRes] = await Promise.allSettled([
        api.get('/tenders', { params: { page_size: 100 } }),
        api.get('/templates'),
      ]);
      if (tendersRes.status === 'fulfilled') {
        setTenders(tendersRes.value.data.items || tendersRes.value.data || []);
      }
      if (templatesRes.status === 'fulfilled') {
        setTemplates(templatesRes.value.data.items || templatesRes.value.data || []);
      }
    } catch {
      // non-critical
    }
  };

  const handleGenerate = async () => {
    if (!selectedTender) return;
    try {
      setGenerating(true);
      const payload = { tender_id: selectedTender };
      if (selectedTemplate) payload.template_id = selectedTemplate;
      const res = await api.post('/tender-notes/generate', payload);
      const note = res.data;
      setShowGenerateModal(false);
      setSelectedTender('');
      setSelectedTemplate('');
      if (note?.id) {
        navigate(`/tender-notes/${note.id}`);
      } else {
        fetchNotes();
      }
    } catch {
      // handled by interceptor
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async (noteId, format) => {
    try {
      setExporting(`${noteId}-${format}`);
      const res = await api.get(`/tender-notes/${noteId}/export`, {
        params: { format },
        responseType: 'blob',
      });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const ext = format === 'word' ? 'docx' : 'pdf';
      link.href = url;
      link.download = `tender-note-${noteId}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      // handled by interceptor
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Tender Notes</h1>
            <p className="mt-1 text-sm text-gray-500">{total} notes found</p>
          </div>
          <Button onClick={openGenerateModal} variant="primary" size="md" className="self-start sm:self-auto">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Generate Note</span>
            <span className="sm:hidden">Generate</span>
          </Button>
        </div>

        {/* Search and filter bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Input
              placeholder="Search by tender title..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              leftIcon={<Search className="h-4 w-4" />}
              rightIcon={
                search ? (
                  <button onClick={() => { setSearch(''); setPage(1); }} className="pointer-events-auto cursor-pointer">
                    <X className="h-4 w-4" />
                  </button>
                ) : undefined
              }
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="block rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="final">Final</option>
          </select>
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
              <Button onClick={fetchNotes} variant="outline" size="sm" className="mt-3">
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileText className="mb-3 h-10 w-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">No tender notes found</p>
              <p className="mt-1 text-sm text-gray-400">Generate a note to get started</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">Tender Title</th>
                      <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Template Used</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">Status</th>
                      <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Created By</th>
                      <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Created Date</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {notes.map((note) => (
                      <tr
                        key={note.id}
                        className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/tender-notes/${note.id}`)}
                      >
                        <td className="max-w-[160px] sm:max-w-xs truncate px-4 py-4 text-sm font-medium text-gray-900 sm:px-6">
                          {note.tender_title || note.title}
                        </td>
                        <td className="hidden lg:table-cell whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                          {note.template_name || '-'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                          <Badge variant={note.status === 'final' ? 'success' : 'warning'}>
                            <span className="flex items-center gap-1">
                              {note.status === 'final' ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                              {note.status === 'final' ? 'Final' : 'Draft'}
                            </span>
                          </Badge>
                        </td>
                        <td className="hidden md:table-cell whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                          {note.created_by_name}
                        </td>
                        <td className="hidden sm:table-cell whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                          {formatDate(note.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right sm:px-6">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/tender-notes/${note.id}`); }}
                              title="View"
                              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/tender-notes/${note.id}`); }}
                              title="Edit"
                              className="hidden sm:inline-flex rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleExport(note.id, 'pdf'); }}
                              title="Download PDF"
                              className="hidden sm:inline-flex rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                              disabled={exporting === `${note.id}-pdf`}
                            >
                              {exporting === `${note.id}-pdf` ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleExport(note.id, 'word'); }}
                              title="Download Word"
                              className="hidden sm:inline-flex rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                              disabled={exporting === `${note.id}-word`}
                            >
                              {exporting === `${note.id}-word` ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p className="text-xs text-gray-500 sm:text-sm">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} notes
                </p>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </Button>
                  <span className="text-xs text-gray-600 sm:text-sm">Page {page} of {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Generate Note Modal */}
      <Modal isOpen={showGenerateModal} onClose={() => setShowGenerateModal(false)} title="Generate Tender Note" size="lg">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Select Tender *</label>
            <select
              value={selectedTender}
              onChange={(e) => setSelectedTender(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">Choose a tender...</option>
              {tenders.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Template (optional)</label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">Default template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowGenerateModal(false)}>Cancel</Button>
            <Button onClick={handleGenerate} loading={generating} disabled={!selectedTender}>
              <Sparkles className="h-4 w-4" />
              Generate
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
