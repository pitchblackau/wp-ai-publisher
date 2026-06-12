-- WordPress AI Publisher — Database Schema
-- Run this in your Supabase SQL editor

create extension if not exists "uuid-ossp";

create table if not exists sites (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  url text not null,
  wp_username text not null,
  wp_password_encrypted text not null,
  status text not null default 'unchecked' check (status in ('active', 'error', 'unchecked')),
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists articles (
  id uuid primary key default uuid_generate_v4(),
  site_ids uuid[] not null default '{}',
  title text not null default '',
  body text not null default '',
  meta_description text not null default '',
  tags text[] not null default '{}',
  category text not null default '',
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'discarded')),
  scheduled_at timestamptz,
  published_at timestamptz,
  topic text not null,
  tone text not null,
  word_count_target integer not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists publish_jobs (
  id uuid primary key default uuid_generate_v4(),
  article_id uuid not null references articles(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  wp_post_id integer,
  wp_post_url text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Updated_at triggers
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger sites_updated_at before update on sites
  for each row execute function update_updated_at();

create trigger articles_updated_at before update on articles
  for each row execute function update_updated_at();

-- Indexes
create index if not exists articles_status_idx on articles(status);
create index if not exists articles_scheduled_at_idx on articles(scheduled_at) where status = 'scheduled';
create index if not exists publish_jobs_article_id_idx on publish_jobs(article_id);
create index if not exists publish_jobs_status_idx on publish_jobs(status);
