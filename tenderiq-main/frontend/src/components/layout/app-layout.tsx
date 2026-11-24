'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import Link from 'next/link';
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  Bell,
  Globe,
  Tag,
  FileCode,
  Users,
  Shield,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Search,
  ChevronDown,
  User,
  Settings,
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';

/* ------------------------------------------------------------------ */
/*  Navigation config                                                  */
/* ------------------------------------------------------------------ */

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** Admiralty section number for the mono prefix (e.g. "01", "02"). */
  index: string;
}

interface NavSection {
  title?: string;
  code?: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    code: 'I',
    title: 'Desk',
    items: [
      { label: 'Dashboard',     href: '/dashboard',     icon: LayoutDashboard, index: '01' },
      { label: 'Tenders',       href: '/tenders',       icon: FileText,        index: '02' },
      { label: 'Tender Notes',  href: '/tender-notes',  icon: ClipboardList,   index: '03' },
      { label: 'Alerts',        href: '/alerts',        icon: Bell,            index: '04' },
    ],
  },
  {
    code: 'II',
    title: 'Admiralty',
    items: [
      { label: 'Sources',    href: '/admin/sources',    icon: Globe,       index: '05' },
      { label: 'Keywords',   href: '/admin/keywords',   icon: Tag,         index: '06' },
      { label: 'Templates',  href: '/admin/templates',  icon: FileCode,    index: '07' },
      { label: 'Users',      href: '/admin/users',      icon: Users,       index: '08' },
      { label: 'Audit Log',  href: '/admin/audit-log',  icon: Shield,      index: '09' },
    ],
  },
];

/** Paired with each pathname to give the header a short descriptive subtitle. */
const PAGE_META: Record<string, { eyebrow: string; subtitle: string }> = {
  '/dashboard':      { eyebrow: 'Desk · 01',   subtitle: 'Pipeline overview and signals' },
  '/tenders':        { eyebrow: 'Desk · 02',   subtitle: 'Every bid worth your attention' },
  '/tender-notes':   { eyebrow: 'Desk · 03',   subtitle: 'Qualification notes and briefs' },
  '/alerts':         { eyebrow: 'Desk · 04',   subtitle: 'Deadline watch and triggers' },
  '/admin':          { eyebrow: 'Admiralty',   subtitle: 'System configuration' },
  '/admin/sources':  { eyebrow: 'Admiralty · 05', subtitle: 'Portals the desk watches' },
  '/admin/keywords': { eyebrow: 'Admiralty · 06', subtitle: 'Scope, sector, exclusion filters' },
  '/admin/templates':{ eyebrow: 'Admiralty · 07', subtitle: 'Note and brief templates' },
  '/admin/users':    { eyebrow: 'Admiralty · 08', subtitle: 'Desk access and roles' },
  '/admin/audit-log':{ eyebrow: 'Admiralty · 09', subtitle: 'Journal of every change' },
};

/* ------------------------------------------------------------------ */
/*  AppLayout                                                          */
/* ------------------------------------------------------------------ */

export interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const [user, setUser] = useState<{
    full_name: string;
    email: string;
    role: string;
  } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('tenderiq_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        setUser(null);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('tenderiq_token');
    localStorage.removeItem('tenderiq_user');
    router.push('/login');
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
    return pathname.startsWith(href);
  };

  /* Page title: use friendly name if we have one, else derive from pathname */
  const pageTitle = (() => {
    const flat = pathname === '/' ? '/dashboard' : pathname;
    for (const section of navigation) {
      for (const item of section.items) {
        if (isActive(item.href) && item.href === flat) return item.label;
      }
    }
    const segment = flat.split('/').filter(Boolean).pop() || 'dashboard';
    return segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  })();

  const pageMeta =
    PAGE_META[pathname === '/' ? '/dashboard' : pathname] ??
    { eyebrow: 'TenderIQ', subtitle: '' };

  const initials =
    user?.full_name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';

  const stamp = new Date()
    .toISOString()
    .slice(0, 10);

  /* ---- Sidebar content (shared between mobile drawer and desktop) ---- */
  const sidebarContent = (
    <>
      {/* Masthead */}
      <div className="flex h-16 shrink-0 items-center border-b border-rule px-4">
        <Link href="/dashboard" className="group flex items-center gap-2.5">
          <span className="text-ink">
            <Logo size={24} />
          </span>
          {!sidebarCollapsed && (
            <span className="flex flex-col leading-none">
              <span className="font-display text-[16px] font-semibold tracking-tight text-ink">
                TenderIQ
              </span>
              <span className="eyebrow mt-1 text-[9.5px]">Admiralty Desk</span>
            </span>
          )}
        </Link>
        {/* Mobile close */}
        <button
          onClick={() => setMobileSidebarOpen(false)}
          className="ml-auto p-1 text-ink-muted hover:text-ink lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-5">
        {navigation.map((section, idx) => (
          <div key={idx} className={clsx(idx > 0 && 'mt-7')}>
            {section.title && !sidebarCollapsed && (
              <div className="mb-3 flex items-baseline gap-2 px-2">
                {section.code && (
                  <span className="font-mono text-[10px] text-ink-muted">
                    {section.code}
                  </span>
                )}
                <p className="eyebrow">{section.title}</p>
              </div>
            )}
            {section.title && sidebarCollapsed && (
              <div className="mb-3 mx-2 border-t border-rule" />
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileSidebarOpen(false)}
                      className={clsx(
                        'group relative flex items-center gap-3 px-3 py-2 text-[13.5px] font-medium transition-colors',
                        active
                          ? 'text-ink'
                          : 'text-ink-soft hover:text-ink',
                        sidebarCollapsed && 'justify-center',
                      )}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      {/* Active rail — brass hairline on the left */}
                      {active && (
                        <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 bg-brass" />
                      )}
                      <Icon
                        className={clsx(
                          'h-[18px] w-[18px] shrink-0 transition-colors',
                          active ? 'text-ink' : 'text-ink-muted group-hover:text-ink-soft',
                        )}
                      />
                      {!sidebarCollapsed && (
                        <>
                          <span>{item.label}</span>
                          <span
                            className={clsx(
                              'ml-auto font-mono text-[10.5px] tabular-nums transition-opacity',
                              active ? 'text-brass' : 'text-ink-muted/60 opacity-0 group-hover:opacity-100',
                            )}
                          >
                            {item.index}
                          </span>
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse toggle (desktop only) */}
      <div className="hidden border-t border-rule px-3 py-2 lg:block">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="flex w-full items-center justify-center p-2 text-ink-muted hover:text-ink"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* User + logbook footer */}
      <div className="border-t border-rule px-3 py-3">
        <div
          className={clsx(
            'flex items-center gap-3',
            sidebarCollapsed && 'justify-center',
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-ink text-[11px] font-semibold tracking-wide text-ink">
            {initials}
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">
                {user?.full_name || 'User'}
              </p>
              <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                {user?.role || 'admin'}
              </p>
            </div>
          )}
          {!sidebarCollapsed && (
            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-1.5 text-ink-muted hover:text-ink"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
        {!sidebarCollapsed && (
          <div className="mt-3 border-t border-rule pt-2.5">
            <div className="flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-muted">
              <span>Log · {stamp}</span>
              <span>v1.0</span>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="relative flex h-screen overflow-hidden bg-paper text-ink">
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar — mobile drawer */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-paper-tint border-r border-rule-strong transition-transform duration-200 lg:hidden',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebarContent}
      </aside>

      {/* Sidebar — desktop */}
      <aside
        className={clsx(
          'hidden lg:flex h-screen flex-col border-r border-rule bg-paper-tint/70 transition-all duration-200',
          sidebarCollapsed ? 'w-[72px]' : 'w-[248px]',
        )}
      >
        {sidebarContent}
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-20 shrink-0 items-center justify-between border-b border-rule bg-paper px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 text-ink-soft hover:text-ink lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex flex-col leading-tight">
              <span className="eyebrow">{pageMeta.eyebrow}</span>
              <h1 className="mt-0.5 font-display text-[22px] font-normal tracking-[-0.015em] text-ink">
                {pageTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-5">
            {/* Search */}
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                placeholder="Search tenders, references, orgs…"
                className="w-[300px] border-0 border-b border-rule bg-transparent py-2 pl-6 pr-2 text-[13.5px] text-ink placeholder:text-ink-muted focus:border-ink focus:outline-none focus:ring-0"
              />
            </div>

            {/* Notifications */}
            <Link
              href="/alerts"
              className="relative p-1.5 text-ink-soft transition-colors hover:text-ink"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-0 top-0.5 h-1.5 w-1.5 rounded-full bg-brass" />
            </Link>

            {/* User dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1 transition-colors hover:text-ink"
              >
                <div className="flex h-8 w-8 items-center justify-center border border-ink text-[11px] font-semibold text-ink">
                  {initials}
                </div>
                <ChevronDown
                  className={clsx(
                    'hidden h-4 w-4 text-ink-muted transition-transform sm:block',
                    userDropdownOpen && 'rotate-180',
                  )}
                />
              </button>

              {userDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-50 mt-2 w-64 border border-rule-strong bg-canvas py-1">
                    <div className="border-b border-rule px-4 py-3">
                      <p className="eyebrow mb-1">Signed in as</p>
                      <p className="truncate text-[14px] font-medium text-ink">
                        {user?.full_name || 'User'}
                      </p>
                      <p className="truncate font-mono text-[11px] text-ink-muted">
                        {user?.email || ''}
                      </p>
                    </div>
                    <button
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-[13.5px] text-ink-soft transition-colors hover:bg-canvas-tint hover:text-ink"
                    >
                      <User className="h-4 w-4" />
                      Profile
                    </button>
                    <button
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-[13.5px] text-ink-soft transition-colors hover:bg-canvas-tint hover:text-ink"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </button>
                    <div className="border-t border-rule">
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          handleLogout();
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-[13.5px] text-signal transition-colors hover:bg-signal/[0.05]"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin bg-paper px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
