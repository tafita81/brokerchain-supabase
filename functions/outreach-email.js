// outreach-email.js v18.1
// Gera rascunhos de outreach humano curto em inglês dos EUA.
// Usa gpt-4o-mini via OPENAI_API_KEY.
// Não envia sozinho. Apenas devolve texto para você.

const { readJSON, corsHeaders } = require('./_util.js');
const fetch = require('node-fetch');

async function draftEmail(openaiKey, model, baseUrl, context) {
  const sysTone = `You are BrokerChain. You write first-contact emails as a real human in US business English.
Style:
- calm, direct, short sentences
- you are Dispatch / Procurement Desk
- never say you're AI
- never sign a personal name
- under 6 short lines.`;

  const payload = {
    model,
    messages: [
      { role: "system", content: sysTone },
      { role: "user", content: "Context: " + JSON.stringify(context) + "\nNow draft a short outreach email:" }
    ],
    max_completion_tokens: 200
  };

  const resp = await fetch(baseUrl, {
    method:"POST",
    headers:{
      "Authorization":"Bearer "+openaiKey,
      "Content-Type":"application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error("OpenAI draft failed: "+t);
  }
  const data = await resp.json();

  const fallback =
    (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content)
    || data.output_text
    || JSON.stringify(data);

  return fallback;
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode:200, headers:corsHeaders(), body:'' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode:405, headers:corsHeaders(), body:'Method Not Allowed' };
  }

  const settings = readJSON('settings.json') || {};
  if (!settings.OUTREACH_ENABLED) {
    return {
      statusCode:200,
      headers:corsHeaders(),
      body:JSON.stringify({ok:true, skipped:true, reason:"OUTREACH_DISABLED"})
    };
  }

  try {
    const openaiKey = process.env.OPENAI_API_KEY || "MISSING_OPENAI_API_KEY";
    const model = "gpt-4o-mini";
    const baseUrl = "https://api.openai.com/v1/chat/completions";

    const toBuyerContext = {
      need: "City needs diesel pumps, under $15k, 24h delivery.",
      ask: [
        "ZIP code?",
        "When do you need delivery? (today / this week)",
        "Are you authorized to approve under $15k now by card?"
      ]
    };

    const toSupplierContext = {
      pitch: "We have paid emergency jobs in your service area.",
      ask: [
        "Are you on 24/7 standby?",
        "Can you take flood/roof/HVAC emergency calls?",
        "We pay per dispatched job, not subscription."
      ]
    };

    let toBuyerDraft, toSupplierDraft;
    try {
      toBuyerDraft = await draftEmail(openaiKey, model, baseUrl, toBuyerContext);
    } catch (err) {
      toBuyerDraft = "[draft to buyer failed: "+err.message+"]";
    }
    try {
      toSupplierDraft = await draftEmail(openaiKey, model, baseUrl, toSupplierContext);
    } catch (err) {
      toSupplierDraft = "[draft to supplier failed: "+err.message+"]";
    }

    return {
      statusCode:200,
      headers:corsHeaders(),
      body:JSON.stringify({
        ok:true,
        outreach_enabled: settings.OUTREACH_ENABLED,
        sample_to_buyer: toBuyerDraft,
        sample_to_supplier: toSupplierDraft
      })
    };

  } catch (err) {
    return {
      statusCode:500,
      headers:corsHeaders(),
      body:JSON.stringify({ok:false, error:err.message})
    };
  }
};
