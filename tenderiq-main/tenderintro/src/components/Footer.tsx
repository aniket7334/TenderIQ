const cols = [
  { title: 'The Paper', links: ['The wire', 'Methodology', 'Coverage', 'Changelog', 'Roadmap'] },
  { title: 'Desks', links: ['Marine & ports', 'Energy', 'Infrastructure', 'Government', 'Consulting'] },
  { title: 'Reading room', links: ['Docs', 'Help', 'Status', 'Contact', 'Security'] },
  { title: 'Masthead', links: ['About', 'Careers', 'Press', 'Privacy', 'Terms'] },
];

export default function Footer() {
  return (
    <footer className="border-t-2 border-ink bg-paper">
      {/* Masthead */}
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="border-b border-ink/15 py-10 text-center">
          <p className="dateline">Vol. I · No. 001</p>
          <p
            className="mt-2 font-display text-6xl font-black tracking-crisper text-ink sm:text-7xl lg:text-8xl"
            style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 25" }}
          >
            Tender
            <span className="italic text-signal">IQ</span>
          </p>
          <p className="mt-1 font-display text-base italic tracking-crisp text-ink-soft"
             style={{ fontVariationSettings: "'opsz' 72, 'SOFT' 100" }}>
            A daily wire of global procurement
          </p>
          <p className="mt-3 dateline">Established MMXXV · Dispatched worldwide</p>
        </div>

        {/* Columns */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 py-12 sm:grid-cols-4">
          {cols.map((c) => (
            <div key={c.title}>
              <p className="dateline">{c.title}</p>
              <ul className="mt-4 space-y-2">
                {c.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="ink-link text-[15px] text-ink">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Colophon */}
        <div className="flex flex-col items-start gap-3 border-t border-ink/15 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[11px] uppercase tracking-dateline text-ink-mute">
            © {new Date().getFullYear()} TenderIQ · Composed in Fraunces & Geist · Set on warm paper
          </p>
          <p className="dateline">— Filed in good faith —</p>
        </div>
      </div>
    </footer>
  );
}
