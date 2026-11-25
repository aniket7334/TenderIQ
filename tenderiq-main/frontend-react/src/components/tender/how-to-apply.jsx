import React from 'react';
import { CalendarClock, ExternalLink, FileText, Globe, Mail, MapPin, Phone, Send, UserRound } from 'lucide-react';
import { formatDate } from '@/lib/utils';

/* "How to apply" for live tenders (TED). Everything comes from the official
   notice; TenderIQ doesn't store it. */

function LinkButton({ href, icon: Icon, children, primary }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        primary
          ? 'inline-flex items-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-900'
          : 'inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50'
      }
    >
      <Icon className="h-4 w-4" />
      {children}
      <ExternalLink className="h-3.5 w-3.5 opacity-60" />
    </a>
  );
}

function Contact({ icon: Icon, label, children }) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="break-words text-sm text-gray-900">{children}</p>
      </div>
    </div>
  );
}

export default function HowToApply({ tender }) {
  const a = tender?.how_to_apply;
  if (!a) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-5 py-12 text-center text-sm text-gray-500">
        Application details are not available for this tender.
      </div>
    );
  }
  const b = a.buyer || {};
  const steps = [
    {
      title: 'Read the official notice',
      text: 'Check the scope, lots, eligibility and selection criteria in the TED notice (English PDF).',
    },
    {
      title: 'Get the tender documents',
      text: a.documents_url
        ? "Open the buyer's procurement portal and download the specifications, forms and bill of quantities. Most portals ask you to register (free)."
        : 'Ask the buyer for the tender documents using the contact details below.',
    },
    {
      title: 'Prepare your bid',
      text: 'Follow the documents for the required forms, certificates and language. Send any questions to the buyer before their clarification deadline.',
    },
    {
      title: 'Submit before the deadline',
      text: a.submission_url
        ? "Submit electronically on the buyer's portal. Late bids are not accepted."
        : 'Submit as described in the tender documents. Late bids are not accepted.',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Deadline + main actions */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200">
              <CalendarClock className="h-5 w-5 text-gray-500" />
            </span>
            <div>
              <p className="text-xs text-gray-500">Submission deadline</p>
              <p className="text-base font-semibold text-gray-900">{a.deadline ? formatDate(a.deadline, 'd MMMM yyyy') : 'See notice'}</p>
              {a.procedure && <p className="text-xs text-gray-500">{a.procedure}</p>}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <LinkButton href={a.submission_url} icon={Send} primary>
            Submit a bid online
          </LinkButton>
          <LinkButton href={a.documents_url} icon={FileText} primary={!a.submission_url}>
            Tender documents
          </LinkButton>
          <LinkButton href={a.notice_pdf_url} icon={FileText}>
            Official notice (PDF, English)
          </LinkButton>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Steps */}
        <section className="rounded-xl border border-gray-200 bg-white">
          <header className="border-b border-gray-100 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-gray-900">Steps to apply</h3>
          </header>
          <ol className="space-y-4 p-5">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-gray-300 text-xs font-semibold text-gray-700">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Buyer contact */}
        <section className="rounded-xl border border-gray-200 bg-white">
          <header className="border-b border-gray-100 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-gray-900">Buyer contact</h3>
          </header>
          <div className="space-y-4 p-5">
            <Contact icon={UserRound} label="Organisation">{b.name}</Contact>
            <Contact icon={Mail} label="Email">
              {b.email && (
                <a href={`mailto:${b.email}`} className="text-brand-700 hover:underline">
                  {b.email}
                </a>
              )}
            </Contact>
            <Contact icon={Phone} label="Phone">{b.phone}</Contact>
            <Contact icon={MapPin} label="Address">{b.address}</Contact>
            <Contact icon={Globe} label="Website">
              {b.website && (
                <a href={b.website} target="_blank" rel="noopener noreferrer" className="break-all text-brand-700 hover:underline">
                  {b.website}
                </a>
              )}
            </Contact>
          </div>
        </section>
      </div>

      <p className="text-xs text-gray-500">
        {a.language_note} Source:{' '}
        <a href={a.notice_url} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
          TED notice
        </a>
        . Shown live — TenderIQ doesn't store Europe tenders.
      </p>
    </div>
  );
}
