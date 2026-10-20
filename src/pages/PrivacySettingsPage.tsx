import { useState, type FormEvent, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate } from '@/lib/router';
import { PageHeader } from '@/components/Avatar';
import { LoadingSpinner } from '@/components/States';
import { ArrowLeft, Check, Shield, Eye, Users, MessageSquare } from 'lucide-react';
import type { ProfileVisibility } from '@/types/database';

export default function PrivacySettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [profileVisibility, setProfileVisibility] = useState<ProfileVisibility>('public');
  const [showArea, setShowArea] = useState(true);
  const [showFollowing, setShowFollowing] = useState(true);
  const [showFollowers, setShowFollowers] = useState(true);
  const [allowFollowers, setAllowFollowers] = useState(true);
  const [allowComments, setAllowComments] = useState(true);
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

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <button onClick={() => navigate('/profile')} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400"><ArrowLeft className="h-4 w-4" /> Profile</button>
      <PageHeader title="Privacy settings" subtitle="Control who sees your information and how people interact with you." />

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

        {error && <div role="alert" className="mx-5 my-3 rounded-xl bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/40 dark:text-error-400">{error}</div>}

        <div className="flex items-center gap-3 p-5">
          <button type="button" onClick={() => navigate('/profile')} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading || !dirty} className="btn-primary">
            {loading ? <LoadingSpinner size={18} /> : saved ? <><Check className="h-4 w-4" /> Saved</> : 'Save settings'}
          </button>
        </div>
      </form>
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
