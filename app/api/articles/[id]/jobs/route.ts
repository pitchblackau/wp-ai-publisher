import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data, error } = await supabase
    .from('publish_jobs')
    .select('site_id, status, wp_post_url, error_message, completed_at')
    .eq('article_id', id)
    .order('completed_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Keep only the most recent job per site.
  const latestBySite = new Map<string, typeof data[number]>();
  for (const job of data ?? []) {
    if (!latestBySite.has(job.site_id)) latestBySite.set(job.site_id, job);
  }

  const jobs = [...latestBySite.values()].map(j => ({
    siteId: j.site_id,
    ok: j.status === 'success',
    postUrl: j.wp_post_url ?? undefined,
    error: j.error_message ?? undefined,
  }));

  return NextResponse.json(jobs);
}
