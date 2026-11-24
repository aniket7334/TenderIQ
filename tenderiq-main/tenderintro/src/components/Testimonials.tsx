import { motion } from 'framer-motion';

const lead = {
  body:
    "TenderIQ replaced four browser tabs and two SaaS subscriptions. We caught a fourteen-million-dollar port-dredging tender six hours before our competitors knew it existed — and won the brief.",
  name: 'Aarav Mehta',
  role: 'Head of Bidding · Coastal Marine Co., Mumbai',
};

const quotes = [
  {
    body:
      'Eleven GCC sources plus the World Bank in one feed. The category filter alone saves my analysts twelve hours a week.',
    name: 'Sara Al-Hashimi',
    role: 'Procurement Director · Hadid Infra, Dubai',
  },
  {
    body:
      "The cleanest aggregator I've used. No data lock-in, real-time deadlines, and the API plays well with our CRM.",
    name: 'James Okonkwo',
    role: 'Director · Lagos Procurement Partners',
  },
  {
    body:
      'A tool for serious teams. The dispatch model lines up perfectly with how we already triage briefs in our morning stand-up.',
    name: 'Priya Iyer',
    role: 'Operations · IRCON International',
  },
];

export default function Testimonials() {
  return (
    <section className="bg-paper py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="flex flex-col gap-3 border-b border-ink pb-6 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="dateline">Section V · Letters from the field</p>
          <p className="dateline">Sourced May–Nov, 2025</p>
        </div>

        {/* Lead quote */}
        <motion.figure
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="grid grid-cols-12 gap-x-6 gap-y-6 py-14"
        >
          <div className="col-span-12 lg:col-span-2">
            <p
              className="font-display text-[140px] font-black leading-none text-signal"
              style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 30" }}
            >
              “
            </p>
          </div>
          <div className="col-span-12 lg:col-span-10">
            <blockquote
              className="font-display text-3xl font-medium italic leading-snug tracking-crisp text-ink sm:text-4xl lg:text-[44px]"
              style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 80" }}
            >
              {lead.body}
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              <div className="h-px w-12 bg-ink" />
              <p className="font-mono text-[12px] uppercase tracking-dateline text-ink">
                {lead.name}
              </p>
              <span className="text-ink-fade">·</span>
              <p className="font-mono text-[11px] uppercase tracking-dateline text-ink-mute">
                {lead.role}
              </p>
            </figcaption>
          </div>
        </motion.figure>

        <div className="rule-ink" />

        {/* Sub-quotes */}
        <div className="grid grid-cols-1 gap-x-10 gap-y-10 pt-12 lg:grid-cols-3">
          {quotes.map((q, i) => (
            <motion.figure
              key={q.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="lg:border-r lg:border-ink/15 lg:pr-10 last:lg:border-r-0 last:lg:pr-0"
            >
              <p className="font-display text-3xl font-black italic leading-none text-signal"
                 style={{ fontVariationSettings: "'opsz' 96, 'SOFT' 80" }}>
                ‟
              </p>
              <blockquote className="mt-2 text-balance text-[15px] leading-[1.65] text-ink-soft">
                {q.body}
              </blockquote>
              <figcaption className="mt-5">
                <p className="font-display text-base font-bold italic tracking-crisp text-ink"
                   style={{ fontVariationSettings: "'opsz' 72, 'SOFT' 60" }}>
                  — {q.name}
                </p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-dateline text-ink-mute">
                  {q.role}
                </p>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
