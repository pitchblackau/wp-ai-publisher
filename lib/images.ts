import sharp from 'sharp';
import { supabase } from '@/lib/supabase';

const PROVIDER = process.env.HF_PROVIDER || 'fal-ai';
const MODEL = process.env.HF_IMAGE_MODEL || 'fal-ai/krea-2/turbo';
const BUCKET = 'article-images';

export const imagesConfigured = () => !!process.env.HF_TOKEN;

// Hard limits: nothing above 800x600, inline images <= 50 KB, hero (image 1) <= 75 KB.
export const MAX_DIMENSIONS = { width: 800, height: 600 };
export function imageSize(n: number) {
  return n === 1 ? { width: 800, height: 450 } : { width: 800, height: 600 };
}
export const maxBytes = (n: number) => (n === 1 ? 75 : 50) * 1024;

// Re-encode as progressive JPEG, lowering quality and then dimensions until it fits the byte cap.
export async function compressToLimit(input: Buffer, limit: number): Promise<Buffer> {
  let width = MAX_DIMENSIONS.width;
  for (let shrink = 0; shrink < 8; shrink++) {
    for (const quality of [78, 68, 58, 50, 42, 35, 28]) {
      const out = await sharp(input)
        .resize({ width, height: MAX_DIMENSIONS.height, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true, progressive: true, chromaSubsampling: '4:2:0' })
        .toBuffer();
      if (out.length <= limit) return out;
    }
    width = Math.round(width * 0.85);
  }
  throw new Error(`Could not compress image under ${Math.round(limit / 1024)} KB`);
}

export async function generateImageBytes(prompt: string, width: number, height: number): Promise<{ bytes: Buffer; contentType: string }> {
  const res = await fetch(`https://router.huggingface.co/${PROVIDER}/${MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.HF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_size: { width, height }, num_images: 1, sync_mode: false }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`Image API ${res.status}: ${(await res.text()).slice(0, 200)}`);

  if ((res.headers.get('content-type') || '').includes('json')) {
    const j = await res.json();
    const url = j.images?.[0]?.url || j.image?.url || j.output?.[0];
    if (!url) throw new Error('Image API returned no image URL');
    const img = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!img.ok) throw new Error(`Image download ${img.status}`);
    return { bytes: Buffer.from(await img.arrayBuffer()), contentType: img.headers.get('content-type') || 'image/jpeg' };
  }
  return { bytes: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') || 'image/jpeg' };
}

export async function generateAndStore(articleId: string, n: number, prompt: string): Promise<string> {
  const { width, height } = imageSize(n);
  const { bytes: raw } = await generateImageBytes(prompt, width, height);
  const bytes = await compressToLimit(raw, maxBytes(n));
  const contentType = 'image/jpeg';
  const path = `${articleId}/${n}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Shrink an already-stored image to the size caps without regenerating it (no GPU cost).
export async function recompressStored(articleId: string, n: number, url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const bytes = await compressToLimit(Buffer.from(await res.arrayBuffer()), maxBytes(n));
  const path = `${articleId}/${n}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export function imageFigure(url: string, alt: string): string {
  const safeAlt = alt.replace(/"/g, '&quot;');
  return `<figure class="wp-block-image size-large"><img src="${url}" alt="${safeAlt}" loading="lazy" /></figure>`;
}
