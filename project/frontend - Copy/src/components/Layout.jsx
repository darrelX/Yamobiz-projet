import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard, ShoppingCart, Package, CreditCard,
  BarChart3, MessageSquare, LogOut, Menu, X, ChevronRight
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/sales', icon: ShoppingCart, label: 'Ventes' },
  { to: '/stock', icon: Package, label: 'Stock' },
  { to: '/credits', icon: CreditCard, label: 'Créances' },
  { to: '/reports', icon: BarChart3, label: 'Rapports' },
  { to: '/simulator', icon: MessageSquare, label: 'Simulateur Bot' },
]

export default function Layout() {
  const { business, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full z-30 w-64 bg-navy-900 flex flex-col
        transform transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center font-bold text-white text-sm">YB</div>
          <div>
            <div className="font-bold text-white text-sm">YamoBiz</div>
            <div className="text-xs text-brand-400">{business?.plan === 'premium' ? 'Premium' : 'Standard'}</div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-white/60 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Business info */}
        <div className="px-4 py-4 border-b border-white/10">
          <div className="bg-white/5 rounded-xl px-4 py-3">
            <p className="text-white font-semibold text-sm truncate">{business?.name || 'Mon Commerce'}</p>
            <p className="text-white/50 text-xs mt-0.5">{business?.city} · {business?.sector || 'Commerce'}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
                ${isActive
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/30'
                  : 'text-white/60 hover:text-white hover:bg-white/8'
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
              <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-50 transition-opacity" />
            </NavLink>
          ))}
        </nav>

        {/* Sign out */}
        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-red-400 hover:bg-red-400/10 transition-all duration-200"
          >
            <LogOut size={18} />
            <span>Deconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-4 lg:px-8 py-4 flex items-center gap-4 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
              <span className="text-brand-700 font-semibold text-xs">{business?.name?.[0] || 'Y'}</span>
            </div>
            <span className="text-sm font-medium text-gray-700 hidden sm:block">{business?.name || 'Mon Commerce'}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
