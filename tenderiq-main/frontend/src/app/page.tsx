import { redirect } from 'next/navigation';

/**
 * Root route — the dashboard lives at `/dashboard`; redirect server-side so
 * both URLs land in the same place without a client-side flash.
 */
export default function RootRoute(): never {
  redirect('/dashboard');
}
