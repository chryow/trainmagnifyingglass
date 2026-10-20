import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate, useRoute } from '@/lib/router';
import { PageHeader } from '@/components/Avatar';
import { LoadingSpinner, ErrorState } from '@/components/States';
import { validateImageFile } from '@/lib/upload';
import type { Community, Category, GemStatus } from '@/types/database';
import { ArrowLeft, Save, Send, ImagePlus, X } from 'lucide-react';

export default function CreateGemPage() {
  const route = useRoute();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const preselectCommunity = route.params.community ?? '';

  const [communities, setCommunities] = useState<Community[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [communityId, setCommunityId] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [catsRes, mineRes] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('community_members').select('community:communities(*)').eq('user_id', profile.id),
      ]);
      setCategories((catsRes.data as Category[] | null) ?? []);
      const mine = (mineRes.data as { community: Community }[] | null) ?? [];
      setCommunities(mine.map((m) => m.community).filter(Boolean));
      if (preselectCommunity) setCommunityId(preselectCommunity);
    } catch {
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [profile, preselectCommunity]);

  useEffect(() => { load(); }, [load]);

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) { setImageError(err); return; }
    setImageError(null);
    setCoverImage(URL.createObjectURL(file));
  };

  const handleSubmit = async (publishStatus: GemStatus) => {
    if (saving || !profile) return;
    if (title.trim().length < 3) { setError('Title must be at least 3 characters.'); return; }
    if (!placeName.trim()) { setError('Place name is required.'); return; }
    if (!communityId) { setError('Please select a community.'); return; }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        community_id: communityId,
        author_id: profile.id,
        category_id: categoryId || null,
        title: title.trim(),
        place_name: placeName.trim(),
        area: area.trim() || null,
        address: address.trim() || null,
        description: description.trim() || null,
        cover_image_url: coverImage,
        status: publishStatus,
      };

      const { data, error: insErr } = await supabase.from('gems').insert(payload).select('id').single();
      if (insErr) {
        if (insErr.code === '23505') setError('You already have a published gem for this place in this community.');
        else setError(insErr.message);
        setSaving(false);
        return;
      }
      navigate(`/gems/${data.id}`);
    } catch {
      setError('Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3 py-16"><LoadingSpinner className="text-primary-500" /> <span className="text-stone-500">Loading…</span></div>
      </div>
    );
  }

  if (communities.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState title="Join a community first" description="You need to be a member of at least one community to share a gem." onRetry={() => navigate('/communities')} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <button onClick={() => navigate('/discover')} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <PageHeader title="Share a hidden gem" subtitle="Recommend a lesser-known spot to your community." />

      <form className="card space-y-5 p-6" noValidate onSubmit={(e: FormEvent) => { e.preventDefault(); void handleSubmit('published'); }}>
        <div>
          <label htmlFor="community" className="label">Community</label>
          <select id="community" className="input" value={communityId} onChange={(e) => setCommunityId(e.target.value)}>
            <option value="">Select a community…</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="title" className="label">Title</label>
          <input id="title" className="input" placeholder="e.g. Best late-night coffee spot" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </div>

        <div>
          <label htmlFor="placeName" className="label">Place name</label>
          <input id="placeName" className="input" placeholder="e.g. Warung Kopi Senja" value={placeName} onChange={(e) => setPlaceName(e.target.value)} maxLength={200} />
        </div>

        <div>
          <label htmlFor="category" className="label">Category <span className="text-stone-400">(optional)</span></label>
          <select id="category" className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="area" className="label">Area <span className="text-stone-400">(optional)</span></label>
            <input id="area" className="input" placeholder="e.g. Kemang, Jakarta" value={area} onChange={(e) => setArea(e.target.value)} maxLength={100} />
          </div>
          <div>
            <label htmlFor="address" className="label">Address <span className="text-stone-400">(optional)</span></label>
            <input id="address" className="input" placeholder="Street address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} />
          </div>
        </div>

        <div>
          <label htmlFor="description" className="label">Description <span className="text-stone-400">(optional)</span></label>
          <textarea id="description" className="input min-h-[100px] resize-y" placeholder="What makes this place special? Why is it a hidden gem?" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
        </div>

        <div>
          <span className="label">Cover image <span className="text-stone-400">(optional)</span></span>
          {coverImage ? (
            <div className="relative overflow-hidden rounded-xl">
              <img src={coverImage} alt="Cover preview" className="h-48 w-full object-cover" />
              <button type="button" onClick={() => setCoverImage(null)} className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-stone-300 p-6 text-stone-500 transition-colors hover:border-primary-400 hover:text-primary-500 dark:border-stone-700 dark:hover:border-primary-500">
              <ImagePlus className="h-6 w-6" />
              <span className="text-sm">Click to upload (JPG, PNG, WebP — max 5MB)</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCoverUpload} />
            </label>
          )}
          {imageError && <p className="mt-2 text-sm text-error-600 dark:text-error-400">{imageError}</p>}
        </div>

        {error && <div role="alert" className="rounded-xl bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/40 dark:text-error-400">{error}</div>}

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/discover')} className="btn-secondary">Cancel</button>
          <button type="button" disabled={saving} onClick={() => void handleSubmit('draft')} className="btn-outline flex-1">
            {saving ? <LoadingSpinner size={16} /> : <><Save className="h-4 w-4" /> Save draft</>}
          </button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? <LoadingSpinner size={16} /> : <><Send className="h-4 w-4" /> Publish</>}
          </button>
        </div>
      </form>
    </div>
  );
}
