import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, isValid } from 'date-fns';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Approximate spot rates for converting common source currencies → USD.
// Update periodically or wire to a live FX feed if needed.
const TO_USD = {
  USD: 1,
  INR: 1 / 83,
  GBP: 1.27,
  EUR: 1.08,
  CAD: 0.73,
  AUD: 0.66,
  SAR: 0.27,
  AED: 0.27,
  QAR: 0.27,
  OMR: 2.6,
  KWD: 3.25,
  BHD: 2.65,
  EGP: 0.021,
  ZAR: 0.054,
  NGN: 0.0007,
  KES: 0.0078,
  BRL: 0.18,
  MXN: 0.058,
  CLP: 0.001,
  COP: 0.00025,
  PEN: 0.27,
  ARS: 0.001,
  TRY: 0.029,
  RUB: 0.011,
  CHF: 1.12,
  NOK: 0.094,
  SGD: 0.74,
  MYR: 0.21,
  IDR: 0.000062,
  THB: 0.028,
  VND: 0.000039,
  JPY: 0.0064,
  KRW: 0.00072,
  CNY: 0.14,
  BDT: 0.0091,
  LKR: 0.0033,
  NPR: 0.0075,
};

/**
 * Format a tender value as US Dollars.
 * Source `currency` defaults to INR (most local tenders); rates above
 * convert other currencies to USD.
 */
export function formatCurrency(amount, currency = 'INR') {
  const rate = TO_USD[currency?.toUpperCase?.()] ?? TO_USD.INR;
  const usd = amount * rate;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(usd);
}

export function formatDate(
  dateString,
  dateFormat = 'dd MMM yyyy'
) {
  if (!dateString) return '-';
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) return '-';
    return format(date, dateFormat);
  } catch {
    return '-';
  }
}

export function getStatusColor(status) {
  const colors = {
    draft: 'bg-gray-100 text-gray-700 border-gray-300',
    published: 'bg-blue-100 text-blue-700 border-blue-300',
    open: 'bg-green-100 text-green-700 border-green-300',
    active: 'bg-green-100 text-green-700 border-green-300',
    closed: 'bg-red-100 text-red-700 border-red-300',
    under_evaluation: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    evaluation: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    awarded: 'bg-purple-100 text-purple-700 border-purple-300',
    cancelled: 'bg-gray-100 text-gray-500 border-gray-300',
    expired: 'bg-orange-100 text-orange-700 border-orange-300',
    submitted: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    scraped: 'bg-cyan-100 text-cyan-700 border-cyan-300',
    new: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    interested: 'bg-brand-100 text-brand-700 border-brand-300',
    not_interested: 'bg-gray-100 text-gray-500 border-gray-300',
    bid_submitted: 'bg-violet-100 text-violet-700 border-violet-300',
    won: 'bg-green-100 text-green-800 border-green-400',
    lost: 'bg-red-100 text-red-800 border-red-400',
  };

  return colors[status.toLowerCase()] || 'bg-gray-100 text-gray-700 border-gray-300';
}

export function getStatusLabel(status) {
  const labels = {
    draft: 'Draft',
    published: 'Published',
    open: 'Open',
    active: 'Active',
    closed: 'Closed',
    under_evaluation: 'Under Evaluation',
    evaluation: 'Evaluation',
    awarded: 'Awarded',
    cancelled: 'Cancelled',
    expired: 'Expired',
    submitted: 'Submitted',
    scraped: 'Scraped',
    new: 'New',
    interested: 'Interested',
    not_interested: 'Not Interested',
    bid_submitted: 'Bid Submitted',
    won: 'Won',
    lost: 'Lost',
  };

  return (
    labels[status.toLowerCase()] ||
    status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
