import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { deletePostFromSite, publishArticleToSite } from '@/lib/publish';

export const maxDuration = 300;

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
    .select('id, url, plugin_key_encrypted, wp_username, wp_password_encrypted')
    .in('id', article.site_ids);

  if (siteErr || !sites?.length) return NextResponse.json({ error: 'Sites not found' }, { status: 404 });

  const isScheduled = !!scheduled_at;
  const jobs = [];

  for (const site of sites) {
    const result = await publishArticleToSite(site, article, {
      status: isScheduled ? 'future' : 'publish',
      date: isScheduled ? scheduled_at : undefined,
    });

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

  const anyOk = jobs.some((j) => j.ok);
  const allOk = jobs.every((j) => j.ok);

  await supabase
    .from('articles')
    .update({
      status: isScheduled ? 'scheduled' : anyOk ? 'published' : 'draft',
      scheduled_at: isScheduled ? scheduled_at : null,
      published_at: !isScheduled && anyOk ? new Date().toISOString() : null,
      removal_error: null,
    })
    .eq('id', id);

  return NextResponse.json({ jobs, allOk, anyOk });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { site_id } = await req.json().catch(() => ({ site_id: undefined }));

  const { data: article, error: artErr } = await supabase.from('articles').select('id, site_ids').eq('id', id).single();
  if (artErr || !article) return NextResponse.json({ error: 'Article not found' }, { status: 404 });

  const { data: jobs, error: jobsErr } = await supabase
    .from('publish_jobs')
    .select('id, site_id, wp_post_id')
    .eq('article_id', id)
    .eq('status', 'success')
    .not('wp_post_id', 'is', null);

  if (jobsErr) return NextResponse.json({ error: jobsErr.message }, { status: 500 });

  const targetJobs = site_id ? (jobs ?? []).filter(j => j.site_id === site_id) : (jobs ?? []);
  if (!targetJobs.length) {
    // The article is marked published/scheduled but no live post is on record (state drift,
    // e.g. the record was lost or the post was removed by hand on WordPress). There is nothing
    // to delete remotely, so don't leave the article stuck — reset it to draft.
    if (!site_id) {
      await supabase
        .from('articles')
        .update({ status: 'draft', published_at: null, scheduled_at: null, removal_error: null })
        .eq('id', id);
      return NextResponse.json({ results: [], revertedToDraft: true, note: 'No live post on record — reset to draft' });
    }
    return NextResponse.json({ error: 'No live post found on that site' }, { status: 404 });
  }

  const { data: sites } = await supabase
    .from('sites')
    .select('id, url, plugin_key_encrypted, wp_username, wp_password_encrypted')
    .in('id', targetJobs.map(j => j.site_id));

  const results = [];
  for (const job of targetJobs) {
    const site = sites?.find(s => s.id === job.site_id);
    if (!site) { results.push({ siteId: job.site_id, ok: false, error: 'Site not found' }); continue; }
    const result = await deletePostFromSite(site, job.wp_post_id);
    if (result.ok) await supabase.from('publish_jobs').delete().eq('id', job.id);
    results.push({ siteId: job.site_id, ...result });
  }

  const failures = results.filter(r => !r.ok);
  const anyRemoved = results.some(r => r.ok);

  const { count: stillLive } = await supabase
    .from('publish_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('article_id', id)
    .eq('status', 'success');

  // Only revert to draft once every live copy is gone — a partial removal
  // (one site out of several) should leave the article published on the rest.
  if (!stillLive) {
    await supabase
      .from('articles')
      .update({ status: 'draft', published_at: null, scheduled_at: null, removal_error: null })
      .eq('id', id);
  } else if (failures.length) {
    // Persist the failure on the article itself: "Published" here only means our
    // records say it's live, and a failed removal must not look like a healthy post.
    const label = (siteId: string) => {
      const url = sites?.find(s => s.id === siteId)?.url;
      try { return url ? new URL(url).hostname : siteId; } catch { return url ?? siteId; }
    };
    const summary = failures.map(f => `${label(f.siteId)}: ${f.error ?? 'failed'}`).join(' | ');
    await supabase.from('articles').update({ removal_error: summary }).eq('id', id);
  } else if (anyRemoved) {
    await supabase.from('articles').update({ removal_error: null }).eq('id', id);
  }

  return NextResponse.json({ results, revertedToDraft: !stillLive });
}
