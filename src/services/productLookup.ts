import type { ExternalProduct } from '../types'

export interface ProductLookupProvider {
  name: string
  lookupByBarcode(barcode: string): Promise<ExternalProduct | null>
}

interface FactsProductResponse {
  status?: number
  product?: {
    _id?: string
    product_name?: string
    generic_name?: string
    abbreviated_product_name?: string
    brands?: string
    image_front_url?: string
    image_url?: string
    quantity?: string
    categories?: string
  }
}

function mapFactsProduct(source: string, barcode: string, data: FactsProductResponse): ExternalProduct | null {
  if (!data || data.status !== 1 || !data.product) return null
  const product = data.product
  const name = cleanExternalName(product.product_name || product.generic_name || product.abbreviated_product_name)
  const imageUrl = product.image_front_url || product.image_url
  if (!name || !imageUrl) return null
  return {
    barcode,
    name,
    brand: product.brands || undefined,
    imageUrl,
    source,
    externalId: product._id || barcode,
    metadata: {
      quantity: product.quantity,
      categories: product.categories,
      brands: product.brands,
    },
  }
}

function cleanExternalName(value?: string) {
  const name = value?.replace(/\s+/g, ' ').trim()
  if (!name || name.length < 3 || name.length > 120) return null
  return name
}

class OpenFoodFactsProvider implements ProductLookupProvider {
  name = 'Open Food Facts'

  async lookupByBarcode(barcode: string) {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, {
      signal: AbortSignal.timeout(7000),
    })
    if (!response.ok) return null
    return mapFactsProduct(this.name, barcode, await response.json())
  }
}

export class ProductLookupService {
  constructor(private providers: ProductLookupProvider[]) {}

  async lookupByBarcode(barcode: string) {
    for (const provider of this.providers) {
      try {
        const product = await provider.lookupByBarcode(barcode)
        if (product) return product
      } catch {
        continue
      }
    }
    return null
  }
}

export const productLookupService = new ProductLookupService([
  new OpenFoodFactsProvider(),
])
