import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { decrypt } from '@/lib/crypto';
import { publishPost } from '@/lib/wp-api';

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();

  const { data: articles, error } = await supabase
    .from('articles')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!articles?.length) return NextResponse.json({ published: 0 });

  let published = 0;

  for (const article of articles) {
    if (!article.site_ids?.length) continue;

    const { data: sites } = await supabase
      .from('sites')
      .select('id, url, wp_username, wp_password_encrypted')
      .in('id', article.site_ids);

    if (!sites?.length) continue;

    for (const site of sites) {
      let password: string;
      try {
        password = decrypt(site.wp_password_encrypted);
      } catch {
        continue;
      }

      const meta: Record<string, string> = {};
      if (article.meta_description) {
        meta['_yoast_wpseo_metadesc'] = article.meta_description;
        meta['rank_math_description'] = article.meta_description;
      }

      const result = await publishPost(
        { url: site.url, username: site.wp_username, password },
        { title: article.title, content: article.body, status: 'publish', meta }
      );

      await supabase.from('publish_jobs').insert({
        article_id: article.id,
        site_id: site.id,
        status: result.ok ? 'success' : 'failed',
        wp_post_id: result.postId ?? null,
        wp_post_url: result.postUrl ?? null,
        error_message: result.error ?? null,
        completed_at: new Date().toISOString(),
      });
    }

    await supabase
      .from('articles')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', article.id);

    published++;
  }

  return NextResponse.json({ published, timestamp: now });
}
