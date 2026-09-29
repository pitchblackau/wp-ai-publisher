import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateAndStore, imageFigure, imagesConfigured } from '@/lib/images';
import type { ImagePlanItem } from '@/types';

export const maxDuration = 300;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: article, error } = await supabase.from('articles').select('id, body, image_plan').eq('id', id).single();
  if (error || !article) return NextResponse.json({ error: 'Article not found' }, { status: 404 });

  const plan: ImagePlanItem[] = article.image_plan ?? [];
  const pending = plan.filter(p => !p.url);
  if (!pending.length) return NextResponse.json({ generated: 0, failed: 0 });

  if (!imagesConfigured()) {
    return NextResponse.json({ error: 'Image generation is not configured — add HF_TOKEN to the Vercel environment variables.' }, { status: 503 });
  }

  const results = await Promise.allSettled(pending.map(p => generateAndStore(id, p.n, p.prompt)));

  const errors: string[] = [];
  let body: string = article.body;
  results.forEach((r, i) => {
    const item = pending[i];
    if (r.status === 'fulfilled') {
      item.url = r.value;
    } else {
      errors.push(`Image ${item.n}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
    }
  });

  for (const item of plan) {
    const marker = `[[IMAGE:${item.n}]]`;
    if (item.n === 1) continue;
    body = body.split(marker).join(item.url ? imageFigure(item.url, item.alt) : '');
  }

  const { error: upErr } = await supabase.from('articles').update({ body, image_plan: plan }).eq('id', id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({
    generated: results.filter(r => r.status === 'fulfilled').length,
    failed: errors.length,
    errors,
  });
}
