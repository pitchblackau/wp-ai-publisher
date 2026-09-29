import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { decrypt } from '@/lib/crypto';
import { postPresence, postPresencePlugin } from '@/lib/wp-api';

export const maxDuration = 120;

type SiteRow = { id: string; url: string; plugin_key_encrypted: string | null; wp_username: string | null; wp_password_encrypted: string | null };

async function presenceOnSite(site: SiteRow, postId: number) {
  try {
    if (site.plugin_key_encrypted) {
      return await postPresencePlugin({ url: site.url, pluginKey: decrypt(site.plugin_key_encrypted) }, postId);
    }
    if (site.wp_username && site.wp_password_encrypted) {
      return await postPresence({ url: site.url, username: site.wp_username, password: decrypt(site.wp_password_encrypted) }, postId);
    }
  } catch { /* fall through */ }
  return 'unknown' as const;
}

// Reconciles "published" articles with what is actually live on WordPress: posts that
// no longer exist (deleted by hand, removed earlier, etc.) stop being reported as published.
export async function POST() {
  const { data: articles } = await supabase.from('articles').select('id').eq('status', 'published');
  if (!articles?.length) return NextResponse.json({ checked: 0, reverted: [] });

  const { data: jobs } = await supabase
    .from('publish_jobs')
    .select('id, article_id, site_id, wp_post_id')
    .in('article_id', articles.map(a => a.id))
    .eq('status', 'success')
    .not('wp_post_id', 'is', null);

  const { data: sites } = await supabase
    .from('sites')
    .select('id, url, plugin_key_encrypted, wp_username, wp_password_encrypted')
    .in('id', [...new Set((jobs ?? []).map(j => j.site_id))]);

  const queue = [...(jobs ?? [])];
  const gone = new Set<string>();
  const workers = Array.from({ length: 8 }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const site = sites?.find(s => s.id === job.site_id);
      if (site && await presenceOnSite(site, job.wp_post_id) === 'gone') gone.add(job.id);
    }
  });
  await Promise.all(workers);

  if (gone.size) await supabase.from('publish_jobs').delete().in('id', [...gone]);

  const reverted: string[] = [];
  for (const a of articles) {
    const mine = (jobs ?? []).filter(j => j.article_id === a.id);
    // No live post on record at all, or every one confirmed gone -> it is not published any more.
    if (mine.every(j => gone.has(j.id))) {
      await supabase
        .from('articles')
        .update({ status: 'draft', published_at: null, scheduled_at: null, removal_error: null })
        .eq('id', a.id);
      reverted.push(a.id);
    }
  }

  return NextResponse.json({ checked: articles.length, reverted });
}
