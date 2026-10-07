import { assertCategory, handleError, json, nowIso, readJson, requireBinding, rowToCategory } from '../_shared.js'

export async function onRequestGet({ env }) {
  try {
    const DB = requireBinding(env, 'DB')
    const { results } = await DB.prepare('select * from categories order by name collate nocase').all()
    return json(results.map(rowToCategory))
  } catch (error) {
    return handleError(error)
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const DB = requireBinding(env, 'DB')
    const body = await readJson(request)
    assertCategory(body)
    const name = String(body.name).trim()
    const existing = await DB.prepare('select * from categories where lower(name) = lower(?1)').bind(name).first()
    if (existing) return json(rowToCategory(existing))

    const timestamp = nowIso()
    const id = crypto.randomUUID()
    await DB.prepare('insert into categories (id, name, created_at, updated_at) values (?1, ?2, ?3, ?4)')
      .bind(id, name, timestamp, timestamp)
      .run()
    const category = await DB.prepare('select * from categories where id = ?1').bind(id).first()
    return json(rowToCategory(category))
  } catch (error) {
    return handleError(error)
  }
}
