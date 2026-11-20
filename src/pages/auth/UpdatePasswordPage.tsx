import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { friendlyAuthError } from '@/lib/authErrors';
import { useAuth } from '@/lib/auth';
import { useNavigate } from '@/lib/router';
import { Logo } from '@/components/Logo';
import { LoadingSpinner } from '@/components/States';
import { CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react';

// Shown after the user opens a password-reset email link. Supabase has
// already signed them in with a short-lived recovery session; this page
// lets them choose the new password.
export default function UpdatePasswordPage() {
  const navigate = useNavigate();
  const { clearRecovery, profile } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    const { error: updErr } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updErr) { setError(friendlyAuthError(updErr)); return; }
    setDone(true);
  };

  const finish = () => {
    clearRecovery();
    navigate(profile && !profile.onboarding_completed ? '/onboarding' : '/discover');
  };

  return (
    <div className="auth-bg flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-slide-up">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo className="h-14 w-14" />
          <h1 className="font-display text-3xl font-bold">Choose a new password</h1>
        </div>

        {done ? (
          <div className="card space-y-4 p-6 text-center">
            <div className="mx-auto w-fit rounded-2xl bg-success-50 p-4 text-success-600 dark:bg-success-900/30">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="font-display text-lg font-semibold">Password updated</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400">You're signed in with your new password.</p>
            <button onClick={finish} className="btn-primary w-full">Continue</button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="card space-y-5 p-6" noValidate>
            <div>
              <label htmlFor="new-password" className="label">New password</label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  id="new-password"
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="input pl-10 pr-10"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirm-password" className="label">Confirm new password</label>
              <input
                id="confirm-password"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {error && <div role="alert" className="rounded-xl bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/40 dark:text-error-400">{error}</div>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <LoadingSpinner size={18} /> : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
