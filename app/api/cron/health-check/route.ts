import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkHealth } from '@/lib/wp-api';

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: sites, error } = await supabase.from('sites').select('id, url');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = await Promise.allSettled(
    (sites ?? []).map(async (site) => {
      const health = await checkHealth(site.url);
      await supabase
        .from('sites')
        .update({
          status: health.ok ? 'active' : 'error',
          last_checked_at: new Date().toISOString(),
          last_error: health.ok ? null : health.message,
        })
        .eq('id', site.id);
      return { id: site.id, ...health };
    })
  );

  return NextResponse.json({ checked: results.length, timestamp: new Date().toISOString() });
}
