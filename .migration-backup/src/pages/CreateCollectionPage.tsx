import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate } from '@/lib/router';
import { PageHeader } from '@/components/Avatar';
import { LoadingSpinner } from '@/components/States';
import type { CollectionVisibility } from '@/types/database';
import { ArrowLeft, Globe, Lock, Users } from 'lucide-react';

export default function CreateCollectionPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<CollectionVisibility>('private');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || !profile) return;
    if (name.trim().length < 1) { setError('Name is required.'); return; }
    setLoading(true);
    setError(null);
    const { data, error: insertErr } = await supabase
      .from('collections')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        visibility,
        owner_id: profile.id,
      })
      .select('id')
      .single();
    setLoading(false);
    if (insertErr || !data) { setError(insertErr?.message ?? 'Failed to create collection'); return; }
    navigate(`/collections/${data.id}`);
  };

  const visOptions: { value: CollectionVisibility; label: string; desc: string; icon: typeof Globe }[] = [
    { value: 'private', label: 'Private', desc: 'Only you can see this collection', icon: Lock },
    { value: 'followers', label: 'Followers', desc: 'Only your followers can see this', icon: Users },
    { value: 'public', label: 'Public', desc: 'Anyone can discover this collection', icon: Globe },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <button onClick={() => navigate('/collections')} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400"><ArrowLeft className="h-4 w-4" /> Collections</button>
      <PageHeader title="Create a collection" subtitle="Organize gems into a curated list." />

      <form onSubmit={onSubmit} className="card space-y-5 p-6" noValidate>
        <div>
          <label htmlFor="name" className="label">Collection name</label>
          <input id="name" required className="input" placeholder="e.g. Best coffee spots in Jakarta" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </div>

        <div>
          <label htmlFor="description" className="label">Description <span className="text-stone-400">(optional)</span></label>
          <textarea id="description" className="input min-h-[80px] resize-y" placeholder="What's this collection about?" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </div>

        <div>
          <span className="label">Visibility</span>
          <div className="space-y-2">
            {visOptions.map((v) => (
              <button key={v.value} type="button" onClick={() => setVisibility(v.value)} aria-pressed={visibility === v.value}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${visibility === v.value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-stone-200 hover:border-stone-300 dark:border-stone-700'}`}>
                <v.icon className={`h-5 w-5 shrink-0 ${visibility === v.value ? 'text-primary-600 dark:text-primary-400' : 'text-stone-400'}`} />
                <div>
                  <p className={`text-sm font-medium ${visibility === v.value ? 'text-primary-700 dark:text-primary-300' : ''}`}>{v.label}</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">{v.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {error && <div role="alert" className="rounded-xl bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/40 dark:text-error-400">{error}</div>}

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/collections')} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? <LoadingSpinner size={18} /> : 'Create collection'}</button>
        </div>
      </form>
    </div>
  );
}
