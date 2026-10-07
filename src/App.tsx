import { ArrowLeft, Camera, Folder, Home, Plus, Search, Settings, SunMoon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import type { Category, ExternalProduct, Product, ProductDraft, ScanResult, ThemePreference } from './types'
import { db } from './storage/database'
import { exportJson, exportZip, readBackup, restoreBackup } from './services/backup'
import { productLookupService } from './services/productLookup'
import { fileToDataUrl, normalizeBarcode, productMatches, urlToDataUrl } from './utils'
import { BarcodeScanner } from './components/BarcodeScanner'

type View =
  | { name: 'home' }
  | { name: 'search' }
  | { name: 'scan' }
  | { name: 'new'; barcode?: string; external?: ExternalProduct }
  | { name: 'product'; id: string }
  | { name: 'edit'; id: string }
  | { name: 'categories' }
  | { name: 'settings' }

const productSchema = z.object({
  name: z.string().min(1),
  categoryId: z.string().min(1),
  rating: z.number().min(1).max(10),
})

const themeKey = 'rateit-theme'

export default function App() {
  const [view, setView] = useState<View>({ name: 'home' })
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [theme, setTheme] = useState<ThemePreference>(() => (localStorage.getItem(themeKey) as ThemePreference) || 'system')

  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories])
  const recentProducts = useMemo(
    () => [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3),
    [products],
  )

  async function refresh() {
    setProducts(await db.listProducts())
    setCategories(await db.listCategories())
  }

  useEffect(() => {
    db.seedIfEmpty()
      .then(refresh)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    localStorage.setItem(themeKey, theme)
    document.documentElement.dataset.theme = theme
  }, [theme])

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  async function saveProduct(draft: ProductDraft) {
    try {
      productSchema.parse(draft)
      const saved = await db.saveProduct(draft)
      await refresh()
      setView({ name: 'product', id: saved.id })
      showToast('Збережено')
    } catch (error) {
      showToast(error instanceof Error && error.message === 'barcode-exists' ? 'Такий штрихкод уже є в базі' : 'Перевірте обовʼязкові поля')
    }
  }

  async function scanBarcode(barcode: string): Promise<ScanResult> {
    const normalized = normalizeBarcode(barcode)
    const local = await db.findProductByBarcode(normalized)
    if (local) return { status: 'found-local', barcode: normalized, product: local }
    const external = await productLookupService.lookupByBarcode(normalized)
    if (external) return { status: 'found-external', barcode: normalized, externalProduct: external }
    return { status: 'not-found', barcode: normalized, message: 'Товар не знайдено. Ви можете додати його вручну.' }
  }

  const selectedProduct =
    (view.name === 'product' || view.name === 'edit') ? products.find((product) => product.id === view.id) : undefined

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView({ name: 'home' })} aria-label="RateIt">
          <span className="brand-mark">R</span>
          <span>RateIt</span>
        </button>
        <div className="top-actions">
          <IconButton label="Пошук" onClick={() => setView({ name: 'search' })}>
            <Search size={21} />
          </IconButton>
          <IconButton label="Налаштування" onClick={() => setView({ name: 'settings' })}>
            <Settings size={21} />
          </IconButton>
        </div>
      </header>

      <main>
        {loading && <StateCard title="Завантаження..." text="Готуємо вашу базу товарів." />}
        {!loading && view.name === 'home' && (
          <HomeView
            products={products}
            recentProducts={recentProducts}
            categories={categories}
            categoryMap={categoryMap}
            onScan={() => setView({ name: 'scan' })}
            onNew={() => setView({ name: 'new' })}
            onProduct={(id) => setView({ name: 'product', id })}
            onCategories={() => setView({ name: 'categories' })}
          />
        )}
        {!loading && view.name === 'search' && (
          <SearchView
            products={products}
            categoryMap={categoryMap}
            onProduct={(id) => setView({ name: 'product', id })}
            onNew={() => setView({ name: 'new' })}
          />
        )}
        {!loading && view.name === 'scan' && (
          <ScanView
            onBack={() => setView({ name: 'home' })}
            onResult={(result) => {
              if (result.status === 'found-local' && result.product) setView({ name: 'product', id: result.product.id })
              if (result.status === 'found-external' && result.externalProduct) {
                setView({ name: 'new', barcode: result.barcode, external: result.externalProduct })
              }
              if (result.status === 'not-found' || result.status === 'error') {
                showToast(result.message || 'Не вдалося знайти товар автоматично')
                setView({ name: 'new', barcode: result.barcode })
              }
            }}
            onScan={scanBarcode}
          />
        )}
        {!loading && view.name === 'new' && (
          <ProductForm
            categories={categories}
            initialBarcode={view.barcode}
            external={view.external}
            onCancel={() => setView({ name: 'home' })}
            onSave={saveProduct}
            onCreateCategory={async (name) => {
              const category = await db.saveCategory({ name })
              await refresh()
              return category.id
            }}
          />
        )}
        {!loading && view.name === 'product' && selectedProduct && (
          <ProductDetail
            product={selectedProduct}
            category={selectedProduct.categoryId ? categoryMap.get(selectedProduct.categoryId) : undefined}
            onBack={() => setView({ name: 'home' })}
            onEdit={() => setView({ name: 'edit', id: selectedProduct.id })}
            onDelete={async () => {
              if (!confirm('Видалити цей товар?')) return
              await db.deleteProduct(selectedProduct.id)
              await refresh()
              setView({ name: 'home' })
              showToast('Товар видалено')
            }}
          />
        )}
        {!loading && view.name === 'edit' && selectedProduct && (
          <ProductForm
            product={selectedProduct}
            categories={categories}
            onCancel={() => setView({ name: 'product', id: selectedProduct.id })}
            onSave={saveProduct}
            onCreateCategory={async (name) => {
              const category = await db.saveCategory({ name })
              await refresh()
              return category.id
            }}
          />
        )}
        {!loading && view.name === 'categories' && (
          <CategoriesView
            categories={categories}
            products={products}
            onBack={() => setView({ name: 'home' })}
            onChange={refresh}
            toast={showToast}
          />
        )}
        {!loading && view.name === 'settings' && (
          <SettingsView
            theme={theme}
            setTheme={setTheme}
            onCategories={() => setView({ name: 'categories' })}
            onExportJson={async () => download(await exportJson(), `RateIt-backup-${today()}.json`)}
            onExportZip={async () => download(await exportZip(), `RateIt-backup-${today()}.zip`)}
            onImport={async (file) => {
              const backup = await readBackup(file)
              if (!confirm(`Відновити резервну копію? Буде імпортовано товарів: ${backup.products.length}.`)) return
              await restoreBackup(backup.categories, backup.products)
              await refresh()
              showToast('Резервну копію відновлено')
            }}
          />
        )}
      </main>

      <nav className="bottom-nav" aria-label="Основна навігація">
        <button className={view.name === 'home' ? 'active' : ''} onClick={() => setView({ name: 'home' })}>
          <Home size={20} />
          <span>Головна</span>
        </button>
        <button className={view.name === 'search' ? 'active' : ''} onClick={() => setView({ name: 'search' })}>
          <Search size={20} />
          <span>Пошук</span>
        </button>
        <button className={view.name === 'scan' ? 'active' : ''} onClick={() => setView({ name: 'scan' })}>
          <Camera size={24} />
          <span>Скан</span>
        </button>
        <button className={view.name === 'categories' ? 'active' : ''} onClick={() => setView({ name: 'categories' })}>
          <Folder size={20} />
          <span>Категорії</span>
        </button>
      </nav>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function HomeView({
  products,
  recentProducts,
  categories,
  categoryMap,
  onScan,
  onNew,
  onProduct,
  onCategories,
}: {
  products: Product[]
  recentProducts: Product[]
  categories: Category[]
  categoryMap: Map<string, Category>
  onScan: () => void
  onNew: () => void
  onProduct: (id: string) => void
  onCategories: () => void
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(categories[0]?.id ?? null)
  const selectedCategory = selectedCategoryId ? categoryMap.get(selectedCategoryId) : undefined
  const categoryProducts = selectedCategoryId
    ? products.filter((product) => product.categoryId === selectedCategoryId)
    : []

  useEffect(() => {
    if (!selectedCategoryId && categories[0]) setSelectedCategoryId(categories[0].id)
    if (selectedCategoryId && !categories.some((category) => category.id === selectedCategoryId)) {
      setSelectedCategoryId(categories[0]?.id ?? null)
    }
  }, [categories, selectedCategoryId])

  return (
    <section className="stack">
      <div className="hero-actions">
        <button className="primary large" onClick={onScan}>
          <Camera size={24} /> Сканувати
        </button>
        <button className="secondary large" onClick={onNew}>
          <Plus size={24} /> Додати товар
        </button>
      </div>
      {recentProducts.length === 0 ? (
        <StateCard
          title="У вас ще немає товарів"
          text="Відскануйте штрихкод або додайте товар вручну."
          action={<button onClick={onScan}>Сканувати</button>}
        />
      ) : (
        <>
          <SectionHeader title="Останні додані" />
          <ProductGrid products={recentProducts} categoryMap={categoryMap} onProduct={onProduct} />
        </>
      )}
      <SectionHeader title="Категорії" action="Керувати" onAction={onCategories} />
      <div className="chips">
        {categories.map((category) => (
          <button
            className={`chip ${selectedCategoryId === category.id ? 'selected' : ''}`}
            key={category.id}
            onClick={() => setSelectedCategoryId(category.id)}
          >
            {category.name}
          </button>
        ))}
        {categories.length === 0 && <span className="muted">Категорій поки немає</span>}
      </div>
      {selectedCategory && (
        <>
          {categoryProducts.length ? (
            <ProductGrid products={categoryProducts} categoryMap={categoryMap} onProduct={onProduct} />
          ) : (
            <StateCard title="У цій категорії порожньо" text="Додайте товар і виберіть цю категорію у формі." />
          )}
        </>
      )}
    </section>
  )
}

function SearchView({
  products,
  categoryMap,
  onProduct,
  onNew,
}: {
  products: Product[]
  categoryMap: Map<string, Category>
  onProduct: (id: string) => void
  onNew: () => void
}) {
  const [query, setQuery] = useState('')
  const results = products.filter((product) => productMatches(query, product))
  return (
    <section className="stack">
      <label className="search-box">
        <Search size={20} />
        <input autoFocus placeholder="Назва, бренд або штрихкод" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {results.length ? (
        <ProductGrid products={results} categoryMap={categoryMap} onProduct={onProduct} />
      ) : (
        <StateCard title="Нічого не знайдено" text="Спробуйте інший запит або додайте товар вручну." action={<button onClick={onNew}>Додати товар</button>} />
      )}
    </section>
  )
}

function ScanView({
  onBack,
  onResult,
  onScan,
}: {
  onBack: () => void
  onResult: (result: ScanResult) => void
  onScan: (barcode: string) => Promise<ScanResult>
}) {
  const [manual, setManual] = useState('')
  const [loading, setLoading] = useState(false)

  async function submitBarcode(barcode: string) {
    if (!barcode) return
    setLoading(true)
    onResult(await onScan(barcode).catch(() => ({ status: 'error', barcode, message: 'Не вдалося знайти товар автоматично.' } as ScanResult)))
    setLoading(false)
  }

  return (
    <section className="stack">
      <SectionHeader title="Сканувати штрихкод" action="Назад" onAction={onBack} />
      <BarcodeScanner onDetected={submitBarcode} />
      <div className="panel">
        <label>
          Ввести штрихкод вручну
          <input inputMode="numeric" value={manual} onChange={(event) => setManual(event.target.value)} placeholder="4820001234567" />
        </label>
        <button className="primary" disabled={loading || !manual.trim()} onClick={() => submitBarcode(manual)}>
          {loading ? 'Шукаємо товар...' : 'Знайти'}
        </button>
      </div>
    </section>
  )
}

function ProductForm({
  product,
  categories,
  initialBarcode,
  external,
  onSave,
  onCancel,
  onCreateCategory,
}: {
  product?: Product
  categories: Category[]
  initialBarcode?: string
  external?: ExternalProduct
  onSave: (draft: ProductDraft) => Promise<void>
  onCancel: () => void
  onCreateCategory: (name: string) => Promise<string>
}) {
  const [name, setName] = useState(product?.name ?? external?.name ?? '')
  const [barcode, setBarcode] = useState(product?.barcode ?? initialBarcode ?? external?.barcode ?? '')
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? categories[0]?.id ?? '')
  const [rating, setRating] = useState(product?.rating ?? 8)
  const [note, setNote] = useState(product?.note ?? '')
  const [imagePath, setImagePath] = useState(product?.imagePath ?? external?.imageUrl ?? '')
  const [newCategory, setNewCategory] = useState('')
  const [busy, setBusy] = useState(false)

  async function createCategory() {
    if (!newCategory.trim()) return
    const id = await onCreateCategory(newCategory)
    setCategoryId(id)
    setNewCategory('')
  }

  async function save() {
    setBusy(true)
    let storedImage = imagePath
    if (external?.imageUrl && imagePath === external.imageUrl) {
      storedImage = (await urlToDataUrl(external.imageUrl)) ?? external.imageUrl
    }
    await onSave({
      id: product?.id,
      name,
      barcode: normalizeBarcode(barcode) || null,
      categoryId,
      rating,
      note,
      imagePath: storedImage || null,
      externalSource: external?.source ?? product?.externalSource ?? null,
      externalProductId: external?.externalId ?? product?.externalProductId ?? null,
      externalMetadata: external?.metadata ?? product?.externalMetadata ?? null,
      brand: external?.brand ?? product?.brand ?? null,
    })
    setBusy(false)
  }

  return (
    <section className="stack">
      <SectionHeader title={product ? 'Редагування' : external ? 'Додати знайдений товар' : 'Новий товар'} action="Скасувати" onAction={onCancel} />
      {external && (
        <div className="notice">
          <strong>Можливий збіг</strong>
          <span>Перевірте назву й фото перед збереженням.</span>
        </div>
      )}
      <div className="form-card">
        <ImagePicker imagePath={imagePath} setImagePath={setImagePath} />
        <label>
          Назва
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Назва товару" />
        </label>
        <label>
          Штрихкод <span className="optional">необовʼязково</span>
          <input inputMode="numeric" value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="EAN / UPC" />
        </label>
        <label>
          Категорія
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Вибрати категорію</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <div className="inline-create">
          <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Нова категорія" />
          <button type="button" onClick={createCategory}>
            Додати
          </button>
        </div>
        <fieldset className="rating-picker">
          <legend>Оцінка</legend>
          {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
            <button type="button" className={rating === value ? 'selected' : ''} key={value} onClick={() => setRating(value)}>
              {value}
            </button>
          ))}
        </fieldset>
        <label>
          Нотатка
          <textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Що варто памʼятати про цей товар?" />
        </label>
        <button className="primary" disabled={busy} onClick={save}>
          {busy ? 'Збереження...' : 'Зберегти'}
        </button>
      </div>
    </section>
  )
}

