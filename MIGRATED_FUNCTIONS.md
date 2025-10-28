# Funções Migradas para Supabase

Este arquivo contém as versões migradas das funções principais. 
Copie e cole cada função no arquivo correspondente em `functions/`.

---

## brain.js

```javascript
// brain.js v27.0 - COM SUPABASE
const { getLeads, updateLeads, getSettings, corsHeaders } = require('./_supabase.js');

function buildMissingQuestions(lead) {
  const qs = [];
  if (!lead.zip || lead.zip === "00000") {
    qs.push("Please confirm ZIP code for dispatch / delivery.");
  }
  if (lead.buyer_type === "public" && (lead.authorized_under_15k === "unknown" || lead.authorized_under_15k === undefined)) {
    qs.push("Are you authorized to approve under the micro-purchase threshold (under ~15k USD) on card right now?");
  }
  if (lead.tenant === "global-sourcing-b2b" && lead.buyer_type && lead.buyer_type.includes("private")) {
    qs.push("Can you pay via PO or corporate card for delivery this week?");
  }
  if (lead.tenant === "solar-home-us") {
    qs.push("Are you looking for rooftop solar, battery backup, or both?");
    qs.push("Are you ready to schedule site survey this week?");
  }
  return qs;
}

function shouldMarkSaleReady(lead) {
  if (lead.urgency === "1-2h" || lead.urgency === "today") return true;
  if (lead.tenant === "global-sourcing-b2b" && lead.urgency === "this-week") return true;
  return false;
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: 'Method Not Allowed' };
  }

  try {
    const settings = await getSettings();
    if (!settings.BRAIN_ENABLED) {
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: true, skipped: true, reason: "BRAIN_DISABLED" })
      };
    }

    const leads = await getLeads();
    const nowIso = new Date().toISOString();
    let updatedCount = 0;

    const updatedLeads = leads.map(lead => {
      lead.ai_missing_questions = buildMissingQuestions(lead);

      if (!lead.sale_ready && shouldMarkSaleReady(lead)) {
        lead.sale_ready = true;
        if (lead.status === "scraped" || !lead.status || lead.status === "pending") {
          lead.status = "new";
        }
        lead.promoted_utc = nowIso;
        updatedCount++;
      }

      return lead;
    });

    await updateLeads(updatedLeads);

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        ok: true,
        leads_promoted: updatedCount,
        total_leads: leads.length
      })
    };
  } catch (error) {
    console.error('Brain error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
```

---

## dispatch.js

