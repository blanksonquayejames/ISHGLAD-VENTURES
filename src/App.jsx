import React, { useEffect, useMemo, useState } from 'react'
import {
  ShoppingCart,
  Box,
  Clock,
  Printer,
  Plus,
  Minus,
  Check,
  X,
  Search,
  Edit3,
  Trash2,
} from 'lucide-react'

const initialInventory = []

const currency = (v) => `₵${v.toFixed(2)}`
// API base (adjust via Vite env var if needed)
const API = import.meta.env.VITE_API_BASE || 'http://localhost:4000'

const getImageUrl = (img) => {
  if (!img) return null
  if (typeof img !== 'string') return null
  if (img.startsWith('data:')) return img
  if (img.startsWith('/uploads')) return `${API}${img}`
  if (img.startsWith('http')) return img
  return img
}

export default function App() {
  const [inventory, setInventory] = useState(initialInventory)
  const [cart, setCart] = useState({})
  const [salesHistory, setSalesHistory] = useState([])
  const [activeTab, setActiveTab] = useState('Cash Register')
  const [searchQuery, setSearchQuery] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [toasts, setToasts] = useState([])

  // Inventory product modal & form state for add/edit/delete
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [productModalMode, setProductModalMode] = useState('add') // 'add' | 'edit'
  const [productForm, setProductForm] = useState({ id: '', name: '', sku: '', price: '', stock: '', image: '', imageFile: null })

  const openAddProductModal = () => {
    setProductModalMode('add')
    setProductForm({ id: '', name: '', sku: '', price: '', stock: '', image: '', imageFile: null })
    setProductModalOpen(true)
  }

  const openEditProductModal = (prod) => {
    setProductModalMode('edit')
    const img = prod.image ? (prod.image.startsWith('/uploads') ? `${API}${prod.image}` : prod.image) : ''
    setProductForm({ id: prod.id, name: prod.name, sku: prod.sku, price: String(prod.price), stock: String(prod.stock), image: img, imageFile: null })
    setProductModalOpen(true)
  }

  const updateProductForm = (field, value) => setProductForm((f) => ({ ...f, [field]: value }))

  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      updateProductForm('image', String(reader.result))
    }
    reader.readAsDataURL(file)
    updateProductForm('imageFile', file)
  }

  const saveProduct = async () => {
    const name = (productForm.name || '').trim()
    const sku = (productForm.sku || '').trim()
    const price = parseFloat(productForm.price)
    const stock = parseInt(productForm.stock || '0', 10)

    if (!name || !sku || Number.isNaN(price) || Number.isNaN(stock)) {
      addToast('Please provide valid product details', 'error')
      return
    }

    try {
      const form = new FormData()
      form.append('name', name)
      form.append('sku', sku)
      form.append('price', String(price))
      form.append('stock', String(stock))
      if (productForm.imageFile) form.append('image', productForm.imageFile)

      if (productModalMode === 'add') {
        const res = await fetch(`${API}/api/products`, { method: 'POST', body: form })
        if (!res.ok) throw new Error('Failed to create product')
        const created = await res.json()
        setInventory((inv) => [created, ...inv])
        addToast('Product added', 'success')
      } else {
        const res = await fetch(`${API}/api/products/${productForm.id}`, { method: 'PUT', body: form })
        if (!res.ok) throw new Error('Failed to update product')
        const updated = await res.json()
        setInventory((inv) => inv.map((p) => (p.id === updated.id ? updated : p)))
        addToast('Product updated', 'success')
      }
      setProductModalOpen(false)
    } catch (err) {
      addToast(err.message || 'Save failed', 'error')
    }
  }

  const deleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return
    try {
      const res = await fetch(`${API}/api/products/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setInventory((inv) => inv.filter((p) => p.id !== id))
      setCart((c) => {
        const copy = { ...c }
        delete copy[id]
        return copy
      })
      addToast('Product deleted', 'success')
    } catch (err) {
      addToast(err.message || 'Delete failed', 'error')
    }
  }

  useEffect(() => {
    return () => {
      // cleanup print style if left behind
      const el = document.getElementById('receipt-print-styles')
      if (el) el.remove()
    }
  }, [])

  const addToast = (text, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }

  const clearSearchAndSetTab = (tab) => {
    setActiveTab(tab)
    setSearchQuery('')
  }

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API}/api/products`)
      if (!res.ok) throw new Error('Failed to fetch products')
      const data = await res.json()
      setInventory(data)
    } catch (err) {
      addToast('Failed to load products', 'error')
    }
  }

  const fetchSales = async (q = '') => {
    try {
      const url = q ? `${API}/api/sales?q=${encodeURIComponent(q)}` : `${API}/api/sales`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch sales')
      const data = await res.json()
      setSalesHistory(data)
    } catch (err) {
      addToast('Failed to load sales', 'error')
    }
  }

  useEffect(() => {
    fetchProducts()
    fetchSales()
  }, [])

  useEffect(() => {
    if (activeTab === 'Sales History') fetchSales(searchQuery)
    else if (activeTab === 'Inventory') fetchProducts()
  }, [activeTab, searchQuery])

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return inventory
    return inventory.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
  }, [inventory, searchQuery])

  const filteredSales = salesHistory

  const cartItems = useMemo(() => {
    return Object.entries(cart).map(([id, qty]) => {
      const prod = inventory.find((p) => p.id === id) || { name: 'Unknown', price: 0 }
      return { ...prod, qty, subtotal: prod.price * qty }
    })
  }, [cart, inventory])

  const grandTotal = cartItems.reduce((s, i) => s + i.subtotal, 0)

  const addToCart = (product) => {
    if (product.stock <= 0) {
      addToast('Product is out of stock', 'error')
      return
    }
    setCart((c) => {
      const current = c[product.id] || 0
      if (current + 1 > product.stock) {
        addToast('Cannot add more than available stock', 'error')
        return c
      }
      return { ...c, [product.id]: current + 1 }
    })
  }

  const increaseQty = (id) => {
    const prod = inventory.find((p) => p.id === id)
    setCart((c) => {
      const current = c[id] || 0
      if (current + 1 > prod.stock) {
        addToast('Reached stock limit', 'error')
        return c
      }
      return { ...c, [id]: current + 1 }
    })
  }

  const decreaseQty = (id) => {
    setCart((c) => {
      const current = c[id] || 0
      if (current <= 1) {
        const copy = { ...c }
        delete copy[id]
        return copy
      }
      return { ...c, [id]: current - 1 }
    })
  }

  const checkout = async () => {
    if (cartItems.length === 0) {
      addToast('Cart is empty', 'error')
      return
    }
    const payload = {
      items: cartItems.map((i) => ({ id: i.id, name: i.name, sku: i.sku, price: i.price, qty: i.qty, subtotal: i.subtotal })),
      total: Number(grandTotal.toFixed(2)),
    }
    try {
      const res = await fetch(`${API}/api/sales`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('Checkout failed')
      const saved = await res.json()
      setSalesHistory((s) => [saved, ...s])
      // refresh products (stock updated server-side)
      fetchProducts()
      setCart({})
      addToast('Transaction completed', 'success')
      setReceipt(saved)
    } catch (err) {
      addToast(err.message || 'Checkout failed', 'error')
    }
  }

  // Inject print styles when receipt is opened
  useEffect(() => {
    const styleId = 'receipt-print-styles'
    if (receipt) {
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style')
        style.id = styleId
        style.innerHTML = `
          @media print {
            body * { visibility: hidden !important; }
            .receipt-print, .receipt-print * { visibility: visible !important; }
            .receipt-print { position: absolute; left: 0; top: 0; width: 80mm; }
          }
        `
        document.head.appendChild(style)
      }
    } else {
      const el = document.getElementById(styleId)
      if (el) el.remove()
    }
    return () => {
      const el = document.getElementById(styleId)
      if (el) el.remove()
    }
  }, [receipt])

  const printReceipt = () => {
    setTimeout(() => window.print(), 100)
  }

  const stockBadge = (stock) => {
    if (stock === 0) return <span className="text-xs bg-red-600 text-white px-2 py-1 rounded">Out</span>
    if (stock <= 10) return <span className="text-xs bg-orange-400 text-black px-2 py-1 rounded">Low</span>
    return <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">In</span>
  }

  return (
    <div className="h-screen flex bg-gray-100 text-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-gray-100 p-4 flex flex-col">
        <div className="mb-6">
          <h1 className="text-xl font-bold">ISHGLAD VENTURES</h1>
          <p className="text-xs text-gray-400 mt-1">Desktop Demo</p>
        </div>

        <nav className="flex-1">
          <button onClick={() => clearSearchAndSetTab('Cash Register')} className={`w-full flex items-center gap-3 px-3 py-2 rounded ${activeTab === 'Cash Register' ? 'bg-gray-800' : 'hover:bg-gray-800'}`}>
            <ShoppingCart size={18} />
            Cash Register
          </button>
          <button onClick={() => clearSearchAndSetTab('Inventory')} className={`w-full flex items-center gap-3 mt-2 px-3 py-2 rounded ${activeTab === 'Inventory' ? 'bg-gray-800' : 'hover:bg-gray-800'}`}>
            <Box size={18} />
            Inventory
          </button>
          <button onClick={() => clearSearchAndSetTab('Sales History')} className={`w-full flex items-center gap-3 mt-2 px-3 py-2 rounded ${activeTab === 'Sales History' ? 'bg-gray-800' : 'hover:bg-gray-800'}`}>
            <Clock size={18} />
            Sales History
          </button>
        </nav>

        <div className="mt-6 text-xs text-gray-400">
          <div className="flex items-center justify-between">
            <span>Terminal</span>
            <span className="text-green-400">Online</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        <header className="flex items-center justify-between px-6 py-4 border-b bg-white">
          <div>
            <h2 className="text-lg font-semibold">{activeTab}</h2>
            <p className="text-sm text-gray-500">ISHGLAD VENTURES</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600 flex items-center gap-2">
              <span className="h-2 w-2 bg-green-500 rounded-full inline-block" /> Terminal Online
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-auto">
          {activeTab === 'Cash Register' && (
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-9">
                <div className="mb-4 flex items-center gap-3">
                  <div className="relative flex-1">
                    <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search products by name or SKU" className="w-full border rounded px-3 py-2" />
                    <Search className="absolute right-3 top-2.5 text-gray-400" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {filteredProducts.map((p) => (
                    <div key={p.id} className={`bg-white p-3 rounded shadow-sm flex flex-col cursor-pointer ${p.stock === 0 ? 'opacity-50 pointer-events-none' : 'hover:shadow-md'}`} onClick={() => addToCart(p)}>
                      <div className="h-36 mb-3 bg-gray-50 rounded flex items-center justify-center overflow-hidden">
                        {getImageUrl(p.image) ? (
                          <img src={getImageUrl(p.image)} alt={p.name} className="object-cover h-full w-full" />
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400">No Image</div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">{p.name}</div>
                          <div className="text-xs text-gray-500">{p.sku}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{currency(p.price)}</div>
                          <div className="mt-1">{stockBadge(p.stock)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <aside className="col-span-3">
                <div className="bg-white rounded shadow p-4 sticky top-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Cart</h3>
                    <span className="text-sm text-gray-500">{cartItems.length} items</span>
                  </div>

                  <div className="space-y-3 max-h-72 overflow-auto mb-4">
                    {cartItems.length === 0 && <div className="text-sm text-gray-500">Cart is empty</div>}
                    {cartItems.map((it) => (
                      <div key={it.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getImageUrl(it.image) ? (
                            <img src={getImageUrl(it.image)} alt={it.name} className="w-12 h-12 object-cover rounded" />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 flex items-center justify-center text-xs text-gray-500 rounded">No</div>
                          )}
                          <div>
                            <div className="text-sm font-medium">{it.name}</div>
                            <div className="text-xs text-gray-500">{it.sku}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => decreaseQty(it.id)} className="p-1 rounded bg-gray-100"><Minus size={14} /></button>
                          <div className="w-6 text-center">{it.qty}</div>
                          <button onClick={() => increaseQty(it.id)} className="p-1 rounded bg-gray-100"><Plus size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex items-center justify-between text-lg font-semibold">Total <span>{currency(grandTotal)}</span></div>
                    <div className="mt-3">
                      <button onClick={checkout} className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded mt-2 flex items-center justify-center gap-2"><Check /> Charge</button>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          )}

          {activeTab === 'Inventory' && (
            <div>
              <div className="mb-4 flex items-center gap-3">
                <button onClick={openAddProductModal} className="bg-blue-600 text-white px-3 py-2 rounded flex items-center gap-2">
                  <Plus size={14} /> Add Product
                </button>
                <div className="relative flex-1">
                  <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Filter inventory by name or SKU" className="w-full border rounded px-3 py-2" />
                  <Search className="absolute right-3 top-2.5 text-gray-400" />
                </div>
              </div>

              <div className="bg-white rounded shadow overflow-auto">
                <table className="w-full table-auto text-left">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Stock</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="px-4 py-3 flex items-center gap-3">
                          {getImageUrl(p.image) ? (
                            <img src={getImageUrl(p.image)} alt={p.name} className="w-12 h-12 object-cover rounded" />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 flex items-center justify-center text-xs text-gray-500 rounded">No</div>
                          )}
                          <div>
                            <div className="font-medium">{p.name}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3">{p.sku}</td>
                        <td className="px-4 py-3">{currency(p.price)}</td>
                        <td className="px-4 py-3">{p.stock}</td>
                        <td className="px-4 py-3">{stockBadge(p.stock)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEditProductModal(p)} className="p-1 rounded bg-gray-100" title="Edit"><Edit3 size={16} /></button>
                            <button onClick={() => deleteProduct(p.id)} className="p-1 rounded bg-red-100 text-red-700" title="Delete"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'Sales History' && (
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="relative flex-1">
                  <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search sales by Order ID" className="w-full border rounded px-3 py-2" />
                  <Search className="absolute right-3 top-2.5 text-gray-400" />
                </div>
              </div>

              <div className="bg-white rounded shadow overflow-auto">
                <table className="w-full table-auto text-left">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3">Order ID</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Items</th>
                      <th className="px-4 py-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-gray-500">No sales found</td>
                      </tr>
                    )}
                    {filteredSales.map((o) => (
                      <tr key={o.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setReceipt(o)}>
                        <td className="px-4 py-3">{o.id}</td>
                        <td className="px-4 py-3">{new Date(o.datetime).toLocaleString()}</td>
                        <td className="px-4 py-3">{o.items.map((it) => `${it.qty}x ${it.name}`).join(', ')}</td>
                        <td className="px-4 py-3">{currency(o.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
        {toasts.map((t) => (
          <div key={t.id} className={`px-4 py-2 rounded shadow text-sm flex items-center gap-2 ${t.type === 'success' ? 'bg-green-600 text-white' : t.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'}`}>
            {t.type === 'success' && <Check size={16} />}
            {t.type === 'error' && <X size={16} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      {/* Product Add/Edit Modal */}
      {productModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setProductModalOpen(false)}>
          <div className="bg-white w-96 p-4 rounded shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">{productModalMode === 'add' ? 'Add Product' : 'Edit Product'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm">Name</label>
                <input value={productForm.name} onChange={(e) => updateProductForm('name', e.target.value)} className="w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="text-sm">SKU</label>
                <input value={productForm.sku} onChange={(e) => updateProductForm('sku', e.target.value)} className="w-full border rounded px-2 py-1" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-sm">Price</label>
                  <input type="number" step="0.01" value={productForm.price} onChange={(e) => updateProductForm('price', e.target.value)} className="w-full border rounded px-2 py-1" />
                </div>
                <div className="w-28">
                  <label className="text-sm">Stock</label>
                  <input type="number" value={productForm.stock} onChange={(e) => updateProductForm('stock', e.target.value)} className="w-full border rounded px-2 py-1" />
                </div>
              </div>
              <div>
                <label className="text-sm">Product Image</label>
                <div className="flex items-center gap-3 mt-1">
                  <input type="file" accept="image/*" onChange={handleImageFileChange} />
                  {productForm.image ? (
                    <img src={productForm.image} alt="preview" className="w-20 h-20 object-cover rounded" />
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 flex items-center justify-center text-xs text-gray-500 rounded">No Image</div>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setProductModalOpen(false)} className="bg-gray-200 py-1 px-3 rounded">Cancel</button>
              <button onClick={saveProduct} className="bg-blue-600 text-white py-1 px-3 rounded">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receipt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40" onClick={() => setReceipt(null)}>
          <div className="bg-white w-96 p-4 rounded shadow-lg receipt-print" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold">ISHGLAD VENTURES</h3>
                <div className="text-xs text-gray-500">123 Example St • (555) 555-5555</div>
              </div>
              <div className="text-xs text-gray-500">{new Date(receipt.datetime).toLocaleString()}</div>
            </div>

            <div className="border-t pt-3">
              {receipt.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{it.name}</div>
                    <div className="text-xs text-gray-500">{it.qty} x {currency(it.price)}</div>
                  </div>
                  <div className="font-medium">{currency(it.subtotal)}</div>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 mt-3">
              <div className="flex items-center justify-between font-semibold">Total <span>{currency(receipt.total)}</span></div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button onClick={printReceipt} className="flex-1 bg-gray-900 text-white py-2 rounded flex items-center justify-center gap-2"><Printer /> Print</button>
              <button onClick={() => setReceipt(null)} className="bg-gray-200 py-2 px-3 rounded">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
