import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { cn } from '../lib/utils';

const links = [
  { label: 'The wire', href: '#features' },
  { label: 'Methodology', href: '#how' },
  { label: 'Coverage', href: '#stats' },
  { label: 'Subscribe', href: '#pricing' },
  { label: 'Q&A', href: '#faq' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState(() => formatTime(new Date()));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTime(formatTime(new Date())), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={cn(
        // Sits BELOW the TickerBar (which is z-40 / fixed top)
        'fixed left-0 right-0 top-[36px] z-30 transition-all duration-300',
        scrolled
          ? 'border-b border-ink/15 bg-paper/85 backdrop-blur-md'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-6 lg:px-10">
        {/* Wordmark masthead — no boxy logo, just type */}
        <a href="#top" className="group flex items-baseline gap-3">
          <span className="font-display text-[26px] font-black leading-none tracking-crisper text-ink">
            Tender
            <span className="italic text-signal">IQ</span>
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-dateline text-ink-mute sm:inline-block">
            · Issue 001 · {time}
          </span>
        </a>

        <ul className="hidden items-center gap-7 lg:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="group inline-flex items-center text-sm font-medium text-ink-soft transition-colors hover:text-ink"
              >
                <span className="border-b border-transparent pb-0.5 transition-colors group-hover:border-signal">
                  {l.label}
                </span>
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 lg:flex">
          <a
            href="#login"
            className="text-sm font-medium text-ink-soft hover:text-ink"
          >
            Sign in
          </a>
          <a
            href="#cta"
            className="group inline-flex items-center gap-2 rounded-none border border-ink bg-ink px-4 py-2 text-sm font-semibold text-paper transition-all hover:bg-signal hover:border-signal"
          >
            Start trial
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </a>
        </div>

        <button
          aria-label="Open menu"
          onClick={() => setOpen((o) => !o)}
          className="rounded-none border border-ink/20 p-2 text-ink hover:border-ink lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden border-t border-ink/15 bg-paper lg:hidden"
        >
          <ul className="space-y-1 px-6 py-4">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block py-2 text-sm font-medium text-ink hover:text-signal"
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li className="pt-3">
              <a
                href="#cta"
                className="inline-flex w-full items-center justify-center gap-2 border border-ink bg-ink px-3.5 py-2.5 text-sm font-semibold text-paper"
              >
                Start trial →
              </a>
            </li>
          </ul>
        </motion.div>
      )}
    </motion.header>
  );
}

function formatTime(d: Date) {
  const hh = d.getUTCHours().toString().padStart(2, '0');
  const mm = d.getUTCMinutes().toString().padStart(2, '0');
  return `${hh}:${mm} GMT`;
}
