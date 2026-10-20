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
