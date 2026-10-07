import { handleError, json, readJson, requireBinding } from '../_shared.js'

export async function onRequestPost({ request, env }) {
  try {
    const IMAGES = requireBinding(env, 'IMAGES')
    const { dataUrl } = await readJson(request)
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl ?? '')
    if (!match) throw new Error('invalid-image')

    const contentType = match[1]
    const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0))
    const extension = contentType.includes('png') ? 'png' : contentType.includes('jpeg') ? 'jpg' : 'webp'
    const key = `${crypto.randomUUID()}.${extension}`

    await IMAGES.put(key, bytes, {
      httpMetadata: { contentType },
    })

    return json({ imagePath: `/api/images/${key}` })
  } catch (error) {
    return handleError(error)
  }
}
