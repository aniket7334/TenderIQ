import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import gsap from 'gsap';

function Counter({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  useEffect(() => {
    if (!inView) return;
    const o = { v: 0 };
    gsap.to(o, {
      v: value,
      duration: 1.8,
      ease: 'expo.out',
      onUpdate: () => setN(Math.round(o.v)),
    });
  }, [inView, value]);
  return (
    <span ref={ref}>
      {prefix}
      {n.toLocaleString()}
      {suffix}
    </span>
  );
}

interface Item {
  value: number;
  prefix?: string;
  suffix?: string;
  cat: string;
  unit: string;
  hint: string;
}

const items: Item[] = [
  { value: 239, suffix: '', cat: 'Live wires', unit: 'sources', hint: 'CPPP · TED · SAM · WB +' },
  { value: 80, suffix: '', cat: 'Jurisdictions', unit: 'countries', hint: 'six continents' },
  { value: 203456, cat: 'Listings indexed', unit: 'tenders', hint: 'updated 5-minutely' },
  { value: 12, prefix: '$', suffix: 'B', cat: 'Contract value', unit: 'aggregate', hint: 'under active watch' },
];

export default function Stats() {
  return (
    <section id="stats" className="border-t border-ink/15 bg-paper-deep py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="flex flex-col gap-3 border-b border-ink pb-6 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="dateline">Section IV · Coverage by the numbers</p>
          <p className="dateline">As of today · {new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}</p>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-2 gap-y-10 pt-12 lg:grid-cols-4 lg:gap-y-0"
        >
          {items.map((it, i) => (
            <div
              key={it.cat}
              className={`px-2 sm:px-6 lg:border-r lg:border-ink/15 ${
                i === items.length - 1 ? 'lg:border-r-0' : ''
              }`}
            >
              <p className="dateline">{`No. ${String(i + 1).padStart(2, '0')}`}</p>
              <p
                className="mt-3 font-display font-black tracking-crisper text-ink"
                style={{
                  fontSize: 'clamp(3.2rem, 5.6vw, 5.4rem)',
                  lineHeight: 0.9,
                  fontVariationSettings: "'opsz' 144, 'SOFT' 20",
                }}
              >
                <Counter value={it.value} prefix={it.prefix} suffix={it.suffix} />
              </p>
              <div className="mt-3 h-px w-8 bg-signal" />
              <p className="mt-3 font-display text-base font-bold italic tracking-crisp text-ink"
                 style={{ fontVariationSettings: "'opsz' 72, 'SOFT' 80" }}>
                {it.cat}
              </p>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-dateline text-ink-mute">
                {it.unit}
              </p>
              <p className="mt-3 max-w-[12rem] text-[13px] leading-snug text-ink-soft">
                {it.hint}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
