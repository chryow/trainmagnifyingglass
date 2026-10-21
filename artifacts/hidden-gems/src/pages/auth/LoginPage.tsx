import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from '@/lib/router';
import { Logo, LogoWithText } from '@/components/Logo';
import { LoadingSpinner } from '@/components/States';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message === 'Invalid login credentials' ? 'Incorrect email or password.' : signInError.message);
      return;
    }
    navigate('/discover');
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary-50/60 to-stone-50 dark:from-stone-900 dark:to-stone-950">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <Logo className="h-14 w-14" />
            <div>
              <h1 className="font-display text-2xl font-semibold">Welcome back</h1>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Sign in to continue exploring hidden gems</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="card space-y-5 p-6" noValidate>
            <div>
              <label htmlFor="email" className="label">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="input pl-10"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="label">Password</label>
                <button type="button" onClick={() => navigate('/reset-password')} className="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="input pl-10 pr-10"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-xl bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/40 dark:text-error-400">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <LoadingSpinner size={18} /> : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-stone-500 dark:text-stone-400">
            New to Hidden Gems?{' '}
            <button onClick={() => navigate('/register')} className="font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400">
              Create an account
            </button>
          </p>
          <p className="mt-3 text-center text-xs text-stone-400">
            <button onClick={() => navigate('/privacy')} className="underline hover:text-stone-500">Privacy Policy</button>
            {' · '}
            <button onClick={() => navigate('/terms')} className="underline hover:text-stone-500">Terms</button>
            {' · '}
            <button onClick={() => navigate('/support')} className="underline hover:text-stone-500">Support</button>
          </p>

          <div className="mt-8 flex justify-center">
            <LogoWithText className="opacity-40" />
          </div>
        </div>
      </div>
    </div>
  );
}