```javascript
// dispatch.js v27.0 - COM SUPABASE
const { getLeads, updateLeads, getSuppliers, matchSupplierForLead, getSettings, corsHeaders } = require('./_supabase.js');
const { createCheckoutSession } = require('./_billing.js');
const { createDocusignEnvelope } = require('./_docusign.js');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: 'Method Not Allowed' };
  }

  try {
    const settings = await getSettings();
    if (!settings.AUTO_DISPATCH_ENABLED) {
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: true, skipped: true, reason: "AUTO_DISPATCH_DISABLED" })
      };
    }

    const leads = await getLeads({ sale_ready: true, status: "new" });
    
    let updatedCount = 0;
    let checkoutCount = 0;
    let docusignCount = 0;
    let alertsRaised = 0;

    for (let lead of leads) {
      const nowIso = new Date().toISOString();
      const isFederal = !!(lead.tenant && lead.tenant.includes("federal-micro-purchase-fastlane"));

      // 1. Validar autorização pública
      if (isFederal && lead.authorized_under_15k !== true) {
        lead.status = "awaiting-authorization";
        lead.billing_block_reason = "authorization_missing_under_15k";
        lead.alert_pending = true;
        lead.alert_reason = (lead.alert_reason || "") + "|need_authorization_under_15k";
        alertsRaised++;
        continue;
      }

      // 2. Match fornecedor
      const sup = await matchSupplierForLead(lead);
      
      if (!sup) {
        lead.alert_pending = true;
        lead.alert_reason = (lead.alert_reason || "") + "|no_supplier_available";
        alertsRaised++;
        continue;
      }

      lead.status = "pending-supplier";
      lead.assigned_supplier_id = sup.id;
      lead.assigned_supplier_contact = {
        business_name: sup.business_name || sup.name || "Supplier",
        email: sup.email || "",
        phone24h: sup.phone24h || sup.phone || "",
        billing_pref: sup.billing_pref || "card"
      };
      lead.dispatch_assigned_utc = nowIso;
      updatedCount++;

      // 3. Processar Stripe e DocuSign
      if (isFederal) {
        // DocuSign → Stripe
        if (settings.DOCUSIGN_ENABLED && lead.contact_email) {
          try {
            const dsRes = await createDocusignEnvelope(lead);
            if (dsRes && dsRes.ok) {
              lead.docusign_envelope_id = dsRes.envelopeId;
              lead.docusign_created_utc = nowIso;
              docusignCount++;
            }
          } catch (err) {
            lead.docusign_error = err.message;
            lead.alert_pending = true;
          }
        }

        if (settings.BILLING_ENABLED) {
          try {
            const checkoutRes = await createCheckoutSession(lead, 1000, "Emergency parts under micro-purchase cap");
            if (checkoutRes && checkoutRes.ok) {
              lead.stripe_checkout_url = checkoutRes.checkout_url;
              lead.stripe_session_id = checkoutRes.session_id;
              lead.stripe_created_utc = nowIso;
              checkoutCount++;
            }
          } catch (err) {
            lead.stripe_error = err.message;
            lead.alert_pending = true;
          }
        }
      } else {
        // Stripe → DocuSign
        if (settings.BILLING_ENABLED) {
          try {
            const checkoutRes = await createCheckoutSession(lead, 500, "Emergency field dispatch / mitigation");
            if (checkoutRes && checkoutRes.ok) {
              lead.stripe_checkout_url = checkoutRes.checkout_url;
              lead.stripe_session_id = checkoutRes.session_id;
              lead.stripe_created_utc = nowIso;
              checkoutCount++;
            }
          } catch (err) {
            lead.stripe_error = err.message;
            lead.alert_pending = true;
          }
        }

        if (settings.DOCUSIGN_ENABLED && lead.contact_email) {
          try {
            const dsRes = await createDocusignEnvelope(lead);
            if (dsRes && dsRes.ok) {
              lead.docusign_envelope_id = dsRes.envelopeId;
              lead.docusign_created_utc = nowIso;
              docusignCount++;
            }
          } catch (err) {
            lead.docusign_error = err.message;
            lead.alert_pending = true;
          }
        }
      }
    }

    await updateLeads(leads);

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        ok: true,
        updated_leads: updatedCount,
        stripe_sessions_created: checkoutCount,
        docusign_envelopes_created: docusignCount,
        alertsRaised
      })
    };
  } catch (error) {
    console.error('Dispatch error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
```

---

## settings.js

```javascript
// settings.js v27.0 - COM SUPABASE
const { getSettings, updateSetting, corsHeaders } = require('./_supabase.js');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  try {
    if (event.httpMethod === 'GET') {
      const settings = await getSettings();
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: true, settings })
      };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      
      // Atualizar múltiplas settings
      for (const [key, value] of Object.entries(body)) {
        await updateSetting(key, value);
      }
      
      const settings = await getSettings();
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: true, settings })
      };
    }

    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: 'Method Not Allowed'
    };
  } catch (error) {
    console.error('Settings error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
```

---

## buyers-all.js

```javascript
// buyers-all.js v27.0 - COM SUPABASE
const { getBuyers, corsHeaders } = require('./_supabase.js');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  try {
    const buyers = await getBuyers();
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: true, buyers })
    };
  } catch (error) {
    console.error('Buyers error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
```

---

## leads-all.js

```javascript
// leads-all.js v27.0 - COM SUPABASE
const { getLeads, corsHeaders } = require('./_supabase.js');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  try {
    const leads = await getLeads();
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: true, leads })
    };
  } catch (error) {
    console.error('Leads error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
```

---

## suppliers-all.js

```javascript
// suppliers-all.js v27.0 - COM SUPABASE
const { getSuppliers, corsHeaders } = require('./_supabase.js');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  try {
    const suppliers = await getSuppliers();
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: true, suppliers })
    };
  } catch (error) {
    console.error('Suppliers error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
```

---

