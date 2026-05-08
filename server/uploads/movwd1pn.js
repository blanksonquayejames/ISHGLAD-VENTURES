const express = require('express')
const cors = require('cors')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')

const app = express()
const port = process.env.PORT || 4000

const root = path.resolve(__dirname, '..')
const dataDir = path.join(root, 'data')
const uploadsDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

const dbPath = path.join(dataDir, 'pos.db')
const db = new Database(dbPath)

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      datetime DATETIME NOT NULL,
      total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id TEXT NOT NULL,
      product_id TEXT,
      name TEXT,
      sku TEXT,
      price REAL,
      qty INTEGER,
      subtotal REAL,
      FOREIGN KEY (sale_id) REFERENCES sales(id)
    );
  `)
}

migrate()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use('/uploads', express.static(uploadsDir))

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir)
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname)
    cb(null, Date.now().toString(36) + ext)
  },
})
const upload = multer({ storage })

// Products
app.get('/api/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all()
  res.json(rows)
})

app.post('/api/products', upload.single('image'), (req, res) => {
  const { name, sku, price, stock } = req.body
  const id = `p-${Date.now().toString(36)}`
  let imagePath = ''
  if (req.file) imagePath = `/uploads/${req.file.filename}`
  try {
    db.prepare('INSERT INTO products (id, name, sku, price, stock, image) VALUES (?, ?, ?, ?, ?, ?)').run(id, name, sku, parseFloat(price), parseInt(stock || '0', 10), imagePath)
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
    res.json(product)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.put('/api/products/:id', upload.single('image'), (req, res) => {
  const id = req.params.id
  const { name, sku, price, stock } = req.body
  try {
    if (req.file) {
      const imagePath = `/uploads/${req.file.filename}`
      const old = db.prepare('SELECT image FROM products WHERE id = ?').get(id)
      if (old && old.image && old.image.startsWith('/uploads/')) {
        const oldFile = path.join(uploadsDir, path.basename(old.image))
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile)
      }
      db.prepare('UPDATE products SET name=?, sku=?, price=?, stock=?, image=? WHERE id=?').run(name, sku, parseFloat(price), parseInt(stock || '0', 10), imagePath, id)
    } else {
      db.prepare('UPDATE products SET name=?, sku=?, price=?, stock=? WHERE id=?').run(name, sku, parseFloat(price), parseInt(stock || '0', 10), id)
    }
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
    res.json(product)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.delete('/api/products/:id', (req, res) => {
  const id = req.params.id
  const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
  if (prod && prod.image && prod.image.startsWith('/uploads/')) {
    const f = path.join(uploadsDir, path.basename(prod.image))
    if (fs.existsSync(f)) fs.unlinkSync(f)
  }
  db.prepare('DELETE FROM products WHERE id = ?').run(id)
  res.json({ ok: true })
})

// Sales
app.get('/api/sales', (req, res) => {
  const q = req.query.q || ''
  const sales = q
    ? db.prepare('SELECT * FROM sales WHERE id LIKE ? ORDER BY datetime DESC').all(`%${q}%`)
    : db.prepare('SELECT * FROM sales ORDER BY datetime DESC').all()

  // Attach sale items to each sale record so the frontend can render items in the history list
  const getItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?')
  const output = sales.map((s) => {
    const items = getItems.all(s.id)
    return { ...s, items }
  })

  res.json(output)
})

app.get('/api/sales/:id', (req, res) => {
  const id = req.params.id
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id)
  if (!sale) return res.status(404).json({ error: 'Not found' })
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id)
  res.json({ ...sale, items })
})

app.post('/api/sales', (req, res) => {
  const { items, total } = req.body
  const id = `ORD-${Date.now()}`
  const datetime = new Date().toISOString()
  const insertSale = db.prepare('INSERT INTO sales (id, datetime, total) VALUES (?, ?, ?)')
  const insertItem = db.prepare('INSERT INTO sale_items (sale_id, product_id, name, sku, price, qty, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?')
  const transaction = db.transaction(() => {
    insertSale.run(id, datetime, total)
    for (const it of items) {
      insertItem.run(id, it.id || null, it.name, it.sku, it.price, it.qty, it.subtotal)
      if (it.id) updateStock.run(it.qty, it.id)
    }
  })
  try {
    transaction()
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id)
    const saleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id)
    res.json({ ...sale, items: saleItems })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Serve frontend production build if available
const distDir = path.join(root, 'dist')
console.log('distDir:', distDir, 'exists:', fs.existsSync(distDir))
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.use((req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}
// Debug: list registered routes/middleware
if (app._router && app._router.stack) {
  console.log('--- Express router stack ---')
  app._router.stack.forEach((layer, i) => {
    try {
      const name = layer.name || '<anonymous>'
      const path = layer.regexp && layer.regexp.source ? layer.regexp.source : layer.route ? layer.route.path : ''
      console.log(i, name, path)
    } catch (e) {
      console.log('Error listing layer', i)
    }
  })
  console.log('----------------------------')
}

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}, DB at ${dbPath}`)
})