function ProductDetail({
  product,
  category,
  onBack,
  onEdit,
  onDelete,
}: {
  product: Product
  category?: Category
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <section className="stack product-detail">
      <div className="detail-nav">
        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={18} />
          Назад
        </button>
      </div>
      <ProductImage product={product} />
      <div className="detail-head">
        <h1>{product.name}</h1>
        <span className="score">{product.rating}/10</span>
      </div>
      {category && <span className="chip detail-category">{category.name}</span>}
      {product.barcode && <p className="muted">Штрихкод: {product.barcode}</p>}
      {product.note && <p className="note">{product.note}</p>}
      <div className="row-actions">
        <button className="primary" onClick={onEdit}>
          Редагувати
        </button>
        <button className="danger" onClick={onDelete}>
          Видалити
        </button>
      </div>
    </section>
  )
}

function CategoriesView({
  categories,
  products,
  onBack,
  onChange,
  toast,
}: {
  categories: Category[]
  products: Product[]
  onBack: () => void
  onChange: () => Promise<void>
  toast: (message: string) => void
}) {
  const [name, setName] = useState('')

  return (
    <section className="stack">
      <SectionHeader title="Категорії" action="Назад" onAction={onBack} />
      <div className="inline-create">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Нова категорія" />
        <button
          onClick={async () => {
            if (!name.trim()) return
            await db.saveCategory({ name })
            setName('')
            await onChange()
          }}
        >
          Додати
        </button>
      </div>
      <div className="list">
        {categories.map((category) => (
          <CategoryRow key={category.id} category={category} count={products.filter((product) => product.categoryId === category.id).length} onChange={onChange} toast={toast} />
        ))}
      </div>
    </section>
  )
}

