import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from '@/lib/router';
import { Logo } from '@/components/Logo';
import { LoadingSpinner } from '@/components/States';
import { Eye, EyeOff, Check } from 'lucide-react';

interface FormData {
  displayName: string;
  username: string;
  email: string;
  password: string;
  bio: string;
  homeArea: string;
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormData>({
    displayName: '',
    username: '',
    email: '',
    password: '',
    bio: '',
    homeArea: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (key === 'username') setUsernameAvailable(null);
  };

  const checkUsername = async () => {
    if (!USERNAME_RE.test(form.username)) {
      setUsernameAvailable(false);
      return;
    }
    setCheckingUsername(true);
    const { data } = await supabase.from('profiles').select('id').eq('username', form.username).maybeSingle();
    setCheckingUsername(false);
    setUsernameAvailable(!data);
  };

  const passwordStrength = (() => {
    const p = form.password;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^a-zA-Z0-9]/.test(p)) score++;
    return score;
  })();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (!USERNAME_RE.test(form.username)) {
      setError('Username must be 3–20 characters: letters, numbers, and underscores only.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          username: form.username,
          display_name: form.displayName,
          bio: form.bio || undefined,
          home_area: form.homeArea || undefined,
        },
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (!data.user) {
      setError('Registration failed. Please try again.');
      return;
    }
    navigate('/onboarding');
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary-50/60 to-stone-50 dark:from-stone-900 dark:to-stone-950">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg animate-slide-up">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <Logo className="h-14 w-14" />
            <div>
              <h1 className="font-display text-2xl font-semibold">Join the community</h1>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Create an account to discover and share hidden gems</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="card space-y-5 p-6" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="displayName" className="label">Display name</label>
                <input id="displayName" required className="input" placeholder="Your name" value={form.displayName} onChange={set('displayName')} maxLength={40} />
              </div>
              <div>
                <label htmlFor="username" className="label">Username</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">@</span>
                  <input
                    id="username"
                    required
                    className="input pl-7"
                    placeholder="explorer"
                    value={form.username}
                    onChange={set('username')}
                    onBlur={checkUsername}
                    maxLength={20}
                  />
                </div>
                {checkingUsername && <p className="mt-1 text-xs text-stone-400">Checking…</p>}
                {usernameAvailable === true && <p className="mt-1 flex items-center gap-1 text-xs text-success-600"><Check className="h-3 w-3" /> Available</p>}
                {usernameAvailable === false && <p className="mt-1 text-xs text-error-600">Username is taken or invalid.</p>}
              </div>
            </div>

            <div>
              <label htmlFor="email" className="label">Email</label>
              <input id="email" type="email" autoComplete="email" required className="input" placeholder="you@example.com" value={form.email} onChange={set('email')} />
              <p className="mt-1 text-xs text-stone-400">Your email is never shown publicly.</p>
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className="input pr-10"
                  placeholder="At least 8 characters"
                  value={form.password}
                  onChange={set('password')}
                />
                <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.password && (
                <div className="mt-2 flex gap-1" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full ${i < passwordStrength ? (passwordStrength <= 1 ? 'bg-error-500' : passwordStrength === 2 ? 'bg-warning-500' : 'bg-success-500') : 'bg-stone-200 dark:bg-stone-700'}`} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="homeArea" className="label">Home city or area <span className="text-stone-400">(optional)</span></label>
              <input id="homeArea" className="input" placeholder="e.g. Jakarta, Lombok" value={form.homeArea} onChange={set('homeArea')} maxLength={60} />
            </div>

            <div>
              <label htmlFor="bio" className="label">Short biography <span className="text-stone-400">(optional)</span></label>
              <textarea id="bio" className="input min-h-[80px] resize-y" placeholder="Tell the community a little about yourself" value={form.bio} onChange={set('bio')} maxLength={160} />
              <p className="mt-1 text-right text-xs text-stone-400">{form.bio.length}/160</p>
            </div>

            {error && (
              <div role="alert" className="rounded-xl bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/40 dark:text-error-400">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <LoadingSpinner size={18} /> : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-stone-500 dark:text-stone-400">
            Already have an account?{' '}
            <button onClick={() => navigate('/login')} className="font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400">
              Sign in
            </button>
          </p>
          <p className="mt-3 text-center text-xs text-stone-400">
            By creating an account, you agree to our{' '}
            <button onClick={() => navigate('/terms')} className="underline hover:text-stone-500">Terms</button>{' '}
            and{' '}
            <button onClick={() => navigate('/privacy')} className="underline hover:text-stone-500">Privacy Policy</button>.
          </p>
        </div>
      </div>
    </div>
  );
}
