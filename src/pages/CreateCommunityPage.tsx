import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate } from '@/lib/router';
import { PageHeader } from '@/components/Avatar';
import { LoadingSpinner } from '@/components/States';
import type { CommunityType, Visibility } from '@/types/database';
import { ArrowLeft, Globe, Lock, MapPin, Sparkles, Users } from 'lucide-react';

export default function CreateCommunityPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [communityType, setCommunityType] = useState<CommunityType>('interest_based');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [generalArea, setGeneralArea] = useState('');
  const [guidelines, setGuidelines] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || !profile) return;
    if (name.trim().length < 3) { setError('Name must be at least 3 characters.'); return; }
    setLoading(true);
    setError(null);
    const { data, error: insertErr } = await supabase
      .from('communities')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        community_type: communityType,
        visibility,
        general_area: generalArea.trim() || null,
        guidelines: guidelines.trim() || null,
        owner_id: profile.id,
      })
      .select('id')
      .single();
    setLoading(false);
    if (insertErr || !data) { setError(insertErr?.message ?? 'Failed to create community'); return; }
    navigate(`/communities/${data.id}`);
  };

  const types: { value: CommunityType; label: string; icon: typeof MapPin }[] = [
    { value: 'location_based', label: 'Location-Based', icon: MapPin },
    { value: 'interest_based', label: 'Interest-Based', icon: Sparkles },
    { value: 'private_group', label: 'Private Group', icon: Users },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <button onClick={() => navigate('/communities')} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400"><ArrowLeft className="h-4 w-4" /> Communities</button>
      <PageHeader title="Create a community" subtitle="Bring people together around a place or interest." />

      <form onSubmit={onSubmit} className="card space-y-5 p-6" noValidate>
        <div>
          <label htmlFor="name" className="label">Community name</label>
          <input id="name" required className="input" placeholder="e.g. Jakarta Food Explorers" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </div>

        <div>
          <label htmlFor="description" className="label">Description</label>
          <textarea id="description" className="input min-h-[80px] resize-y" placeholder="What is this community about?" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
        </div>

        <div>
          <span className="label">Community type</span>
          <div className="grid grid-cols-3 gap-2">
            {types.map((t) => (
              <button key={t.value} type="button" onClick={() => setCommunityType(t.value)} aria-pressed={communityType === t.value}
                className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-3 text-xs font-medium transition-all ${communityType === t.value ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'border-stone-200 text-stone-600 hover:border-stone-300 dark:border-stone-700 dark:text-stone-300'}`}>
                <t.icon className="h-5 w-5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="label">Visibility</span>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setVisibility('public')} aria-pressed={visibility === 'public'} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${visibility === 'public' ? 'border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300' : 'border-stone-200 text-stone-600 dark:border-stone-700 dark:text-stone-300'}`}>
              <Globe className="h-4 w-4" /> Public
            </button>
            <button type="button" onClick={() => setVisibility('private')} aria-pressed={visibility === 'private'} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${visibility === 'private' ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'border-stone-200 text-stone-600 dark:border-stone-700 dark:text-stone-300'}`}>
              <Lock className="h-4 w-4" /> Private (invite code)
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="area" className="label">General area <span className="text-stone-400">(optional)</span></label>
          <input id="area" className="input" placeholder="e.g. Jakarta, Bali, Online" value={generalArea} onChange={(e) => setGeneralArea(e.target.value)} maxLength={60} />
        </div>

        <div>
          <label htmlFor="guidelines" className="label">Community guidelines <span className="text-stone-400">(optional)</span></label>
          <textarea id="guidelines" className="input min-h-[100px] resize-y" placeholder="Set expectations for members — e.g. be respectful, share accurate info, no advertising." value={guidelines} onChange={(e) => setGuidelines(e.target.value)} maxLength={500} />
        </div>

        {error && <div role="alert" className="rounded-xl bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/40 dark:text-error-400">{error}</div>}

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/communities')} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? <LoadingSpinner size={18} /> : 'Create community'}</button>
        </div>
      </form>
    </div>
  );
}
