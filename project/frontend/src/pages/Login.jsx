import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, LogIn, MessageCircle, Mail, ArrowLeft, RefreshCw } from 'lucide-react'

const RESEND_COOLDOWN = 60 // seconds

const OTP_ERROR_MESSAGES = {
  business_not_found: 'Ce numéro n\'est associé à aucun commerce YamoBiz. Créez votre compte pour l\'activer.',
  too_many_requests: 'Un code a déjà été envoyé récemment. Patientez avant d\'en redemander un.',
  no_active_code: 'Aucun code actif. Demandez-en un nouveau.',
  code_expired: 'Ce code a expiré. Demandez-en un nouveau.',
  too_many_attempts: 'Trop de tentatives. Demandez un nouveau code.',
  invalid_code: 'Code incorrect. Réessayez.',
}

function otpErrorMessage(code) {
  return OTP_ERROR_MESSAGES[code] || 'Une erreur est survenue. Réessayez.'
}

export default function Login() {
  const { signIn, requestWhatsAppOtp, verifyWhatsAppOtp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('email') // 'email' | 'whatsapp'

  // Email login state
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // WhatsApp login state
  const [waStep, setWaStep] = useState('phone') // 'phone' | 'code'
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [waError, setWaError] = useState('')
  const [waErrorCode, setWaErrorCode] = useState('')
  const [waLoading, setWaLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const codeInputRef = useRef(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown(c => c - 1), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  useEffect(() => {
    if (waStep === 'code') codeInputRef.current?.focus()
  }, [waStep])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError('Email ou mot de passe incorrect.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRequestOtp(e) {
    e?.preventDefault()
    setWaError('')
    setWaErrorCode('')
    setWaLoading(true)
    try {
      await requestWhatsAppOtp(phone)
      setWaStep('code')
      setCooldown(RESEND_COOLDOWN)
    } catch (err) {
      setWaError(otpErrorMessage(err.code))
      setWaErrorCode(err.code)
    } finally {
      setWaLoading(false)
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault()
    setWaError('')
    setWaErrorCode('')
    setWaLoading(true)
    try {
      await verifyWhatsAppOtp(phone, code)
      navigate('/dashboard')
    } catch (err) {
      setWaError(otpErrorMessage(err.code))
      setWaErrorCode(err.code)
    } finally {
      setWaLoading(false)
    }
  }

  function switchMode(next) {
    setMode(next)
    setError('')
    setWaError('')
    setWaErrorCode('')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-navy-900 to-navy-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-800/40 via-transparent to-transparent" />
        <div className="relative z-10 flex flex-col justify-center px-16">
          <Link to="/" className="flex items-center gap-2.5 mb-16">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center font-bold text-white text-sm">YB</div>
            <span className="font-bold text-white text-xl">YamoBiz</span>
          </Link>
          <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
            Bienvenue sur votre<br />
            <span className="text-brand-400">assistant business</span>
          </h2>
          <p className="text-white/60 leading-relaxed mb-8">
            Gérez vos ventes, votre stock et vos créances depuis WhatsApp et votre tableau de bord.
          </p>
          <div className="space-y-4">
            {[
              { icon: '📊', text: 'Tableau de bord en temps réel' },
              { icon: '💬', text: 'Simulateur bot WhatsApp intégré' },
              { icon: '📄', text: 'Rapports financiers automatiques' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-white/70 text-sm">
                <span className="text-lg">{icon}</span>
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center font-bold text-white text-xs">YB</div>
            <span className="font-bold text-navy-900 text-lg">YamoBiz</span>
          </Link>

          <h1 className="text-2xl font-bold text-navy-900 mb-1">Connexion</h1>
          <p className="text-gray-500 text-sm mb-6">
            Pas encore de compte ?{' '}
            <Link to="/register" className="text-brand-600 font-medium hover:text-brand-700">Inscrivez-vous</Link>
          </p>

          {/* Mode switch */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            <button
              type="button"
              onClick={() => switchMode('email')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === 'email' ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Mail size={14} />
              Email
            </button>
            <button
              type="button"
              onClick={() => switchMode('whatsapp')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === 'whatsapp' ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <MessageCircle size={14} />
              WhatsApp
            </button>
          </div>

          {mode === 'email' ? (
            <>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-6">
                  {error}
                </div>
              )}
              <Link to="/forgot-password" className="text-brand-600 text-sm">
                Mot de passe oublié ?
              </Link>
              <form onSubmit={handleSubmit} className="space-y-5 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="vous@exemple.com"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      required
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <LogIn size={16} />
                      Se connecter
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              {waError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-6">
                  {waError}
                  {waErrorCode === 'business_not_found' && (
                    <Link to="/register" className="block mt-1.5 font-medium underline hover:no-underline">
                      Créer mon compte YamoBiz
                    </Link>
                  )}
                </div>
              )}

              {waStep === 'phone' ? (
                <form onSubmit={handleRequestOtp} className="space-y-5">
                  <div className="flex items-start gap-2.5 bg-brand-50 border border-brand-100 rounded-xl px-4 py-3">
                    <MessageCircle size={14} className="text-brand-600 mt-0.5 flex-shrink-0" />
                    <p className="text-brand-700 text-xs leading-relaxed">
                      Utilisez le même numéro que celui enregistré sur le bot WhatsApp YamoBiz.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Numéro WhatsApp</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+237 6XX XXX XXX"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={waLoading}
                    className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                  >
                    {waLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <MessageCircle size={16} />
                        Recevoir le code sur WhatsApp
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  <button
                    type="button"
                    onClick={() => { setWaStep('phone'); setCode(''); setWaError('') }}
                    className="flex items-center gap-1.5 text-gray-500 text-sm hover:text-gray-700"
                  >
                    <ArrowLeft size={14} />
                    Modifier le numéro
                  </button>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Code reçu sur WhatsApp
                    </label>
                    <p className="text-xs text-gray-400 mb-2">Envoyé au {phone}</p>
                    <input
                      ref={codeInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      value={code}
                      onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg tracking-[0.5em] text-center font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={waLoading || code.length < 6}
                    className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                  >
                    {waLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <LogIn size={16} />
                        Vérifier et se connecter
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={cooldown > 0 || waLoading}
                    className="w-full flex items-center justify-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 disabled:text-gray-300 py-1"
                  >
                    <RefreshCw size={13} />
                    {cooldown > 0 ? `Renvoyer le code (${cooldown}s)` : 'Renvoyer le code'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
