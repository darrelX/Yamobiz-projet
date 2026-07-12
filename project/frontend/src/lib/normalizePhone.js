// Doit rester strictement identique à la version utilisée dans le backend
// WhatsApp (BACKEND_whatsapp_auth_routes.js), sinon les numéros ne
// correspondront plus lors du lookup dans `businesses.phone`.
export function normalizePhone(phone) {
  return (phone || '').trim().replace(/[^\d+]/g, '')
}
