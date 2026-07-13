import { useState } from 'react'
import {
  User, Building2, Plus, Pencil, Trash2, Check, X, Star, Loader2
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const cities = ['Douala', 'Yaoundé', 'Bafoussam', 'Garoua', 'Bamenda', 'Maroua', 'Ngaoundéré']
const sectors = ['Commerce général', 'Alimentation / Restauration', 'Mode / Textile', 'Électronique', 'Agriculture', 'BTP / Matériaux', 'Santé / Pharmacie', 'Autre']

const emptyBusinessForm = { name: '', phone: '', city: 'Douala', sector: 'Commerce général' }

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  )
}

const inputClass = "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"

function BusinessForm({ initial, onCancel, onSubmit, submitLabel }) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await onSubmit(form)
    } catch (err) {
      setError(err.message || 'Une erreur est survenue.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100">
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Nom de l'entreprise">
          <input required className={inputClass} value={form.name} onChange={e => update('name', e.target.value)} />
        </Field>
        <Field label="Téléphone">
          <input required className={inputClass} value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+237 6XX XXX XXX" />
        </Field>
        <Field label="Ville">
          <select className={inputClass} value={form.city} onChange={e => update('city', e.target.value)}>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Secteur">
          <select className={inputClass} value={form.sector} onChange={e => update('sector', e.target.value)}>
            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button type="submit" disabled={saving} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          {saving && <Loader2 size={14} className="animate-spin" />}
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-medium text-gray-500 hover:text-gray-700 px-3 py-2">
          Annuler
        </button>
      </div>
    </form>
  )
}

