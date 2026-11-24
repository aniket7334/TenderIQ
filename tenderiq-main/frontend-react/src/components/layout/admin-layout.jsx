import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Globe,
  Tags,
  Users,
  FileText,
  ClipboardList,
  Settings,
} from 'lucide-react';

const adminNavItems = [
  { href: '/admin/sources', label: 'Sources', icon: Globe },
  { href: '/admin/keywords', label: 'Keywords', icon: Tags },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/templates', label: 'Templates', icon: FileText },
  { href: '/admin/audit-log', label: 'Audit Log', icon: ClipboardList },
];

export default function AdminLayout({ children }) {
  const pathname = useLocation().pathname;
  const activeRef = useRef(null);

  // On narrow screens the tab bar scrolls sideways — keep the current tab in view
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [pathname]);

  return (
    <div className="space-y-6">
      {/* Admin header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-gray-900 p-2">
          <Settings className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Administration</h1>
          <p className="text-xs text-gray-500 sm:text-sm">Manage sources, keywords, users, and system settings</p>
        </div>
      </div>

      {/* Admin sub-nav */}
      <div className="border-b border-gray-200">
        <nav className="scrollbar-none -mb-px flex space-x-6 overflow-x-auto">
          {adminNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                ref={isActive ? activeRef : undefined}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
