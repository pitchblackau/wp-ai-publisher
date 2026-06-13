import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';

export const runtime = 'nodejs';

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_JWT_SECRET ?? 'wp-publisher-fallback-secret'
);

const SESSION_DAYS = 30;
const SESSION_MAX_AGE = 60 * 60 * 24 * SESSION_DAYS;

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  const validUsername = process.env.ADMIN_USERNAME?.replace(/^﻿/, '').trim();
  const validPassword = process.env.ADMIN_PASSWORD?.replace(/^﻿/, '').trim();

  if (
    !validUsername ||
    !validPassword ||
    username.trim() !== validUsername ||
    password.trim() !== validPassword
  ) {
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
  }

  const token = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(JWT_SECRET);

  const res = NextResponse.json({ ok: true });
  res.cookies.set('pb_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('pb_session');
  return res;
}
