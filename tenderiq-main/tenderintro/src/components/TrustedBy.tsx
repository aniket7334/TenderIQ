const wires = [
  'GeM', 'CPPP', 'eTenders NIC', 'IREPS', 'TED EU', 'SAM.gov',
  'USASpending', 'World Bank', 'UK Find a Tender', 'UK Contracts Finder',
  'AusTender', 'CanadaBuys', 'Saudi Etimad', 'Hamad Port', 'ADNOC',
  'Mawani', 'Transnet', 'UNGM', 'UNDP', 'NHAI', 'AAI', 'Cochin Shipyard',
];

export default function TrustedBy() {
  return (
    <section className="border-y border-ink/15 bg-paper-deep py-12">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-10">
          <div className="lg:max-w-[14rem]">
            <p className="dateline">Wires</p>
            <p className="mt-2 font-display text-xl italic leading-snug tracking-crisp text-ink">
              Carried from twenty-two of the world's leading procurement registries.
            </p>
          </div>
          <div className="mask-fade-x relative flex-1 overflow-hidden">
            <div className="flex w-max animate-ticker-slow gap-x-10 whitespace-nowrap py-1">
              {[...wires, ...wires].map((w, i) => (
                <span
                  key={i}
                  className="flex items-center gap-3 font-mono text-[12px] tracking-wide text-ink-soft"
                >
                  <span className="inline-block h-1 w-1 rounded-full bg-signal" />
                  <span className="font-semibold uppercase">{w}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
