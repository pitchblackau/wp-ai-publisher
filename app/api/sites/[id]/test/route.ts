import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { decrypt } from '@/lib/crypto';
import { testConnection, testConnectionPlugin } from '@/lib/wp-api';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: site, error } = await supabase
    .from('sites')
    .select('id, url, plugin_key_encrypted, wp_username, wp_password_encrypted')
    .eq('id', id)
    .single();

  if (error || !site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  let result: { ok: boolean; message: string };
  try {
    if (site.plugin_key_encrypted) {
      result = await testConnectionPlugin({ url: site.url, pluginKey: decrypt(site.plugin_key_encrypted) });
    } else if (site.wp_username && site.wp_password_encrypted) {
      result = await testConnection({ url: site.url, username: site.wp_username, password: decrypt(site.wp_password_encrypted) });
    } else {
      return NextResponse.json({ error: 'Site has no credentials' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt credentials' }, { status: 500 });
  }

  await supabase
    .from('sites')
    .update({
      status: result.ok ? 'active' : 'error',
      last_checked_at: new Date().toISOString(),
      last_error: result.ok ? null : result.message,
    })
    .eq('id', id);

  return NextResponse.json(result);
}
