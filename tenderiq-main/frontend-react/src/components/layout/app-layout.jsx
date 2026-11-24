import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Bell,
  Globe,
  FileCode,
  Users,
  Shield,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Search,
  User,
  Settings,
  HelpCircle,
  KeyRound,
  LifeBuoy,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Navigation config                                                  */
/* ------------------------------------------------------------------ */

const navigation = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Tenders', href: '/tenders', icon: Search },
      { label: 'Tender Notes', href: '/tender-notes', icon: FileText },
      { label: 'Alerts', href: '/alerts', icon: Bell },
    ],
  },
  {
    title: 'Admin Section',
    items: [
      { label: 'Sources', href: '/admin/sources', icon: Globe },
      { label: 'Keywords', href: '/admin/keywords', icon: KeyRound },
      { label: 'Templates', href: '/admin/templates', icon: FileCode },
      { label: 'Users', href: '/admin/users', icon: Users },
      { label: 'Audit Log', href: '/admin/audit-log', icon: Shield },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  AppLayout                                                          */
/* ------------------------------------------------------------------ */

export default function AppLayout({ children }) {
  const pathname = useLocation().pathname;
  const navigate = useNavigate();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const [user, setUser] = useState(null);

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
    navigate('/login');
  };

  const isActive = (href) => {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
    return pathname.startsWith(href);
  };

  const initials =
    user?.full_name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';

  /* ---- Sidebar content (shared between mobile drawer and desktop) ---- */
  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex h-20 items-center border-b border-white/10 px-5">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-gold-500/60 bg-white/5 text-gold-300">
            <Briefcase className="h-5 w-5" strokeWidth={1.75} />
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-serif text-[19px] font-semibold tracking-tight text-white">TenderIQ</span>
              <span className="whitespace-nowrap text-[9.5px] font-medium uppercase tracking-[0.12em] text-gold-300/80">
                Enterprise Procurement
              </span>
            </div>
          )}
        </Link>
        {/* Mobile close */}
        <button
          onClick={() => setMobileSidebarOpen(false)}
          className="ml-auto rounded-lg p-1 text-white/50 hover:bg-white/10 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navigation.map((section, idx) => {
          // Hide admin section for non-admin/manager users
          if (section.title === 'Admin' && user?.role !== 'admin' && user?.role !== 'manager') {
            return null;
          }
          return (
          <div key={idx} className={clsx(idx > 0 && 'mt-6')}>
            {section.title && !sidebarCollapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                {section.title}
              </p>
            )}
            {section.title && sidebarCollapsed && (
              <div className="mb-2 border-t border-white/10" />
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      onClick={() => setMobileSidebarOpen(false)}
                      className={clsx(
                        'relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                        active
                          ? 'bg-white/10 text-white before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-gold-500'
                          : 'text-white/60 hover:bg-white/5 hover:text-white',
                        sidebarCollapsed && 'justify-center',
                      )}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <Icon className={clsx('h-[18px] w-[18px] flex-shrink-0', active ? 'text-gold-300' : 'text-white/45')} strokeWidth={1.75} />
                      {!sidebarCollapsed && <span>{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
          );
        })}
      </nav>

      {/* Collapse toggle (desktop only) */}
      <div className="hidden border-t border-white/10 px-3 py-2 lg:block">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="flex w-full items-center justify-center rounded-md p-2 text-white/40 hover:bg-white/5 hover:text-white"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Bottom links */}
      <div className="border-t border-white/10 px-3 py-3">
        <ul className="space-y-1">
          <li>
            <button
              type="button"
              className={clsx(
                'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white',
                sidebarCollapsed && 'justify-center',
              )}
              title={sidebarCollapsed ? 'Settings' : undefined}
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>Settings</span>}
            </button>
          </li>
          <li>
            <button
              type="button"
              className={clsx(
                'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white',
                sidebarCollapsed && 'justify-center',
              )}
              title={sidebarCollapsed ? 'Support' : undefined}
            >
              <LifeBuoy className="h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>Support</span>}
            </button>
          </li>
        </ul>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar - mobile drawer */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-brand-900 transition-transform duration-200 lg:hidden',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebarContent}
      </aside>

      {/* Sidebar - desktop */}
      <aside
        className={clsx(
          'hidden lg:flex h-screen flex-col bg-brand-900 transition-all duration-200',
          sidebarCollapsed ? 'w-[68px]' : 'w-60',
        )}
      >
        {sidebarContent}
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-[72px] items-center gap-4 border-b border-gray-200 bg-white/95 px-4 backdrop-blur lg:px-8">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Search (full-width, primary header element) */}
          <div className="flex flex-1 items-center">
            <div className="relative w-full max-w-2xl">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search tenders, keywords or users..."
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <Link
              to="/alerts"
              className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </Link>

            {/* Help */}
            <button
              type="button"
              aria-label="Help"
              className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              <HelpCircle className="h-5 w-5" />
            </button>

            {/* Divider */}
            <span className="mx-1 hidden h-8 w-px bg-gray-200 sm:block" />

            {/* User profile panel */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-3 rounded-xl p-1 pl-2 hover:bg-gray-50"
              >
                <div className="hidden text-right leading-tight sm:block">
                  <p className="text-sm font-semibold text-gray-900">
                    {user?.full_name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {user?.role === 'admin' ? 'Procurement Lead' : (user?.role || 'Member')}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-900 font-serif text-sm font-semibold text-gold-300 ring-2 ring-gold-500/40">
                  {initials}
                </div>
              </button>

              {userDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                    <div className="border-b border-gray-100 px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">
                        {user?.full_name || 'User'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {user?.email || ''}
                      </p>
                    </div>
                    <button
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <User className="h-4 w-4" />
                      Profile
                    </button>
                    <button
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </button>
                    <div className="border-t border-gray-100">
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          handleLogout();
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" />
                        Log out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  );
}
