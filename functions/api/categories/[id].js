import { assertCategory, handleError, json, nowIso, readJson, requireBinding, rowToCategory } from '../_shared.js'

export async function onRequestPut({ request, env, params }) {
  try {
    const DB = requireBinding(env, 'DB')
    const body = await readJson(request)
    assertCategory(body)
    const name = String(body.name).trim()
    const duplicate = await DB.prepare('select id from categories where lower(name) = lower(?1) and id <> ?2')
      .bind(name, params.id)
      .first()
    if (duplicate) throw new Error('category-exists')

    await DB.prepare('update categories set name = ?1, updated_at = ?2 where id = ?3')
      .bind(name, nowIso(), params.id)
      .run()
    const category = await DB.prepare('select * from categories where id = ?1').bind(params.id).first()
    if (!category) return json({ error: 'not-found' }, { status: 404 })
    return json(rowToCategory(category))
  } catch (error) {
    return handleError(error)
  }
}

export async function onRequestDelete({ env, params }) {
  try {
    const DB = requireBinding(env, 'DB')
    await DB.prepare('update products set category_id = null, updated_at = ?1 where category_id = ?2')
      .bind(nowIso(), params.id)
      .run()
    await DB.prepare('delete from categories where id = ?1').bind(params.id).run()
    return json({ ok: true })
  } catch (error) {
    return handleError(error)
  }
}
