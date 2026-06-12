import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { decrypt } from '@/lib/crypto';
import { publishPost } from '@/lib/wp-api';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { scheduled_at } = await req.json().catch(() => ({}));

  const { data: article, error: artErr } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .single();

  if (artErr || !article) return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  if (!article.site_ids?.length) return NextResponse.json({ error: 'No target sites selected' }, { status: 400 });

  const { data: sites, error: siteErr } = await supabase
    .from('sites')
    .select('id, url, wp_username, wp_password_encrypted')
    .in('id', article.site_ids);

  if (siteErr || !sites?.length) return NextResponse.json({ error: 'Sites not found' }, { status: 404 });

  const isScheduled = !!scheduled_at;
  const wpStatus = isScheduled ? 'future' : 'publish';
  const jobs = [];

  for (const site of sites) {
    let password: string;
    try {
      password = decrypt(site.wp_password_encrypted);
    } catch {
      jobs.push({ siteId: site.id, ok: false, error: 'Decrypt failed' });
      continue;
    }

    const meta: Record<string, string> = {};
    if (article.meta_description) {
      meta['_yoast_wpseo_metadesc'] = article.meta_description;
      meta['rank_math_description'] = article.meta_description;
    }

    const result = await publishPost(
      { url: site.url, username: site.wp_username, password },
      {
        title: article.title,
        content: article.body,
        status: wpStatus,
        date: isScheduled ? scheduled_at : undefined,
        meta,
      }
    );

    await supabase.from('publish_jobs').insert({
      article_id: id,
      site_id: site.id,
      status: result.ok ? 'success' : 'failed',
      wp_post_id: result.postId ?? null,
      wp_post_url: result.postUrl ?? null,
      error_message: result.error ?? null,
      completed_at: new Date().toISOString(),
    });

    jobs.push({ siteId: site.id, ...result });
  }

  const allOk = jobs.every((j) => j.ok);
  const anyOk = jobs.some((j) => j.ok);

  await supabase
    .from('articles')
    .update({
      status: isScheduled ? 'scheduled' : anyOk ? 'published' : 'draft',
      scheduled_at: isScheduled ? scheduled_at : null,
      published_at: !isScheduled && anyOk ? new Date().toISOString() : null,
    })
    .eq('id', id);

  return NextResponse.json({ jobs, allOk, anyOk });
}
