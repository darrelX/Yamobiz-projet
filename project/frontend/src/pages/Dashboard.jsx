import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, CreditCard, Package, ShoppingCart,
  AlertTriangle, ArrowRight, Plus
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Même seuil que dans Stock.jsx — products n'a pas de colonne stock_alert.
const LOW_STOCK_THRESHOLD = 5

function formatFCFA(n) {
  if (!n) return '0 FCFA'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M FCFA`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} K FCFA`
  return `${n} FCFA`
}

function StatCard({ icon: Icon, label, value, sub, color, to }) {
  const card = (
    <div className={`bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-all duration-200 ${to ? 'cursor-pointer group' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={20} />
        </div>
        {to && <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />}
      </div>
      <p className="text-2xl font-bold text-navy-900">{value}</p>
      <p className="text-sm font-medium text-gray-600 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
  return to ? <Link to={to}>{card}</Link> : card
}

export default function Dashboard() {
  const { business } = useAuth()
  const [stats, setStats] = useState({ sales: 0, credits: 0, products: 0, lowStock: 0, cashTotal: 0, creditTotal: 0 })
  const [recentSales, setRecentSales] = useState([])
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (business?.id) loadData()
    else setLoading(false)
  }, [business])

  async function loadData() {
    setLoading(true)
    // Schéma réel : sales.total_amount (pas total), pas de sales.customer_name
    // (client via customer_id -> customers), pas de table `credits` (c'est
    // `debts`), products.stock_quantity (pas stock_qty/stock_alert).
    const [salesRes, debtsRes, productsRes, recentRes] = await Promise.all([
      supabase.from('sales').select('total_amount, payment_type, created_at').eq('business_id', business.id),
      supabase.from('debts').select('amount_total, amount_paid, status').eq('business_id', business.id),
      supabase.from('products').select('stock_quantity, name').eq('business_id', business.id),
      supabase.from('sales').select('id, total_amount, payment_type, created_at, customers(name)').eq('business_id', business.id).order('created_at', { ascending: false }).limit(5),
    ])

    const salesData = salesRes.data || []
    const debtsData = debtsRes.data || []
    const productsData = productsRes.data || []

    const cashTotal = salesData.filter(s => s.payment_type === 'cash').reduce((a, s) => a + (s.total_amount || 0), 0)
    const creditTotal = debtsData.filter(d => d.status !== 'paid').reduce((a, d) => a + ((d.amount_total || 0) - (d.amount_paid || 0)), 0)
    const lowStock = productsData.filter(p => p.stock_quantity <= LOW_STOCK_THRESHOLD).length

    setStats({
      sales: salesData.length,
      credits: debtsData.filter(d => d.status !== 'paid').length,
      products: productsData.length,
      lowStock,
      cashTotal,
      creditTotal,
    })
    setRecentSales(recentRes.data || [])

    // Build chart data — last 7 days
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      return d
    })
    const chart = days.map(d => {
      const label = d.toLocaleDateString('fr-FR', { weekday: 'short' })
      const dayStr = d.toISOString().slice(0, 10)
      const total = salesData.filter(s => s.created_at?.slice(0, 10) === dayStr).reduce((a, s) => a + (s.total_amount || 0), 0)
      return { day: label, total }
    })
    setChartData(chart)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-96">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900">Tableau de bord</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link
          to="/sales"
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-medium px-4 py-2.5 rounded-xl text-sm transition-colors"
        >
          <Plus size={16} />
          Nouvelle vente
        </Link>
      </div>

      {/* Low stock alert */}
      {stats.lowStock > 0 && (
        <Link to="/stock" className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5 hover:bg-amber-100 transition-colors group">
          <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
          <p className="text-amber-800 text-sm font-medium flex-1">
            {stats.lowStock} produit{stats.lowStock > 1 ? 's' : ''} en rupture ou stock faible
          </p>
          <ArrowRight size={16} className="text-amber-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={TrendingUp}
          label="Chiffre d'affaires"
          value={formatFCFA(stats.cashTotal)}
          sub="Ventes encaissées"
          color="text-brand-600 bg-brand-50"
          to="/sales"
        />
        <StatCard
          icon={CreditCard}
          label="Créances ouvertes"
          value={formatFCFA(stats.creditTotal)}
          sub={`${stats.credits} client${stats.credits > 1 ? 's' : ''} débiteur${stats.credits > 1 ? 's' : ''}`}
          color="text-orange-600 bg-orange-50"
          to="/credits"
        />
        <StatCard
          icon={ShoppingCart}
          label="Ventes totales"
          value={stats.sales}
          sub="Toutes périodes"
          color="text-blue-600 bg-blue-50"
          to="/sales"
        />
        <StatCard
          icon={Package}
          label="Produits en stock"
          value={stats.products}
          sub={stats.lowStock > 0 ? `${stats.lowStock} en alerte` : 'Niveaux normaux'}
          color="text-teal-600 bg-teal-50"
          to="/stock"
        />
      </div>

      {/* Chart + Recent sales */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Chart */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-navy-900 text-sm">Ventes — 7 derniers jours</h2>
              <p className="text-xs text-gray-400 mt-0.5">Chiffre d'affaires encaissé</p>
            </div>
          </div>
          {chartData.some(d => d.total > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${v/1000}K` : v} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                  formatter={v => [`${v.toLocaleString()} FCFA`, 'Ventes']}
                />
                <Area type="monotone" dataKey="total" stroke="#16a34a" strokeWidth={2.5} fill="url(#grad)" dot={{ fill: '#16a34a', r: 3 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-gray-300">
              <TrendingUp size={36} className="mb-2" />
              <p className="text-sm">Aucune vente cette semaine</p>
              <Link to="/sales" className="mt-2 text-brand-600 text-xs font-medium hover:underline">Enregistrer une vente</Link>
            </div>
          )}
        </div>

        {/* Recent sales */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-navy-900 text-sm">Ventes récentes</h2>
            <Link to="/sales" className="text-xs text-brand-600 hover:text-brand-700 font-medium">Voir tout</Link>
          </div>
          {recentSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-300">
              <ShoppingCart size={32} className="mb-2" />
              <p className="text-sm">Aucune vente</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentSales.map(sale => (
                <div key={sale.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
                    ${sale.payment_type === 'cash' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                    {sale.payment_type === 'cash' ? 'C' : 'CR'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-navy-900 truncate">{sale.customers?.name || 'Client anonyme'}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(sale.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-navy-900 flex-shrink-0">{(sale.total_amount || 0).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { to: '/sales', icon: ShoppingCart, title: 'Nouvelle vente', desc: 'Enregistrer une transaction', color: 'brand' },
          { to: '/stock', icon: Package, title: 'Mettre a jour le stock', desc: 'Ajouter ou modifier des produits', color: 'teal' },
          { to: '/simulator', icon: '💬', title: 'Tester le bot', desc: 'Simulez un message WhatsApp', color: 'gold', emoji: true },
        ].map(({ to, icon: Icon, title, desc, color, emoji }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition-all group"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
              ${color === 'brand' ? 'bg-brand-50 text-brand-600' :
                color === 'teal' ? 'bg-teal-50 text-teal-600' :
                'bg-gold-50 text-gold-600'}`}>
              {emoji ? <span className="text-xl">{Icon}</span> : <Icon size={20} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-navy-900 text-sm">{title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
            </div>
            <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
