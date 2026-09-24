# RateIt

RateIt is a personal PWA for remembering what you thought about physical products. The main flow is simple: open the app in a shop, scan a barcode, and immediately see your own rating, note, category, and photo.

## Stack

- Vite + React + TypeScript for a small, fast mobile-first frontend.
- IndexedDB adapter for the current MVP runtime, so the app works immediately without secrets.
- Supabase-ready schema in `supabase/migrations` for PostgreSQL, Storage, Auth, RLS, and future multi-device sync.
- ZXing browser scanner for EAN/UPC/Code 128 and other common barcode formats.
- JSZip for RateIt backup export/import.

## Run Locally

```bash
npm install
npm run dev
```

Open the printed URL on a desktop browser or phone on the same network. Camera access requires HTTPS in production, or localhost during development.

## Build

```bash
npm run build
npm run preview
```

## Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Never put Supabase service role keys in frontend env variables.

## Supabase Setup

1. Create a Supabase project.
2. Run the SQL migration in `supabase/migrations/20260924100000_initial_schema.sql`.
3. Create a private Storage bucket, for example `product-images`.
4. Create one Auth user for yourself.
5. Keep Row Level Security enabled.
6. In production, add server-side backup automation using Supabase Edge Functions or scheduled jobs. Store backup ZIP snapshots in private Storage and metadata in `backup_snapshots`.

The current app code is structured so the IndexedDB adapter can be replaced with a Supabase repository without changing UI screens.

## Features In MVP

- Ukrainian UI.
- Mobile-first home screen.
- Add products with optional barcode.
- Upload or capture a product photo.
- Rating from 1 to 10.
- Notes.
- Create, rename, and delete categories.
- Search by name, brand, or barcode.
- Edit and delete products.
- Camera barcode scanning with manual barcode fallback.
- External lookup through Open Products Facts and Open Food Facts.
- PWA manifest, icons, and service worker.
- Light, dark, and system themes.
- Export JSON, export ZIP, and import backup.
- Development seed data for Lay's and parchment.

## Backup Format

ZIP exports are named like:

```text
RateIt-backup-YYYY-MM-DD.zip
```

Inside:

```text
backup.json
images/
```

`backup.json` contains `schemaVersion`, `products`, `categories`, barcode values, ratings, notes, and external metadata.

## Deployment

Any static host works for the current frontend build:

```bash
npm run build
```

Deploy `dist/`. Use HTTPS so camera permissions and PWA install work correctly.

## Next Work

- Implement the Supabase repository adapter and image Storage upload.
- Add server-side weekly backup snapshots.
- Add a small sign-in screen for the single Supabase user.
- Add richer import handling for image files inside ZIP backups.
