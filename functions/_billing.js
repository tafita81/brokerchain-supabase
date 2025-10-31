// _billing.js v18.1
// Cria sessão de checkout Stripe p/ cobrança de taxa de despacho / reserva
// Agora com retry logic e backoff exponencial

const stripeLib = require('stripe');
const { logInfo, logError, logExternalApiCall, logPerformance } = require('./_logger');

/**
 * Retry com backoff exponencial
 */
async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = i === maxRetries - 1;

      // Não fazer retry em erros 4xx (exceto 429)
      if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
        throw error;
      }

      if (isLastAttempt) {
        throw error;
      }

      const delay = initialDelay * Math.pow(2, i);
      logInfo(`Stripe retry attempt ${i + 1}/${maxRetries} after ${delay}ms`, {
        error: error.message,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function createCheckoutSession(lead, baseAmountUSD, desc) {
  const startTime = Date.now();

  try {
    const secret = process.env.STRIPE_SECRET_KEY || '';
    if (!secret) {
      logError('Stripe API key missing');
      return { ok: false, error: 'STRIPE_SECRET_KEY missing' };
    }

    const stripe = stripeLib(secret);

    const amountCents = Math.round(baseAmountUSD * 100);
    const successUrl = process.env.STRIPE_SUCCESS_URL || 'https://example.com/success';
    const cancelUrl = process.env.STRIPE_CANCEL_URL || 'https://example.com/cancel';

    logExternalApiCall('Stripe', '/checkout/sessions', {
      leadId: lead.id,
      amount: baseAmountUSD,
    });

    const session = await retryWithBackoff(async () => {
      return await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: desc,
              },
              unit_amount: amountCents,
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          lead_id: lead.id || '',
          category: lead.category || '',
          tenant: lead.tenant || '',
        },
      });
    });

    const duration = Date.now() - startTime;
    logPerformance('createCheckoutSession', duration, {
      leadId: lead.id,
      sessionId: session.id,
    });

    return {
      ok: true,
      checkout_url: session.url,
      session_id: session.id,
    };
  } catch (e) {
    logError('Stripe session error', e, {
      leadId: lead.id,
      amount: baseAmountUSD,
    });

    return { ok: false, error: e.message || 'stripe_exception' };
  }
}

module.exports = {
  createCheckoutSession,
  retryWithBackoff,
};

