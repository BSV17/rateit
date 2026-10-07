create table if not exists categories (
  id text primary key,
  name text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create unique index if not exists categories_name_unique
  on categories (lower(name));

create table if not exists products (
  id text primary key,
  name text not null,
  barcode text null,
  image_path text null,
  rating integer not null check (rating between 1 and 10),
  note text not null default '',
  category_id text null references categories(id) on delete set null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  external_source text null,
  external_product_id text null,
  external_metadata text null,
  brand text null
);

create unique index if not exists products_barcode_unique_not_null
  on products (barcode)
  where barcode is not null and barcode <> '';

create index if not exists products_created_at_idx on products (created_at desc);
create index if not exists products_category_id_idx on products (category_id);

create table if not exists external_product_cache (
  barcode text primary key,
  source text not null,
  external_product_id text null,
  name text not null,
  brand text null,
  image_url text null,
  metadata text null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists backup_snapshots (
  id text primary key,
  schema_version integer not null default 1,
  object_path text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
