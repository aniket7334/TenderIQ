import React from 'react';
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

  return (
    <div className="space-y-6">
      {/* Admin header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-gray-900 p-2">
          <Settings className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
          <p className="text-sm text-gray-500">Manage sources, keywords, users, and system settings</p>
        </div>
      </div>

      {/* Admin sub-nav */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          {adminNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
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
