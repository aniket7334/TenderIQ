import { motion } from 'framer-motion';

const steps = [
  {
    n: '01',
    title: 'Subscribe.',
    body:
      'No scrapers to wire. Every source is pre-cleared at signup — TED, SAM.gov, World Bank, every Indian state portal, GCC etenders and the rest.',
  },
  {
    n: '02',
    title: 'File your brief.',
    body:
      'Define what you bid on: regions, sectors, contract bands. Save the view; TenderIQ does the cross-referencing on every refresh.',
  },
  {
    n: '03',
    title: 'Act on the wire.',
    body:
      'Dispatch lands in your inbox the moment a tender matches. Triage, shortlist and assign — long before the listing makes the morning round-up elsewhere.',
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how"
      className="relative overflow-hidden bg-navy text-paper"
    >
      {/* Top dateline rule */}
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="flex flex-col gap-2 border-b border-paper/15 py-5 sm:flex-row sm:items-baseline sm:justify-between">
          <span className="dateline" style={{ color: 'rgba(244,239,229,0.55)' }}>
            Section III · The Process
          </span>
          <span className="dateline" style={{ color: 'rgba(244,239,229,0.55)' }}>
            <span className="text-signal">●</span> From subscription to first dispatch · 47 minutes
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
        <div className="grid grid-cols-12 gap-x-6 gap-y-6">
          <div className="col-span-12 lg:col-span-5">
            <h2
              className="text-balance font-display font-black leading-[0.95] tracking-crisper"
              style={{
                fontSize: 'clamp(2.6rem, 6.4vw, 5.4rem)',
                fontVariationSettings: "'opsz' 144, 'SOFT' 30",
              }}
            >
              How the{' '}
              <span className="italic" style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 100" }}>
                paper
              </span>{' '}
              is filed.
            </h2>
          </div>
          <div className="col-span-12 lg:col-span-7 lg:pl-10 lg:border-l lg:border-paper/15">
            <p className="max-w-xl text-lg leading-relaxed text-paper/80">
              A simple newsroom workflow. Subscribe, file your editorial brief, then read
              the wire as the dispatch arrives. No scrapers, no logins, no batch jobs.
            </p>
          </div>
        </div>

        {/* Steps as broadsheet columns */}
        <div className="mt-14 grid grid-cols-1 gap-y-10 md:grid-cols-3 md:gap-x-10 md:gap-y-0">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, delay: i * 0.12 }}
              className="relative md:border-r md:border-paper/12 md:pr-10 last:md:border-r-0 last:md:pr-0"
            >
              <p
                className="font-display text-[120px] font-black leading-none tracking-crisper text-signal"
                style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 20" }}
              >
                {s.n}
              </p>
              <div className="my-4 h-px w-12 bg-paper/40" />
              <h3
                className="font-display text-3xl font-black leading-tight tracking-crisp"
                style={{ fontVariationSettings: "'opsz' 96, 'SOFT' 40" }}
              >
                {s.title}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-paper/75">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bottom dateline rule */}
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="border-t border-paper/15 py-5">
          <span className="dateline" style={{ color: 'rgba(244,239,229,0.55)' }}>
            — End Section III —
          </span>
        </div>
      </div>
    </section>
  );
}
