/**
 * imageUpload.ts — shrink images in the browser BEFORE they are uploaded, then store them in
 * Supabase Storage (not in a database column).
 *
 * WHY:
 *   - A phone photo is often 3–8 MB. Saved as base64 text in the experts table it became part
 *     of every expert-list download. Now we resize to max 512 px, convert to WebP (~20–60 KB),
 *     upload it to the public "avatars" bucket, and save only the short https URL in the table.
 *   - Public bucket files are served through Supabase's CDN with a 1-year cache header, so
 *     returning visitors don't download the same photo again ("cached egress", billed separately
 *     and far below the limit).
 *   - We do NOT use Supabase image transformations (not included in the Free Plan).
 */
import imageCompression from 'browser-image-compression';

export async function compressImageToWebp(
  file: File,
  opts: { maxSizeMB?: number; maxWidthOrHeight?: number } = {}
): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: opts.maxSizeMB ?? 0.15, // aim for ≤ 150 KB
    maxWidthOrHeight: opts.maxWidthOrHeight ?? 512, // avatars are shown at ≤ 300 px
    fileType: 'image/webp',
    initialQuality: 0.82,
    useWebWorker: true
  });
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses `file` and uploads it through our server (/api/uploads/avatar, which uses the
 * service key so the browser never needs write access to Storage).
 * Returns the public https URL to store in the database.
 * Throws with a readable message if anything fails — the caller shows it to the user.
 */
export async function uploadAvatarImage(file: File, ownerId: string): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file (JPG, PNG, WebP…).');
  if (file.size > 15 * 1024 * 1024) throw new Error('This image is larger than 15 MB. Please choose a smaller one.');

  const compressed = await compressImageToWebp(file);
  const dataUrl = await fileToDataUrl(compressed);

  const res = await fetch('/api/uploads/avatar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerId, fileData: dataUrl, contentType: 'image/webp' })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success || !json?.url) {
    throw new Error(json?.error || `Upload failed (HTTP ${res.status}).`);
  }
  return json.url as string;
}
