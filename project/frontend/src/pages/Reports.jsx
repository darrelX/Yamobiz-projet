import { useEffect, useState } from 'react'
import { BarChart3, TrendingUp, Download, Calendar } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const COLORS = ['#16a34a', '#f59e0b', '#3b82f6']

const MONTHS_FR = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']

function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

export default function Reports() {
  const { business } = useAuth()
  const [period, setPeriod] = useState('month') // month | quarter | year
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState(null)

  useEffect(() => {
    if (business?.id) loadReport()
    else setLoading(false)
  }, [business, period])

  async function loadReport() {
    setLoading(true)
    const now = new Date()
    let startDate

    if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    } else if (period === 'quarter') {
      const q = Math.floor(now.getMonth() / 3)
      startDate = new Date(now.getFullYear(), q * 3, 1)
    } else {
      startDate = new Date(now.getFullYear(), 0, 1)
    }

    // sales.total_amount (pas total), pas de table `credits` (c'est
    // `debts`, amount_total/amount_paid), products.stock_quantity, et
    // payment_type n'a que 'cash'/'credit' (pas de 'momo').
    const [salesRes, debtsRes, productsRes] = await Promise.all([
      supabase.from('sales').select('total_amount, payment_type, created_at').eq('business_id', business.id).gte('created_at', startDate.toISOString()),
      supabase.from('debts').select('amount_total, amount_paid, status').eq('business_id', business.id),
      supabase.from('products').select('name, stock_quantity, price').eq('business_id', business.id),
    ])

    const sales = salesRes.data || []
    const debts = debtsRes.data || []
    const products = productsRes.data || []

    const cashSales = sales.filter(s => s.payment_type === 'cash')
    const creditSales = sales.filter(s => s.payment_type === 'credit')
    const cashTotal = cashSales.reduce((a, s) => a + (s.total_amount || 0), 0)
    const creditTotal = creditSales.reduce((a, s) => a + (s.total_amount || 0), 0)
    const caTotal = cashTotal + creditTotal

    const pendingCredits = debts.filter(d => d.status !== 'paid').reduce((a, d) => a + ((d.amount_total || 0) - (d.amount_paid || 0)), 0)
    const recoveredCredits = debts.filter(d => d.status === 'paid').reduce((a, d) => a + d.amount_total, 0)

    const stockValue = products.reduce((a, p) => a + p.stock_quantity * p.price, 0)

    // Monthly breakdown for the year
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const month = i
      const year = now.getFullYear()
      const monthSales = sales.filter(s => {
        const d = new Date(s.created_at)
        return d.getFullYear() === year && d.getMonth() === month
      })
      return {
        name: MONTHS_FR[i],
        cash: monthSales.filter(s => s.payment_type !== 'credit').reduce((a, s) => a + (s.total_amount || 0), 0),
        credit: monthSales.filter(s => s.payment_type === 'credit').reduce((a, s) => a + (s.total_amount || 0), 0),
      }
    }).slice(0, now.getMonth() + 1)

    // Payment type pie
    const pieData = [
      { name: 'Cash', value: cashSales.length || 0 },
      { name: 'Crédit', value: creditSales.length || 0 },
    ].filter(d => d.value > 0)

    setReport({ caTotal, cashTotal, creditTotal, pendingCredits, recoveredCredits, stockValue, monthlyData, pieData, totalTransactions: sales.length })
    setLoading(false)
  }

  const periodLabel = period === 'month' ? 'Ce mois' : period === 'quarter' ? 'Ce trimestre' : 'Cette année'

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900">Rapport financier</h1>
          <p className="text-gray-400 text-sm mt-0.5">{business?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-xl p-1">
            {[['month', 'Mois'], ['quarter', 'Trimestre'], ['year', 'Année']].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setPeriod(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${period === v ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : !report ? null : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'CA Total', value: `${report.caTotal.toLocaleString()} FCFA`, sub: periodLabel, color: 'text-brand-600 bg-brand-50' },
              { label: 'Encaissé', value: `${report.cashTotal.toLocaleString()} FCFA`, sub: 'Ventes cash', color: 'text-green-600 bg-green-50' },
              { label: 'Créances ouvertes', value: `${report.pendingCredits.toLocaleString()} FCFA`, sub: 'À recouvrer', color: 'text-orange-600 bg-orange-50' },
              { label: 'Valeur du stock', value: `${report.stockValue.toLocaleString()} FCFA`, sub: 'Tous produits', color: 'text-blue-600 bg-blue-50' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5">
                <p className="text-xs text-gray-400 mb-2">{label}</p>
                <p className="text-xl font-bold text-navy-900">{value}</p>
                <p className="text-xs text-gray-400 mt-1">{sub}</p>
              </div>
            ))}
          </div>

          {/* Financial health score */}
          <div className="bg-gradient-to-r from-navy-900 to-navy-800 rounded-2xl p-6 text-white">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-semibold text-base mb-1">Bilan de santé financière</h2>
                <p className="text-white/60 text-xs">{periodLabel} · {report.totalTransactions} transaction{report.totalTransactions > 1 ? 's' : ''}</p>
              </div>
              <div className="bg-white/10 rounded-xl px-4 py-2 text-center">
                <p className="text-2xl font-bold text-brand-400">
                  {report.caTotal > 0 ? Math.round((report.cashTotal / report.caTotal) * 100) : 0}%
                </p>
                <p className="text-xs text-white/50">Cash rate</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-white/50 mb-1">Taux recouvrement</p>
                <p className="font-bold text-white">
                  {(report.pendingCredits + report.recoveredCredits) > 0
                    ? Math.round((report.recoveredCredits / (report.pendingCredits + report.recoveredCredits)) * 100)
                    : 100}%
                </p>
              </div>
              <div>
                <p className="text-xs text-white/50 mb-1">Ventes / jour</p>
                <p className="font-bold text-white">
                  {report.totalTransactions > 0 ? (report.totalTransactions / 30).toFixed(1) : 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/50 mb-1">Panier moyen</p>
                <p className="font-bold text-white">
                  {report.totalTransactions > 0 ? Math.round(report.caTotal / report.totalTransactions).toLocaleString() : 0} FCFA
                </p>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-5 gap-6">
            {/* Bar chart */}
            <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-semibold text-navy-900 text-sm mb-5">Ventes par mois — {new Date().getFullYear()}</h2>
              {report.monthlyData.some(d => d.cash > 0 || d.credit > 0) ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={report.monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                      formatter={v => [`${v.toLocaleString()} FCFA`]}
                    />
                    <Bar dataKey="cash" name="Cash" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="credit" name="Crédit" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-52 flex items-center justify-center text-gray-200">
                  <div className="text-center">
                    <BarChart3 size={36} className="mx-auto mb-2" />
                    <p className="text-sm">Pas encore de données</p>
                  </div>
                </div>
              )}
            </div>

            {/* Pie chart */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-semibold text-navy-900 text-sm mb-5">Modes de paiement</h2>
              {report.pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={report.pieData} cx="50%" cy="45%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                      {report.pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-52 flex items-center justify-center text-gray-200">
                  <div className="text-center">
                    <TrendingUp size={36} className="mx-auto mb-2" />
                    <p className="text-sm">Pas encore de données</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* YamoBiz message */}
          <div className="bg-brand-50 border border-brand-100 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-xs">YB</div>
              <div>
                <p className="font-semibold text-brand-800 text-sm mb-1">Conseil YamoBiz</p>
                <p className="text-brand-700 text-sm leading-relaxed">
                  {report.pendingCredits > 0
                    ? `Vous avez ${report.pendingCredits.toLocaleString()} FCFA de créances non recouvrées. Envoyez un message WhatsApp à vos clients débiteurs pour accélérer le recouvrement.`
                    : report.caTotal === 0
                    ? 'Aucune vente cette période. Commencez par enregistrer votre première vente depuis la section Ventes.'
                    : `Bravo ! Votre taux d'encaissement est de ${report.caTotal > 0 ? Math.round((report.cashTotal / report.caTotal) * 100) : 0}%. Continuez à utiliser YamoBiz pour suivre vos performances.`
                  }
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