## manual-lead.js

```javascript
// manual-lead.js v27.0 - COM SUPABASE
const { createLead, corsHeaders } = require('./_supabase.js');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    
    const lead = {
      buyer_type: body.buyer_type || 'public',
      state: body.state || '?',
      urgency: body.urgency || 'unknown',
      tenant: body.tenant || 'federal-micro-purchase-fastlane',
      authorized_under_15k: !!body.authorized_under_15k,
      contact_email: body.contact_email || '',
      contact_phone: body.contact_phone || '',
      title: body.title || '',
      body: body.need || body.body || '',
      need: body.need || '',
      category: body.category || 'general',
      zip: body.zip || '00000',
      source_channel: 'manual',
      status: 'scraped',
      sale_ready: false
    };

    const created = await createLead(lead);
    
    if (created) {
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: true, lead: created })
      };
    } else {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: false, error: 'Failed to create lead (duplicate?)' })
      };
    }
  } catch (error) {
    console.error('Manual lead error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
```

---

## scrape-suppliers.js

```javascript
// scrape-suppliers.js v27.0 - COM SUPABASE
const { createSupplier, getSettings, corsHeaders } = require('./_supabase.js');

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"
];

function buildSuppliersForState(state) {
  return [
    {
      name: `Emergency Roof Repair ${state}`,
      business_name: `${state} Roofing Emergency Services LLC`,
      state,
      categories: ["roofing-emergency"],
      email: `roof-${state.toLowerCase()}@example.com`,
      phone24h: `+1-555-ROOF-${state}`,
      billing_pref: "card"
    },
    {
      name: `24/7 HVAC Critical ${state}`,
      business_name: `${state} HVAC Emergency Response`,
      state,
      categories: ["hvac-failure"],
      email: `hvac-${state.toLowerCase()}@example.com`,
      phone24h: `+1-555-HVAC-${state}`,
      billing_pref: "card"
    },
    {
      name: `Flood Pump & Water Mitigation ${state}`,
      business_name: `${state} Water Emergency Services`,
      state,
      categories: ["water-mitigation"],
      email: `water-${state.toLowerCase()}@example.com`,
      phone24h: `+1-555-WATR-${state}`,
      billing_pref: "card"
    },
    {
      name: `Generator Rental ${state}`,
      business_name: `${state} Power Solutions`,
      state,
      categories: ["power-generation"],
      email: `power-${state.toLowerCase()}@example.com`,
      phone24h: `+1-555-POWR-${state}`,
      billing_pref: "card"
    },
    {
      name: `Solar Install Fast Close ${state}`,
      business_name: `${state} Solar & Battery Experts`,
      state,
      categories: ["solar-install"],
      email: `solar-${state.toLowerCase()}@example.com`,
      phone24h: `+1-555-SOLR-${state}`,
      billing_pref: "card"
    },
    {
      name: `Industrial MRO Supply ${state}`,
      business_name: `${state} Industrial Supply Desk`,
      state,
      categories: ["industrial-supply", "ppe-bulk", "mro-parts"],
      email: `mro-${state.toLowerCase()}@example.com`,
      phone24h: `+1-555-MRO-${state}`,
      billing_pref: "card"
    }
  ];
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: 'Method Not Allowed' };
  }

  try {
    const settings = await getSettings();
    if (!settings.SCRAPER_ENABLED) {
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: true, skipped: true, reason: "SCRAPER_DISABLED" })
      };
    }

    let totalCreated = 0;

    for (const state of US_STATES) {
      const suppliers = buildSuppliersForState(state);
      
      for (const sup of suppliers) {
        const created = await createSupplier(sup);
        if (created) totalCreated++;
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        ok: true,
        states_processed: US_STATES.length,
        suppliers_created: totalCreated
      })
    };
  } catch (error) {
    console.error('Scrape suppliers error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
```

---

## INSTRUÇÕES DE USO

1. Abra cada arquivo em `functions/` mencionado acima
2. Substitua o conteúdo completo pelo código fornecido
3. Salve o arquivo
4. Repita para todos os arquivos listados

Ou use o comando:

```bash
cd /home/ubuntu/brokerchain-supabase
# Copiar cada função manualmente ou usar script automatizado
```
