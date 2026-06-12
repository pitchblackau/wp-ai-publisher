import { NextResponse } from 'next/server';

export async function GET() {
  const u = process.env.ADMIN_USERNAME;
  const p = process.env.ADMIN_PASSWORD;
  return NextResponse.json({
    username_set: !!u,
    password_set: !!p,
    username_length: u?.length,
    username_chars: u ? [...u].map(c => c.charCodeAt(0)) : [],
  });
}
