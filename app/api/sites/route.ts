import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { encrypt } from '@/lib/crypto';
import { testConnection } from '@/lib/wp-api';
import { z } from 'zod';

const CreateSiteSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  wp_username: z.string().min(1),
  wp_password: z.string().min(1),
});

export async function GET() {
  const { data, error } = await supabase
    .from('sites')
    .select('id, name, url, wp_username, status, last_checked_at, last_error, created_at, updated_at')
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

  const { name, url, wp_username, wp_password } = parsed.data;

  const test = await testConnection({ url, username: wp_username, password: wp_password });

  const encrypted = encrypt(wp_password);

  const { data, error } = await supabase
    .from('sites')
    .insert({
      name,
      url,
      wp_username,
      wp_password_encrypted: encrypted,
      status: test.ok ? 'active' : 'error',
      last_checked_at: new Date().toISOString(),
      last_error: test.ok ? null : test.message,
    })
    .select('id, name, url, wp_username, status, last_checked_at, last_error, created_at, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ site: data, connection: test }, { status: 201 });
}
