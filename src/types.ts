export type ThemePreference = 'system' | 'light' | 'dark'

export interface Category {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface Product {
  id: string
  name: string
  barcode: string | null
  imagePath: string | null
  rating: number
  note: string
  categoryId: string | null
  createdAt: string
  updatedAt: string
  externalSource: string | null
  externalProductId: string | null
  externalMetadata: Record<string, unknown> | null
  brand?: string | null
}

export interface ExternalProduct {
  barcode: string
  name: string
  brand?: string
  imageUrl?: string
  source: string
  externalId?: string
  metadata?: Record<string, unknown>
}

export interface ProductDraft {
  id?: string
  name: string
  barcode?: string | null
  imagePath?: string | null
  rating: number
  note: string
  categoryId?: string | null
  externalSource?: string | null
  externalProductId?: string | null
  externalMetadata?: Record<string, unknown> | null
  brand?: string | null
}

export interface ScanResult {
  status: 'found-local' | 'found-external' | 'not-found' | 'error'
  barcode: string
  product?: Product
  externalProduct?: ExternalProduct
  message?: string
}

export interface BackupPayload {
  schemaVersion: 1
  exportedAt: string
  products: Product[]
  categories: Category[]
}
