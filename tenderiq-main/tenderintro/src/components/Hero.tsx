import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { motion } from 'framer-motion';

export default function Hero() {
  const headlineRef = useRef<HTMLHeadingElement | null>(null);

  useLayoutEffect(() => {
    if (!headlineRef.current) return;
    const ctx = gsap.context(() => {
      // Character-level reveal across all `.char` spans
      const chars = headlineRef.current!.querySelectorAll<HTMLElement>('.char');
      gsap.set(chars, { yPercent: 110, opacity: 0 });
      gsap.to(chars, {
        yPercent: 0,
        opacity: 1,
        duration: 0.9,
        ease: 'expo.out',
        stagger: 0.018,
        delay: 0.25,
      });
    }, headlineRef);
    return () => ctx.revert();
  }, []);

  const lines: Array<Array<{ t: string; italic?: boolean; tone?: 'signal' }>> = [
    [{ t: 'A daily' }, { t: 'wire of', italic: true }],
    [{ t: 'global' }, { t: 'procurement.' }],
    [{ t: 'Filed', italic: true }, { t: 'before', italic: true }, { t: 'the' }, { t: 'rest', tone: 'signal' }, { t: 'know.' }],
  ];

  return (
    <section
      id="top"
      className="relative isolate overflow-hidden pt-[140px] sm:pt-[170px] lg:pt-[200px] pb-20 lg:pb-28"
    >
      {/* Hairline rule above masthead title */}
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="rule-ink" />

        {/* Dateline */}
        <div className="flex flex-col items-start justify-between gap-3 py-4 sm:flex-row sm:items-baseline">
          <span className="dateline">
            Vol I · Dispatch from 239 procurement portals · Worldwide
          </span>
          <span className="dateline">
            <span className="text-signal">●</span> Live · {new Date().toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </span>
        </div>

        <div className="rule-ink" />
      </div>

      <div className="mx-auto mt-10 max-w-7xl px-6 lg:px-10">
        <div className="grid grid-cols-12 gap-x-6 gap-y-10">
          {/* Headline — 8 cols */}
          <div className="col-span-12 lg:col-span-8">
            <h1
              ref={headlineRef}
              className="font-display font-black tracking-crisper text-ink"
              style={{
                fontSize: 'clamp(2.6rem, 7.2vw, 6.5rem)',
                lineHeight: 0.96,
                fontVariationSettings: "'opsz' 144, 'SOFT' 30",
              }}
            >
              {lines.map((line, li) => (
                <span key={li} className="block overflow-hidden">
                  {line.map((piece, pi) => (
                    <span
                      key={pi}
                      className={
                        (piece.italic ? 'italic ' : '') +
                        (piece.tone === 'signal' ? 'text-signal ' : '') +
                        'inline-block whitespace-nowrap'
                      }
                      style={
                        piece.italic
                          ? { fontVariationSettings: "'opsz' 144, 'SOFT' 80" }
                          : undefined
                      }
                    >
                      {piece.t.split('').map((c, ci) => (
                        <span key={ci} className="char inline-block">
                          {c}
                        </span>
                      ))}
                      {pi < line.length - 1 && (
                        <span className="char inline-block">&nbsp;</span>
                      )}
                    </span>
                  ))}
                </span>
              ))}
            </h1>
          </div>

          {/* Lede + CTAs — 4 cols, editorial sidebar */}
          <motion.aside
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.7 }}
            className="col-span-12 lg:col-span-4 lg:pl-6 lg:border-l lg:border-ink/15"
          >
            <p className="dateline mb-3">The lede</p>
            <p className="text-balance text-[15px] leading-[1.65] text-ink-soft sm:text-base sm:leading-[1.7]">
              TenderIQ aggregates two hundred and thirty-nine public procurement portals
              across eighty countries into a single, editorial-grade feed. Filter by
              region, sector and contract value. Receive the dispatch before your
              competitors know the brief exists.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="#cta"
                className="group inline-flex items-center gap-2 border border-ink bg-ink px-4 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-signal hover:border-signal"
              >
                Begin 14-day subscription
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </a>
              <a href="#demo" className="ink-link text-sm font-medium text-ink">
                Watch the wire (2 min)
              </a>
            </div>

            <p className="mt-7 font-mono text-[11px] uppercase tracking-dateline text-ink-mute">
              ◇ No card required · Cancel inside the app
            </p>
          </motion.aside>
        </div>

        {/* Hairline below */}
        <div className="mt-14 rule-ink-soft" />

        {/* Editorial dashboard strip — like a "front page of the app" */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.9, ease: 'easeOut' }}
          className="mt-14"
        >
          <div className="flex items-baseline justify-between">
            <p className="dateline">The front page · Live dashboard</p>
            <p className="dateline">app.tenderiq.com</p>
          </div>
          <div className="mt-2 rule-ink" />

          <div className="grid grid-cols-12 gap-x-6 gap-y-6 py-8">
            {[
              { label: 'Active tenders', value: '1,447', sub: '+125 today', spark: [4, 6, 5, 9, 8, 12, 11, 16] },
              { label: 'Wires (sources)', value: '239', sub: '80 countries', spark: [6, 6, 7, 8, 8, 9, 10, 10] },
              { label: 'Closing in 7d', value: '292', sub: '12 in next 24h', spark: [10, 8, 12, 9, 14, 11, 16, 13], tone: 'signal' },
              { label: 'Pipeline value', value: '$1.2B', sub: '+12.4% MoM', spark: [3, 4, 7, 5, 8, 12, 10, 14] },
            ].map((s, i) => (
              <article
                key={s.label}
                className="col-span-12 sm:col-span-6 lg:col-span-3 lg:border-r last:lg:border-r-0 border-ink/10 pr-6"
              >
                <p className="dateline">{`No. ${String(i + 1).padStart(2, '0')} · ${s.label}`}</p>
                <p
                  className={`mt-3 font-display text-5xl font-black tracking-crisper sm:text-[58px] ${
                    s.tone === 'signal' ? 'text-signal' : 'text-ink'
                  }`}
                  style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 30" }}
                >
                  {s.value}
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="font-mono text-[11px] text-ink-mute">{s.sub}</p>
                  <svg viewBox="0 0 80 24" className="h-6 w-20">
                    <polyline
                      fill="none"
                      stroke={s.tone === 'signal' ? '#E0531B' : '#15130F'}
                      strokeWidth="1.4"
                      strokeLinecap="square"
                      strokeLinejoin="miter"
                      points={s.spark
                        .map((v, i) => `${(i / (s.spark.length - 1)) * 76 + 2},${22 - (v / 16) * 18}`)
                        .join(' ')}
                    />
                  </svg>
                </div>
              </article>
            ))}
          </div>

          <div className="rule-ink" />

          {/* Sub-headline strip: "today's leaders" */}
          <div className="py-4">
            <p className="dateline mb-3">Today's leaders · Highest-value listings</p>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { country: 'IN', org: 'NHAI Highways', sum: '$38.2M', closes: '14d' },
                { country: 'AE', org: 'ADNOC Procurement', sum: '$22.4M', closes: '9d' },
                { country: 'BR', org: 'Petrobras Subsea', sum: '$19.7M', closes: '6d' },
              ].map((t) => (
                <li key={t.org} className="flex items-baseline gap-3">
                  <span className="font-mono text-[10px] text-ink-mute">{t.country}</span>
                  <span className="flex-1 font-display text-base font-semibold tracking-crisp text-ink">
                    {t.org}
                  </span>
                  <span className="font-mono text-sm font-semibold text-ink">{t.sum}</span>
                  <span className="font-mono text-[10px] uppercase tracking-dateline text-signal">
                    {t.closes}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rule-ink" />
        </motion.section>
      </div>
    </section>
  );
}
