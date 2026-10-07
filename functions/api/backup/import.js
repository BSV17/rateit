import { handleError, json, productParams, readJson, requireBinding } from '../_shared.js'

export async function onRequestPost({ request, env }) {
  try {
    const DB = requireBinding(env, 'DB')
    const payload = await readJson(request)
    if (payload.schemaVersion !== 1) throw new Error('unsupported-backup-version')
    if (!Array.isArray(payload.categories) || !Array.isArray(payload.products)) throw new Error('invalid-backup')

    const statements = [
      DB.prepare('delete from products'),
      DB.prepare('delete from categories'),
      ...payload.categories.map((category) =>
        DB.prepare('insert into categories (id, name, created_at, updated_at) values (?1, ?2, ?3, ?4)').bind(
          category.id,
          category.name,
          category.createdAt,
          category.updatedAt,
        ),
      ),
      ...payload.products.map((draft) => {
        const product = productParams(draft, draft.id)
        return DB.prepare(
          `insert into products (
            id, name, barcode, image_path, rating, note, category_id, created_at, updated_at,
            external_source, external_product_id, external_metadata, brand
          ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
        ).bind(
          product.id,
          product.name,
          product.barcode,
          product.imagePath,
          product.rating,
          product.note,
          product.categoryId,
          product.createdAt,
          product.updatedAt,
          product.externalSource,
          product.externalProductId,
          product.externalMetadata,
          product.brand,
        )
      }),
    ]

    await DB.batch(statements)
    return json({ ok: true })
  } catch (error) {
    return handleError(error)
  }
}
