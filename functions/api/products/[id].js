import { assertProduct, handleError, json, productParams, readJson, requireBinding, rowToProduct } from '../_shared.js'

export async function onRequestGet({ env, params }) {
  try {
    const DB = requireBinding(env, 'DB')
    const product = await DB.prepare('select * from products where id = ?1').bind(params.id).first()
    if (!product) return json({ error: 'not-found' }, { status: 404 })
    return json(rowToProduct(product))
  } catch (error) {
    return handleError(error)
  }
}

export async function onRequestPut({ request, env, params }) {
  try {
    const DB = requireBinding(env, 'DB')
    const body = await readJson(request)
    assertProduct(body)
    const current = await DB.prepare('select * from products where id = ?1').bind(params.id).first()
    if (!current) return json({ error: 'not-found' }, { status: 404 })

    const product = productParams({ ...body, createdAt: current.created_at }, params.id)
    if (product.barcode) {
      const existing = await DB.prepare('select id from products where barcode = ?1 and id <> ?2')
        .bind(product.barcode, params.id)
        .first()
      if (existing) throw new Error('barcode-exists')
    }

    await DB.prepare(
      `update products set
        name = ?1, barcode = ?2, image_path = ?3, rating = ?4, note = ?5, category_id = ?6,
        updated_at = ?7, external_source = ?8, external_product_id = ?9, external_metadata = ?10, brand = ?11
      where id = ?12`,
    )
      .bind(
        product.name,
        product.barcode,
        product.imagePath,
        product.rating,
        product.note,
        product.categoryId,
        product.updatedAt,
        product.externalSource,
        product.externalProductId,
        product.externalMetadata,
        product.brand,
        params.id,
      )
      .run()

    const saved = await DB.prepare('select * from products where id = ?1').bind(params.id).first()
    return json(rowToProduct(saved))
  } catch (error) {
    return handleError(error)
  }
}

export async function onRequestDelete({ env, params }) {
  try {
    const DB = requireBinding(env, 'DB')
    await DB.prepare('delete from products where id = ?1').bind(params.id).run()
    return json({ ok: true })
  } catch (error) {
    return handleError(error)
  }
}
