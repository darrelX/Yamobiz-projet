import { Link } from 'react-router-dom'
import { CheckCircle, MessageSquare, TrendingUp, Package, CreditCard, BarChart3, ArrowRight, Star, Zap, Shield } from 'lucide-react'

const features = [
  {
    icon: MessageSquare,
    title: 'WhatsApp Natif',
    desc: 'Envoyez un message texte ou vocal. YamoBiz comprend votre pidgin et votre français.',
    color: 'text-brand-600 bg-brand-50',
  },
  {
    icon: Zap,
    title: 'Réponse en 3 secondes',
    desc: 'Facture générée, stock mis à jour, créance enregistrée — tout en un seul message.',
    color: 'text-gold-600 bg-gold-50',
  },
  {
    icon: TrendingUp,
    title: '+25% de revenus',
    desc: 'Suivez vos créances, récupérez vos impayés et pilotez vos finances en temps réel.',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    icon: Package,
    title: 'Gestion du stock',
    desc: 'Alertes rupture de stock automatiques. Plus jamais de manque à gagner.',
    color: 'text-orange-600 bg-orange-50',
  },
  {
    icon: CreditCard,
    title: 'Suivi des créances',
    desc: 'Chaque vente à crédit est tracée. Relances SMS automatiques à J+7 et J+14.',
    color: 'text-red-600 bg-red-50',
  },
  {
    icon: BarChart3,
    title: 'Bilan financier',
    desc: 'Votre rapport mensuel complet : chiffre d\'affaires, bénéfices, dettes clients.',
    color: 'text-teal-600 bg-teal-50',
  },
]

const steps = [
  { num: '1', title: 'Envoyez un message', desc: '"J\'ai vendu 3 sacs de riz à 15 000 à Marie, crédit"' },
  { num: '2', title: 'YamoBiz analyse', desc: 'L\'IA comprend votre intention en pidgin, français ou anglais' },
  { num: '3', title: 'Actions automatiques', desc: 'Facture, stock, créance — tout est mis à jour instantanément' },
  { num: '4', title: 'Confirmation', desc: 'Vous recevez un résumé clair sur WhatsApp en moins de 3 secondes' },
]

