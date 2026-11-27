import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
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
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';
import DocumentsPanel from '@/components/tender/documents-panel';
import HowToApply from '@/components/tender/how-to-apply';
import useAuth, { canEditTenders } from '@/hooks/useAuth';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/utils';

export default function TenderDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const id = params.id;

  /* ---- Back to the list the user came from (same search, filters, page, scroll) ---- */
  const arrivedFromList = !!location.state?.fromList;
  const fromList = (() => {
    if (location.state?.fromList) return location.state.fromList;
    try { return sessionStorage.getItem(`tenderiq:fromList:${id}`); } catch { return null; }
  })();
  const fromSearch = fromList ? new URLSearchParams(fromList.split('?')[1] || '').get('search') : null;
  const backLabel = fromSearch ? `Back to results for “${fromSearch}”` : fromList ? 'Back to results' : 'Back to Tenders';
  const goBack = () => {
    // Opened straight from the list: step back in history (the list restores its scroll)
    if (arrivedFromList && window.history.length > 1) navigate(-1);
    else if (fromList) navigate(fromList, { state: { backToList: true } });
    else navigate('/tenders');
  };
  // A tender opens at the top (the page area keeps the list's scroll otherwise)
  useEffect(() => {
    const main = document.querySelector('main');
    if (main) main.scrollTop = 0;
  }, [id]);

  const [tender, setTender] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [docBundle, setDocBundle] = useState(null);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsRefreshing, setDocsRefreshing] = useState(false);
  const [notes, setNotes] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [comments, setComments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [newTag, setNewTag] = useState('');
  const [editingCost, setEditingCost] = useState(false);
  const [costInput, setCostInput] = useState('');
  const [newComment, setNewComment] = useState('');
  const [generatingNote, setGeneratingNote] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [fetchResult, setFetchResult] = useState(null);
  const [generatingInfographic, setGeneratingInfographic] = useState(false);
  const [infographicHtml, setInfographicHtml] = useState(null);
  const [showInfographic, setShowInfographic] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchTender = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [tenderRes, notesRes, logsRes, commentsRes, usersRes] = await Promise.allSettled([
        api.get(`/tenders/${id}`),
        api.get(`/tenders/${id}/notes`),
        api.get(`/audit-logs`, { params: { entity_type: 'tender', entity_id: id, page_size: 50 } }),
        api.get(`/tenders/${id}/comments`),
        api.get('/users'),
      ]);

      if (tenderRes.status === 'fulfilled') setTender(tenderRes.value.data);
      else throw new Error('Failed to load tender');

      if (notesRes.status === 'fulfilled') setNotes(notesRes.value.data.items || notesRes.value.data || []);
      if (logsRes.status === 'fulfilled') setAuditLogs(logsRes.value.data.items || logsRes.value.data || []);
      if (commentsRes.status === 'fulfilled') setComments(commentsRes.value.data.items || commentsRes.value.data || []);
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data.items || usersRes.value.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load tender details';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Documents load separately: the first view fetches the bid document from
  // the source portal (about a second), so it shouldn't hold up the page.
  const fetchDocuments = useCallback(
    async (refresh = false) => {
      try {
        refresh ? setDocsRefreshing(true) : setDocsLoading(true);
        // Generous timeout: the free API server may need ~50s to wake up, and
        // the first view also downloads the bid document from GeM.
        const load = () =>
          api.get(`/tenders/${id}/documents`, { params: refresh ? { refresh: 1 } : {}, timeout: 90000 });
        let res;
        try {
          res = await load();
        } catch (first) {
          // A dropped connection (server waking up / restarting) — try once more
          if (!/network error|timeout/i.test(first?.message || '')) throw first;
          await new Promise((r) => setTimeout(r, 3000));
          res = await load();
        }
        const data = res.data || {};
        setDocBundle(data);
        setDocuments(data.items || (Array.isArray(data) ? data : []));
      } catch (err) {
        const raw = err instanceof Error ? err.message : '';
        const message = /network error|timeout/i.test(raw)
          ? "Couldn't reach the TenderIQ server. It may be starting up — wait a few seconds and click Refresh."
          : raw || 'Could not load documents';
        setDocBundle((prev) => ({ ...(prev || {}), fetch_error: message }));
      } finally {
        setDocsLoading(false);
        setDocsRefreshing(false);
      }
    },
    [id],
  );

  useEffect(() => {
    if (id) {
      fetchTender();
      fetchDocuments();
    }
  }, [id, fetchTender, fetchDocuments]);

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

  const handleDownloadTender = () => {
    if (!tender) return;
    const lines = [
      `TENDER DETAILS`,
      `==============`,
      ``,
      `Title: ${tender.title}`,
      `Reference No: ${tender.reference_number || '-'}`,
      `Client / Organization: ${tender.organization || '-'}`,
      `Department: ${tender.department || '-'}`,
      `Category: ${tender.category || '-'}`,
      `Status: ${getStatusLabel(tender.internal_status || tender.status)}`,
      `Priority: ${tender.priority || '-'}`,
      ``,
      `--- Financial Details ---`,
      `Estimated Value: ${tender.estimated_value ? formatCurrency(tender.estimated_value, tender.currency || 'INR') : '-'}`,
      `EMD Amount: ${tender.emd_amount ? formatCurrency(tender.emd_amount, tender.currency || 'INR') : '-'}`,
      `Tender Fee: ${tender.tender_fee ? formatCurrency(tender.tender_fee, tender.currency || 'INR') : '-'}`,
      `Currency: ${tender.currency || 'INR'}`,
      ``,
      `--- Dates ---`,
      `Published Date: ${formatDate(tender.published_date) || '-'}`,
      `Submission Deadline: ${formatDate(tender.submission_deadline) || '-'}`,
      `Opening Date: ${formatDate(tender.opening_date) || '-'}`,
      `Closing Date: ${formatDate(tender.closing_date) || '-'}`,
      ``,
      `--- Location ---`,
      `Location: ${[tender.city, tender.state, tender.location].filter(Boolean).join(', ') || '-'}`,
      ``,
      `--- Description ---`,
      `${tender.description || tender.eligibility_criteria || '-'}`,
      ``,
      `--- Source ---`,
      `Source: ${tender.source_name || '-'}`,
      `Source URL: ${tender.source_url || '-'}`,
      ``,
      `--- Tags ---`,
      `${tender.tags?.length ? tender.tags.join(', ') : 'None'}`,
      ``,
      `Assigned To: ${tender.assigned_to_name || 'Unassigned'}`,
      ``,
      `--- Documents (${documents.length}) ---`,
      ...documents.map((d) => `  - ${d.file_name} (${d.document_type || d.file_type || 'file'})`),
      ``,
      `Generated on: ${new Date().toLocaleString()}`,
    ];
    const text = lines.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tender_${tender.reference_number || tender.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateInfographic = async () => {
    if (!tender) return;
    try {
      setGeneratingInfographic(true);
      const res = await api.post(`/tenders/${id}/infographic`);
      setInfographicHtml(res.data.html);
      setShowInfographic(true);
    } catch {
      // handled by interceptor
    } finally {
      setGeneratingInfographic(false);
    }
  };

  const handleDownloadInfographic = () => {
    if (!infographicHtml) return;
    const blob = new Blob([infographicHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `infographic_${tender?.reference_number || tender?.id || 'tender'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFetchFromSource = async () => {
    if (!tender) return;
    try {
      setFetchingDetails(true);
      setFetchResult(null);
      const res = await api.post(`/tenders/${id}/fetch-details`);
      const data = res.data;
      setTender(data.tender);
      if (data.fields_updated > 0) {
        const parts = [];
        if (data.fetched.estimated_project_cost) parts.push(`Est. Cost: ₹${(data.fetched.estimated_project_cost / (data.fetched.estimated_project_cost >= 10000000 ? 10000000 : 100000)).toFixed(2)}${data.fetched.estimated_project_cost >= 10000000 ? ' Cr' : ' L'}`);
        if (data.fetched.emd_amount) parts.push(`EMD: ₹${data.fetched.emd_amount.toLocaleString()}`);
        if (data.fetched.tender_fee) parts.push(`Fee: ₹${data.fetched.tender_fee.toLocaleString()}`);
        if (data.fetched.location) parts.push(`Location: ${data.fetched.location}`);
        setFetchResult(`Updated ${data.fields_updated} fields: ${parts.join(', ')}`);
      } else {
        setFetchResult('No additional data found on the source page.');
      }
    } catch (err) {
      setFetchResult(err instanceof Error ? err.message : 'Failed to fetch from source');
    } finally {
      setFetchingDetails(false);
    }
  };

  const handleSaveCost = async () => {
    if (!tender || !costInput.trim()) return;
    try {
      let value = parseFloat(costInput.replace(/,/g, ''));
      if (isNaN(value)) return;
      // Handle shorthand: "5cr" = 5 crore, "10l" = 10 lakh
      const lower = costInput.toLowerCase().trim();
      if (lower.endsWith('cr') || lower.endsWith('crore')) value = parseFloat(lower) * 10000000;
      else if (lower.endsWith('l') || lower.endsWith('lakh') || lower.endsWith('lac')) value = parseFloat(lower) * 100000;
      await api.patch(`/tenders/${id}`, { estimated_project_cost: value });
      setTender((prev) => prev ? { ...prev, estimated_value: value, estimated_project_cost: value } : prev);
      setEditingCost(false);
    } catch {}
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

  const handleRemoveTag = async (tagToRemove) => {
    if (!tender) return;
    try {
      const updatedTags = tender.tags.filter((t) => t !== tagToRemove);
      await api.patch(`/tenders/${id}`, { tags: updatedTags });
      setTender((prev) => (prev ? { ...prev, tags: updatedTags } : prev));
    } catch {
      // handled by interceptor
    }
  };

  const handleAssignOwner = async (userId) => {
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
        navigate(`/tender-notes/${note.id}`);
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
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !tender) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <p className="text-lg font-medium text-gray-900">Tender not found</p>
        <p className="text-sm text-gray-500">{error}</p>
        <div className="flex gap-2">
          <Button onClick={goBack} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Button>
          <Button onClick={fetchTender} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Live tenders (Europe from TED, UK from Find a Tender) aren't stored: no notes/history/shortlist
  const isLive = !!tender.is_live;
  // Viewers are read-only
  const canEdit = canEditTenders(useAuth.getState().user);
  const money = (v, cur) => {
    try {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur || 'EUR', maximumFractionDigits: 0 }).format(v);
    } catch {
      return `${Number(v).toLocaleString()} ${cur || ''}`;
    }
  };
  const liveTabs = [
    { key: 'overview', label: 'Overview', icon: Eye },
    { key: 'documents', label: 'Documents', icon: FileText },
    { key: 'apply', label: 'How to apply', icon: Send },
  ];
  const liveFields = [
    { label: 'Name of Work', value: tender.title },
    { label: 'Notice Number', value: tender.reference_number },
    { label: 'Buyer', value: tender.organization, icon: Building2 },
    { label: 'Location', value: tender.location, icon: MapPin },
    { label: 'Category', value: (tender.categories || []).join(', ') || null },
    { label: 'Project', value: tender.project_name },
    { label: 'Language', value: tender.original_language ? (tender.translated || tender.original_title ? `${tender.original_language} — translated to English automatically` : `${tender.original_language} (English translation not available)`) : null },
    { label: 'Original Title', value: tender.original_title },
    { label: 'Contract Type', value: tender.tender_type },
    { label: 'Procedure', value: tender.procedure },
    { label: 'Estimated Value', value: tender.estimated_value ? money(tender.estimated_value, tender.currency) : null },
    { label: 'Published Date', value: formatDate(tender.published_date), icon: Calendar },
    { label: 'Submission Deadline', value: formatDate(tender.submission_deadline), icon: Clock },
    { label: 'CPV Codes', value: (tender.cpv_codes || []).join(', ') || null },
    { label: 'Source', value: tender.source_label || `${tender.source_name} (shown live)` },
    { label: 'Source URL', value: tender.source_url },
    { label: 'Description', value: tender.description },
    { label: 'Original Notice Text', value: tender.original_description },
  ];

  const storedTabs = [
    { key: 'overview', label: 'Overview', icon: Eye },
    { key: 'documents', label: `Documents (${documents.length})`, icon: FileText },
    { key: 'notes', label: `Notes (${notes.length})`, icon: MessageSquare },
    { key: 'history', label: 'History', icon: History },
  ];
  const tabs = isLive ? liveTabs : storedTabs;

  const storedFields = [
    { label: 'Name of Work', value: tender.title },
    { label: 'Reference Number', value: tender.reference_number },
    { label: 'Client / Organization', value: tender.organization, icon: Building2 },
    { label: 'Department', value: tender.department },
    { label: 'Category', value: tender.category },
    { label: 'Sub-Category', value: tender.subcategory },
    { label: 'Tender Type', value: tender.tender_type },
    { label: 'Location', value: [tender.city, tender.state, tender.location].filter(Boolean).join(', ') || null, icon: MapPin },
    { label: 'Estimated Cost', value: '__EDITABLE_COST__', icon: IndianRupee },
    { label: 'EMD Amount', value: tender.emd_amount ? formatCurrency(tender.emd_amount, tender.currency || 'INR') : null },
    { label: 'Tender Fee', value: tender.tender_fee ? formatCurrency(tender.tender_fee, tender.currency || 'INR') : null },
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
  const detailFields = isLive ? liveFields : storedFields;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button onClick={goBack} variant="ghost" size="sm" className="max-w-full">
        <ArrowLeft className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{backLabel}</span>
      </Button>

      {/* Header */}
      {/* Title and actions sit side by side only on wide screens; on phones, laptops and
          tablets the buttons wrap below the title so it keeps the full width (xl = 1280px+) */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-all font-mono text-sm text-gray-500">{tender.reference_number}</span>
            {isLive ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                <Globe className="h-3 w-3" /> Live · {tender.source_name}
              </span>
            ) : (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(tender.internal_status || tender.status)}`}
            >
              {getStatusLabel(tender.internal_status || tender.status)}
            </span>
            )}
            {!isLive && tender.priority && tender.priority !== 'low' && (
              <Badge
                variant={
                  tender.priority === 'critical'
                    ? 'danger'
                    : tender.priority === 'high'
                      ? 'warning'
                      : 'info'
                }
              >
                {tender.priority.toUpperCase()}
              </Badge>
            )}
          </div>
          <h1 className="mt-2 break-words text-xl font-bold text-gray-900 sm:text-2xl">{tender.title}</h1>
          <p className="mt-1 text-sm text-gray-500">{[tender.organization, isLive && tender.location].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex flex-wrap gap-2 xl:max-w-[52%] xl:flex-shrink-0 xl:justify-end">
          {!isLive && canEdit && (
          <Button
            onClick={handleShortlist}
            variant={tender.internal_status === 'interested' ? 'primary' : 'outline'}
            size="sm"
          >
            <Star
              className="h-4 w-4"
              fill={tender.internal_status === 'interested' ? 'currentColor' : 'none'}
            />
            <span className="hidden sm:inline">
              {tender.internal_status === 'interested' ? 'Shortlisted' : 'Shortlist'}
            </span>
          </Button>
          )}
          <Button onClick={handleDownloadTender} variant="outline" size="sm">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
          </Button>
          {!isLive && canEdit && (
          <>
          <Button
            onClick={handleFetchFromSource}
            variant="outline"
            size="sm"
            loading={fetchingDetails}
            disabled={fetchingDetails || !tender.source_url}
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Fetch from Source</span>
            <span className="sm:hidden">Fetch</span>
          </Button>
          <Button
            onClick={handleGenerateInfographic}
            variant="outline"
            size="sm"
            loading={generatingInfographic}
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Infographic</span>
          </Button>
          </>
          )}
          {tender.source_url && (
            <a
              href={tender.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">{isLive ? 'View notice' : 'Source'}</span>
            </a>
          )}
        </div>
      </div>

      {/* Infographic Modal */}
      {showInfographic && infographicHtml && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="relative max-h-[95vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b bg-white px-4 py-3 sm:px-6">
              <h3 className="text-base font-semibold text-gray-900 sm:text-lg">Tender Infographic</h3>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleDownloadInfographic} variant="outline" size="sm">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Download HTML</span>
                </Button>
                <Button
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(infographicHtml);
                      printWindow.document.close();
                      printWindow.print();
                    }
                  }}
                  variant="outline"
                  size="sm"
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Print</span>
                </Button>
                <button
                  onClick={() => setShowInfographic(false)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <div dangerouslySetInnerHTML={{ __html: infographicHtml }} />
            </div>
          </div>
        </div>
      )}

      {fetchResult && (
        <div className={`rounded-lg border px-4 py-2 text-sm ${fetchResult.startsWith('Updated') ? 'bg-green-50 border-green-200 text-green-700' : fetchResult.startsWith('No additional') ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {fetchResult}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="border-b border-gray-200 -mx-4 sm:mx-0">
            <nav className="flex gap-4 overflow-x-auto px-4 sm:gap-6 sm:px-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex flex-shrink-0 items-center gap-2 border-b-2 pb-3 pt-1 text-sm font-medium transition-colors ${
                      activeTab === tab.key
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
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
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2">
                {detailFields.map((field) => (
                  <div
                    key={field.label}
                    className={
                      field.label === 'Description' || field.label === 'Eligibility / Scope' || field.label === 'Original Notice Text' || field.label === 'Name of Work'
                        ? 'sm:col-span-2'
                        : ''
                    }
                  >
                    <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-400">
                      {field.icon && <field.icon className="h-3.5 w-3.5" />}
                      {field.label}
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                      {field.value === '__EDITABLE_COST__' ? (
                        editingCost ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={costInput}
                              onChange={(e) => setCostInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveCost()}
                              placeholder="e.g. 50000000 or 5cr or 50l"
                              className="w-48 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                              autoFocus
                            />
                            <button onClick={handleSaveCost} className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700">Save</button>
                            <button onClick={() => setEditingCost(false)} className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-300">Cancel</button>
                          </div>
                        ) : (
                          <span
                            onClick={() => { setEditingCost(true); setCostInput(tender?.estimated_value?.toString() || ''); }}
                            className="cursor-pointer hover:text-blue-600 group inline-flex items-center gap-1"
                          >
                            {tender?.estimated_value ? formatCurrency(tender.estimated_value, tender?.currency || 'INR') : <span className="text-gray-300">-</span>}
                            <span className="text-xs text-gray-300 group-hover:text-blue-400">✎</span>
                          </span>
                        )
                      ) : field.label === 'Source URL' && field.value && field.value !== '-' ? (
                        <a
                          href={field.value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline break-all"
                        >
                          {field.value}
                        </a>
                      ) : (
                        field.value || '-'
                      )}
                    </dd>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <DocumentsPanel
              bundle={docBundle}
              loading={docsLoading}
              refreshing={docsRefreshing}
              onRefresh={() => fetchDocuments(true)}
            />
          )}

          {activeTab === 'apply' && isLive && <HowToApply tender={tender} />}

          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">Tender Notes</h3>
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
                <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm">
                  <MessageSquare className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                  <p className="text-sm font-medium text-gray-600">No notes yet</p>
                  <p className="mt-1 text-sm text-gray-400">
                    Generate a note to get started
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {notes.map((note) => (
                    <li
                      key={note.id}
                      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{note.created_by_name}</span>
                            <span>&middot;</span>
                            <span>{formatDate(note.created_at, 'dd MMM yyyy HH:mm')}</span>
                            {note.is_internal && (
                              <Badge variant="default">Internal</Badge>
                            )}
                          </div>
                          <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap line-clamp-4">
                            {note.content}
                          </p>
                        </div>
                        <Link
                          to={`/tender-notes/${note.id}`}
                          className="ml-3 flex-shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
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
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              {auditLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <History className="mb-3 h-10 w-10 text-gray-300" />
                  <p className="text-sm font-medium text-gray-600">No history entries</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {auditLogs.map((log) => (
                    <li key={log.id} className="px-4 py-4 sm:px-6">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                          <History className="h-4 w-4 text-gray-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-900">
                            <span className="font-medium">{log.performed_by_name}</span>{' '}
                            {log.action}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {formatDate(log.created_at, 'dd MMM yyyy HH:mm:ss')}
                            {log.ip_address && ` from ${log.ip_address}`}
                          </p>
                          {log.details && Object.keys(log.details).length > 0 && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs text-blue-600 hover:text-blue-700">
                                View changes
                              </summary>
                              <pre className="mt-1 rounded-lg bg-gray-50 p-3 text-xs text-gray-600 overflow-x-auto">
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
        {isLive ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Globe className="h-4 w-4" />
              Live tender
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              This tender is shown live from {tender.source_name}, its official public source. TenderIQ doesn't store it,
              so shortlisting, tags, owners and comments aren't available.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('apply')}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900"
            >
              <Send className="h-4 w-4" /> How to apply
            </button>
          </div>
        </div>
        ) : (
        <div className="space-y-6">
          {/* Tags */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Tag className="h-4 w-4" />
              Tags
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {tender.tags.length === 0 && (
                <p className="text-xs text-gray-400">No tags</p>
              )}
              {tender.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-blue-100"
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
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <UserIcon className="h-4 w-4" />
              Assigned Owner
            </h3>
            <select
              value={tender.assigned_to || ''}
              onChange={(e) =>
                handleAssignOwner(e.target.value ? Number(e.target.value) : null)
              }
              className="mt-3 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <MessageSquare className="h-4 w-4" />
              Comments ({comments.length})
            </h3>
            <div className="mt-3 max-h-64 space-y-3 overflow-y-auto">
              {comments.length === 0 && (
                <p className="text-xs text-gray-400">No comments yet</p>
              )}
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-lg bg-gray-50 p-3">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="font-medium text-gray-700">{comment.created_by_name}</span>
                    <span>&middot;</span>
                    <span>{formatDate(comment.created_at, 'dd MMM HH:mm')}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{comment.content}</p>
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
        )}
      </div>
    </div>
  );
}
