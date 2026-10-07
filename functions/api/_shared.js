export function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      'cache-control': 'no-store',
      ...(init.headers ?? {}),
    },
  })
}

export async function readJson(request) {
  try {
    return await request.json()
  } catch {
    throw new Error('invalid-json')
  }
}

export function requireBinding(env, binding) {
  if (!env[binding]) throw new Error(`missing-binding-${binding}`)
  return env[binding]
}

export function nowIso() {
  return new Date().toISOString()
}

export function rowToCategory(row) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function rowToProduct(row) {
  return {
    id: row.id,
    name: row.name,
    barcode: row.barcode,
    imagePath: row.image_path,
    rating: row.rating,
    note: row.note ?? '',
    categoryId: row.category_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    externalSource: row.external_source,
    externalProductId: row.external_product_id,
    externalMetadata: row.external_metadata ? JSON.parse(row.external_metadata) : null,
    brand: row.brand,
  }
}

export function productParams(product, id = crypto.randomUUID()) {
  const timestamp = nowIso()
  return {
    id,
    name: String(product.name ?? '').trim(),
    barcode: product.barcode ? String(product.barcode).trim() : null,
    imagePath: product.imagePath ?? null,
    rating: Number(product.rating),
    note: String(product.note ?? '').trim(),
    categoryId: product.categoryId || null,
    createdAt: product.createdAt ?? timestamp,
    updatedAt: timestamp,
    externalSource: product.externalSource ?? null,
    externalProductId: product.externalProductId ?? null,
    externalMetadata: product.externalMetadata ? JSON.stringify(product.externalMetadata) : null,
    brand: product.brand ?? null,
  }
}

export function assertProduct(product) {
  if (!String(product.name ?? '').trim()) throw new Error('name-required')
  if (!String(product.categoryId ?? '').trim()) throw new Error('category-required')
  const rating = Number(product.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) throw new Error('rating-invalid')
}

export function assertCategory(category) {
  if (!String(category.name ?? '').trim()) throw new Error('name-required')
}

export function handleError(error) {
  const message = error instanceof Error ? error.message : 'unknown-error'
  const status = message.includes('missing-binding') ? 503 : 400
  return json({ error: message }, { status })
}
