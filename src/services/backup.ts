import JSZip from 'jszip'
import { z } from 'zod'
import type { BackupPayload, Category, Product } from '../types'
import { db } from '../storage/database'

const backupSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  products: z.array(z.any()),
  categories: z.array(z.any()),
})

export async function exportJson() {
  const payload: BackupPayload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    products: await db.listProducts(),
    categories: await db.listCategories(),
  }
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}

export async function exportZip() {
  const payload: BackupPayload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    products: await db.listProducts(),
    categories: await db.listCategories(),
  }
  const zip = new JSZip()
  zip.file('backup.json', JSON.stringify(payload, null, 2))
  const images = zip.folder('images')
  payload.products.forEach((product) => {
    if (product.imagePath?.startsWith('data:image/')) {
      images?.file(`${product.id}.webp`, product.imagePath.split(',')[1], { base64: true })
    }
  })
  return zip.generateAsync({ type: 'blob' })
}

export async function readBackup(file: File) {
  if (file.name.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(file)
    const backupFile = zip.file('backup.json')
    if (!backupFile) throw new Error('invalid-backup')
    return parseBackup(await backupFile.async('string'))
  }
  return parseBackup(await file.text())
}

function parseBackup(text: string): BackupPayload {
  const payload = backupSchema.parse(JSON.parse(text))
  return payload as BackupPayload
}

export async function restoreBackup(categories: Category[], products: Product[]) {
  await db.replaceAll(categories, products)
}
