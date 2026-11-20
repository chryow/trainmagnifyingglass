import { useState, type FormEvent, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate } from '@/lib/router';
import { Avatar, PageHeader } from '@/components/Avatar';
import { LoadingSpinner } from '@/components/States';
import { validateImageFile, uploadAvatar, deleteAvatarByUrl } from '@/lib/upload';
import { ArrowLeft, Check, Camera, Trash2 } from 'lucide-react';

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
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Photos save immediately (separately from the text fields), so the
  // uploaded file and the profile never get out of sync.
  const savePhoto = async (url: string | null) => {
    if (!profile) return false;
    const { error: updErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id);
    if (updErr) { setPhotoError(updErr.message); return false; }
    await refreshProfile();
    return true;
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !profile || uploading) return;
    const invalid = validateImageFile(file);
    if (invalid) { setPhotoError(invalid); return; }
    setPhotoError(null);
    setUploading(true);
    try {
      const previous = profile.avatar_url;
      const { url } = await uploadAvatar(profile.id, file);
      if (await savePhoto(url)) {
        setAvatarUrl(url);
        await deleteAvatarByUrl(previous);
      }
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!profile?.avatar_url || uploading) return;
    setUploading(true);
    setPhotoError(null);
    const previous = profile.avatar_url;
    if (await savePhoto(null)) {
      setAvatarUrl('');
      await deleteAvatarByUrl(previous);
    }
    setUploading(false);
  };

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

      <div className="card flex flex-col items-center gap-4 p-6 sm:flex-row">
        <div className="relative">
          <Avatar url={avatarUrl || null} name={displayName || profile.display_name} size={88} />
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white"><LoadingSpinner size={22} /></span>
          )}
        </div>
        <div className="text-center sm:text-left">
          <p className="font-semibold">Profile photo</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">JPG, PNG or WebP. Saves right away.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <label className={`btn-primary cursor-pointer ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
              <Camera className="h-4 w-4" /> {avatarUrl ? 'Change photo' : 'Upload photo'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handlePhotoSelect} disabled={uploading} />
            </label>
            {avatarUrl && (
              <button type="button" onClick={handleRemovePhoto} disabled={uploading} className="btn-outline">
                <Trash2 className="h-4 w-4" /> Remove
              </button>
            )}
          </div>
          {photoError && <p role="alert" className="mt-2 text-sm text-error-600 dark:text-error-400">{photoError}</p>}
        </div>
      </div>

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
