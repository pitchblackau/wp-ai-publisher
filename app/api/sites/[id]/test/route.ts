import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { decrypt } from '@/lib/crypto';
import { testConnection } from '@/lib/wp-api';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: site, error } = await supabase
    .from('sites')
    .select('id, url, wp_username, wp_password_encrypted')
    .eq('id', id)
    .single();

  if (error || !site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  let password: string;
  try {
    password = decrypt(site.wp_password_encrypted);
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt credentials' }, { status: 500 });
  }

  const result = await testConnection({ url: site.url, username: site.wp_username, password });

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
