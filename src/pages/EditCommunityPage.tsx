import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNavigate, useRoute, matchPath } from '@/lib/router';
import { PageHeader } from '@/components/Avatar';
import { LoadingSpinner, ErrorState } from '@/components/States';
import { validateImageFile, uploadCommunityImage, deleteCommunityImage } from '@/lib/upload';
import type { Community, Visibility, CommunityType } from '@/types/database';
import { ArrowLeft, Save, ImagePlus, X, Archive, Trash2, AlertTriangle } from 'lucide-react';

export default function EditCommunityPage() {
  const route = useRoute();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const match = matchPath('/communities/:id/edit', route.path);
  const communityId = match?.id ?? '';

  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [generalArea, setGeneralArea] = useState('');
  const [guidelines, setGuidelines] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // Archive/delete state
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archivePhrase, setArchivePhrase] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteCheck, setDeleteCheck] = useState<{ gems: number; members: number; reports: number; invitations: number } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!communityId || !profile) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase.from('communities').select('*').eq('id', communityId).maybeSingle();
      if (err || !data) { setError('Community not found.'); return; }
      const c = data as Community;
      if (c.owner_id !== profile.id) { setError('Only the community owner can edit settings.'); return; }
      setCommunity(c);
      setName(c.name);
      setDescription(c.description ?? '');
      setGeneralArea(c.general_area ?? '');
      setGuidelines(c.guidelines ?? '');
      setVisibility(c.visibility);
      setCoverPreview(c.cover_image_url);
    } catch {
      setError('Failed to load community.');
    } finally {
      setLoading(false);
    }
  }, [communityId, profile]);

  useEffect(() => { load(); }, [load]);

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) { setImageError(err); return; }
    setImageError(null);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!community || saving) return;
    if (name.trim().length < 2) { setFormError('Name must be at least 2 characters.'); return; }
    setSaving(true);
    setFormError(null);
    try {
      let coverUrl = community.cover_image_url;
      if (coverFile) {
        const { url, path } = await uploadCommunityImage(community.id, coverFile);
        coverUrl = url;
        if (community.cover_image_url) {
          const oldPath = community.cover_image_url.split('/community-images/')[1];
          if (oldPath) { try { await deleteCommunityImage(oldPath); } catch { /* ignore */ } }
        }
      }
      const { error: updErr } = await supabase.from('communities').update({
        name: name.trim(),
        description: description.trim() || null,
        general_area: generalArea.trim() || null,
        guidelines: guidelines.trim() || null,
        visibility,
        cover_image_url: coverUrl,
      }).eq('id', community.id);
      if (updErr) { setFormError(updErr.message); setSaving(false); return; }
      setSaving(false);
      navigate(`/communities/${community.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save. Please try again.';
      setFormError(msg);
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!community || archivePhrase !== community.name) return;
    setSaving(true);
    setActionError(null);
    const { error: rpcErr } = await supabase.rpc('archive_community', { p_community_id: community.id });
    setSaving(false);
    if (rpcErr) { setActionError(rpcErr.message); return; }
    navigate(`/communities/${community.id}`);
  };

  const handleRestore = async () => {
    if (!community) return;
    setSaving(true);
    setActionError(null);
    const { error: rpcErr } = await supabase.rpc('restore_community', { p_community_id: community.id });
    setSaving(false);
    if (rpcErr) { setActionError(rpcErr.message); return; }
    await load();
  };

  const checkDeleteEligibility = async () => {
    if (!community) return;
    setActionError(null);
    const [gemsRes, membersRes, reportsRes, invitesRes] = await Promise.all([
      supabase.from('gems').select('id', { count: 'exact', head: true }).eq('community_id', community.id),
      supabase.from('community_members').select('id', { count: 'exact', head: true }).eq('community_id', community.id).neq('user_id', community.owner_id),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('community_id', community.id),
      supabase.from('community_invitations').select('id', { count: 'exact', head: true }).eq('community_id', community.id),
    ]);
    const counts = {
      gems: gemsRes.count ?? 0,
      members: membersRes.count ?? 0,
      reports: reportsRes.count ?? 0,
      invitations: invitesRes.count ?? 0,
    };
    setDeleteCheck(counts);
  };

  const handleDelete = async () => {
    if (!community || !deleteCheck) return;
    if (deleteCheck.gems > 0 || deleteCheck.members > 0 || deleteCheck.reports > 0 || deleteCheck.invitations > 0) return;
    setSaving(true);
    setActionError(null);
    const { error: rpcErr } = await supabase.rpc('delete_empty_community', { p_community_id: community.id });
    setSaving(false);
    if (rpcErr) { setActionError(rpcErr.message); return; }
    navigate('/communities');
  };

  if (loading) {
    return <div className="flex items-center gap-3 py-16"><LoadingSpinner className="text-primary-500" /> <span className="text-stone-500">Loading community…</span></div>;
  }
  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <button onClick={() => navigate('/communities')} className="mb-4 flex items-center gap-1 text-sm text-stone-500"><ArrowLeft className="h-4 w-4" /> Back</button>
        <ErrorState title="Cannot edit" description={error} onRetry={() => navigate('/communities')} />
      </div>
    );
  }
  if (!community) return null;

  const isArchived = !community.is_active;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <button onClick={() => navigate(`/communities/${community.id}`)} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400">
        <ArrowLeft className="h-4 w-4" /> Back to community
      </button>
      <PageHeader title="Edit community" subtitle="Manage your community's settings, visibility, and status." />

      {isArchived && (
        <div className="card flex items-center gap-3 border-amber-200 p-4 dark:border-amber-800">
          <Archive className="h-5 w-5 shrink-0 text-amber-500" />
          <div className="flex-1">
            <p className="text-sm font-medium">This community is archived</p>
            <p className="text-xs text-stone-500">Archived communities preserve all content but prevent new activity.</p>
          </div>
          <button onClick={handleRestore} disabled={saving} className="btn-outline text-sm">
            {saving ? <LoadingSpinner size={16} /> : 'Restore'}
          </button>
        </div>
      )}

      <form className="card space-y-5 p-6" noValidate onSubmit={handleSave}>
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input min-h-[80px] resize-y" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </div>
        <div>
          <label className="label">General area</label>
          <input className="input" value={generalArea} onChange={(e) => setGeneralArea(e.target.value)} maxLength={100} />
        </div>
        <div>
          <label className="label">Community guidelines</label>
          <textarea className="input min-h-[80px] resize-y" value={guidelines} onChange={(e) => setGuidelines(e.target.value)} maxLength={2000} />
        </div>
        <div>
          <label className="label">Visibility</label>
          <select className="input" value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>
            <option value="public">Public — anyone can find and join</option>
            <option value="private">Private — invitation code required</option>
          </select>
        </div>
        <div>
          <span className="label">Cover image</span>
          {coverPreview ? (
            <div className="relative overflow-hidden rounded-xl">
              <img src={coverPreview} alt="Cover preview" className="h-40 w-full object-cover" />
              <button type="button" onClick={() => { setCoverFile(null); setCoverPreview(null); }} className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-stone-300 p-6 text-stone-500 hover:border-primary-400 dark:border-stone-700">
              <ImagePlus className="h-6 w-6" />
              <span className="text-sm">Upload cover image</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCoverSelect} />
            </label>
          )}
          {imageError && <p className="mt-2 text-sm text-error-600 dark:text-error-400">{imageError}</p>}
        </div>

        {formError && <div role="alert" className="rounded-xl bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/40 dark:text-error-400">{formError}</div>}

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(`/communities/${community.id}`)} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? <LoadingSpinner size={16} /> : <><Save className="h-4 w-4" /> Save changes</>}
          </button>
        </div>
      </form>

      {/* Danger zone */}
      {!isArchived && (
        <div className="card space-y-4 border-error-200 p-5 dark:border-error-800">
          <h2 className="font-display text-lg font-semibold text-error-700 dark:text-error-400">Danger zone</h2>

          {/* Archive */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-stone-500" />
              <p className="text-sm font-medium">Archive this community</p>
            </div>
            <p className="text-xs text-stone-500">Archiving preserves all gems, members, and history but prevents new activity. You can restore it later.</p>
            {!showArchiveConfirm ? (
              <button onClick={() => setShowArchiveConfirm(true)} className="btn-outline text-sm">Archive community</button>
            ) : (
              <div className="space-y-2 rounded-xl bg-stone-50 p-3 dark:bg-stone-800/50">
                <p className="text-sm font-medium">Type the community name to confirm:</p>
                <input className="input" placeholder={community.name} value={archivePhrase} onChange={(e) => setArchivePhrase(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={() => { setShowArchiveConfirm(false); setArchivePhrase(''); }} className="btn-secondary text-sm">Cancel</button>
                  <button onClick={handleArchive} disabled={saving || archivePhrase !== community.name} className="btn-danger text-sm">
                    {saving ? <LoadingSpinner size={16} /> : 'Confirm archive'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Delete (only if eligible) */}
          <div className="space-y-2 border-t border-stone-200 pt-4 dark:border-stone-800">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-error-500" />
              <p className="text-sm font-medium">Permanently delete</p>
            </div>
            <p className="text-xs text-stone-500">Only available for empty communities with no gems, members, reports, or invitations.</p>
            {!showDeleteConfirm ? (
              <button onClick={() => { setShowDeleteConfirm(true); void checkDeleteEligibility(); }} className="btn-outline text-sm text-error-600 dark:text-error-400">Check eligibility</button>
            ) : deleteCheck ? (
              <div className="space-y-2 rounded-xl bg-stone-50 p-3 dark:bg-stone-800/50">
                {deleteCheck.gems > 0 || deleteCheck.members > 0 || deleteCheck.reports > 0 || deleteCheck.invitations > 0 ? (
                  <>
                    <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4" />
                      Cannot delete — community has dependent records:
                    </div>
                    <ul className="text-xs text-stone-500">
                      {deleteCheck.gems > 0 && <li>{deleteCheck.gems} gem(s)</li>}
                      {deleteCheck.members > 0 && <li>{deleteCheck.members} member(s)</li>}
                      {deleteCheck.reports > 0 && <li>{deleteCheck.reports} report(s)</li>}
                      {deleteCheck.invitations > 0 && <li>{deleteCheck.invitations} invitation(s)</li>}
                    </ul>
                    <p className="text-xs text-stone-400">Archive this community instead to preserve its history.</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-error-600">This community is empty and can be permanently deleted.</p>
                    <div className="flex gap-2">
                      <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary text-sm">Cancel</button>
                      <button onClick={handleDelete} disabled={saving} className="btn-danger text-sm">
                        {saving ? <LoadingSpinner size={16} /> : 'Delete permanently'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <LoadingSpinner className="text-primary-500" />
            )}
          </div>
        </div>
      )}

      {actionError && <div role="alert" className="rounded-xl bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/40 dark:text-error-400">{actionError}</div>}
    </div>
  );
}
