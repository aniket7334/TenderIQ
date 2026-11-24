'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { Globe, Tags, Users, FileText, ClipboardList } from 'lucide-react';

/**
 * Admin layout.
 *
 * Rendering a hairline sub-nav strip above each admin page. We keep it
 * minimal because the main sidebar already lists every admin route — this
 * strip exists so someone deep in `/admin/sources` can jump to
 * `/admin/keywords` without a mouse trip to the sidebar.
 */

const adminNavItems = [
  { href: '/admin/sources',   label: 'Sources',    icon: Globe,         code: '05' },
  { href: '/admin/keywords',  label: 'Keywords',   icon: Tags,          code: '06' },
  { href: '/admin/templates', label: 'Templates',  icon: FileText,      code: '07' },
  { href: '/admin/users',     label: 'Users',      icon: Users,         code: '08' },
  { href: '/admin/audit-log', label: 'Audit Log',  icon: ClipboardList, code: '09' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {/* Admin strip */}
      <nav
        aria-label="Admin"
        className="flex items-center gap-6 overflow-x-auto border-b border-rule scrollbar-none"
      >
        {adminNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'relative flex items-center gap-2 whitespace-nowrap pb-3 pt-1 text-[13px] font-medium transition-colors',
                isActive
                  ? 'text-ink'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                {item.code}
              </span>
              <Icon className="h-3.5 w-3.5" />
              {item.label}
              {isActive && (
                <span className="absolute inset-x-0 -bottom-px h-[1.5px] bg-brass" aria-hidden />
              )}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
