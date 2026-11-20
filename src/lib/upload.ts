import { supabase } from '@/lib/supabase';

// Originals up to 20 MB are accepted; they're resized in the browser before
// upload, so what reaches storage is usually a few hundred KB.
export const MAX_FILE_SIZE = 20 * 1024 * 1024;
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
    return 'Image must be 20 MB or smaller.';
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return 'File extension does not match an allowed image type.';
  }
  return null;
}

/**
 * Resizes an image so its longest side is at most `maxSide` px and re-encodes
 * it (WebP where supported, else JPEG). Falls back to the original file if the
 * browser can't decode it, or if the result wouldn't be smaller.
 */
export async function shrinkImage(file: File, maxSide = 1600, quality = 0.82): Promise<File> {
  try {
    // imageOrientation applies the phone's EXIF rotation so photos aren't sideways
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const toBlob = (type: string) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, quality));
    let blob = await toBlob('image/webp');
    if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg');
    if (!blob || blob.size >= file.size) return file;
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${base}.${ext}`, { type: blob.type });
  } catch {
    return file;
  }
}

export async function uploadGemImage(gemId: string, original: File): Promise<UploadResult> {
  const file = await shrinkImage(original);
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

/** Removes every photo stored for a gem (cover + gallery live under gem-images/<gemId>/). */
export async function deleteAllGemImages(gemId: string): Promise<void> {
  const bucket = supabase.storage.from('gem-images');
  const { data, error } = await bucket.list(gemId, { limit: 1000 });
  if (error || !data?.length) return;
  await bucket.remove(data.map((f) => `${gemId}/${f.name}`));
}

export async function deleteGemImage(path: string): Promise<void> {
  const { error } = await supabase.storage.from('gem-images').remove([path]);
  if (error) throw error;
}

// Profile photos — public bucket, each user writes only to avatars/<their id>/

export const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB (matches bucket limit)

export async function uploadAvatar(userId: string, original: File): Promise<UploadResult> {
  const file = await shrinkImage(original, 512, 0.85);
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return { url: data.publicUrl, path };
}

/** Removes a previous avatar if it was uploaded to our bucket (pasted URLs are left alone). */
export async function deleteAvatarByUrl(url: string | null | undefined): Promise<void> {
  const path = url?.split('/avatars/')[1];
  if (!path) return;
  await supabase.storage.from('avatars').remove([path]);
}

// Community cover uploads — public bucket, owner-restricted writes

export async function uploadCommunityImage(communityId: string, original: File): Promise<UploadResult> {
  const file = await shrinkImage(original, 1800);
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
  original: File,
): Promise<EvidenceUploadResult> {
  // Evidence keeps more detail (signs, menus, opening hours) but still shrinks
  const file = await shrinkImage(original, 2400, 0.88);
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
