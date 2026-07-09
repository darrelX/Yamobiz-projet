import { useEffect, useState } from 'react'
import { Plus, X, Trash2, ShoppingCart, Search, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const PAYMENT_LABELS = { cash: 'Cash', credit: 'Crédit', momo: 'MoMo' }
const PAYMENT_COLORS = {
  cash: 'bg-green-100 text-green-700',
  credit: 'bg-orange-100 text-orange-700',
  momo: 'bg-blue-100 text-blue-700',
}

function Modal({ open, onClose, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {children}
      </div>
    </div>
  )
}

export default function Sales() {
  const { business } = useAuth()
  const [sales, setSales] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  // New sale form
  const [form, setForm] = useState({
    customer_name: '',
    payment_type: 'cash',
    notes: '',
    items: [{ product_id: '', product_name: '', qty: 1, unit_price: 0 }],
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (business?.id) loadData()
  }, [business])

  async function loadData() {
    setLoading(true)
    const [salesRes, productsRes] = await Promise.all([
      supabase.from('sales').select('*, sale_items(*)').eq('business_id', business.id).order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('business_id', business.id).order('name'),
    ])
    setSales(salesRes.data || [])
    setProducts(productsRes.data || [])
    setLoading(false)
  }

  function addItem() {
    setForm(f => ({ ...f, items: [...f.items, { product_id: '', product_name: '', qty: 1, unit_price: 0 }] }))
  }

  function removeItem(i) {
    setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))
  }

  function updateItem(i, field, value) {
    setForm(f => {
      const items = [...f.items]
      items[i] = { ...items[i], [field]: value }
      if (field === 'product_id' && value) {
        const prod = products.find(p => p.id === value)
        if (prod) {
          items[i].product_name = prod.name
          items[i].unit_price = prod.price
        }
      }
      return { ...f, items }
    })
  }

  const total = form.items.reduce((s, item) => s + (Number(item.qty) * Number(item.unit_price)), 0)

  async function handleSave(e) {
    e.preventDefault()
    setFormError('')
    const validItems = form.items.filter(i => i.product_name && Number(i.qty) > 0 && Number(i.unit_price) > 0)
    if (validItems.length === 0) { setFormError('Ajoutez au moins un article valide.'); return }

    setSaving(true)
    try {
      const saleTotal = validItems.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0)

      const { data: saleData, error: saleErr } = await supabase.from('sales').insert({
        business_id: business.id,
        customer_name: form.customer_name || 'Client anonyme',
        payment_type: form.payment_type,
        total: saleTotal,
        notes: form.notes,
      }).select().single()

      if (saleErr) throw saleErr

      const lineItems = validItems.map(i => ({
        sale_id: saleData.id,
        product_id: i.product_id || null,
        product_name: i.product_name,
        qty: Number(i.qty),
        unit_price: Number(i.unit_price),
        subtotal: Number(i.qty) * Number(i.unit_price),
      }))
      await supabase.from('sale_items').insert(lineItems)

      // Deduct stock
      for (const item of validItems) {
        if (item.product_id) {
          const prod = products.find(p => p.id === item.product_id)
          if (prod) {
            await supabase.from('products').update({ stock_qty: Math.max(0, prod.stock_qty - Number(item.qty)) }).eq('id', item.product_id)
          }
        }
      }

      // If credit, create credit record
      if (form.payment_type === 'credit' && form.customer_name) {
        await supabase.from('credits').insert({
          business_id: business.id,
          sale_id: saleData.id,
          customer_name: form.customer_name,
          amount: saleTotal,
          amount_paid: 0,
          status: 'pending',
          due_date: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10),
        })
      }

      setShowModal(false)
      setForm({ customer_name: '', payment_type: 'cash', notes: '', items: [{ product_id: '', product_name: '', qty: 1, unit_price: 0 }] })
      await loadData()
    } catch (err) {
      setFormError(err.message || 'Erreur lors de l\'enregistrement.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteSale(id) {
    if (!confirm('Supprimer cette vente ?')) return
    await supabase.from('sales').delete().eq('id', id)
    setSales(s => s.filter(x => x.id !== id))
  }

  const filtered = sales.filter(s => {
    const matchSearch = !search || s.customer_name?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || s.payment_type === filter
    return matchSearch && matchFilter
  })

  const totalCA = sales.filter(s => s.payment_type !== 'credit').reduce((a, s) => a + (s.total || 0), 0)
  const totalCredit = sales.filter(s => s.payment_type === 'credit').reduce((a, s) => a + (s.total || 0), 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900">Ventes</h1>
          <p className="text-gray-400 text-sm mt-0.5">{sales.length} transaction{sales.length > 1 ? 's' : ''} enregistrée{sales.length > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-medium px-4 py-2.5 rounded-xl text-sm transition-colors"
        >
          <Plus size={16} />
          Nouvelle vente
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-1">CA encaissé</p>
          <p className="text-xl font-bold text-green-600">{totalCA.toLocaleString()} FCFA</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-1">Ventes à crédit</p>
          <p className="text-xl font-bold text-orange-600">{totalCredit.toLocaleString()} FCFA</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-400 mb-1">Total général</p>
          <p className="text-xl font-bold text-navy-900">{(totalCA + totalCredit).toLocaleString()} FCFA</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          />
        </div>
        <div className="flex gap-2">
          {[['all', 'Tous'], ['cash', 'Cash'], ['credit', 'Crédit'], ['momo', 'MoMo']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${filter === v ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Sales list */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
          <ShoppingCart size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium text-sm">Aucune vente trouvée</p>
          <button onClick={() => setShowModal(true)} className="mt-3 text-brand-600 text-sm font-medium hover:underline">Enregistrer la première vente</button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Date</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Client</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Articles</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Paiement</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Montant</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(sale => (
                  <tr key={sale.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">
                      {new Date(sale.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-navy-900">{sale.customer_name || '—'}</td>
                    <td className="px-5 py-3.5 text-gray-500 hidden sm:table-cell">
                      {sale.sale_items?.length || 0} article{(sale.sale_items?.length || 0) > 1 ? 's' : ''}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${PAYMENT_COLORS[sale.payment_type]}`}>
                        {PAYMENT_LABELS[sale.payment_type]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-navy-900">
                      {(sale.total || 0).toLocaleString()} FCFA
                    </td>
                    <td className="px-3 py-3.5">
                      <button onClick={() => deleteSale(sale.id)} className="p-1.5 text-gray-300 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New sale modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <form onSubmit={handleSave}>
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="font-bold text-navy-900 text-lg">Nouvelle vente</h2>
            <button type="button" onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {formError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{formError}</div>}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Client</label>
                <input
                  type="text"
                  value={form.customer_name}
                  onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                  placeholder="Nom du client"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Mode de paiement</label>
                <select
                  value={form.payment_type}
                  onChange={e => setForm(f => ({ ...f, payment_type: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  <option value="cash">Cash</option>
                  <option value="credit">Crédit</option>
                  <option value="momo">Mobile Money</option>
                </select>
              </div>
            </div>

            {/* Line items */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Articles vendus</label>
              <div className="space-y-2">
                {form.items.map((item, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-5 gap-2">
                      {products.length > 0 ? (
                        <select
                          value={item.product_id}
                          onChange={e => updateItem(i, 'product_id', e.target.value)}
                          className="col-span-2 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                        >
                          <option value="">Produit libre</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      ) : (
                        <input
                          value={item.product_name}
                          onChange={e => updateItem(i, 'product_name', e.target.value)}
                          placeholder="Produit"
                          className="col-span-2 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      )}
                      {item.product_id === '' && products.length > 0 && (
                        <input
                          value={item.product_name}
                          onChange={e => updateItem(i, 'product_name', e.target.value)}
                          placeholder="Description"
                          className="col-span-2 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      )}
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={item.qty}
                        onChange={e => updateItem(i, 'qty', e.target.value)}
                        placeholder="Qté"
                        className="col-span-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <input
                        type="number"
                        min="0"
                        value={item.unit_price}
                        onChange={e => updateItem(i, 'unit_price', e.target.value)}
                        placeholder="Prix"
                        className="col-span-2 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    {form.items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)} className="p-2 text-gray-300 hover:text-red-400 mt-0.5">
                        <X size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addItem} className="mt-2 flex items-center gap-1.5 text-brand-600 text-xs font-medium hover:text-brand-700">
                <Plus size={14} />
                Ajouter un article
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes (optionnel)</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Remarques..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
            </div>
          </div>

          <div className="px-6 pb-6 flex items-center justify-between gap-4 border-t border-gray-100 pt-5">
            <div>
              <p className="text-xs text-gray-400">Total</p>
              <p className="text-xl font-bold text-navy-900">{total.toLocaleString()} FCFA</p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60 transition-colors"
              >
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                Enregistrer
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
