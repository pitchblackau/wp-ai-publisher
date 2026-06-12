import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateArticle } from '@/lib/anthropic';
import { z } from 'zod';

const GenerateSchema = z.object({
  topic: z.string().min(1),
  site_ids: z.array(z.string().uuid()),
  tone: z.string().min(1),
  word_count_target: z.number().int().min(100).max(10000),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = GenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { topic, site_ids, tone, word_count_target } = parsed.data;

  let generated;
  try {
    generated = await generateArticle({ topic, tone, wordCountTarget: word_count_target });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Generation failed' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('articles')
    .insert({
      site_ids,
      title: generated.title,
      body: generated.body,
      meta_description: generated.metaDescription,
      tags: generated.tags,
      category: generated.category,
      status: 'draft',
      topic,
      tone,
      word_count_target,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
