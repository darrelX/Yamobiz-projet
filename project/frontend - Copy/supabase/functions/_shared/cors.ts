export const corsHeaders = {
  // Restreins à ton domaine web en prod si tu veux être plus strict,
  // ex: 'https://app.yamobiz.com'
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
