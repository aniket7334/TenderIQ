import React from 'react';
import { clsx } from 'clsx';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FileType2,
  Globe,
  Info,
  Landmark,
  Loader2,
  RefreshCw,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';

// Bid terms are shown exactly as in the bid document, in rupees (Indian digit
// grouping). The app's formatCurrency converts to USD, which would be wrong
// for amounts like the EMD that must be paid in INR.
const inr = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

const TYPE_STYLES = {
  pdf: { icon: FileText, cls: 'bg-red-50 text-red-600 ring-red-100', label: 'PDF' },
  doc: { icon: FileType2, cls: 'bg-brand-50 text-brand-700 ring-brand-100', label: 'DOC' },
  docx: { icon: FileType2, cls: 'bg-brand-50 text-brand-700 ring-brand-100', label: 'DOCX' },
  xls: { icon: FileSpreadsheet, cls: 'bg-emerald-50 text-emerald-700 ring-emerald-100', label: 'XLS' },
  xlsx: { icon: FileSpreadsheet, cls: 'bg-emerald-50 text-emerald-700 ring-emerald-100', label: 'XLSX' },
  web: { icon: Globe, cls: 'bg-gray-100 text-gray-600 ring-gray-200', label: 'WEB' },
};
const typeStyle = (t) => TYPE_STYLES[(t || '').toLowerCase()] || { icon: FileText, cls: 'bg-gray-100 text-gray-600 ring-gray-200', label: (t || 'FILE').toUpperCase().slice(0, 4) };

const GROUPS = [
  { kind: 'bid', title: 'Bid document', hint: 'The official bid published on the portal' },
  { kind: 'buyer', title: "Buyer's attachments", hint: 'Scope of work, BOQ and other files uploaded by the buyer' },
  { kind: 'terms', title: 'Terms & conditions', hint: 'Read before bidding — they apply to every bidder' },
  { kind: 'upload', title: 'Uploaded by your team', hint: '' },
];

