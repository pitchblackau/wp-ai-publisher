import { supabase } from '@/lib/supabase';

const PROVIDER = process.env.HF_PROVIDER || 'fal-ai';
const MODEL = process.env.HF_IMAGE_MODEL || 'fal-ai/krea-2/turbo';
const BUCKET = 'article-images';

export const imagesConfigured = () => !!process.env.HF_TOKEN;

// Hero image gets more pixels; inline images stay small to keep GPU cost down.
export function imageSize(n: number) {
  return n === 1 ? { width: 1280, height: 720 } : { width: 800, height: 600 };
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
  const { bytes, contentType } = await generateImageBytes(prompt, width, height);
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const path = `${articleId}/${n}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export function imageFigure(url: string, alt: string): string {
  const safeAlt = alt.replace(/"/g, '&quot;');
  return `<figure class="wp-block-image size-large"><img src="${url}" alt="${safeAlt}" loading="lazy" /></figure>`;
}