const testimonials = [
  {
    name: 'Mama Célestine',
    role: 'Vendeuse au Marché Central, Douala',
    text: 'Avant je perdais mes cahiers et je savais plus qui me devait quoi. Avec YamoBiz tout est sur WhatsApp, c\'est simple !',
    rating: 5,
  },
  {
    name: 'Jean-Pierre N.',
    role: 'Grossiste alimentaire, Yaoundé',
    text: 'Mon chiffre d\'affaires a augmenté de 30% en 3 mois. Je récupère enfin mes créances grâce aux rappels automatiques.',
    rating: 5,
  },
  {
    name: 'Fatimata K.',
    role: 'Boutique mode, Douala Akwa',
    text: 'Aucune application à installer. Je parle à YamoBiz comme je parle à une amie. C\'est révolutionnaire.',
    rating: 5,
  },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center font-bold text-white text-xs">YB</div>
            <span className="font-bold text-navy-900 text-lg">YamoBiz</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-2">
              Connexion
            </Link>
            <Link to="/register" className="text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl transition-colors">
              Essai gratuit
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-20 bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-900/30 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-gold-900/20 via-transparent to-transparent" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-brand-600/20 border border-brand-500/30 text-brand-400 px-4 py-1.5 rounded-full text-sm font-medium mb-8">
            <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-pulse" />
            Disponible sur WhatsApp · Sans installation
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            L'assistant WhatsApp qui<br />
            <span className="text-brand-400">transforme votre PME</span>
          </h1>
          <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed">
            Gérez vos ventes, votre stock et vos créances par simple message vocal ou texte.
            En français, en pidgin, en anglais. Sans application à installer.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Link
              to="/register"
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold px-8 py-4 rounded-2xl text-base transition-all duration-200 hover:shadow-lg hover:shadow-brand-900/30 hover:-translate-y-0.5"
            >
              Commencer gratuitement
              <ArrowRight size={18} />
            </Link>
            <Link
              to="/login"
              className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium px-8 py-4 rounded-2xl text-base transition-all duration-200"
            >
              <MessageSquare size={18} />
              Voir la démo
            </Link>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { val: '+25%', label: 'Bénéfice mensuel' },
              { val: '5 000', label: 'FCFA / mois' },
              { val: '< 3s', label: 'Temps de réponse' },
              { val: '2M', label: 'PME cibles' },
            ].map(({ val, label }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-4">
                <div className="text-2xl font-bold text-gold-400">{val}</div>
                <div className="text-xs text-white/50 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo chat mockup */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-navy-900 mb-3">Comment ca fonctionne</h2>
            <p className="text-gray-500">Un message suffit pour gérer toute votre activité</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Steps */}
            <div className="space-y-6">
              {steps.map((step, i) => (
                <div key={step.num} className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-brand-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-sm">
                    {step.num}
                  </div>
                  <div className="pt-1">
                    <h3 className="font-semibold text-navy-900 mb-1">{step.title}</h3>
                    <p className="text-gray-500 text-sm">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Chat mockup */}
            <div className="bg-white rounded-3xl shadow-2xl shadow-gray-200 overflow-hidden border border-gray-100">
              {/* WhatsApp header */}
              <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-400 flex items-center justify-center text-white font-bold text-xs">YB</div>
                <div>
                  <p className="text-white font-semibold text-sm">YamoBiz</p>
                  <p className="text-white/70 text-xs">en ligne</p>
                </div>
              </div>

              {/* Chat body */}
              <div className="bg-[#ECE5DD] p-4 space-y-3 min-h-64">
                {/* User message */}
                <div className="flex justify-end">
                  <div className="bg-[#DCF8C6] rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-xs shadow-sm">
                    <p className="text-sm text-gray-800">J'ai vendu 3 sacs de riz à 15 000 à Marie, crédit</p>
                    <p className="text-[10px] text-gray-400 text-right mt-1">09:32 ✓✓</p>
                  </div>
                </div>

                {/* Bot response */}
                <div className="flex justify-start">
                  <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 max-w-xs shadow-sm">
                    <p className="text-sm text-gray-800 font-medium mb-2">Facture YB-20250615-001</p>
                    <div className="text-xs text-gray-600 space-y-1 border-t border-gray-100 pt-2">
                      <div className="flex justify-between"><span>Riz (x3)</span><span className="font-medium">45 000 FCFA</span></div>
                      <div className="flex justify-between text-orange-600"><span>Crédit Marie</span><span className="font-medium">45 000 FCFA</span></div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-green-700 space-y-0.5">
                      <p>✅ Stock mis a jour (-3 sacs)</p>
                      <p>✅ Creance enregistree</p>
                      <p>✅ Rappel SMS prevu J+7</p>
                    </div>
                    <p className="text-[10px] text-gray-400 text-right mt-2">09:32 ✓✓</p>
                  </div>
                </div>

                {/* User message 2 */}
                <div className="flex justify-end">
                  <div className="bg-[#DCF8C6] rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-xs shadow-sm">
                    <p className="text-sm text-gray-800">Donne moi mon bilan du mois</p>
                    <p className="text-[10px] text-gray-400 text-right mt-1">09:45 ✓✓</p>
                  </div>
                </div>

                {/* Bot response 2 */}
                <div className="flex justify-start">
                  <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 max-w-xs shadow-sm">
                    <p className="text-sm font-semibold text-gray-800 mb-2">Bilan Juin 2025</p>
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between"><span className="text-gray-500">CA total</span><span className="font-semibold text-green-600">380 000 FCFA</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Encaisse</span><span className="font-semibold text-green-600">295 000 FCFA</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Créances</span><span className="font-semibold text-orange-500">85 000 FCFA</span></div>
                    </div>
                    <p className="text-[10px] text-gray-400 text-right mt-2">09:45 ✓✓</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-navy-900 mb-3">Tout ce dont votre PME a besoin</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Une suite complète d'outils de gestion, accessible depuis WhatsApp et le tableau de bord web.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="p-6 rounded-2xl border border-gray-100 hover:border-brand-200 hover:shadow-md transition-all duration-200 group">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${color}`}>
                  <Icon size={20} />
                </div>
                <h3 className="font-semibold text-navy-900 mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-navy-900 mb-3">Tarifs simples et transparents</h2>
          <p className="text-gray-500 mb-12">Pas de frais cachés. Payez par Mobile Money MTN ou Orange Money.</p>

          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Standard */}
            <div className="bg-white rounded-3xl border border-gray-200 p-8 text-left hover:shadow-lg transition-shadow">
              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Standard</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-navy-900">5 000</span>
                  <span className="text-gray-500">FCFA/mois</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">≈ 8 €/mois</p>
              </div>
              <ul className="space-y-3 mb-8">
                {['Bot WhatsApp (vente, stock, crédit)', 'Transcription vocale FR + pidgin', 'Relances SMS automatiques', 'Dashboard web basique', 'Rapports mensuels'].map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <CheckCircle size={15} className="text-brand-500 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/register" className="block text-center bg-brand-600 hover:bg-brand-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm">
                Commencer
              </Link>
            </div>

            {/* Premium */}
            <div className="bg-navy-900 rounded-3xl border border-navy-800 p-8 text-left relative overflow-hidden hover:shadow-xl transition-shadow">
              <div className="absolute top-4 right-4 bg-gold-500 text-white text-xs font-bold px-3 py-1 rounded-full">PREMIUM</div>
              <div className="mb-6">
                <p className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-2">Premium</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">10 000</span>
                  <span className="text-white/60">FCFA/mois</span>
                </div>
                <p className="text-sm text-white/40 mt-1">≈ 15 €/mois</p>
              </div>
              <ul className="space-y-3 mb-8">
                {['Tout le plan Standard', 'Reporting financier avancé PDF', 'Multi-utilisateurs (2 comptes)', 'Intégration MoMo collecte', 'Langues locales (Bassa, Ewondo)', 'Support prioritaire'].map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                    <CheckCircle size={15} className="text-gold-400 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/register" className="block text-center bg-gold-500 hover:bg-gold-400 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm">
                Passer au Premium
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-navy-900 mb-3">Ce que disent nos commercants</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {testimonials.map(({ name, role, text, rating }) => (
              <div key={name} className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: rating }).map((_, i) => (
                    <Star key={i} size={14} className="fill-gold-400 text-gold-400" />
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-4">"{text}"</p>
                <div>
                  <p className="font-semibold text-navy-900 text-sm">{name}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-brand-700 to-brand-600">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Shield size={40} className="text-white/30 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-white mb-4">
            Devenez un CEO connecté
          </h2>
          <p className="text-white/80 text-lg mb-8 leading-relaxed">
            Rejoignez les PME camerounaises qui ont choisi de digitaliser leur activité.<br />
            30 jours gratuits, sans carte bancaire.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-white text-brand-700 font-bold px-8 py-4 rounded-2xl text-base hover:bg-brand-50 transition-colors"
          >
            Créer mon compte gratuitement
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy-950 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-white text-xs">YB</div>
            <span className="font-bold text-white text-sm">YamoBiz</span>
          </div>
          <p className="text-white/30 text-xs">© 2025 YamoBiz · FinTech SaaS B2B · Cameroun</p>
          <div className="flex gap-4 text-xs text-white/40">
            <Link to="/login" className="hover:text-white/70 transition-colors">Connexion</Link>
            <Link to="/register" className="hover:text-white/70 transition-colors">Inscription</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
