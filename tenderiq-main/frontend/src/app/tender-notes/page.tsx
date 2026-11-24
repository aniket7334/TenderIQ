'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Filter,
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
import AppLayout from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { PaginatedResponse, Tender } from '@/lib/types';

interface TenderNoteListItem {
  id: number;
  tender_id: number;
  title: string;
  status: 'draft' | 'final';
  tender_title: string;
  template_name: string | null;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
}

export default function TenderNotesPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<TenderNoteListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Generate modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTender, setSelectedTender] = useState<number | ''>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string | number> = { page, page_size: pageSize };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get<PaginatedResponse<TenderNoteListItem>>('/tender-notes', { params });
      setNotes(res.data.items || []);
      setTotal(res.data.total);
      setTotalPages(res.data.total_pages);
    } catch (err: unknown) {
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
      const payload: Record<string, unknown> = { tender_id: Number(selectedTender) };
      if (selectedTemplate) payload.template_id = selectedTemplate;
      const res = await api.post('/tender-notes/generate', payload);
      const note = res.data;
      setShowGenerateModal(false);
      setSelectedTender('');
      setSelectedTemplate('');
      if (note?.id) {
        router.push(`/tender-notes/${note.id}`);
      } else {
        fetchNotes();
      }
    } catch {
      // handled by interceptor
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async (noteId: number, format: 'pdf' | 'word') => {
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
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-4 adm-rise">
          <div>
            <p className="eyebrow mb-1">Journal &middot; {total.toLocaleString('en-IN')} notes</p>
            <h2 className="font-display text-[26px] font-normal tracking-[-0.02em] text-ink">
              Qualification briefs.
            </h2>
          </div>
          <Button onClick={openGenerateModal} variant="primary">
            <Sparkles className="h-4 w-4" />
            Draft a new brief
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
            className="block border-0 border-b border-rule-strong bg-transparent py-2 pr-6 text-[13.5px] text-ink focus:border-ink focus:outline-none focus:ring-0"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="final">Final</option>
          </select>
        </div>

        {/* Data table */}
        <div className="doc">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-ink-soft" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertTriangle className="mb-3 h-10 w-10 text-signal" />
              <p className="text-sm text-ink-soft">{error}</p>
              <Button onClick={fetchNotes} variant="outline" size="sm" className="mt-3">
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileText className="mb-3 h-10 w-10 text-ink-muted/60" />
              <p className="text-sm font-medium text-ink-soft">No tender notes found</p>
              <p className="mt-1 text-sm text-ink-muted">Generate a note to get started</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-rule-soft bg-paper-tint/60">
                      <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Tender Title</th>
                      <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Template Used</th>
                      <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Status</th>
                      <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Created By</th>
                      <th className="px-6 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Created Date</th>
                      <th className="px-6 py-3 text-right font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule-soft">
                    {notes.map((note) => (
                      <tr
                        key={note.id}
                        className="hover:bg-canvas-tint transition-colors cursor-pointer"
                        onClick={() => router.push(`/tender-notes/${note.id}`)}
                      >
                        <td className="max-w-xs truncate px-6 py-4 text-sm font-medium text-ink">
                          {note.tender_title || note.title}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-ink-soft">
                          {note.template_name || '-'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <Badge variant={note.status === 'final' ? 'success' : 'warning'}>
                            <span className="flex items-center gap-1">
                              {note.status === 'final' ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                              {note.status === 'final' ? 'Final' : 'Draft'}
                            </span>
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-ink-soft">
                          {note.created_by_name}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-ink-soft">
                          {formatDate(note.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); router.push(`/tender-notes/${note.id}`); }}
                              title="View"
                              className="p-1.5 text-ink-muted transition-colors hover:text-ink"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); router.push(`/tender-notes/${note.id}`); }}
                              title="Edit"
                              className="p-1.5 text-ink-muted transition-colors hover:text-ink"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleExport(note.id, 'pdf'); }}
                              title="Download PDF"
                              className="p-1.5 text-ink-muted transition-colors hover:text-ink"
                              disabled={exporting === `${note.id}-pdf`}
                            >
                              {exporting === `${note.id}-pdf` ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleExport(note.id, 'word'); }}
                              title="Download Word"
                              className="p-1.5 text-ink-muted transition-colors hover:text-ink"
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
              <div className="flex items-center justify-between border-t border-rule px-6 py-4">
                <p className="text-sm text-ink-muted">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} notes
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

      {/* Generate Note Modal */}
      <Modal isOpen={showGenerateModal} onClose={() => setShowGenerateModal(false)} title="Generate Tender Note" size="lg">
        <div className="space-y-4">
          <div>
            <label className="eyebrow mb-2 block">Select Tender *</label>
            <select
              value={selectedTender}
              onChange={(e) => setSelectedTender(e.target.value ? Number(e.target.value) : '')}
              className="block w-full border-0 border-b border-rule-strong bg-transparent py-2 text-[13.5px] text-ink focus:border-ink focus:outline-none focus:ring-0"
            >
              <option value="">Choose a tender...</option>
              {tenders.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="eyebrow mb-2 block">Template (optional)</label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="block w-full border-0 border-b border-rule-strong bg-transparent py-2 text-[13.5px] text-ink focus:border-ink focus:outline-none focus:ring-0"
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
    </AppLayout>
  );
}
