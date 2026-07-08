import { useEffect, useState } from 'react'
import { Plus, X, CreditCard, Search, CheckCircle, Clock, AlertTriangle } from 'lucide-react'
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

const STATUS_MAP = {
  pending: { label: 'En attente', icon: Clock, cls: 'bg-orange-100 text-orange-700' },
  partial: { label: 'Partiel', icon: AlertTriangle, cls: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Soldé', icon: CheckCircle, cls: 'bg-green-100 text-green-700' },
}

export default function Credits() {
  const { business } = useAuth()
  const [credits, setCredits] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showPayModal, setShowPayModal] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [form, setForm] = useState({ customer_name: '', customer_phone: '', amount: '', description: '', due_date: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (business?.id) load()
  }, [business])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('credits').select('*').eq('business_id', business.id).order('created_at', { ascending: false })
    setCredits(data || [])
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('credits').insert({
      business_id: business.id,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      amount: Number(form.amount),
      amount_paid: 0,
      description: form.description,
      due_date: form.due_date || null,
      status: 'pending',
    })
    setSaving(false)
    setShowModal(false)
    setForm({ customer_name: '', customer_phone: '', amount: '', description: '', due_date: '' })
    await load()
  }

  async function handlePayment(credit) {
    const amt = Number(payAmount)
    if (!amt || amt <= 0) return
    const newPaid = Math.min(credit.amount, credit.amount_paid + amt)
    const newStatus = newPaid >= credit.amount ? 'paid' : newPaid > 0 ? 'partial' : 'pending'
    await supabase.from('credits').update({ amount_paid: newPaid, status: newStatus, updated_at: new Date().toISOString() }).eq('id', credit.id)
    setShowPayModal(null)
    setPayAmount('')
    await load()
  }

  const filtered = credits.filter(c => {
    const matchSearch = !search || c.customer_name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || c.status === filterStatus
    return matchSearch && matchStatus
  })

  const totalPending = credits.filter(c => c.status !== 'paid').reduce((a, c) => a + (c.amount - c.amount_paid), 0)
  const totalPaid = credits.filter(c => c.status === 'paid').reduce((a, c) => a + c.amount, 0)

  function isOverdue(credit) {
    return credit.due_date && credit.status !== 'paid' && new Date(credit.due_date) < new Date()
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900">Créances clients</h1>
          <p className="text-gray-400 text-sm mt-0.5">{credits.filter(c => c.status !== 'paid').length} créance{credits.filter(c => c.status !== 'paid').length > 1 ? 's' : ''} ouverte{credits.filter(c => c.status !== 'paid').length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-medium px-4 py-2.5 rounded-xl text-sm transition-colors">
          <Plus size={16} />
          Nouvelle créance
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5">
          <p className="text-xs text-orange-500 font-medium mb-1">Total à recouvrer</p>
          <p className="text-2xl font-bold text-orange-700">{totalPending.toLocaleString()} FCFA</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-2xl p-5">
          <p className="text-xs text-green-600 font-medium mb-1">Total récupéré</p>
          <p className="text-2xl font-bold text-green-700">{totalPaid.toLocaleString()} FCFA</p>
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
          {[['all', 'Tous'], ['pending', 'En attente'], ['partial', 'Partiel'], ['paid', 'Soldés']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilterStatus(v)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${filterStatus === v ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Credits list */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
          <CreditCard size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium text-sm">Aucune créance trouvée</p>
          <button onClick={() => setShowModal(true)} className="mt-3 text-brand-600 text-sm font-medium hover:underline">Enregistrer une créance</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(credit => {
            const { label, icon: Icon, cls } = STATUS_MAP[credit.status]
            const remaining = credit.amount - credit.amount_paid
            const pct = (credit.amount_paid / credit.amount) * 100
            const overdue = isOverdue(credit)
            return (
              <div key={credit.id} className={`bg-white rounded-2xl border p-5 hover:shadow-sm transition-all ${overdue ? 'border-red-200' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-navy-900">{credit.customer_name}</h3>
                      {overdue && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">En retard</span>}
                    </div>
                    {credit.customer_phone && <p className="text-xs text-gray-400 mt-0.5">{credit.customer_phone}</p>}
                    {credit.description && <p className="text-xs text-gray-500 mt-1">{credit.description}</p>}
                  </div>
                  <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${cls}`}>
                    <Icon size={11} />
                    {label}
                  </span>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-lg font-bold text-navy-900">{remaining.toLocaleString()} FCFA</span>
                    <span className="text-gray-400 text-xs ml-1.5">restants</span>
                  </div>
                  <span className="text-xs text-gray-400">Total: {credit.amount.toLocaleString()} FCFA</span>
                </div>

                <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                  <div className="h-1.5 bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    {credit.due_date ? `Échéance: ${new Date(credit.due_date).toLocaleDateString('fr-FR')}` : 'Sans échéance'}
                  </p>
                  {credit.status !== 'paid' && (
                    <button
                      onClick={() => { setShowPayModal(credit); setPayAmount(String(remaining)) }}
                      className="flex items-center gap-1.5 text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <CheckCircle size={12} />
                      Enregistrer paiement
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New credit modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <form onSubmit={handleSave}>
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="font-bold text-navy-900 text-lg">Nouvelle créance</h2>
            <button type="button" onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl"><X size={18} /></button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Nom du client *</label>
              <input type="text" required value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Marie Mbongo" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Téléphone (pour relances SMS)</label>
              <input type="tel" value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} placeholder="+237 6XX XXX XXX" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Montant (FCFA) *</label>
                <input type="number" min="1" required value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Date d'échéance</label>
                <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Description</label>
              <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: 3 sacs de riz, livraison" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div className="px-6 pb-6 flex gap-3 border-t border-gray-100 pt-5">
            <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 text-gray-700 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50">Annuler</button>
            <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-60">
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>

      {/* Payment modal */}
      <Modal open={!!showPayModal} onClose={() => setShowPayModal(null)}>
        {showPayModal && (
          <div>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-bold text-navy-900 text-lg">Enregistrer un paiement</h2>
              <button onClick={() => setShowPayModal(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-medium text-navy-900">{showPayModal.customer_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">Reste dû: {(showPayModal.amount - showPayModal.amount_paid).toLocaleString()} FCFA</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Montant reçu (FCFA)</label>
                <input
                  type="number"
                  min="1"
                  max={showPayModal.amount - showPayModal.amount_paid}
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3 border-t border-gray-100 pt-5">
              <button onClick={() => setShowPayModal(null)} className="flex-1 border border-gray-200 text-gray-700 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50">Annuler</button>
              <button onClick={() => handlePayment(showPayModal)} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-xl text-sm">Valider</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
