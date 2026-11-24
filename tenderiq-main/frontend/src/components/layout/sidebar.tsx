'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
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
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Tenders', href: '/tenders', icon: FileText },
      { label: 'Tender Notes', href: '/notes', icon: ClipboardList },
      { label: 'Alerts', href: '/alerts', icon: Bell },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'Sources', href: '/admin/sources', icon: Globe },
      { label: 'Keywords', href: '/admin/keywords', icon: Tag },
      { label: 'Templates', href: '/admin/templates', icon: FileCode },
      { label: 'Users', href: '/admin/users', icon: Users },
      { label: 'Audit Log', href: '/admin/audit-log', icon: Shield },
    ],
  },
];

export interface SidebarProps {
  user?: {
    name: string;
    role: string;
    avatarUrl?: string;
  };
}

const Sidebar: React.FC<SidebarProps> = ({ user }) => {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={clsx(
        'flex h-screen flex-col border-r border-gray-200 bg-white transition-all duration-200',
        collapsed ? 'w-[68px]' : 'w-60',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-gray-100 px-4">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            T
          </div>
          {!collapsed && (
            <span className="text-lg font-bold text-gray-900">TenderIQ</span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navigation.map((section, sectionIdx) => (
          <div key={sectionIdx} className={clsx(sectionIdx > 0 && 'mt-6')}>
            {section.title && !collapsed && (
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {section.title}
              </p>
            )}
            {section.title && collapsed && (
              <div className="mb-2 border-t border-gray-100" />
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={clsx(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                        collapsed && 'justify-center',
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-gray-100 px-3 py-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* User */}
      {user && (
        <div className="border-t border-gray-100 px-3 py-3">
          <div
            className={clsx(
              'flex items-center gap-3',
              collapsed && 'justify-center',
            )}
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {user.name}
                </p>
                <p className="truncate text-xs text-gray-500">{user.role}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};

export { Sidebar };
