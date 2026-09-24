create extension if not exists "pgcrypto";

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  barcode text null,
  image_path text null,
  rating integer not null check (rating between 1 and 10),
  note text not null default '',
  category_id uuid null references public.categories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  external_source text null,
  external_product_id text null,
  external_metadata jsonb null,
  brand text null
);

create unique index if not exists products_barcode_unique_not_null
  on public.products (barcode)
  where barcode is not null and barcode <> '';

create index if not exists products_created_at_idx on public.products (created_at desc);
create index if not exists products_name_idx on public.products using gin (to_tsvector('simple', name));

create table if not exists public.external_product_cache (
  barcode text primary key,
  source text not null,
  external_product_id text null,
  name text not null,
  brand text null,
  image_url text null,
  metadata jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.backup_snapshots (
  id uuid primary key default gen_random_uuid(),
  schema_version integer not null default 1,
  object_path text not null,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.external_product_cache enable row level security;
alter table public.backup_snapshots enable row level security;

create policy "single authenticated user reads categories"
  on public.categories for select
  to authenticated
  using (true);

create policy "single authenticated user writes categories"
  on public.categories for all
  to authenticated
  using (true)
  with check (true);

create policy "single authenticated user reads products"
  on public.products for select
  to authenticated
  using (true);

create policy "single authenticated user writes products"
  on public.products for all
  to authenticated
  using (true)
  with check (true);

create policy "single authenticated user reads external cache"
  on public.external_product_cache for select
  to authenticated
  using (true);

create policy "single authenticated user writes external cache"
  on public.external_product_cache for all
  to authenticated
  using (true)
  with check (true);

create policy "single authenticated user reads backups"
  on public.backup_snapshots for select
  to authenticated
  using (true);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists categories_updated_at on public.categories;
create trigger categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();
