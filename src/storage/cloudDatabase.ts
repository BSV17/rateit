import type { Category, Product, ProductDraft } from '../types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'request-failed' }))
    throw new Error(error.error ?? 'request-failed')
  }

  return response.json() as Promise<T>
}

async function uploadImage(imagePath?: string | null) {
  if (!imagePath?.startsWith('data:image/')) return imagePath ?? null
  const result = await request<{ imagePath: string }>('/api/images', {
    method: 'POST',
    body: JSON.stringify({ dataUrl: imagePath }),
  })
  return result.imagePath
}

export const cloudDb = {
  async seedIfEmpty() {
    return
  },

  async listProducts() {
    return request<Product[]>('/api/products')
  },

  async listCategories() {
    return request<Category[]>('/api/categories')
  },

  async getProduct(id: string) {
    return request<Product>(`/api/products/${id}`)
  },

  async findProductByBarcode(barcode: string) {
    const products = await this.listProducts()
    return products.find((product) => product.barcode === barcode) ?? null
  },

  async saveProduct(draft: ProductDraft) {
    const imagePath = await uploadImage(draft.imagePath)
    return request<Product>(draft.id ? `/api/products/${draft.id}` : '/api/products', {
      method: draft.id ? 'PUT' : 'POST',
      body: JSON.stringify({ ...draft, imagePath }),
    })
  },

  async deleteProduct(id: string) {
    await request<{ ok: true }>(`/api/products/${id}`, { method: 'DELETE' })
  },

  async saveCategory(input: { id?: string; name: string }) {
    return request<Category>(input.id ? `/api/categories/${input.id}` : '/api/categories', {
      method: input.id ? 'PUT' : 'POST',
      body: JSON.stringify(input),
    })
  },

  async deleteCategory(id: string) {
    await request<{ ok: true }>(`/api/categories/${id}`, { method: 'DELETE' })
  },

  async replaceAll(categories: Category[], products: Product[]) {
    await request<{ ok: true }>('/api/backup/import', {
      method: 'POST',
      body: JSON.stringify({ schemaVersion: 1, categories, products }),
    })
  },
}
