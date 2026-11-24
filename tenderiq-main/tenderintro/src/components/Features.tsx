import { motion } from 'framer-motion';
import { useGsapReveal } from '../hooks/useGsapReveal';

/* ── Editorial map — global coverage ── */
function MapPanel() {
  const dots = [
    { x: 22, y: 36, l: 'IN' }, { x: 14, y: 32, l: 'UK' }, { x: 32, y: 40, l: 'AE' },
    { x: 8, y: 44, l: 'US' }, { x: 26, y: 28, l: 'EU' }, { x: 40, y: 60, l: 'AU' },
    { x: 16, y: 52, l: 'BR' }, { x: 34, y: 50, l: 'KE' }, { x: 38, y: 32, l: 'JP' },
    { x: 28, y: 56, l: 'ZA' }, { x: 20, y: 44, l: 'EG' }, { x: 12, y: 40, l: 'CA' },
  ];
  return (
    <div className="relative aspect-[5/3] w-full overflow-hidden border border-ink/15 bg-paper-deep">
      <svg viewBox="0 0 48 30" className="h-full w-full">
        {/* Latitude/longitude hairlines */}
        {[6, 12, 18, 24].map((y) => (
          <line key={`h${y}`} x1={0} y1={y} x2={48} y2={y} stroke="#15130F" strokeOpacity="0.06" strokeWidth="0.08" />
        ))}
        {[8, 16, 24, 32, 40].map((x) => (
          <line key={`v${x}`} x1={x} y1={0} x2={x} y2={30} stroke="#15130F" strokeOpacity="0.06" strokeWidth="0.08" />
        ))}
        {dots.map((d, i) => (
          <g key={i}>
            <circle cx={d.x} cy={d.y} r="0.5" fill="#15130F" />
            <circle cx={d.x} cy={d.y} r="1.8" fill="#E0531B" fillOpacity="0.18">
              <animate attributeName="r" values="0.5;3;0.5" dur="3.6s" begin={`${i * 0.35}s`} repeatCount="indefinite" />
              <animate attributeName="fill-opacity" values="0.4;0;0.4" dur="3.6s" begin={`${i * 0.35}s`} repeatCount="indefinite" />
            </circle>
            <text x={d.x + 0.9} y={d.y - 0.7} fontSize="0.95" fontFamily="Geist Mono, monospace" fill="#15130F" fillOpacity="0.55">
              {d.l}
            </text>
          </g>
        ))}
      </svg>
      {/* Caption strip */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-ink/15 bg-paper px-3 py-1.5">
        <span className="dateline">Fig. 01 · Active wires by region</span>
        <span className="font-mono text-[10px] text-signal">N = 239</span>
      </div>
    </div>
  );
}

/* ── Wire ledger — notification stack ── */
function LedgerPanel() {
  const items = [
    { tag: 'NEW', tagCls: 'text-signal', title: 'Cochin Shipyard · Hull repair', meta: '$2.1M · 12d' },
    { tag: 'URG', tagCls: 'text-signal', title: 'Hamad Port · Crane LOT', meta: '$8.7M · 2d' },
    { tag: 'STR', tagCls: 'text-ink', title: 'NHAI · Highway maint.', meta: '$15M · 9d' },
    { tag: 'NEW', tagCls: 'text-signal', title: 'TED EU · DEU rail siding', meta: '€2.4M · 21d' },
  ];
  return (
    <div className="border border-ink/15">
      <div className="flex items-center justify-between border-b border-ink/15 bg-paper-deep px-3 py-1.5">
        <span className="dateline">Wire ledger</span>
        <span className="font-mono text-[10px] text-ink-mute">04 / 04</span>
      </div>
      <ul>
        {items.map((it, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 * i, duration: 0.4 }}
            className="flex items-center gap-3 border-b border-ink/10 px-3 py-2 last:border-b-0"
          >
            <span className={`font-mono text-[10px] font-bold uppercase tracking-dateline ${it.tagCls}`}>
              {it.tag}
            </span>
            <span className="flex-1 truncate font-display text-sm font-semibold tracking-crisp text-ink">
              {it.title}
            </span>
            <span className="font-mono text-[11px] text-ink-mute">{it.meta}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

/* ── Tabular filters ── */
function FiltersPanel() {
  const rows = [
    { cat: 'Region', val: 'India · UAE · EU', active: 3 },
    { cat: 'Sector', val: 'Port · Maritime', active: 2 },
    { cat: 'Value', val: '> $1,000,000', active: 1 },
    { cat: 'Closes', val: 'next 30 days', active: 1 },
  ];
  return (
    <div className="border border-ink/15 bg-paper-card">
      <div className="flex items-center justify-between border-b border-ink/15 bg-paper-deep px-3 py-1.5">
        <span className="dateline">Saved view · Marine GCC</span>
        <span className="font-mono text-[10px] text-signal">● Live</span>
      </div>
      <table className="w-full text-left">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-ink/8 last:border-b-0">
              <td className="px-3 py-2 font-mono text-[10px] uppercase tracking-dateline text-ink-mute w-1/3">
                {r.cat}
              </td>
              <td className="px-3 py-2 font-display text-sm tracking-crisp text-ink">
                {r.val}
              </td>
              <td className="px-3 py-2 text-right font-mono text-[11px] text-signal">
                ×{r.active}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Live counter ledger ── */
function CounterPanel() {
  return (
    <div className="flex h-full flex-col justify-between border border-ink/15 bg-paper-card p-5">
      <div className="flex items-baseline justify-between">
        <span className="dateline">Indexed listings</span>
        <span className="font-mono text-[10px] text-signal">●</span>
      </div>
      <div>
        <p
          className="font-display text-[88px] font-black leading-[0.85] tracking-crisper text-ink"
          style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 20" }}
        >
          203,456
        </p>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-dateline text-ink-mute">
          <span className="text-signal">▲ 1,124</span> since yesterday
        </p>
      </div>
    </div>
  );
}

/* ── Code — API column ── */
function CodePanel() {
  return (
    <div className="border border-ink/15 bg-ink p-5 font-mono text-[11.5px] leading-[1.65] text-paper/80">
      <p className="text-paper/40">// Stream new matches into your CRM</p>
      <p>
        <span className="text-signal">const</span>{' '}
        tenders = <span className="text-signal">await</span> tenderiq.<span className="text-paper">watch</span>(<span className="text-paper">{'{'}</span>
      </p>
      <p className="pl-4 text-paper/80">
        country: <span className="text-paper">'India'</span>,
      </p>
      <p className="pl-4">
        sector:  <span className="text-paper">'Port'</span>,
      </p>
      <p className="pl-4">
        minValue: <span className="text-signal">1_000_000</span>,
      </p>
      <p>{'});'}</p>
      <p className="mt-2 text-paper/40">→ 14 new matches today</p>
    </div>
  );
}

/* ── Compliance ── */
function CompliancePanel() {
  return (
    <div className="flex h-full flex-col justify-between border border-ink/15 bg-paper-card p-5">
      <div>
        <p className="dateline">Compliance</p>
        <p
          className="mt-2 font-display text-3xl font-black tracking-crisp text-ink"
          style={{ fontVariationSettings: "'opsz' 96, 'SOFT' 40" }}
        >
          Enterprise-ready, day one.
        </p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 text-[11px] font-mono">
        {['SOC 2 II', 'SSO · SAML', 'RBAC', 'GDPR', 'EU residency', 'Audit log'].map((b) => (
          <span key={b} className="border border-ink/15 bg-paper px-2 py-1.5 text-center uppercase tracking-dateline text-ink-soft">
            {b}
          </span>
        ))}
      </div>
    </div>
  );
}

const cards: Array<{
  no: string;
  title: string;
  body: string;
  panel: React.ReactNode;
  span: string;
}> = [
  {
    no: '§ 01',
    title: 'A wire from every desk.',
    body: 'Two hundred and thirty-nine portals across six continents, refreshed every five minutes. One feed, no tabs.',
    panel: <MapPanel />,
    span: 'lg:col-span-7',
  },
  {
    no: '§ 02',
    title: 'Alerts you can act on.',
    body: 'Email, Slack and in-app dispatch the second a listing matches your saved view.',
    panel: <LedgerPanel />,
    span: 'lg:col-span-5',
  },
  {
    no: '§ 03',
    title: 'Numbers that move.',
    body: 'Live counters drawn straight from the source — no nightly batch.',
    panel: <CounterPanel />,
    span: 'lg:col-span-4',
  },
  {
    no: '§ 04',
    title: 'Slice the day by the bid you want.',
    body: 'Saved views by region, sector and contract value — automatic from then on.',
    panel: <FiltersPanel />,
    span: 'lg:col-span-4',
  },
  {
    no: '§ 05',
    title: 'Wired into your stack.',
    body: 'REST, GraphQL and signed webhooks. A TypeScript SDK that reads like prose.',
    panel: <CodePanel />,
    span: 'lg:col-span-4',
  },
  {
    no: '§ 06',
    title: 'Built for the audit committee.',
    body: 'Enterprise controls baked in. We never persist tender content on our servers.',
    panel: <CompliancePanel />,
    span: 'lg:col-span-12',
  },
];

export default function Features() {
  const ref = useGsapReveal<HTMLDivElement>({ stagger: 0.05 });

  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div ref={ref} className="mx-auto max-w-7xl px-6 lg:px-10">
        {/* Section header */}
        <div className="grid grid-cols-12 gap-x-6 gap-y-4">
          <div className="col-span-12 lg:col-span-3">
            <p className="dateline reveal">Section II</p>
            <p
              className="mt-1 font-display text-5xl font-black leading-none tracking-crisper text-ink reveal"
              style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 30" }}
            >
              The Desk.
            </p>
          </div>
          <div className="col-span-12 lg:col-span-9 lg:pl-10 lg:border-l lg:border-ink/15">
            <h2
              className="text-balance font-display text-3xl font-black leading-tight tracking-crisper text-ink sm:text-4xl reveal"
              style={{ fontVariationSettings: "'opsz' 96, 'SOFT' 40" }}
            >
              Everything a procurement team needs — printed once, refreshed{' '}
              <span className="italic text-signal" style={{ fontVariationSettings: "'opsz' 96, 'SOFT' 90" }}>
                every five minutes
              </span>
              .
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-soft reveal">
              A workspace shaped like an editorial floor. Wires across the top, leaders down the
              middle, the day's brief on every page.
            </p>
          </div>
        </div>

        <div className="my-12 rule-ink" />

        {/* Bento grid */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-x-5 lg:gap-y-6">
          {cards.map((c) => (
            <article
              key={c.no}
              className={`reveal group relative flex flex-col bg-paper-card border border-ink/15 p-6 transition-colors hover:border-ink ${c.span}`}
            >
              <div className="flex items-baseline justify-between">
                <p className="font-mono text-[10px] uppercase tracking-dateline text-signal">
                  {c.no}
                </p>
                <span className="font-mono text-[10px] text-ink-fade">↗</span>
              </div>
              <h3
                className="mt-2 text-balance font-display text-2xl font-black leading-tight tracking-crisp text-ink"
                style={{ fontVariationSettings: "'opsz' 72, 'SOFT' 50" }}
              >
                {c.title}
              </h3>
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-soft">{c.body}</p>
              <div className="mt-5 flex-1">{c.panel}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
