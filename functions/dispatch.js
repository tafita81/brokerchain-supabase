// dispatch.js v27.0 - COM SUPABASE
// Fecha dinheiro e registra Stripe + DocuSign com carimbo.
// Suporta tenants:
//   - emergency-dispatch-exchange (privado/comercial/residencial emergência física)
//   - federal-micro-purchase-fastlane (setor público / infra crítica até ~15k USD autorizado no cartão)
//   - solar-home-us (solar residencial/comercial pequeno correndo pra fechar antes do corte de crédito fiscal)
//   - global-sourcing-b2b (suprimento industrial / MRO / EPI / peças críticas que precisam chegar esta semana)
// Regras atuais de cobrança/ordem:
//   público (micro-purchase): DocuSign -> Stripe
//   privado/comercial/solar/b2b: Stripe -> DocuSign
// Se faltar autorização <15k, fornecedor, Stripe, ou DocuSign
// marcamos alert_pending no lead específico e seguimos com os outros.
// Nada trava o restante da pipeline.

const { getLeads, updateLeads, matchSupplierForLead, getSettings, corsHeaders } = require('./_supabase.js');
const { createCheckoutSession } = require('./_billing.js');
const { createDocusignEnvelope } = require('./_docusign.js');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode:200, headers:corsHeaders(), body:'' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode:405, headers:corsHeaders(), body:'Method Not Allowed' };
  }

  try {
    const settings = await getSettings();
    if (!settings.AUTO_DISPATCH_ENABLED) {
      return {
        statusCode:200,
        headers:corsHeaders(),
        body:JSON.stringify({ok:true, skipped:true, reason:"AUTO_DISPATCH_DISABLED"})
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

    // 1. autorização pública <15k exigida
    if (isFederal) {
      if (lead.authorized_under_15k !== true) {
        lead.status = "awaiting-authorization";
        lead.billing_block_reason = "authorization_missing_under_15k";
        lead.alert_pending = true;
        lead.alert_reason = (lead.alert_reason || "") + "|need_authorization_under_15k";
        alertsRaised++;
        continue;
      }
    }

    // 2. match fornecedor
    let sup = null;
    try {
      sup = await matchSupplierForLead(lead);
    } catch (err) {
      lead.alert_pending = true;
      lead.alert_reason = (lead.alert_reason || "") + "|matchSupplier_error";
      alertsRaised++;
    }

    if (!sup) {
      lead.alert_pending = true;
      lead.alert_reason = (lead.alert_reason || "") + "|no_supplier_available";
      alertsRaised++;
      // mantém como "new" pra tentar depois
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

    async function docusignThenStripe() {
      // DocuSign primeiro (público)
      if (settings.DOCUSIGN_ENABLED) {
        if (lead.contact_email && lead.contact_email.includes("@")) {
          try {
            const dsRes = await createDocusignEnvelope(lead);
            if (dsRes && dsRes.ok) {
              lead.docusign_envelope_id = dsRes.envelopeId;
              lead.docusign_created_utc = new Date().toISOString();
              docusignCount++;
            } else {
              lead.docusign_error = (dsRes && dsRes.error) || "docusign_create_failed";
              lead.alert_pending = true;
              lead.alert_reason = (lead.alert_reason || "") + "|docusign_create_failed";
              alertsRaised++;
            }
          } catch (err) {
            lead.docusign_error = "docusign_exception:"+err.message;
            lead.alert_pending = true;
            lead.alert_reason = (lead.alert_reason || "") + "|docusign_exception";
            alertsRaised++;
          }
        } else {
          lead.docusign_error = "no_valid_email_for_docusign";
          lead.alert_pending = true;
          lead.alert_reason = (lead.alert_reason || "") + "|no_valid_email_for_docusign";
          alertsRaised++;
        }
      }

      // Stripe depois
      if (settings.BILLING_ENABLED) {
        try {
          const baseAmount = (isFederal ? 1000 : 500);
          const desc = isFederal
            ? "Emergency parts under micro-purchase cap"
            : "Emergency field dispatch / mitigation";

          const checkoutRes = await createCheckoutSession(lead, baseAmount, desc);
          if (checkoutRes && checkoutRes.ok) {
            lead.stripe_checkout_url = checkoutRes.checkout_url;
            lead.stripe_session_id = checkoutRes.session_id;
            lead.stripe_created_utc = new Date().toISOString();
            checkoutCount++;
          } else {
            lead.stripe_error = (checkoutRes && checkoutRes.error) || "stripe_create_failed";
            lead.alert_pending = true;
            lead.alert_reason = (lead.alert_reason || "") + "|stripe_create_failed";
            alertsRaised++;
          }
        } catch (err) {
          lead.stripe_error = "stripe_exception:"+err.message;
          lead.alert_pending = true;
          lead.alert_reason = (lead.alert_reason || "") + "|stripe_exception";
          alertsRaised++;
        }
      }
    }

    async function stripeThenDocusign() {
      // Stripe primeiro (privado/comercial)
      if (settings.BILLING_ENABLED) {
        try {
          const baseAmount = (isFederal ? 1000 : 500);
          const desc = isFederal
            ? "Emergency parts under micro-purchase cap"
            : "Emergency field dispatch / mitigation";

          const checkoutRes = await createCheckoutSession(lead, baseAmount, desc);
          if (checkoutRes && checkoutRes.ok) {
            lead.stripe_checkout_url = checkoutRes.checkout_url;
            lead.stripe_session_id = checkoutRes.session_id;
            lead.stripe_created_utc = new Date().toISOString();
            checkoutCount++;
          } else {
            lead.stripe_error = (checkoutRes && checkoutRes.error) || "stripe_create_failed";
            lead.alert_pending = true;
            lead.alert_reason = (lead.alert_reason || "") + "|stripe_create_failed";
            alertsRaised++;
          }
        } catch (err) {
          lead.stripe_error = "stripe_exception:"+err.message;
          lead.alert_pending = true;
          lead.alert_reason = (lead.alert_reason || "") + "|stripe_exception";
          alertsRaised++;
        }
      }

      // DocuSign depois
      if (settings.DOCUSIGN_ENABLED) {
        if (lead.contact_email && lead.contact_email.includes("@")) {
          try {
            const dsRes = await createDocusignEnvelope(lead);
            if (dsRes && dsRes.ok) {
              lead.docusign_envelope_id = dsRes.envelopeId;
              lead.docusign_created_utc = new Date().toISOString();
              docusignCount++;
            } else {
              lead.docusign_error = (dsRes && dsRes.error) || "docusign_create_failed";
              lead.alert_pending = true;
              lead.alert_reason = (lead.alert_reason || "") + "|docusign_create_failed";
              alertsRaised++;
            }
          } catch (err) {
            lead.docusign_error = "docusign_exception:"+err.message;
            lead.alert_pending = true;
            lead.alert_reason = (lead.alert_reason || "") + "|docusign_exception";
            alertsRaised++;
          }
        } else {
          lead.docusign_error = "no_valid_email_for_docusign";
          lead.alert_pending = true;
          lead.alert_reason = (lead.alert_reason || "") + "|no_valid_email_for_docusign";
          alertsRaised++;
        }
      }
    }

    if (isFederal) {
      await docusignThenStripe();
    } else {
      await stripeThenDocusign();
    }
  }

  await updateLeads(leads);

  return {
    statusCode:200,
    headers:corsHeaders(),
    body:JSON.stringify({
      ok:true,
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
