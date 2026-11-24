import { useMemo } from 'react';

/**
 * Live wire ticker — the signature visual element of the page.
 * Runs across the top, just under the masthead. Stock-crawl style.
 *
 * Each entry is one tender event. We render the list twice in a single
 * track so a CSS marquee can loop seamlessly via -50% translation.
 */

interface Tick {
  arrow: '▲' | '▼' | '◆' | '★';
  label: string;
  value: string;
  meta: string;
  tone?: 'up' | 'down' | 'new' | 'neutral';
}

const ticks: Tick[] = [
  { arrow: '★', label: 'NEW · Cochin Shipyard', value: '$4.5M', meta: 'closes 12d', tone: 'new' },
  { arrow: '▲', label: 'GeM · Crane procurement', value: '$8.7M', meta: '+3 since 06:00', tone: 'up' },
  { arrow: '◆', label: 'TED EU · DEU port works', value: '€2.1M', meta: 'PUBLISHED', tone: 'neutral' },
  { arrow: '▼', label: 'Transnet Durban', value: '$850K', meta: 'closes 3d', tone: 'down' },
  { arrow: '★', label: 'NEW · Saudi Etimad', value: 'SAR 6.2M', meta: 'just listed', tone: 'new' },
  { arrow: '▲', label: 'World Bank · Tanzania water', value: '$12M', meta: 'EOI extended', tone: 'up' },
  { arrow: '◆', label: 'SAM.gov · USACE dredging', value: '$33M', meta: 'Q-bid', tone: 'neutral' },
  { arrow: '★', label: 'NEW · UK FTS infra', value: '£1.8M', meta: 'opens today', tone: 'new' },
  { arrow: '▼', label: 'CPPP · MES Karwar', value: '₹7.1Cr', meta: 'closes 5d', tone: 'down' },
  { arrow: '▲', label: 'CanadaBuys · ICT', value: 'C$4M', meta: '+2 today', tone: 'up' },
  { arrow: '◆', label: 'AusTender · vessel maint.', value: 'A$2.3M', meta: 'RFP', tone: 'neutral' },
  { arrow: '★', label: 'NEW · Hamad Port', value: 'QAR 9M', meta: 'crane LOT', tone: 'new' },
];

function toneClass(t?: Tick['tone']) {
  switch (t) {
    case 'up': return 'text-emerald-500';
    case 'down': return 'text-signal';
    case 'new': return 'text-signal';
    case 'neutral':
    default:
      return 'text-paper/70';
  }
}

export default function TickerBar() {
  const track = useMemo(() => [...ticks, ...ticks], []);
  return (
    <div className="fixed left-0 right-0 top-0 z-40 border-b border-ink/90 bg-ink text-paper">
      <div className="relative flex items-stretch">
        {/* Left badge */}
        <div className="z-10 flex items-center gap-2 border-r border-paper/15 bg-ink px-4 py-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-signal" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-signal" />
          </span>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-dateline text-paper">
            Wire · Live
          </span>
        </div>

        {/* Marquee track */}
        <div className="mask-fade-x relative flex-1 overflow-hidden">
          <div className="flex w-max animate-ticker gap-x-10 whitespace-nowrap py-2 pl-6">
            {track.map((t, i) => (
              <span key={i} className="inline-flex items-center gap-2 font-mono text-[11px]">
                <span className={toneClass(t.tone)}>{t.arrow}</span>
                <span className="font-semibold tracking-tight text-paper">
                  {t.label}
                </span>
                <span className="text-paper/60">·</span>
                <span className="font-bold text-paper">{t.value}</span>
                <span className="text-paper/40">·</span>
                <span className="uppercase tracking-dateline text-paper/50">
                  {t.meta}
                </span>
                <span className="ml-2 text-paper/20">⊹</span>
              </span>
            ))}
          </div>
        </div>

        {/* Right timestamp */}
        <div className="z-10 hidden items-center border-l border-paper/15 bg-ink px-4 py-2 sm:flex">
          <span className="font-mono text-[10px] uppercase tracking-dateline text-paper/70">
            ISSUE 001 · 239 SOURCES
          </span>
        </div>
      </div>
    </div>
  );
}
