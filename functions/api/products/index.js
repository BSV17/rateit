import { assertProduct, handleError, json, productParams, readJson, requireBinding, rowToProduct } from '../_shared.js'

export async function onRequestGet({ env }) {
  try {
    const DB = requireBinding(env, 'DB')
    const { results } = await DB.prepare('select * from products order by created_at desc').all()
    return json(results.map(rowToProduct))
  } catch (error) {
    return handleError(error)
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const DB = requireBinding(env, 'DB')
    const body = await readJson(request)
    assertProduct(body)
    const product = productParams(body)

    if (product.barcode) {
      const existing = await DB.prepare('select id from products where barcode = ?1').bind(product.barcode).first()
      if (existing) throw new Error('barcode-exists')
    }

    await DB.prepare(
      `insert into products (
        id, name, barcode, image_path, rating, note, category_id, created_at, updated_at,
        external_source, external_product_id, external_metadata, brand
      ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
    )
      .bind(
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
      .run()

    const saved = await DB.prepare('select * from products where id = ?1').bind(product.id).first()
    return json(rowToProduct(saved))
  } catch (error) {
    return handleError(error)
  }
}