/** "Where to view and apply" — one row per place this tender is published or taken bids on. */
export function WhereToApply({ links }) {
  const [copied, setCopied] = React.useState(null);
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked: the ID is still visible to copy by hand */
    }
  };
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <header className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5">
        <Globe className="h-[18px] w-[18px] text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-900">Where to view and apply</h3>
        <span className="text-xs text-gray-500">· {links.length} {links.length === 1 ? 'place' : 'places'}</span>
      </header>
      <ul className="divide-y divide-gray-100">
        {links.map((l, i) => (
          <li key={i} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-900">
                <span
                  className={clsx(
                    'rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    l.role === 'apply' ? 'bg-brand-700 text-white' : 'bg-gray-100 text-gray-600',
                  )}
                >
                  {l.role === 'apply' ? 'Bid here' : 'View'}
                </span>
                {l.source}
              </p>
              {l.id && (
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <span className="font-mono">{l.id}</span>
                  <button
                    type="button"
                    onClick={() => copy(l.id)}
                    className="rounded border border-gray-200 px-1.5 py-0.5 text-[11px] text-gray-600 hover:bg-gray-50"
                    title="Copy, to search for it on the portal"
                  >
                    {copied === l.id ? 'Copied' : 'Copy'}
                  </button>
                </p>
              )}
              {l.how && <p className="mt-1 text-xs text-gray-500">{l.how}</p>}
            </div>
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-shrink-0 items-center gap-1.5 self-start rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 sm:self-center"
            >
              Open <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function DocumentRow({ doc }) {
  const t = typeStyle(doc.file_type);
  const Icon = t.icon;
  return (
    <li className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50/80">
      <span className={clsx('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ring-1', t.cls)}>
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{doc.file_name}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
          <span className="font-semibold tracking-wide text-gray-600">{t.label}</span>
          {doc.file_size ? <span>· {(doc.file_size / 1024).toFixed(0)} KB</span> : null}
          {doc.file_url && <span className="truncate">· {hostOf(doc.file_url)}</span>}
        </p>
      </div>
      {doc.file_url && (
        <a
          href={doc.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
        >
          Open <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </li>
  );
}

function Term({ label, value }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-3.5 py-2.5">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

export default function DocumentsPanel({ bundle, loading, refreshing, onRefresh }) {
  if (loading && !bundle) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm">
        <Loader2 className="mb-3 h-8 w-8 animate-spin text-brand-600" />
        <p className="text-sm font-medium text-gray-700">Fetching documents from the portal…</p>
        <p className="mt-1 text-xs text-gray-500">Reading the bid document for required documents and attachments</p>
      </div>
    );
  }

  const items = bundle?.items || [];
  const required = bundle?.required_documents || [];
  const d = bundle?.details || {};
  const source = bundle?.source || {};
  const groups = GROUPS.map((g) => ({ ...g, docs: items.filter((x) => x.kind === g.kind) })).filter((g) => g.docs.length);

  const terms = [
    ['Estimated bid value', d.estimated_value ? inr(d.estimated_value) : null],
    ['EMD amount', d.emd_amount ? `${inr(d.emd_amount)}${d.emd_bank ? ` · ${d.emd_bank}` : ''}` : null],
    ['Performance guarantee (ePBG)', d.epbg_percent ? `${d.epbg_percent}%${d.epbg_months ? ` for ${d.epbg_months} months` : ''}` : null],
    ['Contract period', d.contract_period],
    ['Type of bid', d.bid_type],
    ['Offer validity', d.offer_validity],
    ['Min. turnover', d.min_turnover],
    ['Past experience', d.experience_years],
    ['MSE relaxation', d.mse_relaxation],
    ['Startup relaxation', d.startup_relaxation],
  ].filter(([, v]) => v);

  return (
    <div className="space-y-5">
      {/* Source bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3.5 shadow-sm">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-900 text-white">
          <Landmark className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            Documents from {source.name || 'the source portal'}
            {d.bid_number && <span className="ml-2 font-mono text-xs font-normal text-gray-500">{d.bid_number}</span>}
          </p>
          <p className="text-xs text-gray-500">
            {source.live
              ? 'Shown live from the official notice — nothing is stored'
              : bundle?.fetched_at
              ? `Fetched ${formatDate(bundle.fetched_at)}`
              : source.can_fetch
                ? 'Not fetched yet'
                : 'Documents are kept on the portal for this source'}
            {d.ministry && ` · ${[d.ministry, d.organisation].filter(Boolean).join(' · ')}`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {source.url && (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              View on portal <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {source.can_fetch && (
            <Button variant="outline" size="sm" onClick={onRefresh} loading={refreshing} title="Fetch the latest documents from the portal again">
              <RefreshCw className="h-4 w-4" />
              Re-fetch
            </Button>
          )}
        </div>
      </div>

      {bundle?.fetch_error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {bundle.fetch_error}
        </div>
      )}

      {/* GeM-only: checklist + bid terms parsed from the bid PDF */}
      {!source.live && (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        {/* Required documents checklist */}
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <header className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5">
            <ShieldCheck className="h-[18px] w-[18px] text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Documents you must submit</h3>
            {required.length > 0 && (
              <span className="ml-auto rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{required.length}</span>
            )}
          </header>
          {required.length > 0 ? (
            <ul className="space-y-1 p-3">
              {required.map((r) => (
                <li key={r} className="flex items-start gap-3 rounded-lg px-2.5 py-2 hover:bg-gray-50">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                  <span className="text-sm text-gray-800">{r}</span>
                </li>
              ))}
              <li className="mt-2 flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-xs leading-relaxed text-gray-600">
                <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                Items marked "Requested in ATC" are described in the buyer's Additional Terms & Conditions below. Missing any document can get the bid rejected.
              </li>
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-gray-500">
              {source.can_fetch ? 'The bid document does not list specific seller documents.' : 'Not available for this source.'}
            </p>
          )}
        </section>

        {/* Key terms */}
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <header className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5">
            <ScrollText className="h-[18px] w-[18px] text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Key bid terms</h3>
          </header>
          {terms.length > 0 ? (
            <dl className="grid grid-cols-1 gap-2.5 p-4 sm:grid-cols-2">
              {terms.map(([label, value]) => (
                <Term key={label} label={label} value={value} />
              ))}
            </dl>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-gray-500">No terms extracted for this tender.</p>
          )}
        </section>
      </div>
      )}

      {source.live && bundle?.note && (
        <div className="flex items-start gap-2.5 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
          {bundle.note.text}
        </div>
      )}

      {/* Full notice text (World Bank: the notice itself explains how to get the bidding documents) */}
      {source.live && bundle?.notice_text && (
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <header className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5">
            <ScrollText className="h-[18px] w-[18px] text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Notice text</h3>
            {bundle.notice_text_original && <span className="ml-auto text-xs text-gray-500">Translated to English</span>}
          </header>
          <p className="max-h-[28rem] overflow-auto whitespace-pre-wrap px-5 py-4 text-sm leading-relaxed text-gray-800">{bundle.notice_text}</p>
        </section>
      )}

      {/* Files */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <header className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5">
          <FileText className="h-[18px] w-[18px] text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">Tender documents</h3>
          <span className="ml-auto text-xs text-gray-500">{items.length} file{items.length === 1 ? '' : 's'}</span>
        </header>
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <FileText className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">No documents available</p>
            {bundle?.note ? (
              <p className="mt-1 max-w-md text-sm text-gray-500">{bundle.note.text}</p>
            ) : (
              <p className="mt-1 text-sm text-gray-400">This source doesn't publish downloadable documents.</p>
            )}
            {bundle?.note?.link && (
              <a
                href={bundle.note.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                {bundle.note.link_label} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.kind} className="border-b border-gray-100 last:border-0">
              <div className="flex items-baseline gap-2 bg-gray-50/70 px-5 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-600">{g.title}</p>
                {g.hint && <p className="truncate text-xs text-gray-400">{g.hint}</p>}
              </div>
              <ul className="divide-y divide-gray-100">
                {g.docs.map((doc) => (
                  <DocumentRow key={doc.id} doc={doc} />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
