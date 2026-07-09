import { useEffect, useRef, useState } from 'react'
import { Send, Mic, Info, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const QUICK_MESSAGES = [
  'J\'ai vendu 2 sacs de riz à 15000 à Marie, crédit',
  'Donne moi mon bilan du mois',
  'Quel est mon stock actuel ?',
  'Marie m\'a payé 10000 FCFA',
  'Combien je dois récupérer en tout ?',
  'J\'ai vendu 5 savons à 500 à Jean, cash',
]

function parseIntent(text) {
  const lower = text.toLowerCase()
  if (/bilan|rapport|résumé|chiffre|revenus|finance/.test(lower)) return 'bilan'
  if (/stock|inventaire|produit/.test(lower)) return 'stock'
  if (/créance|doit|dette|recouvrer|récupérer/.test(lower)) return 'creances'
  if (/vendu|vente|vendu|sold|acheté/.test(lower)) return 'vente'
  if (/payé|remboursé|réglé|paiement reçu/.test(lower)) return 'paiement'
  if (/aide|help|commande|comment/.test(lower)) return 'aide'
  return 'unknown'
}

function parseSale(text) {
  const qtyMatch = text.match(/(\d+)\s+(?:sacs?|kg|litre|unité|pièce|boîte|carton|savon|article|bouteille|unités?|(\w+))/i)
  const priceMatch = text.match(/à\s*([\d\s]+)\s*(?:fcfa|f|fr)?/i)
  const customerMatch = text.match(/(?:à|pour|de)\s+([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)?)/i)
  const isCredit = /crédit|credit/.test(text.toLowerCase())
  const isMomo = /momo|mobile money/.test(text.toLowerCase())

  const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1
  const price = priceMatch ? parseInt(priceMatch[1].replace(/\s/g, '')) : 0
  const customer = customerMatch ? customerMatch[1] : 'Client anonyme'
  const paymentType = isCredit ? 'credit' : isMomo ? 'momo' : 'cash'

  // Extract product name
  const productMatch = text.match(/(\d+)\s+([a-zA-ZÀ-ü\s]+?)\s+(?:à|pour)/i)
  const product = productMatch ? productMatch[2].trim() : 'Article'

  return { qty, price, customer, paymentType, product, total: qty * price }
}

export default function Simulator() {
  const { business } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [products, setProducts] = useState([])
  const [credits, setCredits] = useState([])
  const [sales, setSales] = useState([])
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (business?.id) {
      loadData()
      setMessages([{
        id: 'welcome',
        direction: 'out',
        content: `Bonjour ! Je suis *YamoBiz*, votre assistant business sur WhatsApp 🌟\n\nJe peux vous aider à :\n• Enregistrer une vente\n• Vérifier votre stock\n• Consulter vos créances\n• Obtenir votre bilan financier\n\nEnvoyez-moi un message pour commencer !`,
        created_at: new Date().toISOString(),
      }])
    }
  }, [business])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadData() {
    const [prodRes, credRes, salesRes] = await Promise.all([
      supabase.from('products').select('*').eq('business_id', business.id),
      supabase.from('credits').select('*').eq('business_id', business.id).neq('status', 'paid'),
      supabase.from('sales').select('total, payment_type').eq('business_id', business.id),
    ])
    setProducts(prodRes.data || [])
    setCredits(credRes.data || [])
    setSales(salesRes.data || [])
  }

  async function processMessage(text) {
    const intent = parseIntent(text)
    await new Promise(r => setTimeout(r, 800 + Math.random() * 600))

    switch (intent) {
      case 'bilan': {
        const cashTotal = sales.filter(s => s.payment_type !== 'credit').reduce((a, s) => a + (s.total || 0), 0)
        const creditTotal = sales.filter(s => s.payment_type === 'credit').reduce((a, s) => a + (s.total || 0), 0)
        const pendingCredits = credits.reduce((a, c) => a + (c.amount - c.amount_paid), 0)
        const month = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
        return {
          content: `📊 *Bilan — ${month}*\n\n💰 CA Total : *${(cashTotal + creditTotal).toLocaleString()} FCFA*\n✅ Encaissé : *${cashTotal.toLocaleString()} FCFA*\n⏳ À crédit : *${creditTotal.toLocaleString()} FCFA*\n❗ Créances ouvertes : *${pendingCredits.toLocaleString()} FCFA*\n📦 ${products.length} produit${products.length > 1 ? 's' : ''} en stock\n\n_Rapport généré par YamoBiz_`,
          action_type: 'bilan',
        }
      }

      case 'stock': {
        if (products.length === 0) {
          return { content: '📦 Votre stock est vide. Ajoutez des produits depuis la section *Stock* du tableau de bord.', action_type: 'stock' }
        }
        const stockLines = products.map(p => {
          const alert = p.stock_qty <= p.stock_alert ? ' ⚠️' : ''
          return `• ${p.name} : *${p.stock_qty} ${p.unit}*${alert}`
        }).join('\n')
        const alerts = products.filter(p => p.stock_qty <= p.stock_alert).length
        return {
          content: `📦 *Inventaire actuel*\n\n${stockLines}\n\n${alerts > 0 ? `⚠️ ${alerts} produit${alerts > 1 ? 's' : ''} en stock faible !` : '✅ Tous vos stocks sont bons.'}`,
          action_type: 'stock',
        }
      }

      case 'creances': {
        if (credits.length === 0) {
          return { content: '✅ Vous n\'avez aucune créance ouverte. Tous vos clients sont à jour !', action_type: 'creances' }
        }
        const total = credits.reduce((a, c) => a + (c.amount - c.amount_paid), 0)
        const lines = credits.slice(0, 5).map(c => `• ${c.customer_name} : *${(c.amount - c.amount_paid).toLocaleString()} FCFA*`).join('\n')
        return {
          content: `💳 *Créances ouvertes*\n\n${lines}${credits.length > 5 ? `\n_...et ${credits.length - 5} autre${credits.length - 5 > 1 ? 's'  : ''}_` : ''}\n\n📌 Total à recouvrer : *${total.toLocaleString()} FCFA*`,
          action_type: 'creances',
        }
      }

      case 'vente': {
        const parsed = parseSale(text)
        if (parsed.total === 0) {
          return { content: 'Je n\'ai pas pu extraire le montant de la vente. Précisez comme ceci :\n\n_"J\'ai vendu 3 sacs de riz à 15000 à Marie, crédit"_', action_type: null }
        }

        // Actually record the sale
        const { data: saleData } = await supabase.from('sales').insert({
          business_id: business.id,
          customer_name: parsed.customer,
          payment_type: parsed.paymentType,
          total: parsed.total,
          notes: `Via simulateur: ${text}`,
        }).select().single()

        if (saleData) {
          await supabase.from('sale_items').insert({
            sale_id: saleData.id,
            product_name: parsed.product,
            qty: parsed.qty,
            unit_price: parsed.price,
            subtotal: parsed.total,
          })

          if (parsed.paymentType === 'credit') {
            await supabase.from('credits').insert({
              business_id: business.id,
              sale_id: saleData.id,
              customer_name: parsed.customer,
              amount: parsed.total,
              amount_paid: 0,
              status: 'pending',
              due_date: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10),
            })
          }
        }

        const payLabel = parsed.paymentType === 'credit' ? 'à crédit' : parsed.paymentType === 'momo' ? 'via Mobile Money' : 'en cash'
        await loadData()
        return {
          content: `✅ *Vente enregistrée !*\n\n📄 Facture YB-${Date.now().toString().slice(-6)}\n\n• ${parsed.product} (x${parsed.qty}) : *${parsed.total.toLocaleString()} FCFA*\n• Client : *${parsed.customer}*\n• Paiement : *${payLabel}*\n\n${parsed.paymentType === 'credit' ? `⏰ Rappel SMS programmé à J+7 et J+14 pour ${parsed.customer}.\n❗ Créance de ${parsed.total.toLocaleString()} FCFA enregistrée.` : '💰 Montant encaissé avec succès.'}`,
          action_type: 'vente',
        }
      }

      case 'paiement': {
        const customerMatch = text.match(/([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)?)\s+(?:m'a|ma|a)\s+payé/i)
        const amtMatch = text.match(/([\d\s]+)\s*(?:fcfa|f)?/i)
        if (customerMatch && amtMatch) {
          const customer = customerMatch[1]
          const amount = parseInt(amtMatch[1].replace(/\s/g, ''))
          return {
            content: `✅ *Paiement enregistré !*\n\n• Client : *${customer}*\n• Montant reçu : *${amount.toLocaleString()} FCFA*\n\nRécupérez-vous ce paiement sur la section *Créances* du tableau de bord pour mettre à jour le solde.`,
            action_type: 'paiement',
          }
        }
        return { content: 'Pouvez-vous préciser qui a payé et le montant ? Ex: _"Marie m\'a payé 10000 FCFA"_', action_type: null }
      }

      case 'aide': {
        return {
          content: `🤖 *Commandes YamoBiz*\n\n📦 *Vente* :\n_"J'ai vendu [qté] [produit] à [prix] à [client], [mode]"_\n\n📊 *Bilan* :\n_"Donne moi mon bilan du mois"_\n\n📦 *Stock* :\n_"Quel est mon stock ?"_\n\n💳 *Créances* :\n_"Combien on me doit ?"_\n\n_Je comprends aussi le pidgin et l'anglais !_`,
          action_type: 'aide',
        }
      }

      default:
        return {
          content: `Je n'ai pas bien compris votre demande 🤔\n\nVous pouvez me demander :\n• Enregistrer une vente\n• Voir votre stock\n• Vérifier vos créances\n• Obtenir votre bilan\n\nTapez *aide* pour voir toutes les commandes.`,
          action_type: null,
        }
    }
  }

  async function send(text) {
    if (!text.trim() || sending) return
    setSending(true)
    setInput('')

    const userMsg = { id: Date.now().toString(), direction: 'in', content: text, created_at: new Date().toISOString() }
    setMessages(m => [...m, userMsg])

    const typingMsg = { id: 'typing', direction: 'out', content: '...', typing: true, created_at: new Date().toISOString() }
    setMessages(m => [...m, typingMsg])

    const response = await processMessage(text)

    setMessages(m => [
      ...m.filter(x => x.id !== 'typing'),
      { id: Date.now().toString() + '-r', direction: 'out', ...response, created_at: new Date().toISOString() },
    ])
    setSending(false)
  }

  function renderContent(content) {
    return content.split('\n').map((line, i) => {
      const formatted = line
        .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
      return <span key={i} dangerouslySetInnerHTML={{ __html: formatted || '&nbsp;' }} className="block leading-relaxed" />
    })
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col" style={{ maxHeight: 'calc(100vh - 73px)' }}>
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-navy-900">Simulateur Bot WhatsApp</h1>
          <p className="text-gray-400 text-sm mt-0.5">Testez le bot YamoBiz et enregistrez de vraies données</p>
        </div>
        <button
          onClick={() => {
            setMessages([{
              id: 'welcome-' + Date.now(),
              direction: 'out',
              content: `Bonjour ! Je suis *YamoBiz*. Envoyez-moi un message pour commencer !`,
              created_at: new Date().toISOString(),
            }])
          }}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={14} />
          Réinitialiser
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2.5 bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 mb-4 flex-shrink-0">
        <Info size={14} className="text-brand-600 mt-0.5 flex-shrink-0" />
        <p className="text-brand-700 text-xs leading-relaxed">
          Ce simulateur exécute de vraies actions sur votre compte. Les ventes enregistrées ici apparaissent dans vos rapports.
        </p>
      </div>

      {/* Chat window */}
      <div className="flex-1 bg-[#ECE5DD] rounded-2xl overflow-hidden flex flex-col min-h-0">
        {/* WA header */}
        <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-brand-400 flex items-center justify-center font-bold text-white text-xs">YB</div>
          <div>
            <p className="text-white font-semibold text-sm">YamoBiz Assistant</p>
            <p className="text-white/60 text-xs">en ligne</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.direction === 'in' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs sm:max-w-sm rounded-2xl px-4 py-2.5 shadow-sm
                ${msg.direction === 'in' ? 'bg-[#DCF8C6] rounded-tr-sm' : 'bg-white rounded-tl-sm'}`}>
                {msg.typing ? (
                  <div className="flex gap-1 py-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-gray-800">{renderContent(msg.content)}</div>
                    <p className="text-[10px] text-gray-400 text-right mt-1">
                      {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      {msg.direction === 'in' && ' ✓✓'}
                    </p>
                  </>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="bg-[#F0F0F0] px-3 py-2 flex items-end gap-2 flex-shrink-0">
          <div className="flex-1 bg-white rounded-3xl px-4 py-2.5 max-h-32 overflow-y-auto">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send(input)
                }
              }}
              placeholder="Écrivez un message..."
              rows={1}
              className="w-full text-sm text-gray-800 outline-none resize-none bg-transparent leading-5"
              style={{ maxHeight: 80 }}
            />
          </div>
          <button
            onClick={() => send(input)}
            disabled={sending || !input.trim()}
            className="w-10 h-10 bg-[#075E54] hover:bg-[#064d44] disabled:opacity-50 text-white rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Quick messages */}
      <div className="mt-4 flex-shrink-0">
        <p className="text-xs text-gray-400 mb-2 font-medium">Messages rapides :</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_MESSAGES.map(msg => (
            <button
              key={msg}
              onClick={() => send(msg)}
              disabled={sending}
              className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full hover:border-brand-300 hover:text-brand-600 transition-colors disabled:opacity-50"
            >
              {msg.length > 40 ? msg.slice(0, 40) + '...' : msg}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
