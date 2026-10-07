import { handleError, requireBinding } from '../_shared.js'

export async function onRequestGet({ env, params }) {
  try {
    const IMAGES = requireBinding(env, 'IMAGES')
    const object = await IMAGES.get(params.key)
    if (!object) return new Response('Not found', { status: 404 })

    return new Response(object.body, {
      headers: {
        'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
        'cache-control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    return handleError(error)
  }
}
