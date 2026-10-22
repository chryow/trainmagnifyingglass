import { supabase } from '@/lib/supabase';

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

export interface UploadResult {
  url: string;
  path: string;
}

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Only JPG, PNG, and WebP images are allowed.';
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'Image must be 5 MB or smaller.';
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return 'File extension does not match an allowed image type.';
  }
  return null;
}

export async function uploadGemImage(gemId: string, file: File): Promise<UploadResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const filename = `${crypto.randomUUID()}.${ext}`;
  const path = `${gemId}/${filename}`;

  const { error } = await supabase.storage
    .from('gem-images')
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from('gem-images').getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function deleteGemImage(path: string): Promise<void> {
  const { error } = await supabase.storage.from('gem-images').remove([path]);
  if (error) throw error;
}

// Community cover uploads — public bucket, owner-restricted writes

export async function uploadCommunityImage(communityId: string, file: File): Promise<UploadResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const filename = `${crypto.randomUUID()}.${ext}`;
  const path = `${communityId}/${filename}`;

  const { error } = await supabase.storage
    .from('community-images')
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from('community-images').getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function deleteCommunityImage(path: string): Promise<void> {
  const { error } = await supabase.storage.from('community-images').remove([path]);
  if (error) throw error;
}

// Evidence uploads — private bucket, signed URLs

export interface EvidenceUploadResult {
  path: string;
  signedUrl: string;
}

async function uploadEvidence(
  category: 'confirmations' | 'corrections' | 'reports',
  gemId: string | null,
  entityId: string,
  file: File,
): Promise<EvidenceUploadResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const filename = `${crypto.randomUUID()}.${ext}`;
  const path = gemId
    ? `${category}/${gemId}/${entityId}/${filename}`
    : `${category}/${entityId}/${filename}`;

  const { error } = await supabase.storage
    .from('gem-evidence')
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) throw error;

  const { data, error: signErr } = await supabase.storage
    .from('gem-evidence')
    .createSignedUrl(path, 3600);

  if (signErr || !data?.signedUrl) throw signErr ?? new Error('Failed to create signed URL');

  return { path, signedUrl: data.signedUrl };
}

export async function uploadConfirmationEvidence(
  gemId: string,
  confirmationId: string,
  file: File,
): Promise<EvidenceUploadResult> {
  return uploadEvidence('confirmations', gemId, confirmationId, file);
}

export async function uploadCorrectionEvidence(
  gemId: string,
  correctionId: string,
  file: File,
): Promise<EvidenceUploadResult> {
  return uploadEvidence('corrections', gemId, correctionId, file);
}

export async function uploadReportEvidence(
  reportId: string,
  file: File,
): Promise<EvidenceUploadResult> {
  return uploadEvidence('reports', null, reportId, file);
}

export async function getEvidenceSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from('gem-evidence')
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) throw error ?? new Error('Failed to create signed URL');
  return data.signedUrl;
}

export async function deleteEvidence(path: string): Promise<void> {
  const { error } = await supabase.storage.from('gem-evidence').remove([path]);
  if (error) throw error;
}
