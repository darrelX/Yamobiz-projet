import { useEffect, useState } from 'react'
import { Plus, X, Edit2, Package, AlertTriangle, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function Modal({ open, onClose, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl">
        {children}
      </div>
    </div>
  )
}

const UNITS = ['unité', 'kg', 'g', 'litre', 'cl', 'sac', 'carton', 'boîte', 'pièce', 'mètre']

const defaultProduct = { name: '', unit: 'unité', price: '', stock_qty: '', stock_alert: '5' }

export default function Stock() {
  const { business } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(defaultProduct)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterAlert, setFilterAlert] = useState(false)

  useEffect(() => {
    if (business?.id) load()
  }, [business])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('products').select('*').eq('business_id', business.id).order('name')
    setProducts(data || [])
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm(defaultProduct)
    setShowModal(true)
  }

  function openEdit(product) {
    setEditing(product)
    setForm({
      name: product.name,
      unit: product.unit,
      price: String(product.price),
      stock_qty: String(product.stock_qty),
      stock_alert: String(product.stock_alert),
    })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      business_id: business.id,
      name: form.name,
      unit: form.unit,
      price: Number(form.price),
      stock_qty: Number(form.stock_qty),
      stock_alert: Number(form.stock_alert),
    }
    if (editing) {
      await supabase.from('products').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('products').insert(payload)
    }
    setSaving(false)
    setShowModal(false)
    await load()
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer ce produit ?')) return
    await supabase.from('products').delete().eq('id', id)
    setProducts(p => p.filter(x => x.id !== id))
  }

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
    const matchAlert = !filterAlert || p.stock_qty <= p.stock_alert
    return matchSearch && matchAlert
  })

  const alertCount = products.filter(p => p.stock_qty <= p.stock_alert).length
  const stockValue = products.reduce((a, p) => a + p.stock_qty * p.price, 0)

  function stockStatus(p) {
    if (p.stock_qty === 0) return { label: 'Rupture', cls: 'bg-red-100 text-red-700' }
    if (p.stock_qty <= p.stock_alert) return { label: 'Stock faible', cls: 'bg-amber-100 text-amber-700' }
    return { label: 'En stock', cls: 'bg-green-100 text-green-700' }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900">Stock</h1>
          <p className="text-gray-400 text-sm mt-0.5">{products.length} produit{products.length > 1 ? 's' : ''} enregistré{products.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-medium px-4 py-2.5 rounded-xl text-sm transition-colors">
          <Plus size={16} />
          Nouveau produit
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-1">Produits</p>
          <p className="text-xl font-bold text-navy-900">{products.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-1">Valeur stock</p>
          <p className="text-xl font-bold text-navy-900">{stockValue.toLocaleString()} <span className="text-sm text-gray-400">FCFA</span></p>
        </div>
        <div className={`rounded-2xl border p-4 ${alertCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
          <p className="text-xs text-gray-400 mb-1">Alertes stock</p>
          <p className={`text-xl font-bold ${alertCount > 0 ? 'text-amber-700' : 'text-gray-300'}`}>{alertCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          />
        </div>
        <button
          onClick={() => setFilterAlert(v => !v)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${filterAlert ? 'bg-amber-500 text-white border-amber-500' : 'bg-white border-gray-200 text-gray-600'}`}
        >
          <AlertTriangle size={14} />
          Alertes
        </button>
      </div>

      {/* Product grid */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
          <Package size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium text-sm">Aucun produit trouvé</p>
          <button onClick={openNew} className="mt-3 text-brand-600 text-sm font-medium hover:underline">Ajouter le premier produit</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => {
            const status = stockStatus(p)
            const pct = p.stock_alert > 0 ? Math.min(100, (p.stock_qty / (p.stock_alert * 3)) * 100) : 100
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-navy-900 truncate">{p.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{p.unit}</p>
                  </div>
                  <span className={`ml-2 text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${status.cls}`}>{status.label}</span>
                </div>

                <div className="flex items-end justify-between mb-3">
                  <div>
                    <p className="text-2xl font-bold text-navy-900">{p.stock_qty.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{p.unit}</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-600">{p.price.toLocaleString()} FCFA</p>
                </div>

                <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
                  <div
                    className={`h-1.5 rounded-full transition-all ${p.stock_qty === 0 ? 'bg-red-400' : p.stock_qty <= p.stock_alert ? 'bg-amber-400' : 'bg-brand-500'}`}
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </div>

                <div className="flex gap-2">
                  <button onClick={() => openEdit(p)} className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-brand-300 hover:text-brand-600 transition-colors">
                    <Edit2 size={13} />
                    Modifier
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-2 border border-gray-200 rounded-xl text-gray-400 hover:border-red-200 hover:text-red-500 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <form onSubmit={handleSave}>
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="font-bold text-navy-900 text-lg">{editing ? 'Modifier le produit' : 'Nouveau produit'}</h2>
            <button type="button" onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
              <X size={18} />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Nom du produit *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Sac de riz 50kg"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Unité</label>
                <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Prix de vente (FCFA)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="0"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Quantité en stock</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.stock_qty}
                  onChange={e => setForm(f => ({ ...f, stock_qty: e.target.value }))}
                  placeholder="0"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Alerte stock bas</label>
                <input
                  type="number"
                  min="0"
                  value={form.stock_alert}
                  onChange={e => setForm(f => ({ ...f, stock_alert: e.target.value }))}
                  placeholder="5"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>
          <div className="px-6 pb-6 flex gap-3 border-t border-gray-100 pt-5">
            <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 text-gray-700 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50">Annuler</button>
            <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-60 transition-colors">
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {editing ? 'Modifier' : 'Ajouter'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
