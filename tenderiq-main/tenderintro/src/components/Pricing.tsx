import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

const tiers = [
  {
    name: 'Cub Reporter',
    price: '0',
    period: 'forever',
    desc: 'Solo bidders. One region, no team seats.',
    cta: 'Subscribe',
    highlight: false,
    features: [
      'One region (any country)',
      'Three saved filter views',
      'Email dispatch',
      'CSV export',
      'Five-minute refresh',
    ],
  },
  {
    name: 'Editor',
    price: '99',
    period: 'per seat / month',
    desc: 'Growing procurement teams. Most subscribed.',
    cta: 'Begin 14-day trial',
    highlight: true,
    features: [
      'Unlimited regions & sectors',
      'Unlimited saved views',
      'Slack, email & in-app dispatch',
      'Shortlist, assign, comment',
      'API · 10,000 calls / month',
      'Multi-currency, auto-USD',
      'Priority correspondence',
    ],
  },
  {
    name: 'Publisher',
    price: '—',
    period: 'bespoke',
    desc: 'Multi-team orgs with SSO, audit and custom wires.',
    cta: 'Speak to sales',
    highlight: false,
    features: [
      'Everything in Editor',
      'SSO · SAML / OIDC',
      'RBAC + audit log',
      'Custom source integrations',
      'EU + US data residency',
      'Dedicated CSM',
      'SLA · 99.95% uptime',
    ],
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="bg-paper py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="flex flex-col gap-3 border-b border-ink pb-6 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="dateline">Section VI · Subscriptions</p>
          <p className="dateline">Per seat · billed monthly · USD</p>
        </div>

        <div className="grid grid-cols-12 gap-x-6 gap-y-4 pt-10">
          <div className="col-span-12 lg:col-span-5">
            <h2
              className="text-balance font-display font-black leading-[0.95] tracking-crisper text-ink"
              style={{
                fontSize: 'clamp(2.6rem, 5.4vw, 4.6rem)',
                fontVariationSettings: "'opsz' 144, 'SOFT' 30",
              }}
            >
              Three desks.{' '}
              <span className="italic text-signal" style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 90" }}>
                One paper.
              </span>
            </h2>
          </div>
          <div className="col-span-12 lg:col-span-7 lg:pl-10 lg:border-l lg:border-ink/15">
            <p className="max-w-xl text-base leading-relaxed text-ink-soft">
              Start with the wire — every tender, every day, at no cost. Upgrade when your
              team grows. Cancel inside the application; no calls, no procurement-sized
              invoices.
            </p>
          </div>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {tiers.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className={cn(
                'relative flex flex-col p-7',
                t.highlight
                  ? 'bg-ink text-paper'
                  : 'bg-paper-card text-ink border border-ink/15',
              )}
            >
              {t.highlight && (
                <span className="absolute -top-3 left-7 bg-signal px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-dateline text-paper">
                  Editor's pick
                </span>
              )}

              <p
                className={cn(
                  'dateline',
                  t.highlight ? 'text-paper/60' : 'text-ink-mute',
                )}
              >
                {t.highlight ? 'Most subscribed' : `No. 0${i + 1}`}
              </p>

              <h3
                className={cn(
                  'mt-3 font-display text-3xl font-black italic tracking-crisp',
                  t.highlight ? 'text-paper' : 'text-ink',
                )}
                style={{ fontVariationSettings: "'opsz' 96, 'SOFT' 70" }}
              >
                {t.name}
              </h3>
              <p
                className={cn(
                  'mt-1 text-sm leading-relaxed',
                  t.highlight ? 'text-paper/70' : 'text-ink-soft',
                )}
              >
                {t.desc}
              </p>

              <div className="mt-7 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold leading-none">$</span>
                <span
                  className={cn(
                    'font-display font-black leading-none tracking-crisper',
                    t.highlight ? 'text-paper' : 'text-ink',
                  )}
                  style={{
                    fontSize: 'clamp(3.5rem, 5vw, 4.5rem)',
                    fontVariationSettings: "'opsz' 144, 'SOFT' 20",
                  }}
                >
                  {t.price}
                </span>
                <span
                  className={cn(
                    'font-mono text-[11px] uppercase tracking-dateline',
                    t.highlight ? 'text-paper/55' : 'text-ink-mute',
                  )}
                >
                  / {t.period}
                </span>
              </div>

              <a
                href={t.name === 'Publisher' ? '#contact' : '#cta'}
                className={cn(
                  'mt-7 inline-flex w-full items-center justify-center gap-2 border px-4 py-3 text-sm font-semibold transition-colors',
                  t.highlight
                    ? 'border-paper bg-paper text-ink hover:bg-signal hover:border-signal hover:text-paper'
                    : 'border-ink bg-paper-card text-ink hover:bg-ink hover:text-paper',
                )}
              >
                {t.cta} <span>→</span>
              </a>

              <ul
                className={cn(
                  'mt-7 space-y-3 border-t pt-6 text-sm',
                  t.highlight ? 'border-paper/20 text-paper/85' : 'border-ink/15 text-ink-soft',
                )}
              >
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <span
                      className={cn(
                        'mt-[7px] inline-block h-px w-3 flex-shrink-0',
                        t.highlight ? 'bg-signal' : 'bg-ink',
                      )}
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <p className="mt-10 text-center font-mono text-[11px] uppercase tracking-dateline text-ink-mute">
          Volume discounts at 25+ seats · contact circulation@tenderiq.com
        </p>
      </div>
    </section>
  );
}
