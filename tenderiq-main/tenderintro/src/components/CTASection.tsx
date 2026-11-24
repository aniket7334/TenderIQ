import { motion } from 'framer-motion';

export default function CTASection() {
  return (
    <section id="cta" className="relative overflow-hidden bg-ink text-paper">
      {/* Ornament rules */}
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="border-b border-paper/20 py-5">
          <p className="dateline" style={{ color: 'rgba(244,239,229,0.55)' }}>
            — Section VIII · The pitch —
          </p>
        </div>
      </div>

      {/* Hero text */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="mx-auto max-w-7xl px-6 py-24 text-center lg:px-10 lg:py-32"
      >
        <p className="dateline mb-8" style={{ color: 'rgba(244,239,229,0.5)' }}>
          ◆ Final page ◆
        </p>
        <h2
          className="text-balance font-display font-black leading-[0.92] tracking-crisper text-paper"
          style={{
            fontSize: 'clamp(3rem, 9vw, 8.5rem)',
            fontVariationSettings: "'opsz' 144, 'SOFT' 30",
          }}
        >
          Stop missing{' '}
          <span className="italic text-signal" style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 100" }}>
            the brief.
          </span>
        </h2>
        <p className="mx-auto mt-7 max-w-xl text-balance text-base leading-relaxed text-paper/80 sm:text-lg">
          Two hundred and thirty-nine wires. Eighty countries. One subscription, billed by the seat.
          Start free; upgrade only when the team does.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#signup"
            className="group inline-flex items-center gap-2 bg-paper px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-signal hover:text-paper"
          >
            Begin 14-day subscription
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </a>
          <a
            href="#contact"
            className="ink-link inline-flex items-center gap-2 text-sm font-medium text-paper"
            style={{ textDecorationColor: 'rgba(244,239,229,0.5)' }}
          >
            Book a 15-min editorial demo
          </a>
        </div>

        <p className="mt-7 font-mono text-[11px] uppercase tracking-dateline" style={{ color: 'rgba(244,239,229,0.55)' }}>
          ◇ No card required · Cancel inside the app · SOC 2 Type II
        </p>
      </motion.div>

      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="border-t border-paper/20 py-5">
          <p className="dateline text-right" style={{ color: 'rgba(244,239,229,0.55)' }}>
            — End —
          </p>
        </div>
      </div>
    </section>
  );
}
