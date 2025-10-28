// _billing.js v18.1
// Cria sessão de checkout Stripe p/ cobrança de taxa de despacho / reserva

const stripeLib = require('stripe');

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

    const session = await stripe.checkout.sessions.create({
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

    return {
      ok:true,
      checkout_url: session.url,
      session_id: session.id
    };
  } catch(e){
    console.error("Stripe session error", e);
    return { ok:false, error:e.message || "stripe_exception" };
  }
}

module.exports = {
  createCheckoutSession
};
