import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { encrypt } from '@/lib/crypto';
import { testConnection, testConnectionPlugin } from '@/lib/wp-api';
import { z } from 'zod';

const CreateSiteSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  login_url: z.string().optional(),
  plugin_key: z.string().optional(),
  wp_username: z.string().optional(),
  wp_password: z.string().optional(),
}).refine(
  d => d.plugin_key || (d.wp_username && d.wp_password),
  { message: 'Provide either a Plugin Key or both WP Username and Application Password' }
);

export async function GET() {
  const { data, error } = await supabase
    .from('sites')
    .select('id, name, url, login_url, plugin_key_encrypted, wp_username, status, last_checked_at, last_error, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CreateSiteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, url, login_url, plugin_key } = parsed.data;
  const wp_username = parsed.data.wp_username ?? '';
  const wp_password = (parsed.data.wp_password ?? '').replace(/\s/g, '');

  let test: { ok: boolean; message: string };
  let insert: Record<string, unknown> = {
    name,
    url,
    login_url: login_url || null,
    last_checked_at: new Date().toISOString(),
  };

  if (plugin_key) {
    test = await testConnectionPlugin({ url, pluginKey: plugin_key });
    insert = { ...insert, plugin_key_encrypted: encrypt(plugin_key), wp_username: null, wp_password_encrypted: null };
  } else {
    test = await testConnection({ url, username: wp_username, password: wp_password });
    insert = { ...insert, plugin_key_encrypted: null, wp_username, wp_password_encrypted: encrypt(wp_password) };
  }

  insert.status = test.ok ? 'active' : 'error';
  insert.last_error = test.ok ? null : test.message;

  const { data, error } = await supabase
    .from('sites')
    .insert(insert)
    .select('id, name, url, login_url, plugin_key_encrypted, wp_username, status, last_checked_at, last_error, created_at, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ site: data, connection: test }, { status: 201 });
}
