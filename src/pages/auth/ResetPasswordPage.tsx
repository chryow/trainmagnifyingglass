import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from '@/lib/router';
import { Logo } from '@/components/Logo';
import { LoadingSpinner } from '@/components/States';
import { Mail, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/#/reset-password`,
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary-50/60 to-stone-50 dark:from-stone-900 dark:to-stone-950">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <Logo className="h-14 w-14" />
            <h1 className="font-display text-2xl font-semibold">Reset your password</h1>
          </div>

          {sent ? (
            <div className="card space-y-4 p-6 text-center">
              <div className="mx-auto w-fit rounded-2xl bg-success-50 p-4 text-success-600 dark:bg-success-900/30">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="font-display text-lg font-semibold">Check your email</h2>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                We sent a password reset link to <strong className="text-stone-700 dark:text-stone-200">{email}</strong>. The link will expire shortly.
              </p>
              <button onClick={() => navigate('/login')} className="btn-primary w-full">Back to sign in</button>
            </div>
          ) : (
            <>
              <form onSubmit={onSubmit} className="card space-y-5 p-6" noValidate>
                <p className="text-sm text-stone-500 dark:text-stone-400">Enter your account email and we'll send you a link to reset your password.</p>
                <div>
                  <label htmlFor="email" className="label">Email</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                    <input id="email" type="email" autoComplete="email" required className="input pl-10" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                </div>
                {error && <div role="alert" className="rounded-xl bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/40 dark:text-error-400">{error}</div>}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? <LoadingSpinner size={18} /> : 'Send reset link'}
                </button>
              </form>
              <button onClick={() => navigate('/login')} className="mt-6 flex w-full items-center justify-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400">
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
