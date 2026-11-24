'use client';

import React from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export interface RecentTender {
  id: string;
  title: string;
  source: string;
  submissionDeadline: string;
  status: 'open' | 'closing_soon' | 'closed' | 'awarded' | 'draft';
  estimatedValue?: number;
}

export interface RecentTendersProps {
  tenders: RecentTender[];
  className?: string;
}

const statusVariant: Record<RecentTender['status'], { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  open: { label: 'Open', variant: 'success' },
  closing_soon: { label: 'Closing Soon', variant: 'warning' },
  closed: { label: 'Closed', variant: 'danger' },
  awarded: { label: 'Awarded', variant: 'info' },
  draft: { label: 'Draft', variant: 'default' },
};

const formatCurrency = (value: number): string => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
};

const RecentTenders: React.FC<RecentTendersProps> = ({ tenders, className }) => {
  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Title
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Source
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Deadline
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                Est. Value
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tenders.map((tender) => {
              const statusInfo = statusVariant[tender.status];
              return (
                <tr
                  key={tender.id}
                  className="transition-colors hover:bg-gray-50"
                >
                  <td className="max-w-[240px] truncate px-4 py-3">
                    <Link
                      href={`/tenders/${tender.id}`}
                      className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {tender.title}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {tender.source}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {format(new Date(tender.submissionDeadline), 'MMM d, yyyy')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-gray-700">
                    {tender.estimatedValue
                      ? formatCurrency(tender.estimatedValue)
                      : '\u2014'}
                  </td>
                </tr>
              );
            })}
            {tenders.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-sm text-gray-500"
                >
                  No recent tenders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export { RecentTenders };
