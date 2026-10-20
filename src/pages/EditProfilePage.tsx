import { useState, type FormEvent, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate } from '@/lib/router';
import { PageHeader } from '@/components/Avatar';
import { LoadingSpinner } from '@/components/States';
import { ArrowLeft, Check } from 'lucide-react';

export default function EditProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [homeArea, setHomeArea] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name);
      setBio(profile.bio ?? '');
      setHomeArea(profile.home_area ?? '');
      setAvatarUrl(profile.avatar_url ?? '');
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
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        home_area: homeArea.trim() || null,
        avatar_url: avatarUrl.trim() || null,
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
      <PageHeader title="Edit profile" subtitle="Update how you appear to the community." />

      <form onSubmit={onSubmit} className="card space-y-5 p-6" noValidate>
        <div>
          <label htmlFor="displayName" className="label">Display name</label>
          <input id="displayName" required className="input" value={displayName} onChange={(e) => { setDisplayName(e.target.value); markDirty(); }} maxLength={40} />
        </div>
        <div>
          <label htmlFor="bio" className="label">Biography</label>
          <textarea id="bio" className="input min-h-[80px] resize-y" value={bio} onChange={(e) => { setBio(e.target.value); markDirty(); }} maxLength={160} />
          <p className="mt-1 text-right text-xs text-stone-400">{bio.length}/160</p>
        </div>
        <div>
          <label htmlFor="homeArea" className="label">Home area</label>
          <input id="homeArea" className="input" value={homeArea} onChange={(e) => { setHomeArea(e.target.value); markDirty(); }} maxLength={60} />
        </div>
        <div>
          <label htmlFor="avatarUrl" className="label">Avatar image URL</label>
          <input id="avatarUrl" type="url" className="input" placeholder="https://…" value={avatarUrl} onChange={(e) => { setAvatarUrl(e.target.value); markDirty(); }} />
          <p className="mt-1 text-xs text-stone-400">Paste an image URL. Photo uploads via Supabase Storage will be added in Phase 2.</p>
        </div>

        {error && <div role="alert" className="rounded-xl bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/40 dark:text-error-400">{error}</div>}

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/profile')} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading || !dirty} className="btn-primary">
            {loading ? <LoadingSpinner size={18} /> : saved ? <><Check className="h-4 w-4" /> Saved</> : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
