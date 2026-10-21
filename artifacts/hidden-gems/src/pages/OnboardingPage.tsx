import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate } from '@/lib/router';
import { ONBOARDING_INTERESTS, type OnboardingInterest } from '@/types/database';
import { Logo } from '@/components/Logo';
import { LoadingSpinner } from '@/components/States';
import { Check } from 'lucide-react';

const MIN_SELECTIONS = 3;

export default function OnboardingPage() {
  const { profile, user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (interest: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(interest)) next.delete(interest);
      else next.add(interest);
      return next;
    });
  };

  const onComplete = async () => {
    if (loading) return;
    if (selected.size < MIN_SELECTIONS) {
      setError(`Please choose at least ${MIN_SELECTIONS} interests.`);
      return;
    }
    if (!user) {
      setError('No active session. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);

    const interests = Array.from(selected) as OnboardingInterest[];
    const inserts = interests.map((interest) => ({ user_id: user.id, interest }));

    const { error: insertError } = await supabase.from('user_interests').insert(inserts);
    if (insertError) {
      setLoading(false);
      setError(insertError.message);
      return;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', user.id);
    if (updateError) {
      setLoading(false);
      setError(updateError.message);
      return;
    }

    await refreshProfile();
    setLoading(false);
    navigate('/discover');
  };

  if (profile?.onboarding_completed) {
    navigate('/discover');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50/50 to-stone-50 dark:from-stone-900 dark:to-stone-950">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo className="h-12 w-12" />
          <div>
            <h1 className="font-display text-2xl font-semibold">What are you looking for?</h1>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Choose at least three interests. We'll use these to personalize your Discover feed.</p>
          </div>
        </div>

        <div className="card p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {ONBOARDING_INTERESTS.map((interest) => {
              const isSelected = selected.has(interest);
              return (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggle(interest)}
                  aria-pressed={isSelected}
                  className={`flex items-center justify-between rounded-xl border px-3.5 py-3 text-sm font-medium transition-all ${
                    isSelected
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-300'
                      : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200'
                  }`}
                >
                  <span className="text-left">{interest}</span>
                  {isSelected && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {selected.size} of {MIN_SELECTIONS}+ selected
            </p>
          </div>

          {error && (
            <div role="alert" className="mt-4 rounded-xl bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/40 dark:text-error-400">
              {error}
            </div>
          )}

          <button onClick={onComplete} disabled={loading} className="btn-primary mt-5 w-full">
            {loading ? <LoadingSpinner size={18} /> : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
