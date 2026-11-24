import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  BellRing,
  CalendarClock,
  FileText,
  Landmark,
  MapPin,
  Sparkles,
  IndianRupee,
} from 'lucide-react';

const features = [
  {
    icon: BellRing,
    title: 'Instant tender alerts',
    text: 'Get notified the moment a tender matching your keywords goes live.',
  },
  {
    icon: FileText,
    title: 'AI tender notes',
    text: 'Eligibility, EMD and scope pulled out of long PDFs into one clean summary.',
  },
  {
    icon: CalendarClock,
    title: 'Deadline tracking',
    text: 'Bid submission and pre-bid dates in one view, so nothing slips.',
  },
];

const portals = ['GeM', 'CPPP', 'IREPS', 'Port Trusts'];

function BrandMark({ light = false }) {
  return (
    <Link to="/login" className="inline-flex items-center gap-2.5">
      <span
        className={clsx(
          'flex h-10 w-10 items-center justify-center rounded-xl font-display text-sm font-extrabold tracking-tight shadow-lg',
          light
            ? 'bg-white text-brand-700 shadow-black/20'
            : 'bg-gradient-to-br from-brand-500 to-indigo-600 text-white shadow-brand-600/30',
        )}
      >
        TQ
      </span>
      <span
        className={clsx(
          'font-display text-lg font-bold tracking-tight',
          light ? 'text-white' : 'text-gray-900',
        )}
      >
        TenderIQ
      </span>
    </Link>
  );
}

/** Illustrative product preview shown on the brand panel. */
function AlertPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* back card: deadline */}
      <div className="absolute -right-2 -top-6 w-56 rotate-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-md xl:-right-6">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-blue-200/80">
          <CalendarClock className="h-3.5 w-3.5" /> Closing soon
        </div>
        <div className="mt-3 space-y-2.5">
          {[
            { d: '3d', w: 'w-4/5' },
            { d: '6d', w: 'w-3/5' },
            { d: '9d', w: 'w-2/3' },
          ].map((r) => (
            <div key={r.d} className="flex items-center gap-2">
              <span className="w-6 text-[11px] font-semibold text-amber-300">{r.d}</span>
              <span className={clsx('h-1.5 rounded-full bg-white/20', r.w)} />
            </div>
          ))}
        </div>
      </div>

      {/* front card: new tender alert */}
      <div className="relative animate-float rounded-2xl border border-white/15 bg-white p-5 text-gray-900 shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            New match · just now
          </span>
          <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
            “dredging”
          </span>
        </div>
        <p className="mt-3 font-display text-[15px] font-bold leading-snug">
          Maintenance dredging of approach channel and turning circle
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1">
            <Landmark className="h-3.5 w-3.5" /> Port Trust
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> Andhra Pradesh
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-4 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400">Est. value</p>
            <p className="mt-0.5 inline-flex items-center text-sm font-bold">
              <IndianRupee className="h-3 w-3" />
              48 Cr
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400">EMD</p>
            <p className="mt-0.5 inline-flex items-center text-sm font-bold">
              <IndianRupee className="h-3 w-3" />
              24 L
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400">Closes in</p>
            <p className="mt-0.5 text-sm font-bold text-amber-600">6 days</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-[#0a1433] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
      {/* backdrop: glow + grid */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-brand-600/40 blur-[120px]" />
        <div className="absolute -bottom-40 right-0 h-[26rem] w-[26rem] rounded-full bg-indigo-500/30 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'radial-gradient(ellipse at 40% 40%, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at 40% 40%, black 30%, transparent 75%)',
          }}
        />
      </div>

      <div className="relative flex flex-1 flex-col px-10 py-9 xl:px-16">
        <BrandMark light />

        <div className="mt-10 max-w-xl [@media(min-height:960px)]:mt-16">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-blue-100">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            Tender intelligence for bid teams
          </span>
          <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-white xl:text-[2.85rem]">
            Find, track and win the tenders{' '}
            <span className="bg-gradient-to-r from-sky-300 via-blue-300 to-indigo-300 bg-clip-text text-transparent">
              that matter.
            </span>
          </h2>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-blue-100/70">
            TenderIQ watches procurement portals for you, alerts you when a matching
            tender is published, and keeps every deadline in view until you bid.
          </p>
        </div>

        <div className="mt-12 px-4 [@media(max-height:760px)]:hidden">
          <AlertPreview />
        </div>

        <ul className="mt-10 grid gap-5 xl:grid-cols-3 xl:gap-6 [@media(min-height:960px)]:mt-14">
          {features.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3 xl:flex-col">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-sky-300 ring-1 ring-white/10">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-blue-100/60 [@media(max-height:860px)]:hidden">{text}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-8 text-xs text-blue-100/50">
          <span>Tracks tenders from</span>
          {portals.map((p) => (
            <span
              key={p}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-medium text-blue-100/80"
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}

/** Compact brand header for phones and tablets, where the side panel is hidden. */
function MobileHeader() {
  return (
    <div className="relative overflow-hidden bg-[#0a1433] px-5 pb-16 pt-6 sm:px-8 lg:hidden">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand-600/50 blur-[90px]" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-60 w-60 rounded-full bg-indigo-500/30 blur-[90px]" />
      <div className="relative">
        <BrandMark light />
        <h2 className="mt-6 max-w-md font-display text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl">
          Never miss a tender that matters.
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {features.map(({ icon: Icon, title }) => (
            <span
              key={title}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-blue-50"
            >
              <Icon className="h-3.5 w-3.5 text-sky-300" />
              {title}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuthSwitch() {
  const base =
    'flex-1 rounded-lg px-4 py-2 text-center text-sm font-semibold transition-all duration-200';
  return (
    <div className="flex rounded-xl bg-gray-100 p-1">
      <NavLink
        to="/login"
        className={({ isActive }) =>
          clsx(base, isActive ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')
        }
      >
        Sign in
      </NavLink>
      <NavLink
        to="/register"
        className={({ isActive }) =>
          clsx(base, isActive ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')
        }
      >
        Create account
      </NavLink>
    </div>
  );
}

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <BrandPanel />
      <MobileHeader />

      <main className="relative -mt-10 flex justify-center rounded-t-[1.75rem] bg-white px-5 pb-10 pt-8 sm:px-8 lg:mt-0 lg:items-center lg:rounded-none lg:px-12 lg:py-12">
        <div className="w-full max-w-[26rem] animate-slideUp">
          <AuthSwitch />

          <div className="mt-8">
            <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900 sm:text-[1.75rem]">
              {title}
            </h1>
            <p className="mt-2 text-sm text-gray-500">{subtitle}</p>
          </div>

          <div className="mt-7">{children}</div>

          {footer && <div className="mt-8">{footer}</div>}

          <p className="mt-10 text-center text-xs text-gray-400">
            © {new Date().getFullYear()} TenderIQ · Intelligent tender management
          </p>
        </div>
      </main>
    </div>
  );
}

/** Shared input styling for the auth forms. */
export const authInputClass =
  'h-11 rounded-xl border-gray-200 bg-gray-50/60 text-[15px] transition-colors focus:bg-white sm:text-sm';
