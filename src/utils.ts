export const uid = () =>
  crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

export const nowIso = () => new Date().toISOString()

export function formatDate(date: string) {
  return new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(date),
  )
}

export function normalizeBarcode(value: string) {
  return value.replace(/\D/g, '').trim()
}

export function productMatches(query: string, product: { name: string; barcode: string | null; brand?: string | null }) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [product.name, product.brand ?? '', product.barcode ?? ''].some((part) => part.toLowerCase().includes(q))
}

export async function fileToDataUrl(file: File): Promise<string> {
  const imageBitmap = await createImageBitmap(file)
  const maxSide = 1200
  const scale = Math.min(1, maxSide / Math.max(imageBitmap.width, imageBitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(imageBitmap.width * scale)
  canvas.height = Math.round(imageBitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available')
  context.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/webp', 0.82)
}

export async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const blob = await response.blob()
    return fileToDataUrl(new File([blob], 'external-image', { type: blob.type || 'image/jpeg' }))
  } catch {
    return null
  }
}
