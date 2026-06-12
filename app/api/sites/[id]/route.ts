import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { encrypt } from '@/lib/crypto';
import { z } from 'zod';

const UpdateSiteSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  wp_username: z.string().min(1).optional(),
  wp_password: z.string().min(1).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateSiteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates: Record<string, string> = {};
  if (parsed.data.name) updates.name = parsed.data.name;
  if (parsed.data.url) updates.url = parsed.data.url;
  if (parsed.data.wp_username) updates.wp_username = parsed.data.wp_username;
  if (parsed.data.wp_password) updates.wp_password_encrypted = encrypt(parsed.data.wp_password);

  const { data, error } = await supabase
    .from('sites')
    .update(updates)
    .eq('id', id)
    .select('id, name, url, wp_username, status, last_checked_at, last_error, created_at, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await supabase.from('sites').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
