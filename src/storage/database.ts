import type { Category, Product, ProductDraft } from '../types'
import { nowIso, uid } from '../utils'
import { cloudDb } from './cloudDatabase'

const DB_NAME = 'rateit-db'
const DB_VERSION = 1
const PRODUCT_STORE = 'products'
const CATEGORY_STORE = 'categories'
let seedPromise: Promise<void> | null = null

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(PRODUCT_STORE)) {
        const products = db.createObjectStore(PRODUCT_STORE, { keyPath: 'id' })
        products.createIndex('barcode', 'barcode', { unique: false })
        products.createIndex('createdAt', 'createdAt')
      }
      if (!db.objectStoreNames.contains(CATEGORY_STORE)) {
        const categories = db.createObjectStore(CATEGORY_STORE, { keyPath: 'id' })
        categories.createIndex('name', 'name', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function store<T>(name: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(name, mode)
    const req = fn(tx.objectStore(name))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
  })
}

async function getAll<T>(name: string): Promise<T[]> {
  return store<T[]>(name, 'readonly', (objectStore) => objectStore.getAll())
}

async function put<T>(name: string, value: T): Promise<T> {
  await store<IDBValidKey>(name, 'readwrite', (objectStore) => objectStore.put(value))
  return value
}

async function deleteById(name: string, id: string) {
  await store<undefined>(name, 'readwrite', (objectStore) => objectStore.delete(id))
}

const localDb = {
  async seedIfEmpty() {
    if (seedPromise) return seedPromise
    seedPromise = this.seedIfEmptyOnce().then(() => this.normalizeDemoData())
    return seedPromise
  },

  async seedIfEmptyOnce() {
    const categories = await this.listCategories()
    const products = await this.listProducts()
    if (categories.length || products.length || import.meta.env.PROD) return

    const chips = await this.saveCategory({ name: 'Чипси' })
    const parchment = await this.saveCategory({ name: 'Пергамент' })
    await this.saveProduct({
      name: "Lay's Сметана і зелень",
      barcode: '4820001234567',
      rating: 8,
      note: 'Смачні, але трохи пересолені.',
      categoryId: chips.id,
      imagePath: null,
    })
    await this.saveProduct({
      name: 'Пергамент',
      barcode: null,
      rating: 9,
      note: 'Добре працює, не прилипає.',
      categoryId: parchment.id,
      imagePath: null,
    })
  },

  async normalizeDemoData() {
    await this.mergeDuplicateCategories()

    const products = await this.listProducts()
    const seen = new Set<string>()
    for (const product of products) {
      const isSeedProduct =
        (product.name === "Lay's Сметана і зелень" && product.note === 'Смачні, але трохи пересолені.') ||
        (product.name === 'Пергамент' && product.note === 'Добре працює, не прилипає.')
      if (!isSeedProduct) continue

      const key = [product.name, product.barcode ?? '', product.note, product.rating].join('|')
      if (seen.has(key)) {
        await this.deleteProduct(product.id)
      } else {
        seen.add(key)
      }
    }
  },

  async mergeDuplicateCategories() {
    const categories = await getAll<Category>(CATEGORY_STORE)
    const byName = new Map<string, Category>()

    for (const category of categories) {
      const key = normalizeCategoryName(category.name)
      const existing = byName.get(key)
      if (!existing) {
        byName.set(key, category)
        continue
      }

      const products = await this.listProducts()
      await Promise.all(
        products
          .filter((product) => product.categoryId === category.id)
          .map((product) => this.saveProduct({ ...product, categoryId: existing.id })),
      )
      await deleteById(CATEGORY_STORE, category.id)
    }
  },

  listProducts: () => getAll<Product>(PRODUCT_STORE),

  async listCategories() {
    const categories = await getAll<Category>(CATEGORY_STORE)
    return [...categories].sort((a, b) => a.name.localeCompare(b.name, 'uk'))
  },

  async getProduct(id: string) {
    return store<Product | undefined>(PRODUCT_STORE, 'readonly', (objectStore) => objectStore.get(id))
  },

  async findProductByBarcode(barcode: string) {
    const products = await this.listProducts()
    return products.find((product) => product.barcode === barcode) ?? null
  },

  async saveProduct(draft: ProductDraft) {
    if (draft.barcode) {
      const existing = await this.findProductByBarcode(draft.barcode)
      if (existing && existing.id !== draft.id) {
        throw new Error('barcode-exists')
      }
    }
    const timestamp = nowIso()
    const current = draft.id ? await this.getProduct(draft.id) : undefined
    const product: Product = {
      id: draft.id ?? uid(),
      name: draft.name.trim(),
      barcode: draft.barcode?.trim() || null,
      imagePath: draft.imagePath ?? current?.imagePath ?? null,
      rating: draft.rating,
      note: draft.note.trim(),
      categoryId: draft.categoryId,
      createdAt: current?.createdAt ?? timestamp,
      updatedAt: timestamp,
      externalSource: draft.externalSource ?? current?.externalSource ?? null,
      externalProductId: draft.externalProductId ?? current?.externalProductId ?? null,
      externalMetadata: draft.externalMetadata ?? current?.externalMetadata ?? null,
      brand: draft.brand ?? current?.brand ?? null,
    }
    return put(PRODUCT_STORE, product)
  },

  async deleteProduct(id: string) {
    await deleteById(PRODUCT_STORE, id)
  },

  async saveCategory(input: { id?: string; name: string }) {
    const timestamp = nowIso()
    const name = input.name.trim()
    const duplicate = (await this.listCategories()).find(
      (category) => normalizeCategoryName(category.name) === normalizeCategoryName(name) && category.id !== input.id,
    )
    if (duplicate && !input.id) return duplicate
    if (duplicate && input.id) throw new Error('category-exists')

    const existing = input.id
      ? await store<Category | undefined>(CATEGORY_STORE, 'readonly', (objectStore) => objectStore.get(input.id!))
      : undefined
    const category: Category = {
      id: input.id ?? uid(),
      name,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    }
    return put(CATEGORY_STORE, category)
  },

  async deleteCategory(id: string) {
    const products = await this.listProducts()
    await Promise.all(
      products
        .filter((product) => product.categoryId === id)
        .map((product) => this.saveProduct({ ...product, categoryId: '' })),
    )
    await deleteById(CATEGORY_STORE, id)
  },

  async replaceAll(categories: Category[], products: Product[]) {
    const database = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction([CATEGORY_STORE, PRODUCT_STORE], 'readwrite')
      tx.objectStore(CATEGORY_STORE).clear()
      tx.objectStore(PRODUCT_STORE).clear()
      categories.forEach((category) => tx.objectStore(CATEGORY_STORE).put(category))
      products.forEach((product) => tx.objectStore(PRODUCT_STORE).put(product))
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    database.close()
  },
}

function normalizeCategoryName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

export const db = import.meta.env.PROD ? cloudDb : localDb
