import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';

const faqs = [
  {
    q: 'How is TenderIQ different from existing aggregators?',
    a: 'Most aggregators give you a nightly CSV from a handful of national portals. TenderIQ streams from two hundred and thirty-nine sources across eighty countries every five minutes, normalises every listing into a single editorial feed, and runs sector classification so off-topic noise never reaches your team.',
  },
  {
    q: 'Which sources actually return data?',
    a: 'Public-API sources (TED EU, SAM.gov, USASpending, World Bank, UK Find a Tender, AusTender, CanadaBuys) plus the major Indian portals (CPPP, GeM, IREPS, eTenders NIC + all 28 state portals) return live data. About 170 other sources are configured and ready for custom adapter work — most require auth or run on JavaScript SPAs.',
  },
  {
    q: 'Do you store our tender data?',
    a: 'No. Tender content lives in an in-memory cache that rebuilds from sources every few minutes. Only your filters, saved views, comments and team data are persisted. You can wipe everything with one click.',
  },
  {
    q: 'How fast is "live"?',
    a: 'New listings appear within five minutes of being posted on the source portal. API-based sources are near-realtime. HTML sources poll on a five-to-fifteen-minute cycle depending on volume.',
  },
  {
    q: 'Can I export tenders into our CRM?',
    a: 'Yes — CSV export on the Editor plan, full REST + GraphQL API and signed webhooks on Publisher. We ship a TypeScript client SDK. Most teams set up a Zapier or n8n workflow in under thirty minutes.',
  },
  {
    q: 'What about data residency and compliance?',
    a: 'SOC 2 Type II audited. EU and US data residency options on Publisher. RBAC, audit logs, SAML/OIDC SSO. No tender content is persisted server-side — only your team config — which simplifies the compliance review considerably.',
  },
];

function FaqItem({
  q,
  a,
  open,
  index,
  onClick,
}: {
  q: string;
  a: string;
  open: boolean;
  index: number;
  onClick: () => void;
}) {
  return (
    <li className="border-b border-ink/15">
      <button
        onClick={onClick}
        className="grid w-full grid-cols-[auto_1fr_auto] items-baseline gap-x-6 py-7 text-left"
        aria-expanded={open}
      >
        <span className="font-mono text-[11px] uppercase tracking-dateline text-ink-mute">
          Q.{String(index + 1).padStart(2, '0')}
        </span>
        <span
          className="font-display text-xl font-bold italic leading-snug tracking-crisp text-ink sm:text-2xl"
          style={{ fontVariationSettings: "'opsz' 72, 'SOFT' 70" }}
        >
          {q}
        </span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-ink-soft"
        >
          <Plus className="h-5 w-5" strokeWidth={1.5} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-[auto_1fr_auto] gap-x-6 pb-7">
              <span aria-hidden className="select-none font-mono text-[11px] uppercase tracking-dateline text-transparent">
                A.{String(index + 1).padStart(2, '0')}
              </span>
              <p className="max-w-3xl text-base leading-relaxed text-ink-soft">{a}</p>
              <span aria-hidden />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <section id="faq" className="bg-paper-deep py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6 lg:px-10">
        <div className="flex flex-col gap-3 border-b border-ink pb-6 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="dateline">Section VII · Correspondence</p>
          <p className="dateline">For questions outside · hello@tenderiq.com</p>
        </div>

        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-10 font-display font-black leading-[0.95] tracking-crisper text-ink"
          style={{
            fontSize: 'clamp(2.6rem, 5.4vw, 4.6rem)',
            fontVariationSettings: "'opsz' 144, 'SOFT' 30",
          }}
        >
          Letters to{' '}
          <span className="italic" style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 90" }}>
            the editor.
          </span>
        </motion.h2>

        <ul className="mt-12">
          {faqs.map((f, i) => (
            <FaqItem
              key={i}
              q={f.q}
              a={f.a}
              index={i}
              open={openIdx === i}
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
