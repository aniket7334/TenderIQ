'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import { Logo } from '@/components/ui/logo';
import type { LoginResponse } from '@/lib/types';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required').min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      setServerError(null);
      const response = await api.post<LoginResponse>('/auth/login', {
        email: data.email,
        password: data.password,
      });
      const { access_token, user } = response.data;
      localStorage.setItem('tenderiq_token', access_token);
      localStorage.setItem('tenderiq_user', JSON.stringify(user));
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setServerError(message);
    }
  };

  const stamp = new Date()
    .toISOString()
    .slice(0, 16)
    .replace('T', ' · ');

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-paper text-ink">
      {/* Latitude grid — barely visible decorative chart lines */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full text-ink/[0.045]"
        aria-hidden="true"
      >
        <defs>
          <pattern id="chart-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M48 0 L0 0 0 48" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#chart-grid)" />
      </svg>

      <div className="relative mx-auto grid min-h-screen max-w-[1200px] grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
        {/* ── Left: editorial masthead ─────────────────────────────── */}
        <aside className="relative hidden flex-col justify-between border-r border-rule px-10 py-10 lg:flex xl:px-14">
          {/* Masthead */}
          <div className="flex items-center justify-between adm-rise">
            <div className="flex items-center gap-3">
              <Logo size={30} />
              <div className="flex flex-col leading-none">
                <span className="font-display text-[18px] font-semibold tracking-tight">
                  TenderIQ
                </span>
                <span className="eyebrow mt-1">Admiralty Desk · Est. 2026</span>
              </div>
            </div>
            <span className="eyebrow hidden xl:inline">Vol. I · No. 014</span>
          </div>

          {/* Headline */}
          <div className="max-w-[560px]">
            <p className="eyebrow mb-5 adm-rise">The intelligence desk</p>
            <h1 className="font-display text-[52px] font-normal leading-[1.02] tracking-[-0.025em] text-ink adm-rise-1 xl:text-[64px]">
              Every port, every dredge,
              <br />
              <em className="not-italic text-navy">read before the deadline.</em>
            </h1>
            <p className="mt-6 max-w-[460px] text-[15px] leading-relaxed text-ink-soft adm-rise-2">
              TenderIQ ingests tenders from <span className="num">239</span> Indian port
              authorities, maritime boards and e-procurement portals &mdash; and
              surfaces the ones worth your bid team&apos;s next hour.
            </p>
          </div>

          {/* Logbook footer */}
          <div className="grid grid-cols-3 gap-6 border-t border-rule pt-6 adm-rise-3">
            <div>
              <p className="eyebrow mb-1.5">Portals</p>
              <p className="font-mono text-[22px] font-medium text-ink tabular-nums">239</p>
            </div>
            <div>
              <p className="eyebrow mb-1.5">Keywords</p>
              <p className="font-mono text-[22px] font-medium text-ink tabular-nums">68</p>
            </div>
            <div>
              <p className="eyebrow mb-1.5">Latitude</p>
              <p className="font-mono text-[13.5px] text-ink-soft tabular-nums">
                08°04&apos;N
                <br />
                77°33&apos;E
              </p>
            </div>
          </div>
        </aside>

        {/* ── Right: sign-in slip ──────────────────────────────────── */}
        <section className="relative flex items-center justify-center px-6 py-16 sm:px-12">
          <div className="w-full max-w-[380px]">
            {/* Mobile masthead */}
            <div className="mb-10 flex items-center gap-3 lg:hidden adm-rise">
              <Logo size={28} />
              <span className="font-display text-[18px] font-semibold tracking-tight">
                TenderIQ
              </span>
            </div>

            {/* Slip header */}
            <div className="mb-10 adm-rise">
              <p className="eyebrow mb-3">Form A-01 · Credentials</p>
              <h2 className="font-display text-[36px] font-normal leading-[1.1] tracking-[-0.02em]">
                Sign in to the desk.
              </h2>
              <p className="mt-2 text-sm text-ink-soft">
                Admin access is required for sources, keywords and users.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-7 adm-rise-1">
              {serverError && (
                <div className="rule border-signal/40 bg-signal/[0.04] px-4 py-3">
                  <p className="eyebrow mb-1 text-signal">Rejected</p>
                  <p className="text-sm text-ink">{serverError}</p>
                </div>
              )}

              {/* Email */}
              <div>
                <label htmlFor="email" className="eyebrow mb-2 block">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="adm-input"
                  {...register('email')}
                  aria-invalid={!!errors.email}
                />
                {errors.email?.message && (
                  <p className="mt-1.5 text-xs text-signal">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="eyebrow mb-2 block">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                    className="adm-input pr-8"
                    {...register('password')}
                    aria-invalid={!!errors.password}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-ink-muted transition-colors hover:text-ink"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password?.message && (
                  <p className="mt-1.5 text-xs text-signal">{errors.password.message}</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="group flex w-full items-center justify-between border border-ink bg-ink px-5 py-3.5 text-sm font-medium tracking-wide text-paper transition-colors hover:bg-navy-ink disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex items-center gap-2">
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {isSubmitting ? 'Verifying credentials' : 'Enter the desk'}
                </span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </form>

            {/* Slip footer */}
            <div className="mt-14 flex items-center justify-between border-t border-rule pt-5 adm-rise-2">
              <p className="eyebrow">Logged {stamp} UTC</p>
              <p className="eyebrow">A-01 / Rev 2</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
