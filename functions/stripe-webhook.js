// stripe-webhook.js v27.0
// Handler para webhooks do Stripe
// Processa eventos de pagamento e atualiza leads no Supabase

const { handleStripeWebhook } = require('./_billing.js');
const { updateLead, corsHeaders } = require('./_supabase.js');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }
  
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    
    // Processar o webhook do Stripe
    const result = await handleStripeWebhook(body);
    
    // Se o evento foi processado com sucesso, atualizar o lead no Supabase
    if (result.ok && result.processed) {
      const leadId = body.data?.object?.metadata?.lead_id;
      
      if (leadId) {
        if (body.type === 'checkout.session.completed') {
          await updateLead(leadId, {
            stripe_payment_completed: true,
            stripe_payment_completed_utc: new Date().toISOString(),
            status: 'payment-completed'
          });
        } else if (body.type === 'checkout.session.expired') {
          await updateLead(leadId, {
            stripe_payment_expired: true,
            stripe_payment_expired_utc: new Date().toISOString(),
            alert_pending: true,
            alert_reason: 'stripe_session_expired'
          });
        }
      }
    }
    
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ received: true })
    };
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
