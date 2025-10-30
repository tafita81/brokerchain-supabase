// _billing.js v27.0 - COM RETRY LOGIC
// Cria sessão de checkout Stripe p/ cobrança de taxa de despacho / reserva
// Inclui retry automático e melhor tratamento de erros

const stripeLib = require('stripe');

// Função auxiliar para retry com exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Não retry em erros de validação ou autenticação
      if (error.type === 'StripeAuthenticationError' || error.type === 'StripePermissionError') {
        throw error;
      }
      
      // Se é a última tentativa, throw o erro
      if (attempt === maxRetries - 1) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Stripe attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function createCheckoutSession(lead, baseAmountUSD, desc){
  try {
    const secret = process.env.STRIPE_SECRET_KEY || "";
    if (!secret){
      return { ok:false, error:"STRIPE_SECRET_KEY missing" };
    }
    const stripe = stripeLib(secret);

    const amountCents = Math.round(baseAmountUSD * 100);
    const successUrl = process.env.STRIPE_SUCCESS_URL || "https://example.com/success";
    const cancelUrl  = process.env.STRIPE_CANCEL_URL  || "https://example.com/cancel";

    // Usar retry logic para criar a sessão
    const session = await retryWithBackoff(async () => {
      return await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: desc
              },
              unit_amount: amountCents
            },
            quantity: 1
          }
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          lead_id: lead.id || "",
          category: lead.category || "",
          tenant: lead.tenant || ""
        }
      });
    });

    return {
      ok:true,
      checkout_url: session.url,
      session_id: session.id
    };
  } catch(e){
    console.error("Stripe session error after retries:", e);
    return { ok:false, error:e.message || "stripe_exception" };
  }
}

// Handler para webhooks do Stripe
async function handleStripeWebhook(event) {
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('Payment successful for lead:', session.metadata.lead_id);
        // Aqui você pode atualizar o lead no Supabase marcando como pago
        return { ok: true, processed: true };
      
      case 'checkout.session.expired':
        const expiredSession = event.data.object;
        console.log('Payment session expired for lead:', expiredSession.metadata.lead_id);
        return { ok: true, processed: true };
      
      default:
        console.log('Unhandled Stripe event type:', event.type);
        return { ok: true, processed: false };
    }
  } catch (error) {
    console.error('Error processing Stripe webhook:', error);
    return { ok: false, error: error.message };
  }
}

module.exports = {
  createCheckoutSession,
  handleStripeWebhook
};
