import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, UserPlus } from 'lucide-react'

const cities = ['Douala', 'Yaoundé', 'Bafoussam', 'Garoua', 'Bamenda', 'Maroua', 'Ngaoundéré']
const sectors = ['Commerce général', 'Alimentation / Restauration', 'Mode / Textile', 'Électronique', 'Agriculture', 'BTP / Matériaux', 'Santé / Pharmacie', 'Autre']

export default function Register() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    city: 'Douala',
    sector: 'Commerce général',
    plan: 'standard',
  })
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (step === 1) { setStep(2); return }
    setError('')
    setLoading(true)
    try {
      await signUp(form.email, form.password, {
        name: form.name,
        phone: form.phone,
        city: form.city,
        sector: form.sector,
        plan: form.plan,
      })
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'inscription.')
      setStep(1)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-700 to-brand-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-gold-600/20 via-transparent to-transparent" />
        <div className="relative z-10 flex flex-col justify-center px-16">
          <Link to="/" className="flex items-center gap-2.5 mb-16">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-bold text-white text-sm">YB</div>
            <span className="font-bold text-white text-xl">YamoBiz</span>
          </Link>
          <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
            Commencez votre<br />
            <span className="text-gold-300">transformation digitale</span>
          </h2>
          <p className="text-white/70 leading-relaxed mb-8">
            30 jours gratuits. Aucune carte bancaire requise. Résiliez à tout moment.
          </p>
          <div className="bg-white/10 border border-white/20 rounded-2xl p-5">
            <p className="text-white font-semibold text-sm mb-3">Ce que vous obtenez :</p>
            {[
              '30 jours d\'essai gratuit complet',
              'Bot WhatsApp actif immédiatement',
              'Tableau de bord web inclus',
              'Support par WhatsApp',
            ].map(t => (
              <div key={t} className="flex items-center gap-2 text-white/80 text-sm py-1.5">
                <span className="text-green-300">✓</span>
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-8">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center font-bold text-white text-xs">YB</div>
            <span className="font-bold text-navy-900 text-lg">YamoBiz</span>
          </Link>

          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-8">
            {[1, 2].map(n => (
              <div key={n} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                  ${step >= n ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {n}
                </div>
                {n < 2 && <div className={`h-0.5 w-8 transition-colors ${step > n ? 'bg-brand-600' : 'bg-gray-200'}`} />}
              </div>
            ))}
            <span className="text-xs text-gray-400 ml-2">{step === 1 ? 'Compte' : 'Commerce'}</span>
          </div>

          <h1 className="text-2xl font-bold text-navy-900 mb-1">
            {step === 1 ? 'Créer mon compte' : 'Mon commerce'}
          </h1>
          <p className="text-gray-500 text-sm mb-8">
            {step === 1 ? (
              <>Déjà inscrit ? <Link to="/login" className="text-brand-600 font-medium hover:text-brand-700">Connexion</Link></>
            ) : (
              'Renseignez les informations de votre commerce'
            )}
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {step === 1 ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => update('email', e.target.value)}
                    placeholder="vous@exemple.com"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={form.password}
                      onChange={e => update('password', e.target.value)}
                      placeholder="Minimum 6 caractères"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent pr-11"
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom du commerce</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => update('name', e.target.value)}
                    placeholder="Ex: Boutique Mama Célestine"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Numéro WhatsApp</label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={e => update('phone', e.target.value)}
                    placeholder="Ex: +237 6XX XXX XXX"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-400 mt-1.5">
                    Ce numéro activera le bot WhatsApp pour votre commerce et vous permettra aussi de vous connecter sans mot de passe.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Ville</label>
                    <select
                      value={form.city}
                      onChange={e => update('city', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
                    >
                      {cities.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Secteur</label>
                    <select
                      value={form.sector}
                      onChange={e => update('sector', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
                    >
                      {sectors.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Formule</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { val: 'standard', label: 'Standard', price: '5 000 FCFA/mois' },
                      { val: 'premium', label: 'Premium', price: '10 000 FCFA/mois' },
                    ].map(({ val, label, price }) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => update('plan', val)}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          form.plan === val
                            ? 'border-brand-500 bg-brand-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className="font-semibold text-sm text-navy-900">{label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{price}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-1">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 border border-gray-200 text-gray-700 font-medium py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  Retour
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : step === 1 ? (
                  'Continuer'
                ) : (
                  <>
                    <UserPlus size={16} />
                    Créer mon compte
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
