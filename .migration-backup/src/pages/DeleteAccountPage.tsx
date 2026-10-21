import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate } from '@/lib/router';
import { PageHeader } from '@/components/Avatar';
import { LoadingSpinner } from '@/components/States';
import { ArrowLeft, AlertTriangle, Check, X } from 'lucide-react';

type DeletionState = 'confirm' | 'processing' | 'success' | 'failure';

export default function DeleteAccountPage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [state, setState] = useState<DeletionState>('confirm');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = password.length > 0 && confirmText === 'DELETE MY ACCOUNT' && acknowledged;

  const handleDelete = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !profile) return;
    setState('processing');
    setError(null);

    try {
      // Re-authenticate with password to ensure recent authentication
      const userEmail = (await supabase.auth.getUser()).data.user?.email;
      if (!userEmail) {
        setState('failure');
        setError('Could not verify your identity. Please try again.');
        return;
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      });
      if (signInErr) {
        setState('failure');
        setError('Password is incorrect. Please enter your current password.');
        return;
      }

      // Call the server-side deletion function
      const { data: rpcData, error: rpcErr } = await supabase.rpc('delete_account', {
        p_password: password,
      });

      if (rpcErr || !rpcData?.success) {
        setState('failure');
        setError(rpcErr?.message ?? rpcData?.error ?? 'Deletion could not be completed.');
        return;
      }

      // Sign out
      await signOut();
      setState('success');
    } catch {
      setState('failure');
      setError('An unexpected error occurred. Please try again or contact support.');
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <button onClick={() => navigate('/settings')} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400">
        <ArrowLeft className="h-4 w-4" /> Settings
      </button>
      <PageHeader title="Delete account" subtitle="This action is permanent and cannot be undone." />

      {state === 'success' ? (
        <div className="card p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success-50 dark:bg-success-950/40">
            <Check className="h-6 w-6 text-success-600 dark:text-success-400" />
          </div>
          <h2 className="font-display text-lg font-semibold">Account deleted</h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Your account has been deleted. Public contributions have been anonymized as "Deleted User."
          </p>
          <button onClick={() => navigate('/')} className="mt-4 btn-primary text-sm">Return to home</button>
        </div>
      ) : state === 'failure' ? (
        <div className="card space-y-4 p-6">
          <div className="flex items-center gap-3 rounded-xl bg-error-50 px-4 py-3 dark:bg-error-950/40">
            <X className="h-5 w-5 shrink-0 text-error-600 dark:text-error-400" />
            <div>
              <p className="text-sm font-medium text-error-700 dark:text-error-400">Deletion could not be completed</p>
              <p className="mt-0.5 text-sm text-error-600 dark:text-error-500">{error}</p>
            </div>
          </div>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            If the problem persists, please use the <button onClick={() => navigate('/support')} className="text-primary-600 underline">support page</button> for assistance.
          </p>
          <button onClick={() => setState('confirm')} className="btn-secondary text-sm">Try again</button>
        </div>
      ) : (
        <form onSubmit={handleDelete} className="card space-y-5 p-6" noValidate>
          {/* What will happen */}
          <div className="rounded-xl bg-amber-50 p-4 dark:bg-amber-900/20">
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-amber-800 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" /> What will happen
            </h3>
            <ul className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-300">
              <li>Your profile will be anonymized as "Deleted User"</li>
              <li>Your private collections and saved gems will be removed</li>
              <li>Your follow and block relationships will be removed</li>
              <li>Your community memberships will be removed</li>
              <li>Your notifications will be removed</li>
              <li>Your published gems and comments will remain but be anonymized</li>
              <li>Moderation and security records will be retained without your identity</li>
              <li>You will be signed out and unable to log in</li>
            </ul>
          </div>

          <div className="rounded-xl bg-stone-50 p-4 dark:bg-stone-800/50">
            <h3 className="font-display text-sm font-semibold">What stays</h3>
            <ul className="mt-2 space-y-1 text-xs text-stone-500 dark:text-stone-400">
              <li>Public gems and comments (shown as "Deleted User")</li>
              <li>Moderation action history (anonymized)</li>
              <li>Report records (anonymized)</li>
            </ul>
          </div>

          {/* Password confirmation */}
          <div>
            <label className="label">Enter your password to confirm</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Your current password"
            />
          </div>

          {/* Type confirmation */}
          <div>
            <label className="label">Type DELETE MY ACCOUNT to confirm</label>
            <input
              type="text"
              className="input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
            />
          </div>

          {/* Acknowledgment */}
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-stone-300 dark:border-stone-600"
            />
            <span className="text-sm text-stone-600 dark:text-stone-400">
              I understand this action is permanent and cannot be undone. My public contributions will be anonymized, and my private data will be deleted.
            </span>
          </label>

          {error && state === 'processing' && (
            <div role="alert" className="rounded-xl bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/40">{error}</div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={() => navigate('/settings')} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={!canSubmit || state === 'processing'} className="btn-danger flex-1">
              {state === 'processing' ? <><LoadingSpinner size={18} /> Deleting…</> : <><AlertTriangle className="h-4 w-4" /> Permanently delete</>}
            </button>
          </div>

          <p className="text-center text-xs text-stone-400">
            Need help? Visit our <button type="button" onClick={() => navigate('/support')} className="underline">support page</button>.
          </p>
        </form>
      )}
    </div>
  );
}
