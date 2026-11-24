import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowRight,
  BarChart3,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Search,
  Shield,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AuthLayout, { authInputClass } from '@/components/layout/auth-layout';
import useAuth from '@/hooks/useAuth';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required').min(6, 'Password must be at least 6 characters'),
});

const demoAccounts = [
  {
    role: 'Admin',
    email: 'admin@tenderiq.com',
    password: 'admin123',
    description: 'Full access',
    icon: Shield,
    tint: 'text-rose-500 bg-rose-50',
  },
  {
    role: 'Manager',
    email: 'manager@tenderiq.com',
    password: 'manager123',
    description: 'Tenders & team',
    icon: BarChart3,
    tint: 'text-brand-600 bg-brand-50',
  },
  {
    role: 'Analyst',
    email: 'analyst@tenderiq.com',
    password: 'analyst123',
    description: 'Shortlist & analyse',
    icon: Search,
    tint: 'text-emerald-600 bg-emerald-50',
  },
  {
    role: 'Viewer',
    email: 'viewer@tenderiq.com',
    password: 'viewer123',
    description: 'Read-only',
    icon: Eye,
    tint: 'text-gray-600 bg-gray-100',
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const loginAction = useAuth((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [quickLoading, setQuickLoading] = useState(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const doLogin = async (email, password) => {
    setServerError(null);
    await loginAction({ email, password });
    navigate('/dashboard');
  };

  const onSubmit = async (data) => {
    try {
      await doLogin(data.email, data.password);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    }
  };

  const handleQuickLogin = async (account) => {
    try {
      setQuickLoading(account.role);
      setValue('email', account.email);
      setValue('password', account.password);
      await doLogin(account.email, account.password);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setQuickLoading(null);
    }
  };

  const busy = isSubmitting || !!quickLoading;

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to see new tenders, alerts and upcoming deadlines."
      footer={
        <p className="text-center text-sm text-gray-500">
          New to TenderIQ?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">
            Create an account
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {serverError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {serverError}
          </div>
        )}

        <Input
          id="login-email"
          label="Work email"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          className={authInputClass}
          leftIcon={<Mail className="h-4 w-4" />}
          error={errors.email?.message}
          {...register('email')}
        />

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="login-password" className="text-sm font-medium text-gray-700">
              Password
            </label>
            <span className="text-xs text-gray-400">Forgot it? Ask your admin to reset.</span>
          </div>
          <Input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            autoComplete="current-password"
            className={authInputClass}
            leftIcon={<Lock className="h-4 w-4" />}
            error={errors.password?.message}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="pointer-events-auto rounded p-1 text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
            {...register('password')}
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="group h-12 w-full rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 text-[15px] shadow-lg shadow-brand-600/25 hover:from-brand-700 hover:to-indigo-700"
          loading={isSubmitting}
          disabled={busy}
        >
          {isSubmitting ? 'Signing in…' : 'Sign in'}
          {!isSubmitting && (
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          )}
        </Button>
      </form>

      {/* Demo accounts */}
      <div className="mt-8">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-gray-200" />
          <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Demo accounts
          </span>
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {demoAccounts.map((account) => {
            const Icon = account.icon;
            const isLoading = quickLoading === account.role;
            return (
              <button
                key={account.role}
                type="button"
                onClick={() => handleQuickLogin(account)}
                disabled={busy}
                className="group flex min-w-0 items-center gap-2.5 rounded-xl border border-gray-200 bg-white p-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md disabled:pointer-events-none disabled:opacity-50"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${account.tint}`}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-800">{account.role}</span>
                  <span className="block truncate text-[11px] text-gray-500">{account.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </AuthLayout>
  );
}
