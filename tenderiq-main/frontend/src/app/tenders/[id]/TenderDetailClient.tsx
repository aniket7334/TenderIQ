'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Star,
  Download,
  FileText,
  MessageSquare,
  History,
  Eye,
  Loader2,
  AlertTriangle,
  RefreshCw,
  X,
  Plus,
  Send,
  Sparkles,
  ExternalLink,
  Calendar,
  MapPin,
  Building2,
  IndianRupee,
  Tag,
  User as UserIcon,
  Clock,
} from 'lucide-react';
import AppLayout from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';
import { formatCurrency, formatDate, formatCountdown, getStatusColor, getStatusLabel } from '@/lib/utils';
import type { Tender, TenderDocument, TenderNote, AuditLog, User } from '@/lib/types';

type TabType = 'overview' | 'documents' | 'notes' | 'history';

interface Comment {
  id: number;
  content: string;
  created_by_name: string;
  created_at: string;
}

export default function TenderDetailClient() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [tender, setTender] = useState<Tender | null>(null);
  const [documents, setDocuments] = useState<TenderDocument[]>([]);
  const [notes, setNotes] = useState<TenderNote[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [newTag, setNewTag] = useState('');
  const [newComment, setNewComment] = useState('');
  const [generatingNote, setGeneratingNote] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchTender = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [tenderRes, docsRes, notesRes, logsRes, commentsRes, usersRes] = await Promise.allSettled([
        api.get(`/tenders/${id}`),
        api.get(`/tenders/${id}/documents`),
        api.get(`/tenders/${id}/notes`),
        api.get(`/audit-logs`, { params: { entity_type: 'tender', entity_id: id, page_size: 50 } }),
        api.get(`/tenders/${id}/comments`),
        api.get('/users'),
      ]);

      if (tenderRes.status === 'fulfilled') setTender(tenderRes.value.data);
      else throw new Error('Failed to load tender');

      if (docsRes.status === 'fulfilled') setDocuments(docsRes.value.data.items || docsRes.value.data || []);
      if (notesRes.status === 'fulfilled') setNotes(notesRes.value.data.items || notesRes.value.data || []);
      if (logsRes.status === 'fulfilled') setAuditLogs(logsRes.value.data.items || logsRes.value.data || []);
      if (commentsRes.status === 'fulfilled') setComments(commentsRes.value.data.items || commentsRes.value.data || []);
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data.items || usersRes.value.data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load tender details';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchTender();
  }, [id, fetchTender]);

  const handleShortlist = async () => {
    if (!tender) return;
    try {
      const newStatus = tender.internal_status === 'interested' ? 'new' : 'interested';
      await api.patch(`/tenders/${id}`, { internal_status: newStatus });
      setTender((prev) => (prev ? { ...prev, internal_status: newStatus } : prev));
    } catch {
      // handled by interceptor
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim() || !tender) return;
    try {
      const updatedTags = [...tender.tags, newTag.trim()];
      await api.patch(`/tenders/${id}`, { tags: updatedTags });
      setTender((prev) => (prev ? { ...prev, tags: updatedTags } : prev));
      setNewTag('');
    } catch {
      // handled by interceptor
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!tender) return;
    try {
      const updatedTags = tender.tags.filter((t) => t !== tagToRemove);
      await api.patch(`/tenders/${id}`, { tags: updatedTags });
      setTender((prev) => (prev ? { ...prev, tags: updatedTags } : prev));
    } catch {
      // handled by interceptor
    }
  };

  const handleAssignOwner = async (userId: number | null) => {
    try {
      await api.patch(`/tenders/${id}`, { assigned_to: userId });
      setTender((prev) =>
        prev
          ? {
              ...prev,
              assigned_to: userId,
              assigned_to_name: users.find((u) => u.id === userId)?.full_name || null,
            }
          : prev,
      );
    } catch {
      // handled by interceptor
    }
  };

  const handleGenerateNote = async () => {
    try {
      setGeneratingNote(true);
      const res = await api.post(`/tender-notes/generate`, { tender_id: Number(id) });
      const note = res.data;
      if (note?.id) {
        router.push(`/tender-notes/${note.id}`);
      } else {
        await fetchTender();
      }
    } catch {
      // handled by interceptor
    } finally {
      setGeneratingNote(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      setSubmittingComment(true);
      await api.post(`/tenders/${id}/comments`, { content: newComment.trim() });
      setNewComment('');
      const res = await api.get(`/tenders/${id}/comments`);
      setComments(res.data.items || res.data || []);
    } catch {
      // handled by interceptor
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-navy" />
        </div>
      </AppLayout>
    );
  }

  if (error || !tender) {
    return (
      <AppLayout>
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <AlertTriangle className="h-10 w-10 text-signal" />
          <p className="text-lg font-medium text-ink">Tender not found</p>
          <p className="text-sm text-ink-muted">{error}</p>
          <div className="flex gap-2">
            <Button onClick={() => router.push('/tenders')} variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back to Tenders
            </Button>
            <Button onClick={fetchTender} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const tabs: { key: TabType; label: string; icon: React.ElementType }[] = [
    { key: 'overview', label: 'Overview', icon: Eye },
    { key: 'documents', label: `Documents (${documents.length})`, icon: FileText },
    { key: 'notes', label: `Notes (${notes.length})`, icon: MessageSquare },
    { key: 'history', label: 'History', icon: History },
  ];

  const detailFields: { label: string; value: string | number | null | undefined; icon?: React.ElementType }[] = [
    { label: 'Name of Work', value: tender.title },
    { label: 'Reference Number', value: tender.reference_number },
    { label: 'Client / Organization', value: tender.organization, icon: Building2 },
    { label: 'Department', value: tender.department },
    { label: 'Category', value: tender.category },
    { label: 'Sub-Category', value: tender.subcategory },
    { label: 'Tender Type', value: tender.tender_type },
    { label: 'Location', value: [tender.city, tender.state, tender.location].filter(Boolean).join(', ') || null, icon: MapPin },
    { label: 'Estimated Cost', value: tender.estimated_value ? formatCurrency(tender.estimated_value) : null, icon: IndianRupee },
    { label: 'EMD Amount', value: tender.emd_amount ? formatCurrency(tender.emd_amount) : null },
    { label: 'Tender Fee', value: tender.tender_fee ? formatCurrency(tender.tender_fee) : null },
    { label: 'Currency', value: tender.currency },
    { label: 'Published Date', value: formatDate(tender.published_date), icon: Calendar },
    { label: 'Submission Deadline', value: formatDate(tender.submission_deadline), icon: Clock },
    { label: 'Opening Date', value: formatDate(tender.opening_date) },
    { label: 'Closing Date', value: formatDate(tender.closing_date) },
    { label: 'Eligibility / Scope', value: tender.eligibility_criteria },
    { label: 'Source', value: tender.source_name },
    { label: 'Source URL', value: tender.source_url },
    { label: 'Priority', value: tender.priority },
    { label: 'Description', value: tender.description },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Back */}
        <button
          onClick={() => router.push('/tenders')}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-soft hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to the index
        </button>

        {/* Dossier header */}
        <div className="flex flex-col gap-5 border-b border-rule pb-6 sm:flex-row sm:items-start sm:justify-between adm-rise">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <span className="eyebrow">Dossier &middot; {tender.reference_number || 'NO-REF'}</span>
              <span className={`pill ${getStatusColor(tender.internal_status || tender.status)}`}>
                {getStatusLabel(tender.internal_status || tender.status)}
              </span>
              {tender.priority && tender.priority !== 'low' && (
                <Badge
                  variant={
                    tender.priority === 'critical' ? 'danger' :
                    tender.priority === 'high'    ? 'warning' :
                    'info'
                  }
                >
                  {tender.priority}
                </Badge>
              )}
              {(() => {
                const cd = formatCountdown(tender.submission_deadline);
                const tone =
                  cd.tone === 'overdue' || cd.tone === 'urgent' ? 'text-signal' :
                  cd.tone === 'warn' ? 'text-amber' : 'text-ink-soft';
                return <span className={`text-[12.5px] ${tone}`}>{cd.text}</span>;
              })()}
            </div>
            <h1 className="mt-3 font-display text-[28px] font-normal leading-[1.1] tracking-[-0.02em] text-ink sm:text-[34px]">
              {tender.title}
            </h1>
            {tender.organization && (
              <p className="mt-2 text-[14px] text-ink-soft">{tender.organization}</p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              onClick={handleShortlist}
              variant={tender.internal_status === 'interested' ? 'primary' : 'secondary'}
              size="sm"
            >
              <Star
                className="h-4 w-4"
                fill={tender.internal_status === 'interested' ? 'currentColor' : 'none'}
              />
              {tender.internal_status === 'interested' ? 'Shortlisted' : 'Shortlist'}
            </Button>
            {tender.source_url && (
              <a
                href={tender.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="adm-btn adm-btn-ghost"
              >
                <ExternalLink className="h-4 w-4" />
                Source
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            <div className="border-b border-rule">
              <nav className="flex gap-6">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center gap-2 border-b-2 pb-3 pt-1 text-sm font-medium transition-colors ${
                        activeTab === tab.key
                          ? 'border-brass text-navy'
                          : 'border-transparent text-ink-muted hover:border-ink/30 hover:text-ink'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Tab content */}
            {activeTab === 'overview' && (
              <div className="doc p-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {detailFields.map((field) => (
                    <div
                      key={field.label}
                      className={
                        field.label === 'Description' || field.label === 'Eligibility / Scope'
                          ? 'md:col-span-2'
                          : ''
                      }
                    >
                      <dt className="flex items-center gap-1.5 eyebrow">
                        {field.icon && <field.icon className="h-3.5 w-3.5" />}
                        {field.label}
                      </dt>
                      <dd className="mt-1 text-sm text-ink whitespace-pre-wrap">
                        {field.label === 'Source URL' && field.value && field.value !== '-' ? (
                          <a
                            href={field.value as string}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-navy hover:underline break-all"
                          >
                            {field.value as string}
                          </a>
                        ) : (
                          (field.value as string) || '-'
                        )}
                      </dd>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'documents' && (
              <div className="doc ">
                {documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FileText className="mb-3 h-10 w-10 text-ink-muted/60" />
                    <p className="text-sm font-medium text-ink-soft">No documents attached</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      Documents will appear here when uploaded
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-rule-soft">
                    {documents.map((doc) => (
                      <li key={doc.id} className="flex items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-5 w-5 flex-shrink-0 text-ink-muted" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-ink">
                              {doc.file_name}
                            </p>
                            <p className="text-xs text-ink-muted">
                              {doc.document_type} &middot;{' '}
                              {(doc.file_size / 1024).toFixed(1)} KB &middot;{' '}
                              Uploaded by {doc.uploaded_by_name} on {formatDate(doc.created_at)}
                            </p>
                          </div>
                        </div>
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 p-2 text-ink-muted transition-colors hover:text-ink"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-ink">Tender Notes</h3>
                  <Button
                    onClick={handleGenerateNote}
                    loading={generatingNote}
                    variant="primary"
                    size="sm"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate Note
                  </Button>
                </div>
                {notes.length === 0 ? (
                  <div className="doc py-16 text-center ">
                    <MessageSquare className="mx-auto mb-3 h-10 w-10 text-ink-muted/60" />
                    <p className="text-sm font-medium text-ink-soft">No notes yet</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      Generate a note to get started
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {notes.map((note) => (
                      <li
                        key={note.id}
                        className="doc p-4 "
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-xs text-ink-muted">
                              <span>{note.created_by_name}</span>
                              <span>&middot;</span>
                              <span>{formatDate(note.created_at, 'dd MMM yyyy HH:mm')}</span>
                              {note.is_internal && (
                                <Badge variant="default">Internal</Badge>
                              )}
                            </div>
                            <p className="mt-2 text-sm text-ink-soft whitespace-pre-wrap line-clamp-4">
                              {note.content}
                            </p>
                          </div>
                          <Link
                            href={`/tender-notes/${note.id}`}
                            className="ml-3 flex-shrink-0 p-1.5 text-ink-muted transition-colors hover:text-signal"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="doc ">
                {auditLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <History className="mb-3 h-10 w-10 text-ink-muted/60" />
                    <p className="text-sm font-medium text-ink-soft">No history entries</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-rule-soft">
                    {auditLogs.map((log) => (
                      <li key={log.id} className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center border border-rule-strong bg-paper-tint">
                            <History className="h-4 w-4 text-ink-muted" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-ink">
                              <span className="font-medium">{log.performed_by_name}</span>{' '}
                              {log.action}
                            </p>
                            <p className="mt-0.5 text-xs text-ink-muted">
                              {formatDate(log.created_at, 'dd MMM yyyy HH:mm:ss')}
                              {log.ip_address && ` from ${log.ip_address}`}
                            </p>
                            {log.details && Object.keys(log.details).length > 0 && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-[11px] text-navy hover:text-navy-hover">
                                  View changes
                                </summary>
                                <pre className="mt-1 border border-rule bg-paper-tint p-3 font-mono text-[11px] text-ink-soft overflow-x-auto">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Tags */}
            <div className="doc p-5 ">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Tag className="h-4 w-4" />
                Tags
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {tender.tags.length === 0 && (
                  <p className="text-xs text-ink-muted">No tags</p>
                )}
                {tender.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 border border-rule-strong bg-canvas-tint px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-0.5 p-0.5 text-ink-muted hover:text-signal"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  placeholder="Add tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  className="text-xs"
                />
                <Button onClick={handleAddTag} variant="ghost" size="sm" disabled={!newTag.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Assigned Owner */}
            <div className="doc p-5 ">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <UserIcon className="h-4 w-4" />
                Assigned Owner
              </h3>
              <select
                value={tender.assigned_to || ''}
                onChange={(e) =>
                  handleAssignOwner(e.target.value ? Number(e.target.value) : null)
                }
                className="mt-3 block w-full border-0 border-b border-rule-strong bg-transparent py-2 text-[13.5px] text-ink focus:border-ink focus:outline-none focus:ring-0"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Comments */}
            <div className="doc p-5 ">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <MessageSquare className="h-4 w-4" />
                Comments ({comments.length})
              </h3>
              <div className="mt-3 max-h-64 space-y-3 overflow-y-auto">
                {comments.length === 0 && (
                  <p className="text-xs text-ink-muted">No comments yet</p>
                )}
                {comments.map((comment) => (
                  <div key={comment.id} className="border border-rule bg-paper-tint p-3">
                    <div className="flex items-center gap-1 text-xs text-ink-muted">
                      <span className="font-medium text-ink-soft">{comment.created_by_name}</span>
                      <span>&middot;</span>
                      <span>{formatDate(comment.created_at, 'dd MMM HH:mm')}</span>
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">{comment.content}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  placeholder="Write a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddComment()}
                  className="text-xs"
                />
                <Button
                  onClick={handleAddComment}
                  variant="ghost"
                  size="sm"
                  loading={submittingComment}
                  disabled={!newComment.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
