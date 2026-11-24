'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  FileDown,
  FileText,
  FileSpreadsheet,
  Loader2,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  Clock,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  AlignLeft,
} from 'lucide-react';
import AppLayout from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface NoteSection {
  id: string;
  title: string;
  content: string;
}

interface TenderNoteDetail {
  id: number;
  tender_id: number;
  title: string;
  content: string;
  sections: NoteSection[];
  status: 'draft' | 'final';
  created_by: number;
  created_by_name: string;
  tender_title: string;
  created_at: string;
  updated_at: string;
}

export default function TenderNoteDetailClient() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [note, setNote] = useState<TenderNoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sections, setSections] = useState<NoteSection[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [status, setStatus] = useState<'draft' | 'final'>('draft');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const fetchNote = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/tender-notes/${id}`);
      const data = res.data;
      setNote(data);
      setTitle(data.title || '');
      setContent(data.content || '');
      setStatus(data.status || 'draft');

      const parsedSections: NoteSection[] = data.sections || [];
      if (parsedSections.length === 0 && data.content) {
        const lines = data.content.split('\n');
        let currentSection: NoteSection | null = null;
        const autoSections: NoteSection[] = [];
        lines.forEach((line: string, idx: number) => {
          if (line.startsWith('## ') || line.startsWith('# ')) {
            if (currentSection) autoSections.push(currentSection);
            currentSection = {
              id: `section-${idx}`,
              title: line.replace(/^#+\s*/, ''),
              content: '',
            };
          } else if (currentSection) {
            currentSection.content += line + '\n';
          }
        });
        if (currentSection) autoSections.push(currentSection);
        if (autoSections.length > 0) {
          setSections(autoSections);
          setActiveSection(autoSections[0].id);
        } else {
          const defaultSection: NoteSection = {
            id: 'main',
            title: 'Main Content',
            content: data.content,
          };
          setSections([defaultSection]);
          setActiveSection('main');
        }
      } else {
        setSections(parsedSections);
        if (parsedSections.length > 0) {
          setActiveSection(parsedSections[0].id);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load note';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchNote();
  }, [id, fetchNote]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const fullContent = sections.map((s) => `## ${s.title}\n${s.content}`).join('\n\n');
      await api.put(`/tender-notes/${id}`, {
        title,
        content: fullContent,
        sections,
        status,
      });
      setContent(fullContent);
      setLastSaved(new Date().toISOString());
    } catch {
      // handled by interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'word' | 'excel') => {
    try {
      setExporting(format);
      const res = await api.get(`/tender-notes/${id}/export`, {
        params: { format },
        responseType: 'blob',
      });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const ext = format === 'word' ? 'docx' : format === 'excel' ? 'xlsx' : 'pdf';
      link.href = url;
      link.download = `${title || 'tender-note'}.${ext}`;
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

  const updateSectionContent = (sectionId: string, newContent: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, content: newContent } : s)),
    );
  };

  const insertFormatting = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('note-editor') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    const replacement = `${prefix}${selected}${suffix || prefix}`;
    const newValue = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);

    if (activeSection) {
      updateSectionContent(activeSection, newValue);
    }

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 0);
  };

  const currentSection = sections.find((s) => s.id === activeSection);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </AppLayout>
    );
  }

  if (error || !note) {
    return (
      <AppLayout>
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <AlertTriangle className="h-10 w-10 text-red-500" />
          <p className="text-lg font-medium text-gray-900">Note not found</p>
          <p className="text-sm text-gray-500">{error}</p>
          <Button onClick={fetchNote} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Top bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button onClick={() => router.back()} variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Badge variant={status === 'final' ? 'success' : 'warning'}>
              {status === 'final' ? (
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Final
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Draft
                </span>
              )}
            </Badge>
            {lastSaved && (
              <span className="text-xs text-gray-400">
                Last saved: {formatDate(lastSaved, 'HH:mm:ss')}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'draft' | 'final')}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="draft">Draft</option>
              <option value="final">Final</option>
            </select>
            <Button onClick={() => handleExport('pdf')} variant="outline" size="sm" loading={exporting === 'pdf'}>
              <FileDown className="h-4 w-4" />
              PDF
            </Button>
            <Button onClick={() => handleExport('word')} variant="outline" size="sm" loading={exporting === 'word'}>
              <FileText className="h-4 w-4" />
              Word
            </Button>
            <Button onClick={() => handleExport('excel')} variant="outline" size="sm" loading={exporting === 'excel'}>
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
            <Button onClick={handleSave} variant="primary" size="sm" loading={saving}>
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>
        </div>

        {/* Note title and metadata */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title..."
            className="border-0 bg-transparent text-xl font-bold text-gray-900 focus:ring-0 px-0"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span>Tender: {note.tender_title}</span>
            <span>&middot;</span>
            <span>By {note.created_by_name}</span>
            <span>&middot;</span>
            <span>Created {formatDate(note.created_at)}</span>
            <span>&middot;</span>
            <span>Updated {formatDate(note.updated_at)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Section navigation */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Sections</h3>
              <ul className="space-y-1">
                {sections.map((section) => (
                  <li key={section.id}>
                    <button
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        activeSection === section.id
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {section.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Editor */}
          <div className="lg:col-span-3">
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              {/* Formatting toolbar */}
              <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 px-4 py-2">
                <button
                  onClick={() => insertFormatting('**')}
                  title="Bold"
                  className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                >
                  <Bold className="h-4 w-4" />
                </button>
                <button
                  onClick={() => insertFormatting('*')}
                  title="Italic"
                  className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                >
                  <Italic className="h-4 w-4" />
                </button>
                <button
                  onClick={() => insertFormatting('__', '__')}
                  title="Underline"
                  className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                >
                  <Underline className="h-4 w-4" />
                </button>
                <div className="mx-1 h-5 w-px bg-gray-200" />
                <button
                  onClick={() => insertFormatting('# ', '\n')}
                  title="Heading 1"
                  className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                >
                  <Heading1 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => insertFormatting('## ', '\n')}
                  title="Heading 2"
                  className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                >
                  <Heading2 className="h-4 w-4" />
                </button>
                <div className="mx-1 h-5 w-px bg-gray-200" />
                <button
                  onClick={() => insertFormatting('- ', '\n')}
                  title="Bullet list"
                  className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => insertFormatting('1. ', '\n')}
                  title="Numbered list"
                  className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                >
                  <ListOrdered className="h-4 w-4" />
                </button>
                <div className="mx-1 h-5 w-px bg-gray-200" />
                <button
                  onClick={() => insertFormatting('> ', '\n')}
                  title="Quote"
                  className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                >
                  <AlignLeft className="h-4 w-4" />
                </button>
              </div>

              {/* Textarea editor */}
              <div className="p-4">
                {currentSection ? (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-gray-700">
                      {currentSection.title}
                    </h3>
                    <textarea
                      id="note-editor"
                      value={currentSection.content}
                      onChange={(e) => updateSectionContent(currentSection.id, e.target.value)}
                      placeholder="Start writing..."
                      rows={20}
                      className="block w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-20 text-sm text-gray-400">
                    Select a section from the sidebar to begin editing
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
