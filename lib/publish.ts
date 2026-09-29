import { decrypt } from '@/lib/crypto';
import { deletePost, deletePostPlugin, publishPost, publishPostPlugin, uploadMediaPlugin } from '@/lib/wp-api';
import type { ImagePlanItem } from '@/types';

export interface PublishSite {
  id: string;
  url: string;
  plugin_key_encrypted: string | null;
  wp_username: string | null;
  wp_password_encrypted: string | null;
}

export interface PublishArticle {
  title: string;
  body: string;
  meta_description: string;
  tags: string[];
  category: string;
  image_plan: ImagePlanItem[] | null;
}

export interface PublishResult { ok: boolean; postId?: number; postUrl?: string; error?: string; }

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'image';
}

export async function publishArticleToSite(
  site: PublishSite,
  article: PublishArticle,
  opts: { status: 'publish' | 'future'; date?: string }
): Promise<PublishResult> {
  // Markers left behind by failed/skipped image generation must never reach the live site.
  let content = article.body.replace(/\[\[IMAGE:\d+\]\]/g, '');

  if (site.plugin_key_encrypted) {
    let pluginKey: string;
    try { pluginKey = decrypt(site.plugin_key_encrypted); } catch { return { ok: false, error: 'Decrypt failed' }; }
    const cfg = { url: site.url, pluginKey };

    let featuredId: number | undefined;
    const plan = (article.image_plan ?? []).filter(p => p.url);
    const uploads = await Promise.all(plan.map(async item => {
      try {
        const img = await fetch(item.url!, { signal: AbortSignal.timeout(60000) });
        if (!img.ok) return null;
        const mime = img.headers.get('content-type') || 'image/jpeg';
        const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
        const bytes = Buffer.from(await img.arrayBuffer());
        const up = await uploadMediaPlugin(cfg, {
          file_data: bytes.toString('base64'),
          file_name: `${slugify(article.title)}-${item.n}.${ext}`,
          mime_type: mime,
          alt_text: item.alt,
        });
        return up.ok ? { item, up } : null;
      } catch { return null; }
    }));

    for (const u of uploads) {
      if (!u) continue;
      content = content.split(u.item.url!).join(u.up.url!);
      if (u.item.n === 1) featuredId = u.up.attachmentId;
    }

    return publishPostPlugin(cfg, {
      title: article.title,
      content,
      status: opts.status,
      date: opts.date,
      meta_description: article.meta_description,
      tags: article.tags,
      category: article.category,
      featured_image_id: featuredId,
    });
  }

  if (!site.wp_username || !site.wp_password_encrypted) return { ok: false, error: 'Site has no credentials' };
  let password: string;
  try { password = decrypt(site.wp_password_encrypted); } catch { return { ok: false, error: 'Decrypt failed' }; }

  const meta: Record<string, string> = {};
  if (article.meta_description) {
    meta['_yoast_wpseo_metadesc'] = article.meta_description;
    meta['rank_math_description'] = article.meta_description;
  }

  return publishPost(
    { url: site.url, username: site.wp_username, password },
    { title: article.title, content, status: opts.status, date: opts.date, meta }
  );
}

export async function deletePostFromSite(site: PublishSite, wpPostId: number): Promise<{ ok: boolean; error?: string }> {
  if (site.plugin_key_encrypted) {
    let pluginKey: string;
    try { pluginKey = decrypt(site.plugin_key_encrypted); } catch { return { ok: false, error: 'Decrypt failed' }; }
    return deletePostPlugin({ url: site.url, pluginKey }, wpPostId);
  }

  if (!site.wp_username || !site.wp_password_encrypted) return { ok: false, error: 'Site has no credentials' };
  let password: string;
  try { password = decrypt(site.wp_password_encrypted); } catch { return { ok: false, error: 'Decrypt failed' }; }

  return deletePost({ url: site.url, username: site.wp_username, password }, wpPostId);
}