function BusinessCard({ biz, isActive, onSwitch, onUpdate, onDelete, canDelete }) {
  const [editing, setEditing] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleSwitch() {
    setSwitching(true)
    try { await onSwitch(biz.id) } finally { setSwitching(false) }
  }

  async function handleDelete() {
    setDeleting(true)
    try { await onDelete(biz.id) } finally { setDeleting(false) }
  }

  if (editing) {
    return (
      <BusinessForm
        initial={{ name: biz.name || '', phone: biz.phone || '', city: biz.city || 'Douala', sector: biz.sector || 'Commerce général' }}
        submitLabel="Enregistrer"
        onCancel={() => setEditing(false)}
        onSubmit={async (form) => { await onUpdate(biz.id, form); setEditing(false) }}
      />
    )
  }

  return (
    <div className={`rounded-xl p-4 border transition-colors ${isActive ? 'border-brand-300 bg-brand-50/40' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-navy-900 text-sm truncate">{biz.name}</p>
            {isActive && (
              <span className="flex items-center gap-1 text-xs font-medium text-brand-700 bg-brand-100 px-2 py-0.5 rounded-full flex-shrink-0">
                <Star size={11} className="fill-brand-700" /> Active
              </span>
            )}
            {biz.plan === 'premium' && (
              <span className="text-xs font-medium text-gold-700 bg-gold-50 px-2 py-0.5 rounded-full flex-shrink-0">Premium</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{biz.city} · {biz.sector || 'Commerce'} · {biz.phone}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {!isActive && (
          <button onClick={handleSwitch} disabled={switching} className="flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 border border-brand-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60">
            {switching ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Définir comme active
          </button>
        )}
        <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors">
          <Pencil size={12} /> Modifier
        </button>
        {canDelete && (
          confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Supprimer définitivement ?</span>
              <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 px-2.5 py-1.5 rounded-lg disabled:opacity-60">
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Oui
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs font-medium text-gray-500 hover:text-gray-700">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:bg-red-50 border border-red-100 px-3 py-1.5 rounded-lg transition-colors">
              <Trash2 size={12} /> Supprimer
            </button>
          )
        )}
      </div>
    </div>
  )
}

export default function Account() {
  const { user, business, businesses, updateEmail, updatePassword, switchBusiness, addBusiness, updateBusiness, deleteBusiness } = useAuth()

  const [email, setEmail] = useState(user?.email || '')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMsg, setEmailMsg] = useState('')
  const [emailErr, setEmailErr] = useState('')

  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState('')
  const [pwErr, setPwErr] = useState('')

  const [addingBusiness, setAddingBusiness] = useState(false)

  async function handleEmailSubmit(e) {
    e.preventDefault()
    setEmailMsg(''); setEmailErr(''); setEmailSaving(true)
    try {
      await updateEmail(email)
      setEmailMsg('Un e-mail de confirmation a été envoyé à la nouvelle adresse.')
    } catch (err) {
      setEmailErr(err.message || 'Impossible de modifier l\'e-mail.')
    } finally {
      setEmailSaving(false)
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setPwMsg(''); setPwErr('')
    if (pw1.length < 6) { setPwErr('Le mot de passe doit contenir au moins 6 caractères.'); return }
    if (pw1 !== pw2) { setPwErr('Les mots de passe ne correspondent pas.'); return }
    setPwSaving(true)
    try {
      await updatePassword(pw1)
      setPwMsg('Mot de passe mis à jour.')
      setPw1(''); setPw2('')
    } catch (err) {
      setPwErr(err.message || 'Impossible de modifier le mot de passe.')
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-navy-900">Mon compte</h1>
        <p className="text-gray-400 text-sm mt-0.5">Gérez vos informations personnelles et vos entreprises</p>
      </div>

      {/* Infos personnelles */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
            <User size={16} />
          </div>
          <h2 className="font-semibold text-navy-900 text-sm">Informations personnelles</h2>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-2 mb-6">
          <Field label="Adresse e-mail">
            <input type="email" required className={inputClass} value={email} onChange={e => setEmail(e.target.value)} />
          </Field>
          {emailMsg && <p className="text-xs text-green-600">{emailMsg}</p>}
          {emailErr && <p className="text-xs text-red-600">{emailErr}</p>}
          <button type="submit" disabled={emailSaving || email === user?.email} className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            {emailSaving && <Loader2 size={14} className="animate-spin" />}
            Mettre à jour l'e-mail
          </button>
        </form>

        <form onSubmit={handlePasswordSubmit} className="space-y-2 pt-4 border-t border-gray-100">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Nouveau mot de passe">
              <input type="password" className={inputClass} value={pw1} onChange={e => setPw1(e.target.value)} placeholder="••••••••" />
            </Field>
            <Field label="Confirmer">
              <input type="password" className={inputClass} value={pw2} onChange={e => setPw2(e.target.value)} placeholder="••••••••" />
            </Field>
          </div>
          {pwMsg && <p className="text-xs text-green-600">{pwMsg}</p>}
          {pwErr && <p className="text-xs text-red-600">{pwErr}</p>}
          <button type="submit" disabled={pwSaving || !pw1} className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            {pwSaving && <Loader2 size={14} className="animate-spin" />}
            Changer le mot de passe
          </button>
        </form>
      </div>

      {/* Entreprises */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <Building2 size={16} />
            </div>
            <h2 className="font-semibold text-navy-900 text-sm">Mes entreprises</h2>
          </div>
          {!addingBusiness && (
            <button onClick={() => setAddingBusiness(true)} className="flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 border border-brand-200 px-3 py-1.5 rounded-lg transition-colors">
              <Plus size={13} /> Ajouter une entreprise
            </button>
          )}
        </div>

        <div className="space-y-3">
          {addingBusiness && (
            <BusinessForm
              initial={emptyBusinessForm}
              submitLabel="Créer l'entreprise"
              onCancel={() => setAddingBusiness(false)}
              onSubmit={async (form) => { await addBusiness(form); setAddingBusiness(false) }}
            />
          )}

          {businesses.length === 0 && !addingBusiness && (
            <p className="text-sm text-gray-400 text-center py-6">Aucune entreprise pour le moment.</p>
          )}

          {businesses.map(biz => (
            <BusinessCard
              key={biz.id}
              biz={biz}
              isActive={business?.id === biz.id}
              onSwitch={switchBusiness}
              onUpdate={updateBusiness}
              onDelete={deleteBusiness}
              canDelete={businesses.length > 1}
            />
          ))}
        </div>

        {businesses.length === 1 && (
          <p className="text-xs text-gray-400 mt-3">
            Vous devez garder au moins une entreprise sur votre compte — ajoutez-en une autre avant de pouvoir supprimer celle-ci.
          </p>
        )}
      </div>
    </div>
  )
}