function CategoryRow({ category, count, onChange, toast }: { category: Category; count: number; onChange: () => Promise<void>; toast: (message: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)
  return (
    <div className="list-row">
      {editing ? <input value={name} onChange={(event) => setName(event.target.value)} /> : <strong>{category.name}</strong>}
      <span className="muted">{count} товарів</span>
      <div className="row-actions compact">
        <button
          onClick={async () => {
            if (editing) {
              await db.saveCategory({ id: category.id, name })
              await onChange()
            }
            setEditing(!editing)
          }}
        >
          {editing ? 'Зберегти' : 'Перейменувати'}
        </button>
        <button
          className="danger"
          onClick={async () => {
            if (!confirm('Видалити категорію? Товари залишаться без категорії.')) return
            await db.deleteCategory(category.id)
            await onChange()
            toast('Категорію видалено')
          }}
        >
          Видалити
        </button>
      </div>
    </div>
  )
}

function SettingsView({
  theme,
  setTheme,
  onCategories,
  onExportJson,
  onExportZip,
  onImport,
}: {
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void
  onCategories: () => void
  onExportJson: () => void
  onExportZip: () => void
  onImport: (file: File) => void
}) {
  return (
    <section className="stack">
      <SectionHeader title="Налаштування" />
      <div className="settings-group">
        <h2><SunMoon size={19} /> Тема</h2>
        <div className="segmented">
          {(['system', 'light', 'dark'] as ThemePreference[]).map((item) => (
            <button className={theme === item ? 'selected' : ''} key={item} onClick={() => setTheme(item)}>
              {item === 'system' ? 'Системна' : item === 'light' ? 'Світла' : 'Темна'}
            </button>
          ))}
        </div>
      </div>
      <div className="settings-group">
        <h2>Дані</h2>
        <button onClick={onExportZip}>Експорт ZIP</button>
        <button onClick={onExportJson}>Export JSON</button>
        <label className="file-button">
          Імпорт backup
          <input type="file" accept=".zip,.json,application/json" onChange={(event) => event.target.files?.[0] && onImport(event.target.files[0])} />
        </label>
      </div>
      <div className="settings-group">
        <h2>Категорії</h2>
        <button onClick={onCategories}>Керування категоріями</button>
      </div>
      <div className="settings-group">
        <h2>Інформація</h2>
        <p className="muted">RateIt 0.1.0 · зовнішні дані: Open Products Facts, Open Food Facts.</p>
      </div>
    </section>
  )
}

function ProductGrid({ products, categoryMap, onProduct }: { products: Product[]; categoryMap: Map<string, Category>; onProduct: (id: string) => void }) {
  return (
    <div className="product-grid">
      {products.map((product) => (
        <button className="product-card" key={product.id} onClick={() => onProduct(product.id)}>
          <ProductImage product={product} />
          <strong>{product.name}</strong>
          <span>{product.rating}/10</span>
          {product.categoryId && <small>{categoryMap.get(product.categoryId)?.name}</small>}
        </button>
      ))}
    </div>
  )
}

function ProductImage({ product }: { product: Pick<Product, 'name' | 'imagePath'> }) {
  return product.imagePath ? <img src={product.imagePath} alt={product.name} /> : <div className="image-placeholder">{product.name.slice(0, 1).toUpperCase()}</div>
}

function ImagePicker({ imagePath, setImagePath }: { imagePath: string; setImagePath: (path: string) => void }) {
  return (
    <div className="image-picker">
      {imagePath ? <img src={imagePath} alt="" /> : <div className="image-placeholder">Фото</div>}
      <label className="file-button">
        Вибрати фото
        <input type="file" accept="image/*" capture="environment" onChange={async (event) => {
          const file = event.target.files?.[0]
          if (file) setImagePath(await fileToDataUrl(file))
        }} />
      </label>
    </div>
  )
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="section-header">
      <h1>{title}</h1>
      {action && <button onClick={onAction}>{action}</button>}
    </div>
  )
}

function StateCard({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="state-card">
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  )
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button className="icon-button" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  )
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}
