import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateAndStore, imageFigure, imagesConfigured, recompressStored } from '@/lib/images';
import type { ImagePlanItem } from '@/types';

export const maxDuration = 300;

// Body (all optional): { only?: number[]; force?: boolean }
//  - default: generate every planned image that has no picture yet
//  - only:    restrict to these image numbers
//  - force:   regenerate even if a picture already exists (replaces it in the body)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opts = await req.json().catch(() => ({})) as { only?: number[]; force?: boolean; optimise?: boolean };

  const { data: article, error } = await supabase.from('articles').select('id, body, image_plan').eq('id', id).single();
  if (error || !article) return NextResponse.json({ error: 'Article not found' }, { status: 404 });

  const plan: ImagePlanItem[] = article.image_plan ?? [];

  if (opts.optimise) {
    const targets = plan.filter(p => p.url);
    const out = await Promise.allSettled(targets.map(p => recompressStored(id, p.n, p.url!)));
    let body: string = article.body;
    const errs: string[] = [];
    out.forEach((r, i) => {
      const item = targets[i];
      if (r.status === 'fulfilled') {
        body = body.split(item.url!).join(r.value);
        item.url = r.value;
      } else errs.push(`Image ${item.n}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
    });
    const { data: updated, error: upErr } = await supabase
      .from('articles').update({ body, image_plan: plan }).eq('id', id).select('*').single();
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    return NextResponse.json({ generated: out.length - errs.length, failed: errs.length, errors: errs, article: updated });
  }
  const pending = plan.filter(p => (!opts.only || opts.only.includes(p.n)) && (opts.force || !p.url));
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
      const oldUrl = item.url;
      item.url = r.value;
      if (oldUrl && body.includes(oldUrl)) body = body.split(oldUrl).join(r.value);
      else if (item.n !== 1) body = body.split(`[[IMAGE:${item.n}]]`).join(imageFigure(r.value, item.alt));
    } else {
      errors.push(`Image ${item.n}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
    }
  });

  const { data: updated, error: upErr } = await supabase
    .from('articles').update({ body, image_plan: plan }).eq('id', id).select('*').single();
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({
    generated: results.filter(r => r.status === 'fulfilled').length,
    failed: errors.length,
    errors,
    article: updated,
  });
}
