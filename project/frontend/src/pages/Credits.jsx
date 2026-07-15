import { useEffect, useState } from 'react'
import { X, CreditCard, Search, CheckCircle, Clock, AlertTriangle } from 'lucide-react'
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

// Le schéma réel utilise la table `debts` (pas `credits`), avec un statut
// 'unpaid' / 'partial' / 'paid' (pas 'pending').
const STATUS_MAP = {
  unpaid: { label: 'En attente', icon: Clock, cls: 'bg-orange-100 text-orange-700' },
  partial: { label: 'Partiel', icon: AlertTriangle, cls: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Soldé', icon: CheckCircle, cls: 'bg-green-100 text-green-700' },
}

export default function Credits() {
  const { business } = useAuth()
  const [debts, setDebts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showPayModal, setShowPayModal] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    if (business?.id) load()
    else setLoading(false)
  }, [business])

  async function load() {
    setLoading(true)
    // debts n'a pas de customer_name/customer_phone/description en colonnes
    // directes — le client vient de la table customers via customer_id.
    const { data } = await supabase
      .from('debts')
      .select('*, customers(name, phone)')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
    setDebts(data || [])
    setLoading(false)
  }

  async function handlePayment(debt) {
    const amt = Number(payAmount)
    if (!amt || amt <= 0) return
    const newPaid = Math.min(debt.amount_total, debt.amount_paid + amt)
    const newStatus = newPaid >= debt.amount_total ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid'
    await supabase.from('debts').update({ amount_paid: newPaid, status: newStatus, updated_at: new Date().toISOString() }).eq('id', debt.id)
    setShowPayModal(null)
    setPayAmount('')
    await load()
  }

  const filtered = debts.filter(d => {
    const matchSearch = !search || d.customers?.name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || d.status === filterStatus
    return matchSearch && matchStatus
  })

  const totalPending = debts.filter(d => d.status !== 'paid').reduce((a, d) => a + (d.amount_total - d.amount_paid), 0)
  const totalPaid = debts.filter(d => d.status === 'paid').reduce((a, d) => a + d.amount_total, 0)

  function isOverdue(debt) {
    return debt.due_date && debt.status !== 'paid' && new Date(debt.due_date) < new Date()
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900">Créances clients</h1>
          <p className="text-gray-400 text-sm mt-0.5">{debts.filter(d => d.status !== 'paid').length} créance{debts.filter(d => d.status !== 'paid').length > 1 ? 's' : ''} ouverte{debts.filter(d => d.status !== 'paid').length > 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Info : les créances naissent des ventes à crédit */}
      <div className="flex items-start gap-2.5 bg-brand-50 border border-brand-100 rounded-xl px-4 py-3">
        <CreditCard size={14} className="text-brand-600 mt-0.5 flex-shrink-0" />
        <p className="text-brand-700 text-xs leading-relaxed">
          Les créances sont créées automatiquement lors d'une vente enregistrée en "Crédit" (page Ventes). Il n'y a pas de saisie manuelle ici.
        </p>
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
          {[['all', 'Tous'], ['unpaid', 'En attente'], ['partial', 'Partiel'], ['paid', 'Soldés']].map(([v, l]) => (
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

      {/* Debts list */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
          <CreditCard size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium text-sm">Aucune créance trouvée</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(debt => {
            const { label, icon: Icon, cls } = STATUS_MAP[debt.status]
            const remaining = debt.amount_total - debt.amount_paid
            const pct = (debt.amount_paid / debt.amount_total) * 100
            const overdue = isOverdue(debt)
            return (
              <div key={debt.id} className={`bg-white rounded-2xl border p-5 hover:shadow-sm transition-all ${overdue ? 'border-red-200' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-navy-900">{debt.customers?.name || 'Client'}</h3>
                      {overdue && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">En retard</span>}
                    </div>
                    {debt.customers?.phone && <p className="text-xs text-gray-400 mt-0.5">{debt.customers.phone}</p>}
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
                  <span className="text-xs text-gray-400">Total: {debt.amount_total.toLocaleString()} FCFA</span>
                </div>

                <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                  <div className="h-1.5 bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    {debt.due_date ? `Échéance: ${new Date(debt.due_date).toLocaleDateString('fr-FR')}` : 'Sans échéance'}
                  </p>
                  {debt.status !== 'paid' && (
                    <button
                      onClick={() => { setShowPayModal(debt); setPayAmount(String(remaining)) }}
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
                <p className="text-sm font-medium text-navy-900">{showPayModal.customers?.name || 'Client'}</p>
                <p className="text-xs text-gray-400 mt-0.5">Reste dû: {(showPayModal.amount_total - showPayModal.amount_paid).toLocaleString()} FCFA</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Montant reçu (FCFA)</label>
                <input
                  type="number"
                  min="1"
                  max={showPayModal.amount_total - showPayModal.amount_paid}
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
