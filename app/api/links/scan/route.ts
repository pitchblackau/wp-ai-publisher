import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { decrypt } from '@/lib/crypto';
import { listPostsPlugin } from '@/lib/wp-api';
import { applyEdits, contextFor, findBrokenLinks, internalLinks, proposeEdits, type LinkEdit } from '@/lib/internal-links';

export const maxDuration = 300;

const Schema = z.object({
  site_id: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(10).default(5),
  max_links: z.number().int().min(0).max(8).default(3),
});

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const { site_id, page, per_page, max_links } = parsed.data;

  const { data: site } = await supabase.from('sites').select('id, url, plugin_key_encrypted').eq('id', site_id).single();
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  if (!site.plugin_key_encrypted) return NextResponse.json({ error: 'This site needs the Plugin Key connection (not an Application Password) to scan and edit posts.' }, { status: 400 });

  let cfg: { url: string; pluginKey: string };
  try { cfg = { url: site.url, pluginKey: decrypt(site.plugin_key_encrypted) }; }
  catch { return NextResponse.json({ error: 'Failed to decrypt credentials' }, { status: 500 }); }

  const [pageRes, poolRes] = await Promise.all([
    listPostsPlugin(cfg, { status: 'publish', per_page, page, include_content: 1 }),
    listPostsPlugin(cfg, { status: 'publish', per_page: 100, page: 1 }),
  ]);
  if (!pageRes.ok || !pageRes.posts) return NextResponse.json({ error: pageRes.error ?? 'Could not read posts' }, { status: 502 });
  if (pageRes.posts.length && pageRes.posts[0].content === undefined) {
    return NextResponse.json({ error: "This site's plugin is too old to read post content. Update it to v1.2.0+ on the Sites page first." }, { status: 409 });
  }

  const candidates = (poolRes.posts ?? []).map(p => ({ title: p.title, url: p.url, excerpt: p.excerpt ?? '' }));

  const queue = [...pageRes.posts];
  const results: unknown[] = [];
  await Promise.all(Array.from({ length: 3 }, async () => {
    for (let post = queue.shift(); post; post = queue.shift()) {
      const base = { post_id: post.id, title: post.title, url: post.url };
      const html = post.content ?? '';
      if (post.builder === 'elementor') { results.push({ ...base, edits: [], skipped: 'Built with Elementor — links must be edited in Elementor' }); continue; }
      if (html.trim().length < 200) { results.push({ ...base, edits: [], skipped: 'Too little content' }); continue; }
      try {
        const known = new Set(candidates.map(c => c.url.replace(/\/$/, '').toLowerCase()));
        const unknownLinks = internalLinks(html, site.url).filter(u => !known.has(u.replace(/\/$/, '').toLowerCase()));
        const broken = await findBrokenLinks(unknownLinks);
        const others = candidates.filter(c => c.url !== post.url);
        const proposed = await proposeEdits({ title: post.title, html, candidates: others, broken, maxLinks: max_links });
        const { applied } = applyEdits(html, proposed);
        const edits = applied.map((e: LinkEdit) => e.type === 'add' ? { ...e, context: contextFor(html, e.anchor) } : e);
        results.push({ ...base, edits });
      } catch (e) {
        results.push({ ...base, edits: [], skipped: e instanceof Error ? e.message : 'Scan failed' });
      }
    }
  }));

  return NextResponse.json({ posts: results, page, has_more: pageRes.posts.length === per_page });
}
