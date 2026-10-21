import { useState, type FormEvent, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate } from '@/lib/router';
import { PageHeader } from '@/components/Avatar';
import { LoadingSpinner } from '@/components/States';
import {
  ArrowLeft, Check, Shield, Eye, Users, MessageSquare, Ban,
  Bell, KeyRound, LogOut, AlertTriangle, Lock
} from 'lucide-react';
import type { ProfileVisibility } from '@/types/database';

export default function PrivacySettingsPage() {
  const { profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [profileVisibility, setProfileVisibility] = useState<ProfileVisibility>('public');
  const [showArea, setShowArea] = useState(true);
  const [showFollowing, setShowFollowing] = useState(true);
  const [showFollowers, setShowFollowers] = useState(true);
  const [allowFollowers, setAllowFollowers] = useState(true);
  const [allowComments, setAllowComments] = useState(true);
  const [notifyComments, setNotifyComments] = useState(true);
  const [notifyReactions, setNotifyReactions] = useState(true);
  const [notifyFollows, setNotifyFollows] = useState(true);
  const [notifyCollections, setNotifyCollections] = useState(true);
  const [notifyCorrections, setNotifyCorrections] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (profile) {
      setProfileVisibility(profile.profile_visibility);
      setShowArea(profile.show_area);
      setShowFollowing(profile.show_following);
      setShowFollowers(profile.show_followers);
      setAllowFollowers(profile.allow_followers);
      setAllowComments(profile.allow_comments);
      setNotifyComments(profile.notify_comments);
      setNotifyReactions(profile.notify_reactions);
      setNotifyFollows(profile.notify_follows);
      setNotifyCollections(profile.notify_collections);
      setNotifyCorrections(profile.notify_corrections);
    }
  }, [profile]);

  const markDirty = () => { setDirty(true); setSaved(false); };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || !profile) return;
    setLoading(true);
    setError(null);
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        profile_visibility: profileVisibility,
        show_area: showArea,
        show_following: showFollowing,
        show_followers: showFollowers,
        allow_followers: allowFollowers,
        allow_comments: allowComments,
        notify_comments: notifyComments,
        notify_reactions: notifyReactions,
        notify_follows: notifyFollows,
        notify_collections: notifyCollections,
        notify_corrections: notifyCorrections,
      })
      .eq('id', profile.id);
    setLoading(false);
    if (updateErr) { setError(updateErr.message); return; }
    await refreshProfile();
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const handleSignOutAll = async () => {
    if (!confirm('This will sign you out of all devices. Continue?')) return;
    await supabase.auth.signOut({ scope: 'global' });
    await signOut();
  };

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <button onClick={() => navigate('/profile')} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400"><ArrowLeft className="h-4 w-4" /> Profile</button>
      <PageHeader title="Settings" subtitle="Control your privacy, notifications, and account." />

      <form onSubmit={onSubmit} className="card divide-y divide-stone-200 dark:divide-stone-800" noValidate>
        <Section icon={<Shield className="h-5 w-5" />} title="Profile visibility">
          <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">Choose who can view your profile.</p>
          <div className="flex gap-2">
            <ToggleChip active={profileVisibility === 'public'} onClick={() => { setProfileVisibility('public'); markDirty(); }}>Public</ToggleChip>
            <ToggleChip active={profileVisibility === 'community_only'} onClick={() => { setProfileVisibility('community_only'); markDirty(); }}>Community members only</ToggleChip>
          </div>
        </Section>

        <Section icon={<Eye className="h-5 w-5" />} title="What to show">
          <ToggleRow label="Show my general area" checked={showArea} onChange={(v) => { setShowArea(v); markDirty(); }} />
          <ToggleRow label="Show who I follow" checked={showFollowing} onChange={(v) => { setShowFollowing(v); markDirty(); }} />
          <ToggleRow label="Show my followers" checked={showFollowers} onChange={(v) => { setShowFollowers(v); markDirty(); }} />
        </Section>

        <Section icon={<Users className="h-5 w-5" />} title="Followers">
          <ToggleRow label="Allow new followers" checked={allowFollowers} onChange={(v) => { setAllowFollowers(v); markDirty(); }} />
        </Section>

        <Section icon={<MessageSquare className="h-5 w-5" />} title="Comments">
          <ToggleRow label="Allow comments on my recommendations" checked={allowComments} onChange={(v) => { setAllowComments(v); markDirty(); }} />
        </Section>

        <Section icon={<Bell className="h-5 w-5" />} title="Notification preferences">
          <ToggleRow label="Comments and replies" checked={notifyComments} onChange={(v) => { setNotifyComments(v); markDirty(); }} />
          <ToggleRow label="Reactions" checked={notifyReactions} onChange={(v) => { setNotifyReactions(v); markDirty(); }} />
          <ToggleRow label="New followers" checked={notifyFollows} onChange={(v) => { setNotifyFollows(v); markDirty(); }} />
          <ToggleRow label="Collection additions" checked={notifyCollections} onChange={(v) => { setNotifyCollections(v); markDirty(); }} />
          <ToggleRow label="Correction updates" checked={notifyCorrections} onChange={(v) => { setNotifyCorrections(v); markDirty(); }} />
        </Section>

        <Section icon={<Ban className="h-5 w-5" />} title="Blocked users">
          <p className="text-sm text-stone-500 dark:text-stone-400">Manage people you've blocked.</p>
          <button type="button" onClick={() => navigate('/settings/blocked')} className="mt-2 btn-outline text-sm">View blocked users</button>
        </Section>

        {error && <div role="alert" className="mx-5 my-3 rounded-xl bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/40 dark:text-error-400">{error}</div>}

        <div className="flex items-center gap-3 p-5">
          <button type="button" onClick={() => navigate('/profile')} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading || !dirty} className="btn-primary">
            {loading ? <LoadingSpinner size={18} /> : saved ? <><Check className="h-4 w-4" /> Saved</> : 'Save settings'}
          </button>
        </div>
      </form>

      {/* Account section */}
      <div className="card divide-y divide-stone-200 dark:divide-stone-800">
        <Section icon={<KeyRound className="h-5 w-5" />} title="Password">
          <button onClick={() => navigate('/settings/password')} className="btn-outline text-sm">
            <Lock className="h-4 w-4" /> Change password
          </button>
        </Section>

        <Section icon={<LogOut className="h-5 w-5" />} title="Sessions">
          <p className="mb-2 text-sm text-stone-500 dark:text-stone-400">Sign out of your current session or all devices.</p>
          <div className="flex gap-2">
            <button onClick={() => signOut()} className="btn-outline text-sm">Sign out</button>
            <button onClick={handleSignOutAll} className="btn-outline text-sm text-error-600 dark:text-error-400">Sign out all devices</button>
          </div>
        </Section>

        <Section icon={<AlertTriangle className="h-5 w-5" />} title="Delete account">
          <p className="text-sm text-stone-500 dark:text-stone-400">Permanently delete your account, anonymize your public contributions, and remove private data. This cannot be undone.</p>
          <button onClick={() => navigate('/settings/delete-account')} className="mt-2 btn-danger text-sm">
            <AlertTriangle className="h-4 w-4" /> Delete my account
          </button>
        </Section>
      </div>

      {/* Footer links */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 pb-4 text-xs text-stone-400">
        <button onClick={() => navigate('/privacy')} className="hover:text-stone-600 dark:hover:text-stone-300">Privacy Overview</button>
        <button onClick={() => navigate('/terms')} className="hover:text-stone-600 dark:hover:text-stone-300">Terms of Use</button>
        <button onClick={() => navigate('/guidelines')} className="hover:text-stone-600 dark:hover:text-stone-300">Community Guidelines</button>
        <button onClick={() => navigate('/accuracy')} className="hover:text-stone-600 dark:hover:text-stone-300">Accuracy Disclaimer</button>
        <button onClick={() => navigate('/content-guidelines')} className="hover:text-stone-600 dark:hover:text-stone-300">Content Guidelines</button>
        <button onClick={() => navigate('/deletion-info')} className="hover:text-stone-600 dark:hover:text-stone-300">Account Deletion</button>
        <button onClick={() => navigate('/support')} className="hover:text-stone-600 dark:hover:text-stone-300">Contact &amp; Support</button>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-stone-400">{icon}</span>
        <h2 className="font-display text-base font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}
function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${active ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'border-stone-200 text-stone-600 dark:border-stone-700 dark:text-stone-300'}`}>
      {children}
    </button>
  );
}
function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-2">
      <span className="text-sm text-stone-700 dark:text-stone-300">{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-primary-600' : 'bg-stone-300 dark:bg-stone-700'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </label>
  );
}
