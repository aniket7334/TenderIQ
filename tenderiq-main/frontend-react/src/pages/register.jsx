import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { clsx } from 'clsx';
import {
  AlertCircle,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Info,
  Lock,
  Mail,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AuthLayout, { authInputClass } from '@/components/layout/auth-layout';
import useAuth from '@/hooks/useAuth';

const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[A-Za-z]/, 'Include at least one letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'Please accept the terms to continue' }),
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

const strengthRules = [
  { label: '8+ characters', test: (v) => v.length >= 8 },
  { label: 'A letter', test: (v) => /[A-Za-z]/.test(v) },
  { label: 'A number', test: (v) => /[0-9]/.test(v) },
  { label: 'A symbol', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

const strengthLabels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
const strengthColors = ['bg-gray-200', 'bg-red-500', 'bg-amber-500', 'bg-brand-500', 'bg-emerald-500'];

function PasswordStrength({ value }) {
  const score = value ? strengthRules.filter((r) => r.test(value)).length : 0;
  return (
    <div className="mt-2.5" aria-live="polite">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={clsx(
              'h-1 flex-1 rounded-full transition-colors duration-300',
              score >= i ? strengthColors[score] : 'bg-gray-200',
            )}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-xs font-medium text-gray-600">
          {value ? strengthLabels[score] : 'Password strength'}
        </span>
        {strengthRules.map((r) => {
          const ok = r.test(value);
          return (
            <span
              key={r.label}
              className={clsx(
                'inline-flex items-center gap-1 text-[11px]',
                ok ? 'text-emerald-600' : 'text-gray-400',
              )}
            >
              <Check className={clsx('h-3 w-3', !ok && 'opacity-40')} />
              {r.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const registerAction = useAuth((s) => s.register);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState(null);
  // After sign-up: the account waits for an admin's approval (no automatic sign-in)
  const [done, setDone] = useState(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  const password = watch('password') || '';

  const onSubmit = async (data) => {
    setServerError(null);
    try {
      const result = await registerAction({
        fullName: data.fullName.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password,
      });
      setDone({ ...result, email: data.email.trim().toLowerCase() });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not create your account. Please try again.');
    }
  };

  const eyeToggle = (
    <button
      type="button"
      onClick={() => setShowPassword((v) => !v)}
      className="pointer-events-auto rounded p-1 text-gray-400 hover:text-gray-600"
      aria-label={showPassword ? 'Hide password' : 'Show password'}
    >
      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start tracking tenders and get alerts the moment new ones match your work."
      footer={
        <p className="text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </p>
      }
    >
      {done ? (
        <div className="space-y-5" role="status">
          <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-4">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
            <div>
              <p className="text-sm font-semibold text-gray-900">{done.pending ? 'Account created — waiting for approval' : 'Account created'}</p>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">{done.message}</p>
              {done.pending && (
                <p className="mt-2 text-xs text-gray-500">
                  We registered <span className="font-medium text-gray-700">{done.email}</span>. Try signing in after an administrator has approved it.
                </p>
              )}
            </div>
          </div>
          <Button type="button" className="w-full" onClick={() => navigate('/login')}>
            Go to sign in
          </Button>
        </div>
      ) : (
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
          id="register-name"
          label="Full name"
          placeholder="e.g. Priya Sharma"
          autoComplete="name"
          className={authInputClass}
          leftIcon={<User className="h-4 w-4" />}
          error={errors.fullName?.message}
          {...register('fullName')}
        />

        <Input
          id="register-email"
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
          <Input
            id="register-password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Create a password"
            autoComplete="new-password"
            className={authInputClass}
            leftIcon={<Lock className="h-4 w-4" />}
            rightIcon={eyeToggle}
            error={errors.password?.message}
            {...register('password')}
          />
          <PasswordStrength value={password} />
        </div>

        <Input
          id="register-confirm"
          label="Confirm password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Re-enter your password"
          autoComplete="new-password"
          className={authInputClass}
          leftIcon={<Lock className="h-4 w-4" />}
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <div>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-600">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              {...register('acceptTerms')}
            />
            <span>
              I agree to the <span className="font-medium text-gray-900">Terms of Service</span> and{' '}
              <span className="font-medium text-gray-900">Privacy Policy</span>.
            </span>
          </label>
          {errors.acceptTerms && (
            <p className="mt-1.5 text-sm text-red-600">{errors.acceptTerms.message}</p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="group h-12 w-full rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 text-[15px] shadow-lg shadow-brand-600/25 hover:from-brand-700 hover:to-indigo-700"
          loading={isSubmitting}
        >
          {isSubmitting ? 'Creating account…' : 'Create account'}
          {!isSubmitting && (
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          )}
        </Button>

        <p className="flex items-start gap-2 rounded-xl bg-brand-50/70 px-3.5 py-3 text-xs leading-relaxed text-brand-900/80">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
          New accounts are reviewed by an administrator before you can sign in. You start with view access; an admin can change your role.
        </p>
      </form>
      )}
    </AuthLayout>
  );
}
